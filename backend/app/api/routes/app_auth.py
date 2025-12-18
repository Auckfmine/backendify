"""
App User Authentication Routes

Project-scoped authentication endpoints for end-users of customer apps.
"""
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.rate_limit import check_rate_limit
from app.models.project import Project
from app.models.app_user import AppUser, ProjectAuthSettings
from app.schemas.app_auth import (
    AppUserRegisterIn,
    AppUserLoginIn,
    AppUserRefreshIn,
    AppUserTokenPair,
    AppUserMeOut,
    AuthProvidersOut,
    AuthSettingsOut,
    AuthSettingsUpdate,
    PasswordChangeIn,
)
from app.services import app_auth

router = APIRouter()


def get_client_info(request: Request) -> tuple[str | None, str | None]:
    """Extract client IP and user agent from request."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip, user_agent


def get_current_app_user(
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
    authorization: str = Header(...),
) -> AppUser:
    """Dependency to get the current authenticated app user."""
    if not authorization.startswith("Bearer "):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization[7:]  # Remove "Bearer " prefix
    app_user_id = app_auth.decode_app_user_access_token(token, project.id)
    
    app_user = app_auth.get_app_user_by_id(db, project.id, app_user_id)
    if not app_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="User not found")
    
    if app_user.is_disabled:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="User account is disabled")
    
    return app_user


# ============================================================================
# Public endpoints (no auth required)
# ============================================================================

@router.get("/providers", response_model=AuthProvidersOut)
def get_auth_providers(
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Get enabled authentication providers for this project."""
    providers = app_auth.get_auth_providers(db, project.id)
    return AuthProvidersOut(**providers)


