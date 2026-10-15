import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

EXCEL_PATH = Path(__file__).resolve().parent.parent.parent / "desktop.xlsx"

@pytest.fixture(scope="module")
def admin_token():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert res.status_code == 200
    return res.json()["access_token"]

@pytest.fixture(scope="module")
def viewer_token():
    res = client.post("/api/auth/login", json={"username": "viewer", "password": "Viewer@123"})
    assert res.status_code == 200
    return res.json()["access_token"]

def test_preview_desktop_xlsx(admin_token):
    assert EXCEL_PATH.exists(), f"desktop.xlsx not found at {EXCEL_PATH}"
    
    with open(EXCEL_PATH, "rb") as f:
        response = client.post(
            "/api/import/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("desktop.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["filename"] == "desktop.xlsx"
    assert data["sheet_name"] == "Stock Summary"
    assert data["product_rows_count"] == 204
    assert data["category_rows_count"] == 3
    assert data["header_rows_count"] == 10
    
    recon = data["reconciliation"]
    assert float(recon["grand_total_closing"]) == 8596.0
    assert float(recon["calculated_items_closing"]) == 8596.0
    assert float(recon["closing_discrepancy"]) == 0.0
    
    # 14 unit header difference detected and explained
    assert float(recon["inward_discrepancy"]) == 14.0
    assert float(recon["outward_discrepancy"]) == 14.0
    assert recon["discrepancy_explanation"] is not None
    assert recon["negative_stock_rows_count"] == 1  # Row 202 (-5)
    
    # Verify row preview contents
    row_types = [r["row_type"] for r in data["preview_rows"]]
    assert "HEADER" in row_types
    assert "CATEGORY" in row_types
    assert "PRODUCT" in row_types
    assert "TOTAL" in row_types

def test_viewer_cannot_confirm_import(viewer_token):
    with open(EXCEL_PATH, "rb") as f:
        response = client.post(
            "/api/import/confirm",
            headers={"Authorization": f"Bearer {viewer_token}"},
            files={"file": ("desktop.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
    assert response.status_code == 403
    assert "Administrator access required" in response.json()["detail"]

def test_admin_confirm_import_success(admin_token):
    with open(EXCEL_PATH, "rb") as f:
        response = client.post(
            "/api/import/confirm",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("desktop.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"allow_negative_stock": "true", "update_existing_products": "true"}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 204
    assert data["error_count"] == 0
    assert data["id"] is not None
    
    batch_id = data["id"]
    
    # Verify batch details
    detail_res = client.get(
        f"/api/import/batch/{batch_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert detail_res.status_code == 200
    batch_data = detail_res.json()
    assert batch_data["imported_count"] == 204
    assert len(batch_data["row_results"]) > 0

def test_duplicate_import_prevention(admin_token):
    # Try importing the same file again without update_existing_products
    with open(EXCEL_PATH, "rb") as f:
        response = client.post(
            "/api/import/confirm",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("desktop.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"allow_negative_stock": "true", "update_existing_products": "false"}
        )
    assert response.status_code == 409
    assert "already imported" in response.json()["detail"]

def test_import_history_endpoint(viewer_token):
    res = client.get("/api/import/history", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    batches = res.json()
    assert len(batches) >= 1
    assert batches[0]["filename"] == "desktop.xlsx"
