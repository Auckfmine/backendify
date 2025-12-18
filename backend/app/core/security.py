import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import bcrypt
from jose import jwt

from app.core.config import settings


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_bcrypt_safe_password(plain_password), password_hash.encode("utf-8"))


def get_password_hash(password: str) -> str:
    hashed = bcrypt.hashpw(_bcrypt_safe_password(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def _bcrypt_safe_password(password: str) -> bytes:
    # bcrypt limits input to 72 bytes; truncate to avoid ValueError on longer secrets
    return password.encode("utf-8")[:72]


def _expires_in(minutes: int) -> datetime:
    return datetime.now(tz=timezone.utc) + timedelta(minutes=minutes)


def create_access_token(subject: str) -> str:
    expire = _expires_in(settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode: Dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    return secrets.token_urlsafe(48)
