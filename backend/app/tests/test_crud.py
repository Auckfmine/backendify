def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def setup_collection_with_fields(client, token, project_id):
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "tasks", "display_name": "Tasks"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/tasks/fields",
        json={"name": "title", "display_name": "Title", "field_type": "string"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/tasks/fields",
        json={"name": "done", "display_name": "Done", "field_type": "bool"},
        headers=auth_headers(token),
    )


def bootstrap_project(client):
    res = client.post("/api/auth/register", json={"email": "crud@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "CRUD Project"}, headers=auth_headers(token)).json()
    return token, project["id"]


def test_create_record(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    res = client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "My first task", "done": False},
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "My first task"
    assert data["done"] == 0 or data["done"] is False
    assert "id" in data
    assert "created_at" in data


def test_list_records(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Task 1"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Task 2"},
        headers=auth_headers(token),
    )
    
    res = client.get(f"/api/projects/{project_id}/data/tasks", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert "records" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["records"]) == 2


def test_get_single_record(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    create_res = client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Get me"},
        headers=auth_headers(token),
    )
    record_id = create_res.json()["id"]
    
    res = client.get(f"/api/projects/{project_id}/data/tasks/{record_id}", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["title"] == "Get me"


def test_update_record(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    create_res = client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Update me", "done": False},
        headers=auth_headers(token),
    )
    record_id = create_res.json()["id"]
    
    res = client.patch(
        f"/api/projects/{project_id}/data/tasks/{record_id}",
        json={"title": "Updated title", "done": True},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Updated title"
    assert data["done"] == 1 or data["done"] is True


def test_delete_record(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    create_res = client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Delete me"},
        headers=auth_headers(token),
    )
    record_id = create_res.json()["id"]
    
    res = client.delete(f"/api/projects/{project_id}/data/tasks/{record_id}", headers=auth_headers(token))
    assert res.status_code == 204
    
    get_res = client.get(f"/api/projects/{project_id}/data/tasks/{record_id}", headers=auth_headers(token))
    assert get_res.status_code == 404


def test_create_record_unknown_field(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    res = client.post(
        f"/api/projects/{project_id}/data/tasks",
        json={"title": "Test", "unknown_field": "value"},
        headers=auth_headers(token),
    )
    assert res.status_code == 400


def test_get_nonexistent_record(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    res = client.get(f"/api/projects/{project_id}/data/tasks/99999", headers=auth_headers(token))
    assert res.status_code == 404


def test_crud_without_auth(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    res = client.post(f"/api/projects/{project_id}/data/tasks", json={"title": "No auth"})
    assert res.status_code == 401


def test_pagination(client):
    token, project_id = bootstrap_project(client)
    setup_collection_with_fields(client, token, project_id)
    
    for i in range(5):
        client.post(
            f"/api/projects/{project_id}/data/tasks",
            json={"title": f"Task {i}"},
            headers=auth_headers(token),
        )
    
    res = client.get(f"/api/projects/{project_id}/data/tasks?limit=2&offset=0", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert len(data["records"]) == 2
    assert data["total"] == 5
    
    res2 = client.get(f"/api/projects/{project_id}/data/tasks?limit=2&offset=2", headers=auth_headers(token))
    data2 = res2.json()
    assert len(data2["records"]) == 2
