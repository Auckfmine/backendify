import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.workflow import WorkflowCreate, WorkflowResponse
from app.services import workflow_service

router = APIRouter()


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: WorkflowCreate,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    workflow = workflow_service.create_workflow(
        db,
        project_id=project.id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config,
        steps=payload.steps,
        description=payload.description,
    )
    return WorkflowResponse(
        id=workflow.id,
        project_id=workflow.project_id,
        name=workflow.name,
        description=workflow.description,
        trigger_type=workflow.trigger_type,
        trigger_config=json.loads(workflow.trigger_config_json),
        steps=json.loads(workflow.steps_json),
        is_active=workflow.is_active,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.get("", response_model=list[WorkflowResponse])
def list_workflows(
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    workflows = workflow_service.list_workflows(db, project.id)
    return [
        WorkflowResponse(
            id=w.id,
            project_id=w.project_id,
            name=w.name,
            description=w.description,
            trigger_type=w.trigger_type,
            trigger_config=json.loads(w.trigger_config_json),
            steps=json.loads(w.steps_json),
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in workflows
    ]


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    workflow = workflow_service.get_workflow(db, project.id, workflow_id)
    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return WorkflowResponse(
        id=workflow.id,
        project_id=workflow.project_id,
        name=workflow.name,
        description=workflow.description,
        trigger_type=workflow.trigger_type,
        trigger_config=json.loads(workflow.trigger_config_json),
        steps=json.loads(workflow.steps_json),
        is_active=workflow.is_active,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    project=Depends(deps.get_project_member),
    db: Session = Depends(deps.get_db),
):
    deleted = workflow_service.delete_workflow(db, project.id, workflow_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
