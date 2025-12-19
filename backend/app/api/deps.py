from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.project import Project
from app.models.user import User
from app.services.api_keys import authenticate_api_key
from app.services.auth import decode_access_token
from app.services.projects import get_project_for_user
from app.services.app_user_service import AppUserRecord

bearer_scheme = HTTPBearer(auto_error=False)


# ============================================================================
# Principal Types for unified auth context
# ============================================================================

@dataclass
class Principal:
    """Unified auth context for all request types."""
    type: str  # "admin_user", "app_user", "api_key", "anonymous"
    admin_user: Optional[User] = None
    app_user: Optional[AppUserRecord] = None
    api_key: Optional[ApiKey] = None
    project_id: Optional[str] = None
    
    @property
    def is_authenticated(self) -> bool:
        return self.type != "anonymous"
    
    @property
    def user_id(self) -> Optional[str]:
        if self.admin_user:
            return self.admin_user.id
        if self.app_user:
            return self.app_user.id
        return None
    
    @property
    def email(self) -> Optional[str]:
        if self.admin_user:
            return self.admin_user.email
        if self.app_user:
            return self.app_user.email
        return None
    
    @property
    def is_email_verified(self) -> bool:
        if self.app_user:
            return self.app_user.is_email_verified
        # Admin users are always considered verified
        if self.admin_user:
            return True
        return False


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_or_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, convert_underscores=False, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> tuple[User | None, ApiKey | None]:
    if credentials is not None:
        return get_current_user(credentials=credentials, db=db), None
    if x_api_key:
        api_key = authenticate_api_key(db, x_api_key)
        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        return None, api_key
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def get_principal(
    project_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, convert_underscores=False, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Principal:
    """
    Unified principal resolver for all auth types.
    Returns a Principal object identifying the request context.
    """
    from app.services.app_auth import decode_app_user_access_token, APP_USER_TOKEN_TYPE
    from app.services.app_user_service import get_app_user_by_id
    from jose import jwt, JWTError
    
    # Try Bearer token first
    if credentials is not None:
        token = credentials.credentials
        try:
            # Peek at token to determine type
            unverified = jwt.get_unverified_claims(token)
            token_type = unverified.get("type")
            
            if token_type == APP_USER_TOKEN_TYPE:
                # App user token - get from _users collection
                app_user_id = decode_app_user_access_token(token, project_id)
                app_user = get_app_user_by_id(db, project_id, app_user_id)
                if app_user and not app_user.is_disabled:
                    return Principal(
                        type="app_user",
                        app_user=app_user,
                        project_id=project_id,
                    )
            else:
                # Admin user token
                user_id = decode_access_token(token)
                user = db.get(User, user_id)
                if user:
                    return Principal(
                        type="admin_user",
                        admin_user=user,
                        project_id=project_id,
                    )
        except (JWTError, HTTPException):
            pass
    
    # Try API key
    if x_api_key:
        api_key = authenticate_api_key(db, x_api_key)
        if api_key and api_key.project_id == project_id:
            return Principal(
                type="api_key",
                api_key=api_key,
                project_id=project_id,
            )
    
    # Anonymous
    return Principal(type="anonymous", project_id=project_id)


def require_principal(
    allowed_types: list[str],
    require_email_verified: bool = False,
):
    """
    Dependency factory to require specific principal types.
    Usage: Depends(require_principal(["app_user", "api_key"]))
    """
    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.type not in allowed_types:
            if principal.type == "anonymous":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for principal type: {principal.type}"
            )
        
        if require_email_verified and not principal.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required"
            )
        
        return principal
    
    return dependency


def get_project_member(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    return get_project_for_user(db, current_user, project_id)


def get_project_public(
    project_id: str,
    db: Session = Depends(get_db),
) -> Project:
    """Get a project by ID without requiring admin auth (for app user endpoints)."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
