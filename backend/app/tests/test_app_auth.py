"""
Tests for App User Authentication

Tests the project-scoped authentication for end-users of customer apps.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def create_admin_and_project(client: TestClient, suffix: str = "") -> tuple[str, str]:
    """Helper to create an admin user and project with unique email."""
    unique_id = suffix or str(uuid.uuid4())[:8]
    res = client.post("/api/auth/register", json={"email": f"admin_{unique_id}@test.com", "password": "password123"})
    admin_token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": f"Test Project {unique_id}"}, headers=auth_headers(admin_token))
    project_id = project_res.json()["id"]
    
    return admin_token, project_id


# ============================================================================
# Auth Providers Discovery
# ============================================================================

def test_get_auth_providers(client):
    """Test getting auth providers for a project."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.get(f"/api/projects/{project_id}/auth/providers")
    assert res.status_code == 200
    
    data = res.json()
    assert data["email_password"] is True  # Default enabled
    assert data["magic_link"] is False
    assert data["otp"] is False
    assert data["oauth_google"] is False
    assert data["oauth_github"] is False
    assert data["session_mode"] == "header"
    assert data["allow_public_signup"] is True


# ============================================================================
# App User Registration
# ============================================================================

def test_register_app_user(client):
    """Test registering a new app user."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    assert res.status_code == 201
    
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_register_duplicate_email(client):
    """Test that duplicate email registration fails."""
    admin_token, project_id = create_admin_and_project(client)
    
    # First registration
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    
    # Duplicate registration
    res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "differentpass123"}
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_register_weak_password(client):
    """Test that weak passwords are rejected."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "short"}
    )
    assert res.status_code == 422  # Validation error


# ============================================================================
# App User Login
# ============================================================================

def test_login_app_user(client):
    """Test logging in an app user."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register first
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    
    # Login
    res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    assert res.status_code == 200
    
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_invalid_credentials(client):
    """Test login with invalid credentials."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register first
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    
    # Login with wrong password
    res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword"}
    )
    assert res.status_code == 401


def test_login_nonexistent_user(client):
    """Test login with nonexistent user."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "nonexistent@example.com", "password": "anypassword"}
    )
    assert res.status_code == 401


# ============================================================================
# Token Refresh
# ============================================================================

def test_refresh_tokens(client):
    """Test refreshing tokens."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register and get tokens
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    refresh_token = reg_res.json()["refresh_token"]
    
    # Refresh
    res = client.post(
        f"/api/projects/{project_id}/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert res.status_code == 200
    
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # New refresh token should be different (rotation)
    assert data["refresh_token"] != refresh_token


def test_refresh_token_rotation(client):
    """Test that old refresh token is invalidated after rotation."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register and get tokens
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    old_refresh_token = reg_res.json()["refresh_token"]
    
    # Refresh once
    client.post(
        f"/api/projects/{project_id}/auth/refresh",
        json={"refresh_token": old_refresh_token}
    )
    
    # Try to use old refresh token again
    res = client.post(
        f"/api/projects/{project_id}/auth/refresh",
        json={"refresh_token": old_refresh_token}
    )
    assert res.status_code == 401


def test_refresh_invalid_token(client):
    """Test refresh with invalid token."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/refresh",
        json={"refresh_token": "invalid_token"}
    )
    assert res.status_code == 401


# ============================================================================
# Get Current User (Me)
# ============================================================================

def test_get_me(client):
    """Test getting current app user info."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register and get access token
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    access_token = reg_res.json()["access_token"]
    
    # Get me
    res = client.get(
        f"/api/projects/{project_id}/auth/me",
        headers=auth_headers(access_token)
    )
    assert res.status_code == 200
    
    data = res.json()
    assert data["email"] == "user@example.com"
    assert data["is_email_verified"] is False
    assert "id" in data


def test_get_me_unauthorized(client):
    """Test getting me without auth."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.get(f"/api/projects/{project_id}/auth/me")
    assert res.status_code == 422  # Missing header


# ============================================================================
# Logout
# ============================================================================

