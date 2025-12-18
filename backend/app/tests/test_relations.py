"""Tests for Relations (Milestone K)"""
import pytest
from .test_auth import auth_headers


def test_create_relation_field(client):
    """Test creating a relation field between two collections."""
    res = client.post("/api/auth/register", json={"email": "relation1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Relation Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    customers_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "customers", "display_name": "Customers"},
        headers=auth_headers(token),
    )
    assert customers_res.status_code == 201
    customers_id = customers_res.json()["id"]
    
    orders_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "orders", "display_name": "Orders"},
        headers=auth_headers(token),
    )
    assert orders_res.status_code == 201
    orders_id = orders_res.json()["id"]
    
    relation_res = client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{orders_id}/relations",
        json={
            "name": "customer",
            "display_name": "Customer",
            "target_collection_id": customers_id,
            "relation_type": "many_to_one",
            "on_delete": "RESTRICT",
        },
        headers=auth_headers(token),
    )
    assert relation_res.status_code == 201
    data = relation_res.json()
    assert data["name"] == "customer"
    assert data["field_type"] == "relation"
    assert data["sql_column_name"] == "customer_id"
    assert data["relation_target_collection_id"] == customers_id
    assert data["relation_type"] == "many_to_one"
    assert data["relation_on_delete"] == "RESTRICT"


def test_list_relation_fields(client):
    """Test listing relation fields for a collection."""
    res = client.post("/api/auth/register", json={"email": "relation2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Relations Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    products_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "products", "display_name": "Products"},
        headers=auth_headers(token),
    )
    products_id = products_res.json()["id"]
    
    categories_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "categories", "display_name": "Categories"},
        headers=auth_headers(token),
    )
    categories_id = categories_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{products_id}/relations",
        json={
            "name": "category",
            "display_name": "Category",
            "target_collection_id": categories_id,
        },
        headers=auth_headers(token),
    )
    
    list_res = client.get(
        f"/api/projects/{project_id}/schema/relations/collections/{products_id}/relations",
        headers=auth_headers(token),
    )
    assert list_res.status_code == 200
    relations = list_res.json()
    assert len(relations) >= 1
    assert relations[0]["name"] == "category"
    assert relations[0]["target_collection_name"] == "categories"


def test_list_reverse_relations(client):
    """Test listing reverse relations (one_to_many derived)."""
    res = client.post("/api/auth/register", json={"email": "relation3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Reverse Relations Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    authors_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "authors", "display_name": "Authors"},
        headers=auth_headers(token),
    )
    authors_id = authors_res.json()["id"]
    
    books_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "books", "display_name": "Books"},
        headers=auth_headers(token),
    )
    books_id = books_res.json()["id"]
    
    client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{books_id}/relations",
        json={
            "name": "author",
            "display_name": "Author",
            "target_collection_id": authors_id,
        },
        headers=auth_headers(token),
    )
    
    reverse_res = client.get(
        f"/api/projects/{project_id}/schema/relations/collections/{authors_id}/reverse-relations",
        headers=auth_headers(token),
    )
    assert reverse_res.status_code == 200
    reverse = reverse_res.json()
    assert len(reverse) >= 1
    assert reverse[0]["source_collection_name"] == "books"
    assert reverse[0]["relation_type"] == "one_to_many"


def test_relation_with_cascade_delete(client):
    """Test creating a relation with CASCADE on delete."""
    res = client.post("/api/auth/register", json={"email": "relation4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Cascade Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    parent_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "parents", "display_name": "Parents"},
        headers=auth_headers(token),
    )
    parent_id = parent_res.json()["id"]
    
    child_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "children", "display_name": "Children"},
        headers=auth_headers(token),
    )
    child_id = child_res.json()["id"]
    
    relation_res = client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{child_id}/relations",
        json={
            "name": "parent",
            "display_name": "Parent",
            "target_collection_id": parent_id,
            "on_delete": "CASCADE",
        },
        headers=auth_headers(token),
    )
    assert relation_res.status_code == 201
    assert relation_res.json()["relation_on_delete"] == "CASCADE"


def test_relation_invalid_target(client):
    """Test that creating a relation with invalid target fails."""
    res = client.post("/api/auth/register", json={"email": "relation5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Invalid Target Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    coll_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    coll_id = coll_res.json()["id"]
    
    relation_res = client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{coll_id}/relations",
        json={
            "name": "invalid",
            "display_name": "Invalid",
            "target_collection_id": "nonexistent-id",
        },
        headers=auth_headers(token),
    )
    assert relation_res.status_code == 400
    assert "Target collection not found" in relation_res.json()["detail"]


def test_get_relation_options(client):
    """Test getting available relation options."""
    res = client.post("/api/auth/register", json={"email": "relation6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Options Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    options_res = client.get(
        f"/api/projects/{project_id}/schema/relations/relation-options",
        headers=auth_headers(token),
    )
    assert options_res.status_code == 200
    data = options_res.json()
    assert "relation_types" in data
    assert "on_delete_actions" in data
    assert len(data["relation_types"]) >= 1
    assert len(data["on_delete_actions"]) >= 3


def test_required_relation_field(client):
    """Test creating a required relation field."""
    res = client.post("/api/auth/register", json={"email": "relation7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Required Relation Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    dept_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "departments", "display_name": "Departments"},
        headers=auth_headers(token),
    )
    dept_id = dept_res.json()["id"]
    
    emp_res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "employees", "display_name": "Employees"},
        headers=auth_headers(token),
    )
    emp_id = emp_res.json()["id"]
    
    relation_res = client.post(
        f"/api/projects/{project_id}/schema/relations/collections/{emp_id}/relations",
        json={
            "name": "department",
            "display_name": "Department",
            "target_collection_id": dept_id,
            "is_required": True,
        },
        headers=auth_headers(token),
    )
    assert relation_res.status_code == 201
    assert relation_res.json()["is_required"] is True
