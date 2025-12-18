from .test_auth import auth_headers


def test_create_workflow(client):
    res = client.post("/api/auth/register", json={"email": "workflow1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={
            "name": "Test Workflow",
            "description": "A test workflow",
            "trigger_type": "record.created",
            "trigger_config": {"collection": "users"},
            "steps": [
                {"action": "http_request", "url": "https://example.com/notify"},
                {"action": "delay", "seconds": 5},
            ],
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Workflow"
    assert data["description"] == "A test workflow"
    assert data["trigger_type"] == "record.created"
    assert data["is_active"] is True
    assert len(data["steps"]) == 2
    assert "id" in data


def test_list_workflows(client):
    res = client.post("/api/auth/register", json={"email": "workflow2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Workflows Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Workflow 1", "trigger_type": "record.created", "steps": []},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Workflow 2", "trigger_type": "record.updated", "steps": []},
        headers=auth_headers(token),
    )

    response = client.get(f"/api/projects/{project_id}/workflows", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [w["name"] for w in data]
    assert "Workflow 1" in names
    assert "Workflow 2" in names


def test_get_workflow(client):
    res = client.post("/api/auth/register", json={"email": "workflow3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Get Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    create_response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Get Test Workflow", "trigger_type": "manual", "steps": [{"action": "transform"}]},
        headers=auth_headers(token),
    )
    workflow_id = create_response.json()["id"]

    response = client.get(f"/api/projects/{project_id}/workflows/{workflow_id}", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test Workflow"
    assert data["id"] == workflow_id
    assert data["trigger_type"] == "manual"


def test_delete_workflow(client):
    res = client.post("/api/auth/register", json={"email": "workflow4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delete Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    create_response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Delete Test Workflow", "trigger_type": "record.deleted", "steps": []},
        headers=auth_headers(token),
    )
    workflow_id = create_response.json()["id"]

    response = client.delete(f"/api/projects/{project_id}/workflows/{workflow_id}", headers=auth_headers(token))
    assert response.status_code == 204

    get_response = client.get(f"/api/projects/{project_id}/workflows/{workflow_id}", headers=auth_headers(token))
    assert get_response.status_code == 404


def test_workflow_not_found(client):
    res = client.post("/api/auth/register", json={"email": "workflow5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Not Found Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.get(f"/api/projects/{project_id}/workflows/nonexistent-id", headers=auth_headers(token))
    assert response.status_code == 404


def test_create_workflow_without_auth(client):
    res = client.post("/api/auth/register", json={"email": "workflow6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Unauth Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Unauthorized Workflow", "trigger_type": "manual", "steps": []},
    )
    assert response.status_code == 401


def test_workflow_with_multiple_steps(client):
    res = client.post("/api/auth/register", json={"email": "workflow7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Multi-Step Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={
            "name": "Multi-Step Workflow",
            "trigger_type": "record.created",
            "steps": [
                {"action": "http_request", "url": "https://api.example.com/step1"},
                {"action": "delay", "seconds": 2},
                {"action": "http_request", "url": "https://api.example.com/step2"},
                {"action": "transform"},
            ],
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["steps"]) == 4


def test_workflow_minimal(client):
    res = client.post("/api/auth/register", json={"email": "workflow8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Minimal Workflow Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/workflows",
        json={"name": "Minimal Workflow", "trigger_type": "manual"},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Workflow"
    assert data["steps"] == []
    assert data["trigger_config"] == {}
