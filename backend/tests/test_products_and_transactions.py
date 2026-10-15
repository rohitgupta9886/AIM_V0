import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def admin_token():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    return res.json()["access_token"]

@pytest.fixture(scope="module")
def viewer_token():
    res = client.post("/api/auth/login", json={"username": "viewer", "password": "Viewer@123"})
    return res.json()["access_token"]

def test_list_products_and_search(viewer_token):
    res = client.get("/api/products?page=1&page_size=10", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 204
    assert len(data["items"]) == 10

    # Search by thickness or dimension
    search_res = client.get("/api/products?search=Ivory", headers={"Authorization": f"Bearer {viewer_token}"})
    assert search_res.status_code == 200
    assert search_res.json()["total"] > 0

def test_create_and_edit_product(admin_token):
    import uuid
    sku = f"TEST-SKU-{uuid.uuid4().hex[:6]}".upper()
    create_res = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "sku": sku,
            "name": "Test Polymer Variant 100",
            "category": "Test Category",
            "unit": "Pcs",
            "thickness": "30MM",
            "colour_finish": "Glossy Black",
            "dimensions": "80X40",
            "minimum_stock": 10.0,
            "opening_stock": 50.0
        }
    )
    assert create_res.status_code == 200
    product = create_res.json()
    assert product["sku"] == sku
    assert float(product["current_quantity"]) == 50.0
    prod_id = product["id"]

    # Edit product
    edit_res = client.put(
        f"/api/products/{prod_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Test Polymer Variant 100 Updated", "minimum_stock": 15.0}
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["name"] == "Test Polymer Variant 100 Updated"

def test_stock_inward_and_outward_workflow(admin_token):
    # Create distinct product for transaction testing
    import uuid
    sku = f"TX-SKU-{uuid.uuid4().hex[:6]}"
    prod_res = client.post(

        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "sku": sku,
            "name": "Transaction Workflow SKU",
            "category": "WPC Door",
            "opening_stock": 20.0
        }
    )
    prod_id = prod_res.json()["id"]

    # Post inward 15 units
    inward_res = client.post(
        "/api/inventory/inward",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": prod_id, "quantity": 15.0, "remarks": "PO Received"}
    )
    assert inward_res.status_code == 200
    assert float(inward_res.json()["current_balance_after"]) == 35.0

    # Post outward 10 units
    outward_res = client.post(
        "/api/inventory/outward",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": prod_id, "quantity": 10.0, "remarks": "Sales Order 101"}
    )
    assert outward_res.status_code == 200
    assert float(outward_res.json()["current_balance_after"]) == 25.0

    # Insufficient stock test: attempt to dispatch 50 units (only 25 available)
    bad_outward = client.post(
        "/api/inventory/outward",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": prod_id, "quantity": 50.0}
    )
    assert bad_outward.status_code == 400
    assert "Insufficient stock" in bad_outward.json()["detail"]

    # Post adjustment of -5 units with reason
    adj_res = client.post(
        "/api/inventory/adjustment",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": prod_id, "quantity": -5.0, "reason": "Damaged during handling"}
    )
    assert adj_res.status_code == 200
    assert float(adj_res.json()["current_balance_after"]) == 20.0

def test_viewer_cannot_post_transactions(viewer_token):
    res = client.post(
        "/api/inventory/inward",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"product_id": 1, "quantity": 10.0}
    )
    assert res.status_code == 403

def test_dashboard_metrics(viewer_token):
    res = client.get("/api/analysis/dashboard", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert data["kpis"]["active_skus"] >= 204
    assert data["kpis"]["total_stock_quantity"] > 0
    assert len(data["stock_by_category"]) >= 3
    assert len(data["top_skus"]) <= 10

def test_export_endpoints(viewer_token):
    # CSV export
    csv_res = client.get("/api/analysis/export?report_type=stock_summary&export_format=csv", headers={"Authorization": f"Bearer {viewer_token}"})
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "SKU,Name,Category" in csv_res.text

    # Excel export
    xlsx_res = client.get("/api/analysis/export?report_type=stock_summary&export_format=xlsx", headers={"Authorization": f"Bearer {viewer_token}"})
    assert xlsx_res.status_code == 200
    assert "spreadsheetml" in xlsx_res.headers["content-type"]
