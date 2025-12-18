import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import generate_api_key, hash_token
from app.models.api_key import ApiKey
from app.models.project import Project


def create_api_key(db: Session, project: Project, name: str) -> tuple[ApiKey, str]:
    plaintext = generate_api_key()
    prefix = plaintext[:8]
    key_hash = hash_token(plaintext)
    api_key = ApiKey(project_id=project.id, name=name, prefix=prefix, key_hash=key_hash, revoked=False)
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key, plaintext


def list_api_keys(db: Session, project: Project) -> list[ApiKey]:
    return db.query(ApiKey).filter(ApiKey.project_id == project.id).all()


def revoke_api_key(db: Session, project: Project, api_key_id: str) -> None:
    api_key = db.query(ApiKey).filter(ApiKey.id == api_key_id, ApiKey.project_id == project.id).first()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    api_key.revoked = True
    db.commit()


def authenticate_api_key(db: Session, token: str) -> ApiKey | None:
    prefix = token[:8]
    key_hash = hash_token(token)
    candidate = (
        db.query(ApiKey)
        .filter(ApiKey.prefix == prefix, ApiKey.revoked.is_(False))
        .first()
    )
    if candidate and secrets.compare_digest(candidate.key_hash, key_hash):
        return candidate
    return None
