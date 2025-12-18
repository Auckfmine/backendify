from .test_auth import auth_headers


def bootstrap_project(client):
    res = client.post("/api/auth/register", json={"email": "keys@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "Key Project"}, headers=auth_headers(token)).json()
    return token, project["id"]


def test_create_list_revoke_api_keys(client):
    token, project_id = bootstrap_project(client)

    create_res = client.post(
        f"/api/projects/{project_id}/api-keys",
        json={"name": "Primary"},
        headers=auth_headers(token),
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["api_key"]
    assert created["prefix"] == created["api_key"][:8]

    list_res = client.get(f"/api/projects/{project_id}/api-keys", headers=auth_headers(token))
    assert list_res.status_code == 200
    keys = list_res.json()
    assert len(keys) == 1
    assert "api_key" not in keys[0]
    assert keys[0]["revoked"] is False

    revoke_res = client.post(
        f"/api/projects/{project_id}/api-keys/{created['id']}/revoke",
        headers=auth_headers(token),
    )
    assert revoke_res.status_code == 204

    list_res = client.get(f"/api/projects/{project_id}/api-keys", headers=auth_headers(token))
    assert list_res.json()[0]["revoked"] is True


def test_create_api_key_without_auth(client):
    # First create a project to get a valid project_id
    res = client.post("/api/auth/register", json={"email": "noauth@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "NoAuth Project"}, headers=auth_headers(token)).json()

    # Try to create API key without auth
    res = client.post(f"/api/projects/{project['id']}/api-keys", json={"name": "Unauthorized"})
    assert res.status_code == 401


def test_revoke_nonexistent_api_key(client):
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/api-keys/nonexistent-id/revoke",
        headers=auth_headers(token),
    )
    assert res.status_code == 404


def test_access_other_project_api_keys_returns_404(client):
    # User 1 creates a project
    res1 = client.post("/api/auth/register", json={"email": "apiowner@example.com", "password": "password123"})
    token1 = res1.json()["access_token"]
    project = client.post("/api/projects", json={"name": "API Owner Project"}, headers=auth_headers(token1)).json()

    # User 2 tries to access User 1's project API keys
    res2 = client.post("/api/auth/register", json={"email": "apiother@example.com", "password": "password123"})
    token2 = res2.json()["access_token"]
    access_res = client.get(f"/api/projects/{project['id']}/api-keys", headers=auth_headers(token2))
    assert access_res.status_code == 404
