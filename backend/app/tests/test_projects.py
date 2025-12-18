from .test_auth import auth_headers


def test_create_and_list_projects(client):
    res = client.post("/api/auth/register", json={"email": "proj@example.com", "password": "password123"})
    token = res.json()["access_token"]

    create_res = client.post(
        "/api/projects",
        json={"name": "My Project"},
        headers=auth_headers(token),
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    list_res = client.get("/api/projects", headers=auth_headers(token))
    assert list_res.status_code == 200
    projects = list_res.json()
    assert len(projects) == 1
    assert projects[0]["id"] == project_id

    detail_res = client.get(f"/api/projects/{project_id}", headers=auth_headers(token))
    assert detail_res.status_code == 200
    assert detail_res.json()["name"] == "My Project"


def test_access_non_member_project_returns_404(client):
    # User 1 creates a project
    res1 = client.post("/api/auth/register", json={"email": "owner@example.com", "password": "password123"})
    token1 = res1.json()["access_token"]
    create_res = client.post("/api/projects", json={"name": "Private Project"}, headers=auth_headers(token1))
    project_id = create_res.json()["id"]

    # User 2 tries to access it
    res2 = client.post("/api/auth/register", json={"email": "other@example.com", "password": "password123"})
    token2 = res2.json()["access_token"]
    access_res = client.get(f"/api/projects/{project_id}", headers=auth_headers(token2))
    assert access_res.status_code == 404


def test_create_project_without_auth(client):
    res = client.post("/api/projects", json={"name": "Unauthorized"})
    assert res.status_code == 401
