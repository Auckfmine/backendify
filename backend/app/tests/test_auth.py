def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_me(client):
    res = client.post("/api/auth/register", json={"email": "user@example.com", "password": "password123"})
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data and "refresh_token" in data

    me = client.get("/api/me", headers=auth_headers(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"

    login_res = client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["access_token"]


def test_refresh_rotation_invalidates_old_token(client):
    res = client.post("/api/auth/register", json={"email": "refresh@example.com", "password": "password123"})
    refresh_token = res.json()["refresh_token"]

    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    new_refresh = refresh_res.json()["refresh_token"]

    old_refresh_attempt = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert old_refresh_attempt.status_code == 401

    # new refresh works
    final_attempt = client.post("/api/auth/refresh", json={"refresh_token": new_refresh})
    assert final_attempt.status_code == 200


def test_login_invalid_credentials(client):
    # Register a user first
    client.post("/api/auth/register", json={"email": "valid@example.com", "password": "password123"})

    # Wrong password
    res = client.post("/api/auth/login", json={"email": "valid@example.com", "password": "wrongpassword"})
    assert res.status_code == 401

    # Non-existent user
    res = client.post("/api/auth/login", json={"email": "nonexistent@example.com", "password": "password123"})
    assert res.status_code == 401


def test_register_duplicate_email(client):
    client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "password123"})
    res = client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "password123"})
    assert res.status_code == 409


def test_me_without_auth(client):
    res = client.get("/api/me")
    assert res.status_code == 401
