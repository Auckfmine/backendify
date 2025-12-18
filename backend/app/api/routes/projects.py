from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas import ProjectCreate, ProjectOut
from app.services.projects import create_project, get_project_for_user, list_projects_for_user

router = APIRouter()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(
    payload: ProjectCreate,
    current_user=Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
):
    project = create_project(db, owner=current_user, name=payload.name)
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(current_user=Depends(deps.get_current_user), db: Session = Depends(deps.get_db)):
    return list_projects_for_user(db, current_user)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project_endpoint(
    project_id: str,
    current_user=Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
):
    return get_project_for_user(db, current_user, project_id)
