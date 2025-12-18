from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


def _get_refresh_expiry() -> datetime:
    return datetime.now(tz=timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    refresh_token = generate_refresh_token()
    token_hash = hash_token(refresh_token)
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        revoked=False,
        expires_at=_get_refresh_expiry(),
    )
    db.add(db_token)
    db.commit()
    return access_token, refresh_token


def register_user(db: Session, email: str, password: str) -> tuple[User, str, str]:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")
    user = User(email=email, password_hash=get_password_hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    access_token, refresh_token = issue_tokens(db, user)
    return user, access_token, refresh_token


def login_user(db: Session, email: str, password: str) -> tuple[User, str, str]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token, refresh_token = issue_tokens(db, user)
    return user, access_token, refresh_token


def refresh_tokens(db: Session, refresh_token: str) -> tuple[User, str, str]:
    token_hash = hash_token(refresh_token)
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked.is_(False))
        .first()
    )
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    now = datetime.now(tz=timezone.utc)
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    db_token.revoked = True
    db.commit()
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return user, *issue_tokens(db, user)


def logout_refresh_token(db: Session, refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not db_token:
        return
    db_token.revoked = True
    db.commit()


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        sub: str | None = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return sub
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
