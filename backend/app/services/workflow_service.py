import json
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.models.workflow import Workflow, WorkflowRun, WorkflowStep


def create_workflow(
    db: Session,
    project_id: str,
    name: str,
    trigger_type: str,
    trigger_config: dict,
    steps: list[dict],
    description: str | None = None,
) -> Workflow:
    workflow = Workflow(
        project_id=project_id,
        name=name,
        description=description,
        trigger_type=trigger_type,
        trigger_config_json=json.dumps(trigger_config),
        steps_json=json.dumps(steps),
        is_active=True,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def list_workflows(db: Session, project_id: str) -> list[Workflow]:
    return db.query(Workflow).filter(Workflow.project_id == project_id).all()


def get_workflow(db: Session, project_id: str, workflow_id: str) -> Workflow | None:
    return db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.project_id == project_id,
    ).first()


def delete_workflow(db: Session, project_id: str, workflow_id: str) -> bool:
    workflow = get_workflow(db, project_id, workflow_id)
    if not workflow:
        return False
    db.delete(workflow)
    db.commit()
    return True


def trigger_workflow(db: Session, workflow: Workflow, trigger_data: dict) -> WorkflowRun:
    run = WorkflowRun(
        workflow_id=workflow.id,
        trigger_data_json=json.dumps(trigger_data),
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


async def execute_workflow_run(db: Session, run: WorkflowRun, workflow: Workflow) -> bool:
    steps = json.loads(workflow.steps_json)
    context = {"trigger": json.loads(run.trigger_data_json)}
    
    try:
        for i, step_config in enumerate(steps):
            step = WorkflowStep(
                run_id=run.id,
                step_index=i,
                action_type=step_config.get("action", "unknown"),
                input_json=json.dumps(step_config),
                status="running",
                started_at=datetime.utcnow(),
            )
            db.add(step)
            db.commit()
            
            try:
                result = await execute_step(step_config, context)
                step.output_json = json.dumps(result)
                step.status = "completed"
                step.completed_at = datetime.utcnow()
                context[f"step_{i}"] = result
            except Exception as e:
                step.error = str(e)
                step.status = "failed"
                step.completed_at = datetime.utcnow()
                db.commit()
                raise
            
            db.commit()
        
        run.status = "completed"
        run.completed_at = datetime.utcnow()
        db.commit()
        return True
        
    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        run.completed_at = datetime.utcnow()
        db.commit()
        return False


async def execute_step(step_config: dict, context: dict) -> dict:
    action = step_config.get("action")
    
    if action == "http_request":
        return await execute_http_request(step_config, context)
    elif action == "delay":
        import asyncio
        delay_seconds = step_config.get("seconds", 1)
        await asyncio.sleep(min(delay_seconds, 60))
        return {"delayed": delay_seconds}
    elif action == "transform":
        return execute_transform(step_config, context)
    else:
        return {"action": action, "status": "no_op"}


async def execute_http_request(step_config: dict, context: dict) -> dict:
    url = step_config.get("url", "")
    method = step_config.get("method", "GET").upper()
    headers = step_config.get("headers", {})
    body = step_config.get("body")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=body)
        elif method == "PUT":
            response = await client.put(url, headers=headers, json=body)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers)
        else:
            response = await client.request(method, url, headers=headers, json=body)
        
        return {
            "status_code": response.status_code,
            "body": response.text[:4096] if response.text else None,
        }


def execute_transform(step_config: dict, context: dict) -> dict:
    return {"transformed": True, "input_keys": list(context.keys())}