def test_logout(client):
    """Test logging out (revoking refresh token)."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register and get tokens
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    refresh_token = reg_res.json()["refresh_token"]
    
    # Logout
    res = client.post(
        f"/api/projects/{project_id}/auth/logout",
        json={"refresh_token": refresh_token}
    )
    assert res.status_code == 204
    
    # Try to use the refresh token
    res = client.post(
        f"/api/projects/{project_id}/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert res.status_code == 401


# ============================================================================
# Password Change
# ============================================================================

def test_change_password(client):
    """Test changing password."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "oldpassword123"}
    )
    access_token = reg_res.json()["access_token"]
    
    # Change password
    res = client.post(
        f"/api/projects/{project_id}/auth/password/change",
        json={"current_password": "oldpassword123", "new_password": "newpassword123"},
        headers=auth_headers(access_token)
    )
    assert res.status_code == 204
    
    # Login with new password
    res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "user@example.com", "password": "newpassword123"}
    )
    assert res.status_code == 200


def test_change_password_wrong_current(client):
    """Test changing password with wrong current password."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "oldpassword123"}
    )
    access_token = reg_res.json()["access_token"]
    
    # Change password with wrong current
    res = client.post(
        f"/api/projects/{project_id}/auth/password/change",
        json={"current_password": "wrongpassword", "new_password": "newpassword123"},
        headers=auth_headers(access_token)
    )
    assert res.status_code == 401


# ============================================================================
# Auth Settings (Admin)
# ============================================================================

def test_get_auth_settings_admin(client):
    """Test getting auth settings as admin."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.get(
        f"/api/projects/{project_id}/settings/auth",
        headers=auth_headers(admin_token)
    )
    assert res.status_code == 200
    
    data = res.json()
    assert data["enable_email_password"] is True
    assert data["access_ttl_minutes"] == 15
    assert data["refresh_ttl_days"] == 7


def test_update_auth_settings(client):
    """Test updating auth settings."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={
            "enable_magic_link": True,
            "access_ttl_minutes": 30,
            "require_email_verification": True
        },
        headers=auth_headers(admin_token)
    )
    assert res.status_code == 200
    
    data = res.json()
    assert data["enable_magic_link"] is True
    assert data["access_ttl_minutes"] == 30
    assert data["require_email_verification"] is True


def test_disable_public_signup(client):
    """Test that disabling public signup blocks registration."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Disable public signup
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"allow_public_signup": False},
        headers=auth_headers(admin_token)
    )
    
    # Try to register
    res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    assert res.status_code == 403
    assert "not allowed" in res.json()["detail"]


# ============================================================================
# App User Management (Admin)
# ============================================================================

def test_list_app_users(client):
    """Test listing app users as admin."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register some app users
    for i in range(3):
        client.post(
            f"/api/projects/{project_id}/auth/register",
            json={"email": f"user{i}@example.com", "password": "securepass123"}
        )
    
    # List users
    res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    assert res.status_code == 200
    assert len(res.json()) == 3


def test_disable_app_user(client):
    """Test disabling an app user."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register an app user
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    
    # Get the user ID from the list
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    app_user_id = users_res.json()[0]["id"]
    
    # Disable the user
    res = client.patch(
        f"/api/projects/{project_id}/settings/auth/users/{app_user_id}",
        json={"is_disabled": True},
        headers=auth_headers(admin_token)
    )
    assert res.status_code == 200
    assert res.json()["is_disabled"] is True
    
    # Try to login as disabled user
    res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"]


