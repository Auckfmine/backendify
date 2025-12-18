"""Tests for Schema Evolution (Milestone J)"""
import pytest
from .test_auth import auth_headers


def test_rename_collection(client):
    """Test renaming a collection with alias support."""
    res = client.post("/api/auth/register", json={"email": "evolution1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Evolution Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "orders", "display_name": "Orders"},
        headers=auth_headers(token),
    )
    assert coll_res.status_code == 201
    collection_id = coll_res.json()["id"]
    
    rename_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/rename",
        json={"new_name": "purchases", "new_display_name": "Purchases"},
        headers=auth_headers(token),
    )
    assert rename_res.status_code == 200
    data = rename_res.json()
    assert data["success"] is True
    assert data["operation"] == "rename_collection"
    assert data["details"]["old_name"] == "orders"
    assert data["details"]["new_name"] == "purchases"
    assert "alias_expires_at" in data["details"]


def test_rename_field(client):
    """Test renaming a field with alias support."""
    res = client.post("/api/auth/register", json={"email": "evolution2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Field Rename Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "products", "display_name": "Products"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    collection_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{collection_name}/fields",
        json={"name": "price", "display_name": "Price", "field_type": "float"},
        headers=auth_headers(token),
    )
    assert field_res.status_code == 201
    field_id = field_res.json()["id"]
    
    rename_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/rename",
        json={"new_name": "unit_price", "new_display_name": "Unit Price"},
        headers=auth_headers(token),
    )
    assert rename_res.status_code == 200
    data = rename_res.json()
    assert data["success"] is True
    assert data["operation"] == "rename_field"
    assert data["details"]["old_name"] == "price"
    assert data["details"]["new_name"] == "unit_price"


def test_soft_delete_field(client):
    """Test soft deleting a field."""
    res = client.post("/api/auth/register", json={"email": "evolution3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Soft Delete Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    collection_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{collection_name}/fields",
        json={"name": "deprecated_field", "display_name": "Deprecated", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_id = field_res.json()["id"]
    
    delete_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/soft-delete",
        headers=auth_headers(token),
    )
    assert delete_res.status_code == 200
    data = delete_res.json()
    assert data["success"] is True
    assert data["operation"] == "soft_delete_field"
    assert data["details"]["field_name"] == "deprecated_field"
    assert "deleted_at" in data["details"]


def test_restore_field(client):
    """Test restoring a soft-deleted field."""
    res = client.post("/api/auth/register", json={"email": "evolution4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Restore Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "data", "display_name": "Data"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    collection_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{collection_name}/fields",
        json={"name": "temp_field", "display_name": "Temp", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_id = field_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/soft-delete",
        headers=auth_headers(token),
    )
    
    restore_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/restore",
        headers=auth_headers(token),
    )
    assert restore_res.status_code == 200
    data = restore_res.json()
    assert data["success"] is True
    assert data["operation"] == "restore_field"
    assert data["details"]["restored"] is True


def test_change_field_type_safe(client):
    """Test safe field type conversion (int to float)."""
    res = client.post("/api/auth/register", json={"email": "evolution5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Type Change Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "metrics", "display_name": "Metrics"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    collection_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{collection_name}/fields",
        json={"name": "count", "display_name": "Count", "field_type": "int"},
        headers=auth_headers(token),
    )
    field_id = field_res.json()["id"]
    
    change_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/change-type",
        json={"new_type": "float"},
        headers=auth_headers(token),
    )
    assert change_res.status_code == 200
    data = change_res.json()
    assert data["success"] is True
    assert data["operation"] == "change_field_type"
    assert data["details"]["old_type"] == "int"
    assert data["details"]["new_type"] == "float"


def test_change_field_type_unsafe(client):
    """Test that unsafe type conversions are rejected."""
    res = client.post("/api/auth/register", json={"email": "evolution6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Unsafe Type Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "records", "display_name": "Records"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    collection_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{collection_name}/fields",
        json={"name": "amount", "display_name": "Amount", "field_type": "float"},
        headers=auth_headers(token),
    )
    field_id = field_res.json()["id"]
    
    change_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/fields/{field_id}/change-type",
        json={"new_type": "bool"},
        headers=auth_headers(token),
    )
    assert change_res.status_code == 400
    assert "Unsafe type conversion" in change_res.json()["detail"]


def test_preview_migration(client):
    """Test migration preview."""
    res = client.post("/api/auth/register", json={"email": "evolution7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Preview Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "logs", "display_name": "Logs"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    preview_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/preview-migration",
        json={"operation": "rename_collection", "params": {"new_name": "audit_logs"}},
        headers=auth_headers(token),
    )
    assert preview_res.status_code == 200
    data = preview_res.json()
    assert data["operation"] == "rename_collection"
    assert len(data["steps"]) > 0
    assert len(data["warnings"]) > 0


def test_get_active_aliases(client):
    """Test getting active aliases."""
    res = client.post("/api/auth/register", json={"email": "evolution8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Aliases Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "old_name", "display_name": "Old Name"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/rename",
        json={"new_name": "new_name"},
        headers=auth_headers(token),
    )
    
    aliases_res = client.get(
        f"/api/projects/{project_id}/schema/evolution/aliases",
        headers=auth_headers(token),
    )
    assert aliases_res.status_code == 200
    data = aliases_res.json()
    assert "collection_aliases" in data
    assert len(data["collection_aliases"]) >= 1
    assert data["collection_aliases"][0]["old_name"] == "old_name"


def test_get_safe_conversions(client):
    """Test getting safe type conversions list."""
    res = client.post("/api/auth/register", json={"email": "evolution9@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Conversions Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    conversions_res = client.get(
        f"/api/projects/{project_id}/schema/evolution/safe-conversions",
        headers=auth_headers(token),
    )
    assert conversions_res.status_code == 200
    data = conversions_res.json()
    assert "safe_conversions" in data
    assert len(data["safe_conversions"]) >= 3


def test_invalid_collection_name(client):
    """Test that invalid collection names are rejected."""
    res = client.post("/api/auth/register", json={"email": "evolution10@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Invalid Name Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "valid_name", "display_name": "Valid"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    rename_res = client.post(
        f"/api/projects/{project_id}/schema/evolution/collections/{collection_id}/rename",
        json={"new_name": "SELECT"},
        headers=auth_headers(token),
    )
    assert rename_res.status_code == 400
    assert "Invalid" in rename_res.json()["detail"]
