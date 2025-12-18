def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_project_with_collection(client):
    res = client.post("/api/auth/register", json={"email": "audit@example.com", "password": "password123"})
    token = res.json()["access_token"]
    project = client.post("/api/projects", json={"name": "Audit Project"}, headers=auth_headers(token)).json()
    client.post(
        f"/api/projects/{project['id']}/schema/collections",
        json={"name": "logs", "display_name": "Logs"},
        headers=auth_headers(token),
    )
    return token, project["id"]


def test_list_schema_ops(client):
    token, project_id = bootstrap_project_with_collection(client)
    
    res = client.get(f"/api/projects/{project_id}/audit/schema-ops", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    op_types = {op["op_type"] for op in data}
    assert "create_schema" in op_types
    assert "create_table" in op_types


def test_list_schema_ops_filter_by_type(client):
    token, project_id = bootstrap_project_with_collection(client)
    
    res = client.get(
        f"/api/projects/{project_id}/audit/schema-ops?op_type=create_table",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert all(op["op_type"] == "create_table" for op in data)


def test_list_audit_events_empty(client):
    token, project_id = bootstrap_project_with_collection(client)
    
    res = client.get(f"/api/projects/{project_id}/audit/events", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_schema_ops_pagination(client):
    token, project_id = bootstrap_project_with_collection(client)
    
    res = client.get(
        f"/api/projects/{project_id}/audit/schema-ops?limit=1&offset=0",
        headers=auth_headers(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    
    res2 = client.get(
        f"/api/projects/{project_id}/audit/schema-ops?limit=1&offset=1",
        headers=auth_headers(token),
    )
    data2 = res2.json()
    assert len(data2) == 1
    assert data[0]["id"] != data2[0]["id"]
