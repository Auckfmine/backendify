"""Tests for File Storage (Milestone N)"""
import io
import pytest
from .test_auth import auth_headers


def test_upload_file(client):
    """Test uploading a file."""
    res = client.post("/api/auth/register", json={"email": "file1@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "File Upload Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    file_content = b"Hello, this is a test file!"
    files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
    data = {"bucket": "documents", "is_public": "false"}
    
    upload_res = client.post(
        f"/api/projects/{project_id}/files/upload",
        files=files,
        data=data,
        headers=auth_headers(token),
    )
    assert upload_res.status_code == 201
    result = upload_res.json()
    assert result["original_filename"] == "test.txt"
    assert result["content_type"] == "text/plain"
    assert result["size_bytes"] == len(file_content)
    assert result["bucket"] == "documents"


def test_list_files(client):
    """Test listing files."""
    res = client.post("/api/auth/register", json={"email": "file2@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "List Files Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    files1 = {"file": ("file1.txt", io.BytesIO(b"content1"), "text/plain")}
    client.post(f"/api/projects/{project_id}/files/upload", files=files1, headers=auth_headers(token))
    
    files2 = {"file": ("file2.txt", io.BytesIO(b"content2"), "text/plain")}
    client.post(f"/api/projects/{project_id}/files/upload", files=files2, headers=auth_headers(token))
    
    list_res = client.get(f"/api/projects/{project_id}/files", headers=auth_headers(token))
    assert list_res.status_code == 200
    files = list_res.json()
    assert len(files) >= 2


def test_get_file_metadata(client):
    """Test getting file metadata."""
    res = client.post("/api/auth/register", json={"email": "file3@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Get File Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    files = {"file": ("metadata.txt", io.BytesIO(b"metadata content"), "text/plain")}
    upload_res = client.post(f"/api/projects/{project_id}/files/upload", files=files, headers=auth_headers(token))
    file_id = upload_res.json()["id"]
    
    get_res = client.get(f"/api/projects/{project_id}/files/{file_id}", headers=auth_headers(token))
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["original_filename"] == "metadata.txt"
    assert "download_url" in data


def test_download_file(client):
    """Test downloading a public file."""
    res = client.post("/api/auth/register", json={"email": "file4@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Download Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    original_content = b"Download this content!"
    files = {"file": ("download.txt", io.BytesIO(original_content), "text/plain")}
    data = {"is_public": "true"}
    upload_res = client.post(f"/api/projects/{project_id}/files/upload", files=files, data=data, headers=auth_headers(token))
    file_id = upload_res.json()["id"]
    
    download_res = client.get(f"/api/projects/{project_id}/files/{file_id}/download")
    assert download_res.status_code == 200
    assert download_res.content == original_content


def test_delete_file(client):
    """Test deleting a file."""
    res = client.post("/api/auth/register", json={"email": "file5@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Delete File Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    files = {"file": ("todelete.txt", io.BytesIO(b"delete me"), "text/plain")}
    upload_res = client.post(f"/api/projects/{project_id}/files/upload", files=files, headers=auth_headers(token))
    file_id = upload_res.json()["id"]
    
    delete_res = client.delete(f"/api/projects/{project_id}/files/{file_id}", headers=auth_headers(token))
    assert delete_res.status_code == 204
    
    get_res = client.get(f"/api/projects/{project_id}/files/{file_id}", headers=auth_headers(token))
    assert get_res.status_code == 404


def test_storage_stats(client):
    """Test getting storage statistics."""
    res = client.post("/api/auth/register", json={"email": "file6@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Stats Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    files = {"file": ("stats.txt", io.BytesIO(b"stats content here"), "text/plain")}
    client.post(f"/api/projects/{project_id}/files/upload", files=files, headers=auth_headers(token))
    
    stats_res = client.get(f"/api/projects/{project_id}/files/stats", headers=auth_headers(token))
    assert stats_res.status_code == 200
    data = stats_res.json()
    assert data["file_count"] >= 1
    assert data["total_bytes"] > 0


def test_file_not_found(client):
    """Test 404 for non-existent file."""
    res = client.post("/api/auth/register", json={"email": "file7@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Not Found Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    get_res = client.get(f"/api/projects/{project_id}/files/nonexistent-id", headers=auth_headers(token))
    assert get_res.status_code == 404


def test_filter_by_bucket(client):
    """Test filtering files by bucket."""
    res = client.post("/api/auth/register", json={"email": "file8@example.com", "password": "password123"})
    token = res.json()["access_token"]
    
    project_res = client.post("/api/projects", json={"name": "Bucket Filter Test"}, headers=auth_headers(token))
    project_id = project_res.json()["id"]
    
    files1 = {"file": ("doc1.txt", io.BytesIO(b"doc1"), "text/plain")}
    client.post(f"/api/projects/{project_id}/files/upload", files=files1, data={"bucket": "docs"}, headers=auth_headers(token))
    
    files2 = {"file": ("img1.png", io.BytesIO(b"img1"), "image/png")}
    client.post(f"/api/projects/{project_id}/files/upload", files=files2, data={"bucket": "images"}, headers=auth_headers(token))
    
    docs_res = client.get(f"/api/projects/{project_id}/files?bucket=docs", headers=auth_headers(token))
    assert docs_res.status_code == 200
    docs = docs_res.json()
    assert all(f["bucket"] == "docs" for f in docs)
