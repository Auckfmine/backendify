"""
Simple in-memory rate limiter for auth endpoints.

For production, consider using Redis-backed rate limiting.
"""
import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock
from typing import Optional

from fastapi import HTTPException, Request, status


@dataclass
class RateLimitConfig:
    """Rate limit configuration."""
    requests: int  # Number of requests allowed
    window_seconds: int  # Time window in seconds


# Default rate limits for different endpoints
RATE_LIMITS = {
    "login": RateLimitConfig(requests=5, window_seconds=60),  # 5 per minute
    "register": RateLimitConfig(requests=3, window_seconds=60),  # 3 per minute
    "otp_send": RateLimitConfig(requests=3, window_seconds=300),  # 3 per 5 minutes
    "password_reset": RateLimitConfig(requests=3, window_seconds=300),  # 3 per 5 minutes
    "refresh": RateLimitConfig(requests=30, window_seconds=60),  # 30 per minute
}


class RateLimiter:
    """Simple in-memory rate limiter using sliding window."""
    
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()
        self._enabled = True
    
    def reset(self) -> None:
        """Reset all rate limit counters. Useful for testing."""
        with self._lock:
            self._requests.clear()
    
    def disable(self) -> None:
        """Disable rate limiting. Useful for testing."""
        self._enabled = False
    
    def enable(self) -> None:
        """Enable rate limiting."""
        self._enabled = True
    
    def _get_key(self, endpoint: str, identifier: str) -> str:
        """Generate a unique key for rate limiting."""
        return f"{endpoint}:{identifier}"
    
    def _cleanup_old_requests(self, key: str, window_seconds: int) -> None:
        """Remove requests outside the current window."""
        now = time.time()
        cutoff = now - window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
    
    def check_rate_limit(
        self,
        endpoint: str,
        identifier: str,
        config: Optional[RateLimitConfig] = None,
    ) -> bool:
        """
        Check if a request is allowed under the rate limit.
        
        Args:
            endpoint: The endpoint being accessed (e.g., "login", "register")
            identifier: Unique identifier (e.g., IP address, email)
            config: Optional custom rate limit config
        
        Returns:
            True if request is allowed, False if rate limited
        """
        if not self._enabled:
            return True
        
        if config is None:
            config = RATE_LIMITS.get(endpoint)
            if config is None:
                return True  # No rate limit configured
        
        key = self._get_key(endpoint, identifier)
        
        with self._lock:
            self._cleanup_old_requests(key, config.window_seconds)
            
            if len(self._requests[key]) >= config.requests:
                return False
            
            self._requests[key].append(time.time())
            return True
    
    def get_remaining(
        self,
        endpoint: str,
        identifier: str,
        config: Optional[RateLimitConfig] = None,
    ) -> tuple[int, int]:
        """
        Get remaining requests and reset time.
        
        Returns:
            (remaining_requests, seconds_until_reset)
        """
        if config is None:
            config = RATE_LIMITS.get(endpoint)
            if config is None:
                return (999, 0)
        
        key = self._get_key(endpoint, identifier)
        
        with self._lock:
            self._cleanup_old_requests(key, config.window_seconds)
            remaining = max(0, config.requests - len(self._requests[key]))
            
            if self._requests[key]:
                oldest = min(self._requests[key])
                reset_in = int(oldest + config.window_seconds - time.time())
            else:
                reset_in = 0
            
            return (remaining, max(0, reset_in))


# Global rate limiter instance
rate_limiter = RateLimiter()


def check_rate_limit(
    request: Request,
    endpoint: str,
    identifier: Optional[str] = None,
) -> None:
    """
    Check rate limit and raise HTTPException if exceeded.
    
    Args:
        request: FastAPI request object
        endpoint: The endpoint being accessed
        identifier: Optional identifier (defaults to client IP)
    
    Raises:
        HTTPException: 429 Too Many Requests if rate limit exceeded
    """
    if identifier is None:
        identifier = request.client.host if request.client else "unknown"
    
    if not rate_limiter.check_rate_limit(endpoint, identifier):
        remaining, reset_in = rate_limiter.get_remaining(endpoint, identifier)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {reset_in} seconds.",
            headers={
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(reset_in),
                "Retry-After": str(reset_in),
            },
        )


def rate_limit_by_ip(endpoint: str):
    """Dependency to rate limit by IP address."""
    def dependency(request: Request) -> None:
        check_rate_limit(request, endpoint)
    return dependency


def rate_limit_by_email(endpoint: str):
    """Dependency factory to rate limit by email (must be called with email)."""
    def check(request: Request, email: str) -> None:
        # Rate limit by both IP and email
        ip = request.client.host if request.client else "unknown"
        check_rate_limit(request, endpoint, identifier=ip)
        check_rate_limit(request, endpoint, identifier=f"email:{email.lower()}")
    return check