def test_delete_app_user(client):
    """Test deleting an app user."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register an app user
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "user@example.com", "password": "securepass123"}
    )
    
    # Get the user ID
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    app_user_id = users_res.json()[0]["id"]
    
    # Delete the user
    res = client.delete(
        f"/api/projects/{project_id}/settings/auth/users/{app_user_id}",
        headers=auth_headers(admin_token)
    )
    assert res.status_code == 204
    
    # Verify user is gone
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    assert len(users_res.json()) == 0


# ============================================================================
# Email Verification
# ============================================================================

def test_email_verification_flow(client):
    """Test the complete email verification flow."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register a user
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "verify@example.com", "password": "securepass123"}
    )
    access_token = reg_res.json()["access_token"]
    
    # Check user is not verified
    me_res = client.get(
        f"/api/projects/{project_id}/auth/me",
        headers=auth_headers(access_token)
    )
    assert me_res.json()["is_email_verified"] is False
    
    # Request verification token
    verify_res = client.post(
        f"/api/projects/{project_id}/auth/verify/send",
        headers=auth_headers(access_token)
    )
    assert verify_res.status_code == 200
    token = verify_res.json()["token"]
    
    # Confirm verification
    confirm_res = client.post(
        f"/api/projects/{project_id}/auth/verify/confirm",
        params={"token": token}
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["email"] == "verify@example.com"
    
    # Check user is now verified
    me_res = client.get(
        f"/api/projects/{project_id}/auth/me",
        headers=auth_headers(access_token)
    )
    assert me_res.json()["is_email_verified"] is True


def test_email_verification_already_verified(client):
    """Test that already verified users can't request verification."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register and verify a user
    reg_res = client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "verified@example.com", "password": "securepass123"}
    )
    access_token = reg_res.json()["access_token"]
    
    # Get verification token and verify
    verify_res = client.post(
        f"/api/projects/{project_id}/auth/verify/send",
        headers=auth_headers(access_token)
    )
    token = verify_res.json()["token"]
    client.post(f"/api/projects/{project_id}/auth/verify/confirm", params={"token": token})
    
    # Try to request verification again
    verify_res = client.post(
        f"/api/projects/{project_id}/auth/verify/send",
        headers=auth_headers(access_token)
    )
    assert verify_res.status_code == 400
    assert "already verified" in verify_res.json()["detail"]


def test_email_verification_invalid_token(client):
    """Test verification with invalid token."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/verify/confirm",
        params={"token": "invalid_token"}
    )
    assert res.status_code == 400


# ============================================================================
# Password Reset
# ============================================================================

def test_password_reset_flow(client):
    """Test the complete password reset flow."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register a user
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "reset@example.com", "password": "oldpassword123"}
    )
    
    # Request password reset
    reset_res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/send",
        params={"email": "reset@example.com"}
    )
    assert reset_res.status_code == 200
    token = reset_res.json().get("token")
    assert token is not None
    
    # Reset password
    confirm_res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/confirm",
        params={"token": token, "new_password": "newpassword123"}
    )
    assert confirm_res.status_code == 200
    
    # Login with new password
    login_res = client.post(
        f"/api/projects/{project_id}/auth/login",
        json={"email": "reset@example.com", "password": "newpassword123"}
    )
    assert login_res.status_code == 200


def test_password_reset_nonexistent_email(client):
    """Test password reset for nonexistent email (should not reveal if email exists)."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Request password reset for nonexistent email
    reset_res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/send",
        params={"email": "nonexistent@example.com"}
    )
    # Should return success to prevent email enumeration
    assert reset_res.status_code == 200
    # But no token should be returned
    assert "token" not in reset_res.json()


def test_password_reset_invalid_token(client):
    """Test password reset with invalid token."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/confirm",
        params={"token": "invalid_token", "new_password": "newpassword123"}
    )
    assert res.status_code == 400


def test_password_reset_token_reuse(client):
    """Test that password reset token can only be used once."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Register a user
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "reuse@example.com", "password": "oldpassword123"}
    )
    
    # Request password reset
    reset_res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/send",
        params={"email": "reuse@example.com"}
    )
    token = reset_res.json()["token"]
    
    # Use the token
    client.post(
        f"/api/projects/{project_id}/auth/password/reset/confirm",
        params={"token": token, "new_password": "newpassword123"}
    )
    
    # Try to use the token again
    res = client.post(
        f"/api/projects/{project_id}/auth/password/reset/confirm",
        params={"token": token, "new_password": "anotherpassword123"}
    )
    assert res.status_code == 400


# ============================================================================
# OTP / Magic Link Login
# ============================================================================

