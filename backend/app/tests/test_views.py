"""Tests for Views (Milestone L)"""
import pytest
from .test_auth import auth_headers


def test_create_view(client):
    """Test creating a view."""
    res = client.post("/api/auth/register", json={"email": "view1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "View Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "products", "display_name": "Products"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    view_res = client.post(
        f"/api/projects/{project_id}/views",
        json={
            "name": "active_products",
            "display_name": "Active Products",
            "base_collection_id": collection_id,
            "description": "All active products",
            "projection": ["id", "created_at"],
            "filters": [{"field": "id", "operator": ">", "value": 0}],
            "sorts": [{"field": "created_at", "desc": True}],
        },
        headers=auth_headers(token),
    )
    assert view_res.status_code == 201
    data = view_res.json()
    assert data["name"] == "active_products"
    assert data["display_name"] == "Active Products"
    assert data["version"] == 1
    assert data["projection"] == ["id", "created_at"]


def test_list_views(client):
    """Test listing views."""
    res = client.post("/api/auth/register", json={"email": "view2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Views Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "view_a", "display_name": "View A", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "view_b", "display_name": "View B", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    list_res = client.get(f"/api/projects/{project_id}/views", headers=auth_headers(token))
    assert list_res.status_code == 200
    views = list_res.json()
    assert len(views) >= 2


def test_get_view(client):
    """Test getting a view by name."""
    res = client.post("/api/auth/register", json={"email": "view3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Get View Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "data", "display_name": "Data"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "my_view", "display_name": "My View", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    get_res = client.get(f"/api/projects/{project_id}/views/my_view", headers=auth_headers(token))
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "my_view"


def test_update_view(client):
    """Test updating a view creates a new version."""
    res = client.post("/api/auth/register", json={"email": "view4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Update View Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "records", "display_name": "Records"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "versioned_view", "display_name": "Versioned", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    update_res = client.patch(
        f"/api/projects/{project_id}/views/versioned_view",
        json={"display_name": "Updated View", "filters": [{"field": "id", "operator": "=", "value": 1}]},
        headers=auth_headers(token),
    )
    assert update_res.status_code == 200
    assert update_res.json()["version"] == 2
    assert update_res.json()["display_name"] == "Updated View"


def test_delete_view(client):
    """Test deleting a view."""
    res = client.post("/api/auth/register", json={"email": "view5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delete View Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "temp", "display_name": "Temp"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "to_delete", "display_name": "To Delete", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    delete_res = client.delete(f"/api/projects/{project_id}/views/to_delete", headers=auth_headers(token))
    assert delete_res.status_code == 204
    
    get_res = client.get(f"/api/projects/{project_id}/views/to_delete", headers=auth_headers(token))
    assert get_res.status_code == 404


def test_view_versions(client):
    """Test getting view versions."""
    res = client.post("/api/auth/register", json={"email": "view6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Versions Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "history", "display_name": "History"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "history_view", "display_name": "History View", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    client.patch(
        f"/api/projects/{project_id}/views/history_view",
        json={"description": "Version 2"},
        headers=auth_headers(token),
    )
    
    client.patch(
        f"/api/projects/{project_id}/views/history_view",
        json={"description": "Version 3"},
        headers=auth_headers(token),
    )
    
    versions_res = client.get(f"/api/projects/{project_id}/views/history_view/versions", headers=auth_headers(token))
    assert versions_res.status_code == 200
    versions = versions_res.json()
    assert len(versions) == 3
    assert versions[0]["version"] == 3


def test_execute_view(client):
    """Test executing a view."""
    res = client.post("/api/auth/register", json={"email": "view7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Execute View Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "entries", "display_name": "Entries"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={
            "name": "all_entries",
            "display_name": "All Entries",
            "base_collection_id": collection_id,
            "default_limit": 50,
        },
        headers=auth_headers(token),
    )
    
    exec_res = client.post(
        f"/api/projects/{project_id}/views/all_entries/execute",
        json={"limit": 10, "offset": 0},
        headers=auth_headers(token),
    )
    assert exec_res.status_code == 200
    data = exec_res.json()
    assert "data" in data
    assert "total" in data
    assert data["view_name"] == "all_entries"
    assert data["limit"] == 10


def test_get_operators(client):
    """Test getting available operators."""
    res = client.post("/api/auth/register", json={"email": "view8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Operators Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    ops_res = client.get(f"/api/projects/{project_id}/views/operators", headers=auth_headers(token))
    assert ops_res.status_code == 200
    data = ops_res.json()
    assert "operators" in data
    assert len(data["operators"]) >= 10


def test_view_not_found(client):
    """Test 404 for non-existent view."""
    res = client.post("/api/auth/register", json={"email": "view9@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Not Found Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    get_res = client.get(f"/api/projects/{project_id}/views/nonexistent", headers=auth_headers(token))
    assert get_res.status_code == 404


def test_duplicate_view_name(client):
    """Test that duplicate view names are rejected."""
    res = client.post("/api/auth/register", json={"email": "view10@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Duplicate Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "stuff", "display_name": "Stuff"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "unique_view", "display_name": "Unique", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    
    dup_res = client.post(
        f"/api/projects/{project_id}/views",
        json={"name": "unique_view", "display_name": "Duplicate", "base_collection_id": collection_id},
        headers=auth_headers(token),
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]


def test_view_meta(client):
    """Test view meta endpoint (L5.2)."""
    res = client.post("/api/auth/register", json={"email": "viewmeta@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Meta Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/views",
        json={
            "name": "meta_test_view",
            "display_name": "Meta Test View",
            "base_collection_id": collection_id,
            "description": "A view for testing meta endpoint",
            "projection": ["id", "created_at"],
        },
        headers=auth_headers(token),
    )
    
    meta_res = client.get(
        f"/api/projects/{project_id}/views/meta_test_view/meta",
        headers=auth_headers(token),
    )
    assert meta_res.status_code == 200
    data = meta_res.json()
    
    assert data["view_name"] == "meta_test_view"
    assert data["display_name"] == "Meta Test View"
    assert data["description"] == "A view for testing meta endpoint"
    assert "endpoint" in data
    assert data["endpoint"]["method"] == "POST"
    assert "/execute" in data["endpoint"]["url"]
    assert "auth" in data["endpoint"]
    assert "request" in data
    assert "response" in data
    assert "examples" in data
    assert "curl" in data["examples"]


def test_parameterized_sort(client):
    """Test view execution with parameterized sort field and direction."""
    res = client.post("/api/auth/register", json={"email": "paramsort@example.com", "password": "password123"})
    token = res.json()["access_token"]

    project_res = client.post("/api/projects", json={"name": "Param Sort Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    collection_id = coll_res.json()["id"]

    client.post(
        f"/api/projects/{project_id}/schema/collections/items/fields",
        json={"name": "title", "display_name": "Title", "field_type": "string"},
        headers=auth_headers(token),
    )

    # Create test data
    for i in range(3):
        client.post(
            f"/api/projects/{project_id}/data/items",
            json={"title": f"Item {i}"},
            headers=auth_headers(token),
        )

    # Create a view with parameterized sort
    view_res = client.post(
        f"/api/projects/{project_id}/views",
        json={
            "name": "sorted_items",
            "display_name": "Sorted Items",
            "base_collection_id": collection_id,
            "params_schema": {
                "sort_by": {"type": "sort_field", "required": False},
                "sort_order": {"type": "sort_direction", "required": False},
            },
            "sorts": [
                {"field": "id", "desc": False, "is_param": True, "param_name": "sort_by", "desc_is_param": True, "desc_param_name": "sort_order"}
            ],
        },
        headers=auth_headers(token),
    )
    assert view_res.status_code == 201

    # Execute with sort_order = asc (should be ascending by id)
    exec_asc = client.post(
        f"/api/projects/{project_id}/views/sorted_items/execute",
        json={"params": {"sort_by": "id", "sort_order": "asc"}},
        headers=auth_headers(token),
    )
    assert exec_asc.status_code == 200
    data_asc = exec_asc.json()
    assert data_asc["data"][0]["id"] < data_asc["data"][1]["id"]  # Ascending

    # Execute with sort_order = desc (should be descending by id)
    exec_desc = client.post(
        f"/api/projects/{project_id}/views/sorted_items/execute",
        json={"params": {"sort_by": "id", "sort_order": "desc"}},
        headers=auth_headers(token),
    )
    assert exec_desc.status_code == 200
    data_desc = exec_desc.json()
    assert data_desc["data"][0]["id"] > data_desc["data"][1]["id"]  # Descending
