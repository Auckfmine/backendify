"""Tests for Validations (Milestone M)"""
import pytest
from .test_auth import auth_headers


def test_create_validation_rule(client):
    """Test creating a validation rule."""
    res = client.post("/api/auth/register", json={"email": "val1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Validation Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "users", "display_name": "Users"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "email", "display_name": "Email", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    rule_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={
            "rule_type": "email",
            "error_message": "Please enter a valid email address",
        },
        headers=auth_headers(token),
    )
    assert rule_res.status_code == 201
    data = rule_res.json()
    assert data["rule_type"] == "email"
    assert data["error_message"] == "Please enter a valid email address"


def test_list_validation_rules(client):
    """Test listing validation rules for a field."""
    res = client.post("/api/auth/register", json={"email": "val2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Rules Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "products", "display_name": "Products"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "name", "display_name": "Name", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "min_length", "config": {"min": 3}},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "max_length", "config": {"max": 100}},
        headers=auth_headers(token),
    )
    
    list_res = client.get(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        headers=auth_headers(token),
    )
    assert list_res.status_code == 200
    rules = list_res.json()
    assert len(rules) >= 2


def test_update_validation_rule(client):
    """Test updating a validation rule."""
    res = client.post("/api/auth/register", json={"email": "val3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Update Rule Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "price", "display_name": "Price", "field_type": "float"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    rule_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "min_value", "config": {"min": 0}},
        headers=auth_headers(token),
    )
    rule_id = rule_res.json()["id"]
    
    update_res = client.patch(
        f"/api/projects/{project_id}/validations/rules/{rule_id}",
        json={"config": {"min": 0.01}, "error_message": "Price must be positive"},
        headers=auth_headers(token),
    )
    assert update_res.status_code == 200
    assert update_res.json()["config"]["min"] == 0.01
    assert update_res.json()["error_message"] == "Price must be positive"


def test_delete_validation_rule(client):
    """Test deleting a validation rule."""
    res = client.post("/api/auth/register", json={"email": "val4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delete Rule Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "data", "display_name": "Data"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "code", "display_name": "Code", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    rule_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "not_empty"},
        headers=auth_headers(token),
    )
    rule_id = rule_res.json()["id"]
    
    delete_res = client.delete(
        f"/api/projects/{project_id}/validations/rules/{rule_id}",
        headers=auth_headers(token),
    )
    assert delete_res.status_code == 204


def test_validate_record(client):
    """Test validating a record against rules."""
    res = client.post("/api/auth/register", json={"email": "val5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Validate Record Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "contacts", "display_name": "Contacts"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "email", "display_name": "Email", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "email"},
        headers=auth_headers(token),
    )
    
    valid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"email": "test@example.com"}},
        headers=auth_headers(token),
    )
    assert valid_res.status_code == 200
    assert valid_res.json()["is_valid"] is True
    
    invalid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"email": "not-an-email"}},
        headers=auth_headers(token),
    )
    assert invalid_res.status_code == 200
    assert invalid_res.json()["is_valid"] is False
    assert "email" in invalid_res.json()["errors"]


def test_get_rule_types(client):
    """Test getting available rule types."""
    res = client.post("/api/auth/register", json={"email": "val6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Rule Types Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    types_res = client.get(
        f"/api/projects/{project_id}/validations/rule-types",
        headers=auth_headers(token),
    )
    assert types_res.status_code == 200
    data = types_res.json()
    assert "rule_types" in data
    assert len(data["rule_types"]) >= 10


def test_min_max_length_validation(client):
    """Test min/max length validation rules."""
    res = client.post("/api/auth/register", json={"email": "val7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Length Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "posts", "display_name": "Posts"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "title", "display_name": "Title", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "min_length", "config": {"min": 5}},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "max_length", "config": {"max": 100}},
        headers=auth_headers(token),
    )
    
    short_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"title": "Hi"}},
        headers=auth_headers(token),
    )
    assert short_res.json()["is_valid"] is False
    
    valid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"title": "Hello World"}},
        headers=auth_headers(token),
    )
    assert valid_res.json()["is_valid"] is True


def test_enum_validation(client):
    """Test enum validation rule."""
    res = client.post("/api/auth/register", json={"email": "val8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Enum Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "orders", "display_name": "Orders"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "status", "display_name": "Status", "field_type": "string"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "enum", "config": {"values": ["pending", "shipped", "delivered"]}},
        headers=auth_headers(token),
    )
    
    valid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"status": "pending"}},
        headers=auth_headers(token),
    )
    assert valid_res.json()["is_valid"] is True
    
    invalid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"status": "cancelled"}},
        headers=auth_headers(token),
    )
    assert invalid_res.json()["is_valid"] is False


def test_range_validation(client):
    """Test range validation rule."""
    res = client.post("/api/auth/register", json={"email": "val9@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Range Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "ratings", "display_name": "Ratings"},
        headers=auth_headers(token),
    )
    coll_name = coll_res.json()["name"]
    
    field_res = client.post(
        f"/api/projects/{project_id}/schema/collections/{coll_name}/fields",
        json={"name": "score", "display_name": "Score", "field_type": "int"},
        headers=auth_headers(token),
    )
    field_name = field_res.json()["name"]
    
    client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/fields/{field_name}/rules",
        json={"rule_type": "range", "config": {"min": 1, "max": 5}},
        headers=auth_headers(token),
    )
    
    valid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"score": 3}},
        headers=auth_headers(token),
    )
    assert valid_res.json()["is_valid"] is True
    
    invalid_res = client.post(
        f"/api/projects/{project_id}/validations/collections/{coll_name}/validate",
        json={"data": {"score": 10}},
        headers=auth_headers(token),
    )
    assert invalid_res.json()["is_valid"] is False
