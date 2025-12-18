from .test_auth import auth_headers


def test_create_webhook(client):
    res = client.post("/api/auth/register", json={"email": "webhook1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Webhook Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={
            "name": "Test Webhook",
            "url": "https://example.com/webhook",
            "events": ["record.created", "record.updated"],
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Webhook"
    assert data["url"] == "https://example.com/webhook"
    assert data["events"] == ["record.created", "record.updated"]
    assert data["is_active"] is True
    assert "secret" in data
    assert "id" in data


def test_list_webhooks(client):
    res = client.post("/api/auth/register", json={"email": "webhook2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Webhooks Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Webhook 1", "url": "https://example.com/hook1", "events": ["record.created"]},
        headers=auth_headers(token),
    )
    client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Webhook 2", "url": "https://example.com/hook2", "events": ["record.deleted"]},
        headers=auth_headers(token),
    )

    response = client.get(f"/api/projects/{project_id}/webhooks", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [w["name"] for w in data]
    assert "Webhook 1" in names
    assert "Webhook 2" in names


def test_get_webhook(client):
    res = client.post("/api/auth/register", json={"email": "webhook3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Get Webhook Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    create_response = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Get Test Webhook", "url": "https://example.com/get-test", "events": ["record.created"]},
        headers=auth_headers(token),
    )
    webhook_id = create_response.json()["id"]

    response = client.get(f"/api/projects/{project_id}/webhooks/{webhook_id}", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test Webhook"
    assert data["id"] == webhook_id


def test_delete_webhook(client):
    res = client.post("/api/auth/register", json={"email": "webhook4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delete Webhook Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    create_response = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Delete Test Webhook", "url": "https://example.com/delete-test", "events": ["record.deleted"]},
        headers=auth_headers(token),
    )
    webhook_id = create_response.json()["id"]

    response = client.delete(f"/api/projects/{project_id}/webhooks/{webhook_id}", headers=auth_headers(token))
    assert response.status_code == 204

    get_response = client.get(f"/api/projects/{project_id}/webhooks/{webhook_id}", headers=auth_headers(token))
    assert get_response.status_code == 404


def test_webhook_not_found(client):
    res = client.post("/api/auth/register", json={"email": "webhook5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Not Found Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.get(f"/api/projects/{project_id}/webhooks/nonexistent-id", headers=auth_headers(token))
    assert response.status_code == 404


def test_create_webhook_without_auth(client):
    res = client.post("/api/auth/register", json={"email": "webhook6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Unauth Webhook Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Unauthorized Webhook", "url": "https://example.com/unauth", "events": ["record.created"]},
    )
    assert response.status_code == 401


def test_webhook_delivery_on_record_created(client):
    res = client.post("/api/auth/register", json={"email": "webhook7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delivery Test Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    webhook_res = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "Record Created Hook", "url": "https://example.com/hook", "events": ["record.created"]},
        headers=auth_headers(token),
    )
    webhook_id = webhook_res.json()["id"]

    client.post(
        f"/api/projects/{project_id}/schema/collections",
        json={"name": "items", "display_name": "Items"},
        headers=auth_headers(token),
    )

    client.post(
        f"/api/projects/{project_id}/data/items",
        json={},
        headers=auth_headers(token),
    )

    deliveries_res = client.get(
        f"/api/projects/{project_id}/webhooks/{webhook_id}/deliveries",
        headers=auth_headers(token),
    )
    assert deliveries_res.status_code == 200
    deliveries = deliveries_res.json()
    assert len(deliveries) >= 1
    assert deliveries[0]["event_type"] == "record.created"


def test_list_webhook_deliveries(client):
    res = client.post("/api/auth/register", json={"email": "webhook8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Deliveries List Project"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]

    webhook_res = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"name": "List Deliveries Hook", "url": "https://example.com/hook", "events": ["*"]},
        headers=auth_headers(token),
    )
    webhook_id = webhook_res.json()["id"]

    deliveries_res = client.get(
        f"/api/projects/{project_id}/webhooks/{webhook_id}/deliveries",
        headers=auth_headers(token),
    )
    assert deliveries_res.status_code == 200
    assert isinstance(deliveries_res.json(), list)
