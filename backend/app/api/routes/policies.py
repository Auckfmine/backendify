from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas import PolicyCreate, PolicyOut, PolicyUpdate
from app.services.collections import get_collection
from app.services.policy_service import (
    create_policy,
    delete_policy,
    get_policy,
    list_policies,
    update_policy,
)

router = APIRouter()


@router.post("", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
def create_policy_endpoint(
    collection_name: str,
    payload: PolicyCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    return create_policy(
        db,
        collection,
        name=payload.name,
        action=payload.action,
        effect=payload.effect,
        condition_json=payload.condition_json,
        priority=payload.priority,
        allowed_principals=payload.allowed_principals,
        require_email_verified=payload.require_email_verified,
        allowed_roles=payload.allowed_roles,
    )


@router.get("", response_model=list[PolicyOut])
def list_policies_endpoint(
    collection_name: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    return list_policies(db, collection)


@router.get("/{policy_id}", response_model=PolicyOut)
def get_policy_endpoint(
    collection_name: str,
    policy_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    return get_policy(db, collection, policy_id)


@router.patch("/{policy_id}", response_model=PolicyOut)
def update_policy_endpoint(
    collection_name: str,
    policy_id: str,
    payload: PolicyUpdate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    policy = get_policy(db, collection, policy_id)
    return update_policy(
        db,
        policy,
        name=payload.name,
        effect=payload.effect,
        condition_json=payload.condition_json,
        priority=payload.priority,
        is_active=payload.is_active,
        allowed_principals=payload.allowed_principals,
        require_email_verified=payload.require_email_verified,
        allowed_roles=payload.allowed_roles,
    )


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy_endpoint(
    collection_name: str,
    policy_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    collection = get_collection(db, project, collection_name)
    policy = get_policy(db, collection, policy_id)
    delete_policy(db, policy)