def test_otp_login_flow(client):
    """Test the complete OTP login flow."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable OTP
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_otp": True},
        headers=auth_headers(admin_token)
    )
    
    # Register a user first (so they exist)
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "otp@example.com", "password": "securepass123"}
    )
    
    # Request OTP code
    otp_res = client.post(
        f"/api/projects/{project_id}/auth/otp/send",
        params={"email": "otp@example.com"}
    )
    assert otp_res.status_code == 200
    code = otp_res.json().get("code")
    assert code is not None
    assert len(code) == 6
    
    # Verify OTP code
    verify_res = client.post(
        f"/api/projects/{project_id}/auth/otp/verify",
        params={"email": "otp@example.com", "code": code}
    )
    assert verify_res.status_code == 200
    assert "access_token" in verify_res.json()
    assert "refresh_token" in verify_res.json()


def test_otp_not_enabled(client):
    """Test that OTP fails when not enabled."""
    admin_token, project_id = create_admin_and_project(client)
    
    # OTP is not enabled by default
    res = client.post(
        f"/api/projects/{project_id}/auth/otp/send",
        params={"email": "test@example.com"}
    )
    assert res.status_code == 400
    assert "not enabled" in res.json()["detail"]


def test_otp_invalid_code(client):
    """Test OTP verification with invalid code."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable OTP
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_otp": True},
        headers=auth_headers(admin_token)
    )
    
    # Register a user
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "otp2@example.com", "password": "securepass123"}
    )
    
    # Request OTP code
    client.post(
        f"/api/projects/{project_id}/auth/otp/send",
        params={"email": "otp2@example.com"}
    )
    
    # Try invalid code
    res = client.post(
        f"/api/projects/{project_id}/auth/otp/verify",
        params={"email": "otp2@example.com", "code": "000000"}
    )
    assert res.status_code == 400
    assert "Invalid OTP code" in res.json()["detail"]


def test_magic_link_auto_create_user(client):
    """Test that magic link creates user if doesn't exist."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable magic link
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_magic_link": True},
        headers=auth_headers(admin_token)
    )
    
    # Request OTP for non-existent user (should auto-create)
    otp_res = client.post(
        f"/api/projects/{project_id}/auth/otp/send",
        params={"email": "newuser@example.com"}
    )
    assert otp_res.status_code == 200
    code = otp_res.json().get("code")
    assert code is not None
    
    # Verify OTP - should create user and return tokens
    verify_res = client.post(
        f"/api/projects/{project_id}/auth/otp/verify",
        params={"email": "newuser@example.com", "code": code}
    )
    assert verify_res.status_code == 200
    
    # Check user was created
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    emails = [u["email"] for u in users_res.json()]
    assert "newuser@example.com" in emails


# ============================================================================
# OAuth Login
# ============================================================================

def test_oauth_login_new_user(client):
    """Test OAuth login creates new user."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable Google OAuth
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_oauth_google": True},
        headers=auth_headers(admin_token)
    )
    
    # OAuth callback with new user
    res = client.post(
        f"/api/projects/{project_id}/auth/oauth/callback",
        params={
            "provider": "google",
            "provider_user_id": "google_123",
            "email": "oauth@example.com"
        }
    )
    assert res.status_code == 200
    assert "access_token" in res.json()
    
    # Check user was created
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    emails = [u["email"] for u in users_res.json()]
    assert "oauth@example.com" in emails


