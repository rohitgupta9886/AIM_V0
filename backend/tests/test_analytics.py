import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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


def test_date_validation(viewer_token):
    headers = {"Authorization": f"Bearer {viewer_token}"}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    future = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d")

    # 1. From Date after To Date
    res = client.get(f"/api/analysis/workspace?from_date={today}&to_date={yesterday}", headers=headers)
    assert res.status_code == 400
    assert "From Date cannot be after To Date" in res.json()["detail"]

    # 2. Future From Date
    res = client.get(f"/api/analysis/workspace?from_date={future}&to_date={future}", headers=headers)
    assert res.status_code == 400
    assert "in the future" in res.json()["detail"]

    # 3. Invalid date format
    res = client.get("/api/analysis/workspace?from_date=2026/10/01&to_date=2026/10/10", headers=headers)
    assert res.status_code == 400
    assert "Invalid date format" in res.json()["detail"]


def test_workspace_kpis_and_comparison(viewer_token):
    headers = {"Authorization": f"Bearer {viewer_token}"}
    res = client.get("/api/analysis/workspace?compare_period=true", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Core period object
    assert "period" in data
    assert "from_date" in data["period"]
    assert "to_date" in data["period"]
    assert "days" in data["period"]
    assert "comparison_period" in data
    assert data["comparison_period"]["enabled"] is True

    # 8 KPI Cards verification
    kpis = data["kpis"]
    required_kpis = [
        "total_current_stock",
        "total_inward",
        "total_outward",
        "net_movement",
        "low_stock_count",
        "out_of_stock_count",
        "moving_products",
        "no_movement_products"
    ]
    for k in required_kpis:
        assert k in kpis
        assert "current" in kpis[k]
        assert "previous" in kpis[k]
        assert "diff_abs" in kpis[k]
        assert "diff_pct" in kpis[k]
        assert "unit" in kpis[k]
        assert "color_theme" in kpis[k]

    # Visualizations present
    assert isinstance(data["movement_trend"], list)
    assert isinstance(data["category_distribution"], list)
    assert isinstance(data["top_outward"], list)
    assert isinstance(data["top_inward"], list)
    assert isinstance(data["health_distribution"], dict)
    assert isinstance(data["slow_moving"], list)
    assert isinstance(data["stock_concentration"], list)
    assert isinstance(data["insights"], list)
    assert "reconciliation" in data


def test_movement_table_pagination_and_search(viewer_token):
    headers = {"Authorization": f"Bearer {viewer_token}"}

    # Fetch page 1
    res = client.get("/api/analysis/movement-table?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) <= 10
    assert data["page"] == 1
    assert data["total"] >= 0
    assert "summary" in data

    if len(data["items"]) > 0:
        first = data["items"][0]
        assert "sku" in first
        assert "name" in first
        assert "opening_stock" in first
        assert "period_inward" in first
        assert "period_outward" in first
        assert "closing_stock" in first
        assert "current_stock" in first
        assert "movement_status" in first

    # Search filter
    search_res = client.get("/api/analysis/movement-table?search=PVC", headers=headers)
    assert search_res.status_code == 200
    sdata = search_res.json()
    for item in sdata["items"]:
        match = (
            "pvc" in item["sku"].lower() or
            "pvc" in item["name"].lower() or
            "pvc" in item["category"].lower()
        )
        assert match


def test_reconciliation_audit(viewer_token):
    headers = {"Authorization": f"Bearer {viewer_token}"}
    res = client.get("/api/analysis/workspace", headers=headers)
    assert res.status_code == 200
    recon = res.json()["reconciliation"]

    assert recon["status"] in ["RECONCILED", "DISCREPANCY_FOUND", "INSUFFICIENT_DATA"]
    assert "total_database_stock" in recon
    assert "total_category_stock" in recon
    assert "discrepancy" in recon
    assert "products_audited" in recon
    assert "duplicate_tx_count" in recon
    assert "discrepancy_items" in recon


def test_export_excel_and_csv(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Export movement report as Excel
    excel_res = client.get("/api/analysis/export?report_type=product_movement&export_format=xlsx", headers=headers)
    assert excel_res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000

    # Export stock summary as CSV
    csv_res = client.get("/api/analysis/export?report_type=stock_summary&export_format=csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert b"SKU,Name,Category" in csv_res.content


def test_filter_options(viewer_token):
    headers = {"Authorization": f"Bearer {viewer_token}"}
    res = client.get("/api/analysis/filter-options", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "categories" in data
    assert "thicknesses" in data
    assert "finishes" in data
    assert "dimensions" in data
    assert "lengths" in data
    assert len(data["categories"]) > 0
