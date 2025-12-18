from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Backendify BaaS",
    version="0.1.0",
    description="Backend as a Service with multi-tenant app user authentication",
)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# CORS middleware
origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in origins] if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"ok": True}


@app.get("/")
def root():
    return {
        "name": "Backendify BaaS",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


app.include_router(api_router)
