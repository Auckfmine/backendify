"""Tests for RBAC (Role-Based Access Control) endpoints."""


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_project(client):
    """Create a user and project for testing."""
    res = client.post("/api/auth/register", json={"email": "rbac@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "RBAC Project"}, headers=auth_headers(token)).json()
    return token, project["id"]


def bootstrap_project_with_app_user(client):
    """Create a user, project, and app user for testing."""
    token, project_id = bootstrap_project(client)
    # Create an app user via the auth settings endpoint
    app_user_res = client.post(
        f"/api/projects/{project_id}/auth/signup",
        json={"email": "appuser@example.com", "password": "password123"},
    )
    app_user_id = app_user_res.json().get("user", {}).get("id") if app_user_res.status_code == 200 else None
    return token, project_id, app_user_id


# ============== ROLE TESTS ==============

def test_create_role(client):
    """Test creating a new role."""
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={
            "name": "editor",
            "display_name": "Editor",
            "description": "Can edit content",
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "editor"
    assert data["display_name"] == "Editor"
    assert data["description"] == "Can edit content"
    assert data["is_system"] is False
    assert data["is_default"] is False


def test_create_role_duplicate_name(client):
    """Test that creating a role with duplicate name fails."""
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "editor", "display_name": "Editor"},
        headers=auth_headers(token),
    )
    res = client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "editor", "display_name": "Another Editor"},
        headers=auth_headers(token),
    )
    assert res.status_code == 409


def test_list_roles(client):
    """Test listing all roles for a project."""
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "role1", "display_name": "Role 1"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "role2", "display_name": "Role 2"},
        headers=auth_headers(token),
    )
    res = client.get(
        f"/api/projects/{project_id}/rbac/roles",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2


def test_get_role(client):
    """Test getting a single role by ID."""
    token, project_id = bootstrap_project(client)
    create_res = client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "viewer", "display_name": "Viewer"},
        headers=auth_headers(token),
    )
    role_id = create_res.json()["id"]
    
    res = client.get(
        f"/api/projects/{project_id}/rbac/roles/{role_id}",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "viewer"


def test_get_role_not_found(client):
    """Test getting a non-existent role returns 404."""
    token, project_id = bootstrap_project(client)
    res = client.get(
        f"/api/projects/{project_id}/rbac/roles/nonexistent-id",
        headers=auth_headers(token),
    )
    assert res.status_code == 404


def test_update_role(client):
    """Test updating a role."""
    token, project_id = bootstrap_project(client)
    create_res = client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "updatable", "display_name": "Updatable Role"},
        headers=auth_headers(token),
    )
    role_id = create_res.json()["id"]
    
    res = client.patch(
        f"/api/projects/{project_id}/rbac/roles/{role_id}",
        json={"display_name": "Updated Role", "is_default": True},
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Updated Role"
    assert data["is_default"] is True


def test_delete_role(client):
    """Test deleting a role."""
    token, project_id = bootstrap_project(client)
    create_res = client.post(
        f"/api/projects/{project_id}/rbac/roles",
        json={"name": "deletable", "display_name": "Deletable Role"},
        headers=auth_headers(token),
    )
    role_id = create_res.json()["id"]
    
    res = client.delete(
        f"/api/projects/{project_id}/rbac/roles/{role_id}",
        headers=auth_headers(token),
    )
    assert res.status_code == 204
    
    get_res = client.get(
        f"/api/projects/{project_id}/rbac/roles/{role_id}",
        headers=auth_headers(token),
    )
    assert get_res.status_code == 404


# ============== PERMISSION TESTS ==============

# ============== INITIALIZATION TESTS ==============

def test_initialize_rbac(client):
    """Test initializing default roles."""
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/rbac/initialize",
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert "roles_created" in data
    assert data["roles_created"] >= 0


def test_initialize_rbac_idempotent(client):
    """Test that initializing RBAC twice doesn't create duplicates."""
    token, project_id = bootstrap_project(client)
    
    # First initialization
    res1 = client.post(
        f"/api/projects/{project_id}/rbac/initialize",
        headers=auth_headers(token),
    )
    assert res1.status_code == 201
    
    # Second initialization should not create more
    res2 = client.post(
        f"/api/projects/{project_id}/rbac/initialize",
        headers=auth_headers(token),
    )
    assert res2.status_code == 201
    data = res2.json()
    assert data["roles_created"] == 0


# ============== AUTHORIZATION TESTS ==============

def test_rbac_requires_auth(client):
    """Test that RBAC endpoints require authentication."""
    # Try to access without auth
    res = client.get("/api/projects/some-project-id/rbac/roles")
    assert res.status_code == 401


def test_rbac_requires_project_membership(client):
    """Test that RBAC endpoints require project membership."""
    # Create two users with different projects
    res1 = client.post("/api/auth/register", json={"email": "user1@example.com", "password": "password123"})
    token1 = res1.json()["access_token"]
    project1 = client.post("/api/projects", json={"name": "Project 1"}, headers=auth_headers(token1)).json()
    
    res2 = client.post("/api/auth/register", json={"email": "user2@example.com", "password": "password123"})
    token2 = res2.json()["access_token"]
    
    # User 2 tries to access User 1's project RBAC
    res = client.get(
        f"/api/projects/{project1['id']}/rbac/roles",
        headers=auth_headers(token2),
    )
    assert res.status_code in [403, 404]  # Either forbidden or not found is acceptable
