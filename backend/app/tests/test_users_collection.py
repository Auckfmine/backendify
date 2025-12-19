"""Tests for the _users collection functionality."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_project(c: TestClient) -> tuple[str, str]:
    """Register a user and create a project, return (token, project_id)."""
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    res = c.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert res.status_code == 201
    token = res.json()["access_token"]
    
    proj_res = c.post("/api/projects", json={"name": "Test Project"}, headers=auth_headers(token))
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]
    return token, project_id


def test_users_collection_auto_created(client):
    """Test that _users collection is automatically created with a new project."""
    token, project_id = bootstrap_project(client)
    
    # List collections - should include _users
    res = client.get(f"/api/projects/{project_id}/schema/collections", headers=auth_headers(token))
    assert res.status_code == 200
    collections = res.json()
    
    users_collection = next((c for c in collections if c["name"] == "_users"), None)
    assert users_collection is not None
    assert users_collection["is_system"] == True
    assert users_collection["display_name"] == "Users"


def test_users_collection_has_system_fields(client):
    """Test that _users collection has the expected visible system fields.
    
    Hidden fields like password_hash should NOT be returned by the API.
    """
    token, project_id = bootstrap_project(client)
    
    # Get fields for _users collection
    res = client.get(f"/api/projects/{project_id}/schema/collections/_users/fields", headers=auth_headers(token))
    assert res.status_code == 200
    fields = res.json()
    
    field_names = {f["name"] for f in fields}
    
    # Should have visible system fields
    assert "email" in field_names
    assert "is_email_verified" in field_names
    assert "is_disabled" in field_names
    
    # Hidden fields like password_hash should NOT be returned
    assert "password_hash" not in field_names
    
    # Check email field properties
    email_field = next(f for f in fields if f["name"] == "email")
    assert email_field["is_system"] == True
    assert email_field["is_hidden"] == False


def test_cannot_create_users_collection_manually(client):
    """Test that users cannot create a collection named _users."""
    token, project_id = bootstrap_project(client)
    
    # Try to create _users collection - should fail validation (name starts with _)
    # The Pydantic schema rejects names starting with _ before our custom check
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "_users", "display_name": "My Users"},
        headers=auth_headers(token),
    )
    # 422 from Pydantic validation (pattern mismatch) is acceptable
    assert res.status_code in (400, 422)


def test_can_add_custom_fields_to_users_collection(client):
    """Test that custom fields can be added to _users collection."""
    token, project_id = bootstrap_project(client)
    
    # Add a custom field
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/_users/fields",
        json={
            "name": "display_name",
            "display_name": "Display Name",
            "field_type": "string",
            "is_required": False,
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    field = res.json()
    assert field["name"] == "display_name"
    assert field["is_system"] == False
    assert field["is_hidden"] == False


def test_cannot_add_field_with_system_field_name(client):
    """Test that users cannot add a field with a system field name."""
    token, project_id = bootstrap_project(client)
    
    # Try to add a field named 'email' (already exists as system field)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/_users/fields",
        json={
            "name": "email",
            "display_name": "Email Address",
            "field_type": "string",
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 400
    assert "system field" in res.json()["detail"].lower()


def test_users_collection_can_be_relation_target(client):
    """Test that other collections can have relations to _users."""
    token, project_id = bootstrap_project(client)
    
    # Create a posts collection
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "posts", "display_name": "Posts"},
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    posts_collection_id = res.json()["id"]
    
    # Get _users collection ID
    collections_res = client.get(
        f"/api/projects/{project_id}/schema/collections",
        headers=auth_headers(token),
    )
    users_collection = next(c for c in collections_res.json() if c["name"] == "_users")
    users_collection_id = users_collection["id"]
    
    # Create a relation from posts to _users using the relations API
    res = client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{posts_collection_id}/relations",
        json={
            "name": "author",
            "display_name": "Author",
            "target_collection_id": users_collection_id,
            "relation_type": "many_to_one",
            "on_delete": "SET NULL",
            "display_field": "email",
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    relation = res.json()
    assert relation["name"] == "author"
    assert relation["relation_target_collection_id"] == users_collection_id
