import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "version" in data

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_admin_login_success():
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"

def test_viewer_login_success():
    response = client.post(
        "/api/auth/login",
        json={"username": "viewer", "password": "Viewer@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "viewer"
    assert data["user"]["role"] == "viewer"

def test_login_invalid_password():
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "WrongPassword"}
    )
    assert response.status_code == 401
    assert "detail" in response.json()

def test_auth_me_endpoint():
    # Login as admin
    login_res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin@123"}
    )
    token = login_res.json()["access_token"]
    
    # Access /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "admin"
    assert me_res.json()["role"] == "admin"

def test_auth_me_unauthorized():
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 401
