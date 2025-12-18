from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.schemas import CollectionCreate, CollectionOut, FieldCreate, FieldOut
from app.services.collections import (
    add_field,
    create_collection,
    get_collection,
    list_collections,
    list_fields,
)

router = APIRouter()


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection_endpoint(
    payload: CollectionCreate,
    project=Depends(deps.get_project_member),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
):
    return create_collection(
        db,
        project,
        name=payload.name,
        display_name=payload.display_name,
        actor_user_id=current_user.id,
    )


@router.get("", response_model=list[CollectionOut])
def list_collections_endpoint(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    return list_collections(db, project)


@router.get("/{collection_name}", response_model=CollectionOut)
def get_collection_endpoint(
    collection_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    return get_collection(db, project, collection_name)


@router.post("/{collection_name}/fields", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def add_field_endpoint(
    collection_name: str,
    payload: FieldCreate,
    project=Depends(deps.get_project_member),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    return add_field(
        db,
        project,
        collection,
        name=payload.name,
        display_name=payload.display_name,
        field_type=payload.field_type,
        is_required=payload.is_required,
        is_unique=payload.is_unique,
        is_indexed=payload.is_indexed,
        default_value=payload.default_value,
        actor_user_id=current_user.id,
    )


@router.get("/{collection_name}/fields", response_model=list[FieldOut])
def list_fields_endpoint(
    collection_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    return list_fields(db, collection)
