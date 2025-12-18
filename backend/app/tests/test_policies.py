import json


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_project_with_collection(client):
    res = client.post("/api/auth/register", json={"email": "policy@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "Policy Project"}, headers=auth_headers(token)).json()
    client.post(
        f"/api/projects/{project['id']}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    return token, project["id"]


def test_create_policy(client):
    token, project_id = bootstrap_project_with_collection(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "allow_read", "action": "read", "effect": "allow"},
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "allow_read"
    assert data["action"] == "read"
    assert data["effect"] == "allow"
    assert data["is_active"] is True


def test_list_policies(client):
    token, project_id = bootstrap_project_with_collection(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "p1", "action": "read", "effect": "allow"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "p2", "action": "create", "effect": "deny"},
        headers=auth_headers(token),
    )
    res = client.get(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2


def test_get_policy(client):
    token, project_id = bootstrap_project_with_collection(client)
    create_res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "get_me", "action": "read", "effect": "allow"},
        headers=auth_headers(token),
    )
    policy_id = create_res.json()["id"]
    
    res = client.get(
        f"/api/projects/{project_id}/schema/collections/items/policies/{policy_id}",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "get_me"


def test_update_policy(client):
    token, project_id = bootstrap_project_with_collection(client)
    create_res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "update_me", "action": "read", "effect": "allow"},
        headers=auth_headers(token),
    )
    policy_id = create_res.json()["id"]
    
    res = client.patch(
        f"/api/projects/{project_id}/schema/collections/items/policies/{policy_id}",
        json={"effect": "deny", "priority": 10},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["effect"] == "deny"
    assert data["priority"] == 10


def test_delete_policy(client):
    token, project_id = bootstrap_project_with_collection(client)
    create_res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "delete_me", "action": "read", "effect": "allow"},
        headers=auth_headers(token),
    )
    policy_id = create_res.json()["id"]
    
    res = client.delete(
        f"/api/projects/{project_id}/schema/collections/items/policies/{policy_id}",
        headers=auth_headers(token),
    )
    assert res.status_code == 204
    
    get_res = client.get(
        f"/api/projects/{project_id}/schema/collections/items/policies/{policy_id}",
        headers=auth_headers(token),
    )
    assert get_res.status_code == 404


def test_create_policy_invalid_action(client):
    token, project_id = bootstrap_project_with_collection(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "bad", "action": "invalid_action", "effect": "allow"},
        headers=auth_headers(token),
    )
    assert res.status_code == 400


def test_create_policy_invalid_effect(client):
    token, project_id = bootstrap_project_with_collection(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "bad", "action": "read", "effect": "invalid_effect"},
        headers=auth_headers(token),
    )
    assert res.status_code == 400


def test_create_policy_with_condition(client):
    token, project_id = bootstrap_project_with_collection(client)
    condition = json.dumps({"type": "authenticated"})
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "auth_only", "action": "read", "effect": "allow", "condition_json": condition},
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["condition_json"] == condition


def test_create_policy_invalid_condition_json(client):
    token, project_id = bootstrap_project_with_collection(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/items/policies",
        json={"name": "bad", "action": "read", "effect": "allow", "condition_json": "not valid json"},
        headers=auth_headers(token),
    )
    assert res.status_code == 400


def test_policy_not_found(client):
    token, project_id = bootstrap_project_with_collection(client)
    res = client.get(
        f"/api/projects/{project_id}/schema/collections/items/policies/nonexistent-id",
        headers=auth_headers(token),
    )
    assert res.status_code == 404
