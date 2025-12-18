from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut
from app.services.api_keys import create_api_key, list_api_keys, revoke_api_key

router = APIRouter()


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key_endpoint(
    payload: ApiKeyCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    api_key, plaintext = create_api_key(db, project, payload.name)
    return ApiKeyCreated(id=api_key.id, name=api_key.name, prefix=api_key.prefix, api_key=plaintext)


@router.get("", response_model=list[ApiKeyOut])
def list_api_keys_endpoint(project=Depends(deps.get_project_member), db: Session = Depends(deps.get_db)):
    return list_api_keys(db, project)


@router.post("/{api_key_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key_endpoint(
    api_key_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    revoke_api_key(db, project, api_key_id)
    return None
