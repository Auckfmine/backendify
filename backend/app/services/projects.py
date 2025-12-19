from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.membership import Membership
from app.models.project import Project
from app.models.user import User
from app.services.schema_manager import ensure_project_schema
from app.services.users_collection import create_users_collection


def create_project(db: Session, owner: User, name: str) -> Project:
    project = Project(name=name)
    db.add(project)
    db.flush()
    membership = Membership(user_id=owner.id, project_id=project.id, role="owner")
    db.add(membership)
    db.flush()
    ensure_project_schema(db, project, actor_user_id=owner.id)
    
    # Auto-create the _users collection for app user management
    create_users_collection(db, project, actor_user_id=owner.id)
    
    db.refresh(project)
    return project


def list_projects_for_user(db: Session, user: User) -> list[Project]:
    return (
        db.query(Project)
        .join(Membership, Membership.project_id == Project.id)
        .filter(Membership.user_id == user.id)
        .all()
    )


def get_project_for_user(db: Session, user: User, project_id: str) -> Project:
    project = (
        db.query(Project)
        .join(Membership, Membership.project_id == Project.id)
        .filter(Membership.user_id == user.id, Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