def test_oauth_login_existing_identity(client):
    """Test OAuth login with existing identity."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable Google OAuth
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_oauth_google": True},
        headers=auth_headers(admin_token)
    )
    
    # First OAuth login
    client.post(
        f"/api/projects/{project_id}/auth/oauth/callback",
        params={
            "provider": "google",
            "provider_user_id": "google_456",
            "email": "oauth2@example.com"
        }
    )
    
    # Second OAuth login with same identity
    res = client.post(
        f"/api/projects/{project_id}/auth/oauth/callback",
        params={
            "provider": "google",
            "provider_user_id": "google_456",
            "email": "oauth2@example.com"
        }
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_oauth_link_existing_email(client):
    """Test OAuth links to existing user with same email."""
    admin_token, project_id = create_admin_and_project(client)
    
    # Enable Google OAuth
    client.put(
        f"/api/projects/{project_id}/settings/auth",
        json={"enable_oauth_google": True},
        headers=auth_headers(admin_token)
    )
    
    # Register user with email/password
    client.post(
        f"/api/projects/{project_id}/auth/register",
        json={"email": "existing@example.com", "password": "securepass123"}
    )
    
    # OAuth login with same email
    res = client.post(
        f"/api/projects/{project_id}/auth/oauth/callback",
        params={
            "provider": "google",
            "provider_user_id": "google_789",
            "email": "existing@example.com"
        }
    )
    assert res.status_code == 200
    
    # Should still be only one user
    users_res = client.get(
        f"/api/projects/{project_id}/settings/auth/users",
        headers=auth_headers(admin_token)
    )
    assert len(users_res.json()) == 1


def test_oauth_not_enabled(client):
    """Test OAuth fails when not enabled."""
    admin_token, project_id = create_admin_and_project(client)
    
    # OAuth is not enabled by default
    res = client.post(
        f"/api/projects/{project_id}/auth/oauth/callback",
        params={
            "provider": "google",
            "provider_user_id": "google_000",
            "email": "test@example.com"
        }
    )
    assert res.status_code == 400
    assert "not enabled" in res.json()["detail"]


# ============================================================================
# Auth Meta Endpoint
# ============================================================================

def test_get_auth_meta(client):
    """Test getting auth meta documentation."""
    admin_token, project_id = create_admin_and_project(client)
    
    res = client.get(f"/api/projects/{project_id}/auth/meta")
    assert res.status_code == 200
    
    data = res.json()
    assert data["project_id"] == project_id
    assert "providers" in data
    assert "settings" in data
    assert "endpoints" in data
    assert "examples" in data
    assert "error_codes" in data
    
    # Check providers
    assert data["providers"]["email_password"] is True
    
    # Check endpoints exist
    endpoint_names = [e["name"] for e in data["endpoints"]]
    assert "Register" in endpoint_names
    assert "Login" in endpoint_names
    assert "Get Current User" in endpoint_names
    
    # Check examples
    assert "curl" in data["examples"]
    assert "fetch" in data["examples"]


# ============================================================================
# Multi-tenant Isolation
# ============================================================================

def test_multi_tenant_isolation(client):
    """Test that app users are isolated between projects."""
    # Create two projects with unique emails
    unique1 = str(uuid.uuid4())[:8]
    unique2 = str(uuid.uuid4())[:8]
    
    res1 = client.post("/api/auth/register", json={"email": f"admin1_{unique1}@test.com", "password": "password123"})
    admin1_token = res1.json()["access_token"]
    proj1_res = client.post("/api/projects", json={"name": f"Project 1 {unique1}"}, headers=auth_headers(admin1_token))
    project1_id = proj1_res.json()["id"]
    
    res2 = client.post("/api/auth/register", json={"email": f"admin2_{unique2}@test.com", "password": "password123"})
    admin2_token = res2.json()["access_token"]
    proj2_res = client.post("/api/projects", json={"name": f"Project 2 {unique2}"}, headers=auth_headers(admin2_token))
    project2_id = proj2_res.json()["id"]
    
    # Register same email in both projects
    res1 = client.post(
        f"/api/projects/{project1_id}/auth/register",
        json={"email": "user@example.com", "password": "password1"}
    )
    assert res1.status_code == 201
    
    res2 = client.post(
        f"/api/projects/{project2_id}/auth/register",
        json={"email": "user@example.com", "password": "password2"}
    )
    assert res2.status_code == 201  # Same email allowed in different project
    
    # Login with project1 password in project1
    res = client.post(
        f"/api/projects/{project1_id}/auth/login",
        json={"email": "user@example.com", "password": "password1"}
    )
    assert res.status_code == 200
    
    # Login with project2 password in project2
    res = client.post(
        f"/api/projects/{project2_id}/auth/login",
        json={"email": "user@example.com", "password": "password2"}
    )
    assert res.status_code == 200
    
    # Cross-project login should fail
    res = client.post(
        f"/api/projects/{project1_id}/auth/login",
        json={"email": "user@example.com", "password": "password2"}
    )
    assert res.status_code == 401
