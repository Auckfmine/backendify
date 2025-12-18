def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_project(client):
    res = client.post("/api/auth/register", json={"email": "coll@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "Test Project"}, headers=auth_headers(token)).json()
    return token, project["id"]


def test_create_collection(client):
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "posts", "display_name": "Blog Posts"},
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "posts"
    assert data["display_name"] == "Blog Posts"
    assert data["sql_table_name"] == "posts"
    assert data["is_active"] is True


def test_list_collections(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "users", "display_name": "Users"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "comments", "display_name": "Comments"},
        headers=auth_headers(token),
    )
    res = client.get(f"/api/projects/{project_id}/schema/collections", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    names = {c["name"] for c in data}
    assert names == {"users", "comments"}


def test_get_collection(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "products", "display_name": "Products"},
        headers=auth_headers(token),
    )
    res = client.get(f"/api/projects/{project_id}/schema/collections/products", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["name"] == "products"


def test_create_collection_invalid_name(client):
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "Invalid Name", "display_name": "Invalid"},
        headers=auth_headers(token),
    )
    assert res.status_code == 422


def test_create_duplicate_collection(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "orders", "display_name": "Orders"},
        headers=auth_headers(token),
    )
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "orders", "display_name": "Orders Again"},
        headers=auth_headers(token),
    )
    assert res.status_code == 409


def test_add_field_to_collection(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "articles", "display_name": "Articles"},
        headers=auth_headers(token),
    )
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/articles/fields",
        json={
            "name": "title",
            "display_name": "Title",
            "field_type": "string",
            "is_required": False,
        },
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "title"
    assert data["field_type"] == "string"
    assert data["sql_column_name"] == "title"


def test_list_fields(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/items/fields",
        json={"name": "name", "display_name": "Name", "field_type": "string"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/items/fields",
        json={"name": "price", "display_name": "Price", "field_type": "float"},
        headers=auth_headers(token),
    )
    res = client.get(f"/api/projects/{project_id}/schema/collections/items/fields", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2


def test_add_field_invalid_type(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "test", "display_name": "Test"},
        headers=auth_headers(token),
    )
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/test/fields",
        json={"name": "bad", "display_name": "Bad", "field_type": "invalid_type"},
        headers=auth_headers(token),
    )
    assert res.status_code == 400


def test_add_duplicate_field(client):
    token, project_id = bootstrap_project(client)
    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "dupes", "display_name": "Dupes"},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/schema/collections/dupes/fields",
        json={"name": "email", "display_name": "Email", "field_type": "string"},
        headers=auth_headers(token),
    )
    res = client.post(
        f"/api/projects/{project_id}/schema/collections/dupes/fields",
        json={"name": "email", "display_name": "Email Again", "field_type": "string"},
        headers=auth_headers(token),
    )
    assert res.status_code == 409


def test_collection_not_found(client):
    token, project_id = bootstrap_project(client)
    res = client.get(f"/api/projects/{project_id}/schema/collections/nonexistent", headers=auth_headers(token))
    assert res.status_code == 404


def test_create_collection_without_auth(client):
    token, project_id = bootstrap_project(client)
    res = client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "noauth", "display_name": "No Auth"},
    )
    assert res.status_code == 401