@router.post("/register", response_model=AppUserTokenPair, status_code=status.HTTP_201_CREATED)
def register(
    payload: AppUserRegisterIn,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Register a new app user."""
    # Rate limit by IP
    check_rate_limit(request, "register")
    
    ip, user_agent = get_client_info(request)
    _, access_token, refresh_token, expires_in = app_auth.register_app_user(
        db, project, payload.email, payload.password, ip, user_agent
    )
    return AppUserTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/login", response_model=AppUserTokenPair)
def login(
    payload: AppUserLoginIn,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Login an app user."""
    # Rate limit by IP and email
    check_rate_limit(request, "login")
    check_rate_limit(request, "login", identifier=f"email:{payload.email.lower()}")
    
    ip, user_agent = get_client_info(request)
    _, access_token, refresh_token, expires_in = app_auth.login_app_user(
        db, project, payload.email, payload.password, ip, user_agent
    )
    return AppUserTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/refresh", response_model=AppUserTokenPair)
def refresh(
    payload: AppUserRefreshIn,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Refresh tokens (with rotation)."""
    ip, user_agent = get_client_info(request)
    _, access_token, refresh_token, expires_in = app_auth.refresh_app_user_tokens(
        db, project, payload.refresh_token, ip, user_agent
    )
    return AppUserTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: AppUserRefreshIn,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Logout (revoke refresh token)."""
    ip, user_agent = get_client_info(request)
    app_auth.logout_app_user(db, project, payload.refresh_token, ip, user_agent)
    return None


# ============================================================================
# Authenticated endpoints (app user token required)
# ============================================================================

@router.get("/me", response_model=AppUserMeOut)
def get_me(
    app_user: AppUser = Depends(get_current_app_user),
):
    """Get current app user info."""
    return AppUserMeOut(
        id=app_user.id,
        email=app_user.email,
        is_email_verified=app_user.is_email_verified,
    )


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChangeIn,
    request: Request,
    app_user: AppUser = Depends(get_current_app_user),
    db: Session = Depends(deps.get_db),
):
    """Change password for the current app user."""
    ip, user_agent = get_client_info(request)
    app_auth.change_app_user_password(
        db, app_user, payload.current_password, payload.new_password, ip, user_agent
    )
    return None


@router.post("/logout/all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all_sessions(
    request: Request,
    app_user: AppUser = Depends(get_current_app_user),
    db: Session = Depends(deps.get_db),
):
    """Logout from all sessions (revoke all refresh tokens)."""
    ip, user_agent = get_client_info(request)
    app_auth.logout_all_app_user_sessions(db, app_user, ip, user_agent)
    return None


# ============================================================================
# Email Verification
# ============================================================================

@router.post("/verify/send", status_code=status.HTTP_200_OK)
def send_verification_email(
    app_user: AppUser = Depends(get_current_app_user),
    db: Session = Depends(deps.get_db),
):
    """
    Send email verification token.
    Note: In production, this would send an email. For now, returns the token directly.
    """
    if app_user.is_email_verified:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email already verified")
    
    token = app_auth.create_email_verification_token(db, app_user)
    
    # In production: send email with token/link
    # For now, return token directly for testing
    return {
        "message": "Verification email sent",
        "token": token,  # Remove in production - only for testing
    }


@router.post("/verify/confirm", status_code=status.HTTP_200_OK)
def confirm_email_verification(
    token: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Confirm email verification with token."""
    ip, user_agent = get_client_info(request)
    app_user = app_auth.verify_email_token(db, project.id, token, ip, user_agent)
    return {"message": "Email verified successfully", "email": app_user.email}


# ============================================================================
# Password Reset
# ============================================================================

@router.post("/password/reset/send", status_code=status.HTTP_200_OK)
def send_password_reset(
    email: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """
    Send password reset token.
    Note: Always returns success to prevent email enumeration.
    In production, this would send an email only if user exists.
    """
    # Rate limit by IP and email
    check_rate_limit(request, "password_reset")
    check_rate_limit(request, "password_reset", identifier=f"email:{email.lower()}")
    
    token = app_auth.create_password_reset_token(db, project, email)
    
    # In production: send email with token/link if token is not None
    # For now, return token directly for testing (only if user exists)
    response = {"message": "If the email exists, a reset link has been sent"}
    if token:
        response["token"] = token  # Remove in production - only for testing
    
    return response


@router.post("/password/reset/confirm", status_code=status.HTTP_200_OK)
def confirm_password_reset(
    token: str,
    new_password: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Reset password using reset token."""
    ip, user_agent = get_client_info(request)
    app_auth.reset_password_with_token(db, project.id, token, new_password, ip, user_agent)
    return {"message": "Password reset successfully"}


# ============================================================================
# OTP / Magic Link Login
# ============================================================================

@router.post("/otp/send", status_code=status.HTTP_200_OK)
def send_otp(
    email: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """
    Send OTP code for passwordless login.
    Note: In production, this would send an email/SMS. For now, returns the code directly.
    """
    # Rate limit by IP and email (strict for OTP)
    check_rate_limit(request, "otp_send")
    check_rate_limit(request, "otp_send", identifier=f"email:{email.lower()}")
    
    code = app_auth.send_otp_code(db, project, email, purpose="login")
    
    response = {"message": "If the email exists, an OTP code has been sent"}
    if code:
        response["code"] = code  # Remove in production - only for testing
    
    return response


@router.post("/otp/verify", response_model=AppUserTokenPair)
def verify_otp(
    email: str,
    code: str,
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """Verify OTP code and get tokens."""
    ip, user_agent = get_client_info(request)
    _, access_token, refresh_token, expires_in = app_auth.verify_otp_code(
        db, project, email, code, purpose="login", ip_address=ip, user_agent=user_agent
    )
    return AppUserTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


# ============================================================================
# OAuth Login (Google, GitHub)
# ============================================================================

@router.post("/oauth/callback", response_model=AppUserTokenPair)
def oauth_callback(
    provider: str,
    provider_user_id: str,
    email: str = None,
    request: Request = None,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """
    Handle OAuth callback with provider user info.
    
    In a real implementation, this would:
    1. Exchange the authorization code for tokens
    2. Fetch user info from the provider
    3. Call this endpoint with the provider user info
    
    For testing/development, this endpoint accepts provider info directly.
    """
    ip, user_agent = get_client_info(request) if request else (None, None)
    _, access_token, refresh_token, expires_in = app_auth.oauth_login_or_register(
        db, project, provider, provider_user_id, email, ip, user_agent
    )
    return AppUserTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.get("/oauth/{provider}/url")
def get_oauth_url(
    provider: str,
    redirect_uri: str,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """
    Get OAuth authorization URL for a provider.
    
    Note: This requires OAuth client credentials to be configured.
    Returns the URL to redirect the user to for OAuth authorization.
    """
    from app.models.app_user import ProjectAuthSettings
    
    auth_settings = db.query(ProjectAuthSettings).filter(
        ProjectAuthSettings.project_id == project.id
    ).first()
    
    if not auth_settings:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Auth settings not configured")
    
    # Generate state token
    state = app_auth.get_oauth_state_token(project.id, provider, redirect_uri)
    
    if provider == "google":
        if not auth_settings.enable_oauth_google:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Google OAuth not enabled")
        
        # Google OAuth URL (client_id would come from project settings in production)
        # For now, return a placeholder
        return {
            "provider": "google",
            "auth_url": f"https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri={redirect_uri}&response_type=code&scope=email%20profile&state={state}",
            "state": state,
            "note": "Replace YOUR_CLIENT_ID with actual Google OAuth client ID"
        }
    
    elif provider == "github":
        if not auth_settings.enable_oauth_github:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="GitHub OAuth not enabled")
        
        # GitHub OAuth URL
        return {
            "provider": "github",
            "auth_url": f"https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri={redirect_uri}&scope=user:email&state={state}",
            "state": state,
            "note": "Replace YOUR_CLIENT_ID with actual GitHub OAuth client ID"
        }
    
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown OAuth provider: {provider}")


# ============================================================================
# Meta / Documentation endpoint
# ============================================================================

@router.get("/meta")
def get_auth_meta(
    request: Request,
    project: Project = Depends(deps.get_project_public),
    db: Session = Depends(deps.get_db),
):
    """
    Get self-documenting API information for app user authentication.
    Returns enabled providers, endpoints, schemas, and usage examples.
    """
    # Get auth settings
    auth_settings = db.query(ProjectAuthSettings).filter(
        ProjectAuthSettings.project_id == project.id
    ).first()
    
    if not auth_settings:
        auth_settings = ProjectAuthSettings(project_id=project.id)
        db.add(auth_settings)
        db.commit()
        db.refresh(auth_settings)
    
    base_url = str(request.base_url).rstrip("/")
    auth_base = f"{base_url}/api/projects/{project.id}/auth"
    
    # Build endpoints list based on enabled providers
    endpoints = []
    
    # Always available
    endpoints.append({
        "name": "Get Providers",
        "method": "GET",
        "url": f"{auth_base}/providers",
        "description": "Get enabled authentication providers",
        "auth_required": False,
    })
    
    if auth_settings.enable_email_password:
        endpoints.extend([
            {
                "name": "Register",
                "method": "POST",
                "url": f"{auth_base}/register",
                "description": "Register a new user with email and password",
                "auth_required": False,
                "request_body": {
                    "email": "string (required)",
                    "password": "string (required, min 8 chars)",
                },
            },
            {
                "name": "Login",
                "method": "POST",
                "url": f"{auth_base}/login",
                "description": "Login with email and password",
                "auth_required": False,
                "request_body": {
                    "email": "string (required)",
                    "password": "string (required)",
                },
            },
        ])
    
    endpoints.extend([
        {
            "name": "Refresh Tokens",
            "method": "POST",
            "url": f"{auth_base}/refresh",
            "description": "Refresh access token using refresh token (with rotation)",
            "auth_required": False,
            "request_body": {
                "refresh_token": "string (required)",
            },
        },
        {
            "name": "Logout",
            "method": "POST",
            "url": f"{auth_base}/logout",
            "description": "Revoke a refresh token",
            "auth_required": False,
            "request_body": {
                "refresh_token": "string (required)",
            },
        },
        {
            "name": "Get Current User",
            "method": "GET",
            "url": f"{auth_base}/me",
            "description": "Get current authenticated user info",
            "auth_required": True,
        },
        {
            "name": "Change Password",
            "method": "POST",
            "url": f"{auth_base}/password/change",
            "description": "Change password for current user",
            "auth_required": True,
            "request_body": {
                "current_password": "string (required)",
                "new_password": "string (required, min 8 chars)",
            },
        },
        {
            "name": "Logout All Sessions",
            "method": "POST",
            "url": f"{auth_base}/logout/all",
            "description": "Revoke all refresh tokens for current user",
            "auth_required": True,
        },
    ])
    
    # Response schemas
    token_response = {
        "access_token": "string (JWT)",
        "refresh_token": "string (opaque)",
        "token_type": "bearer",
        "expires_in": "number (seconds until access token expires)",
    }
    
    user_response = {
        "id": "string (UUID)",
        "email": "string",
        "is_email_verified": "boolean",
    }
    
    # Examples
    examples = {
        "curl": {
            "register": f'''curl -X POST "{auth_base}/register" \\
  -H "Content-Type: application/json" \\
  -d '{{"email": "user@example.com", "password": "securepassword"}}\'''',
            "login": f'''curl -X POST "{auth_base}/login" \\
  -H "Content-Type: application/json" \\
  -d '{{"email": "user@example.com", "password": "securepassword"}}\'''',
            "refresh": f'''curl -X POST "{auth_base}/refresh" \\
  -H "Content-Type: application/json" \\
  -d '{{"refresh_token": "YOUR_REFRESH_TOKEN"}}\'''',
            "me": f'''curl -X GET "{auth_base}/me" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"''',
        },
        "fetch": {
            "register": f'''const response = await fetch("{auth_base}/register", {{
  method: "POST",
  headers: {{ "Content-Type": "application/json" }},
  body: JSON.stringify({{ email: "user@example.com", password: "securepassword" }})
}});
const {{ access_token, refresh_token }} = await response.json();''',
            "login": f'''const response = await fetch("{auth_base}/login", {{
  method: "POST",
  headers: {{ "Content-Type": "application/json" }},
  body: JSON.stringify({{ email: "user@example.com", password: "securepassword" }})
}});
const {{ access_token, refresh_token }} = await response.json();''',
            "me": f'''const response = await fetch("{auth_base}/me", {{
  headers: {{ "Authorization": `Bearer ${{access_token}}` }}
}});
const user = await response.json();''',
        },
    }
    
    return {
        "project_id": project.id,
        "project_name": project.name,
        "providers": {
            "email_password": auth_settings.enable_email_password,
            "magic_link": auth_settings.enable_magic_link,
            "otp": auth_settings.enable_otp,
            "oauth_google": auth_settings.enable_oauth_google,
            "oauth_github": auth_settings.enable_oauth_github,
        },
        "settings": {
            "session_mode": auth_settings.session_mode,
            "allow_public_signup": auth_settings.allow_public_signup,
            "require_email_verification": auth_settings.require_email_verification,
            "access_token_ttl_minutes": auth_settings.access_ttl_minutes,
            "refresh_token_ttl_days": auth_settings.refresh_ttl_days,
        },
        "auth": {
            "type": "Bearer token",
            "header": "Authorization: Bearer <access_token>",
            "note": "Include access token in Authorization header for authenticated endpoints",
        },
        "endpoints": endpoints,
        "response_schemas": {
            "token_pair": token_response,
            "user": user_response,
        },
        "examples": examples,
        "error_codes": {
            "400": "Bad request - invalid input or auth method not enabled",
            "401": "Unauthorized - invalid credentials or token",
            "403": "Forbidden - account disabled or email not verified",
            "409": "Conflict - user already exists",
            "422": "Validation error - check request body",
        },
    }
