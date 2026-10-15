import sys
import traceback
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

def main():
    print("Initializing TestClient...", flush=True)
    client = TestClient(app)

    print("Logging in as viewer...", flush=True)
    viewer_res = client.post("/api/auth/login", json={"username": "viewer", "password": "Viewer@123"})
    assert viewer_res.status_code == 200, f"Login failed: {viewer_res.text}"
    viewer_token = viewer_res.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    print("Logging in as admin...", flush=True)
    admin_res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert admin_res.status_code == 200, f"Admin login failed: {admin_res.text}"
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Date Validation Tests
    print("Testing date validation...", flush=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    future = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d")

    # From > To
    res = client.get(f"/api/analysis/workspace?from_date={today}&to_date={yesterday}", headers=viewer_headers)
    assert res.status_code == 400 and "From Date cannot be after To Date" in res.json()["detail"], f"Failed: {res.text}"
    print("  -> From > To correctly rejected with 400", flush=True)

    # Future date
    res = client.get(f"/api/analysis/workspace?from_date={future}&to_date={future}", headers=viewer_headers)
    assert res.status_code == 400 and "in the future" in res.json()["detail"], f"Failed: {res.text}"
    print("  -> Future date correctly rejected with 400", flush=True)

    # Invalid format
    res = client.get("/api/analysis/workspace?from_date=bad-date&to_date=2026-10-10", headers=viewer_headers)
    assert res.status_code == 400 and "Invalid date format" in res.json()["detail"], f"Failed: {res.text}"
    print("  -> Invalid format correctly rejected with 400", flush=True)

    # 2. Workspace Intelligence & Period Comparison
    print("Testing /api/analysis/workspace with comparison...", flush=True)
    res = client.get("/api/analysis/workspace?compare_period=true", headers=viewer_headers)
    assert res.status_code == 200, f"Workspace failed: {res.text}"
    data = res.json()

    assert "period" in data and "kpis" in data
    kpis = data["kpis"]
    required_kpis = [
        "total_current_stock", "total_inward", "total_outward", "net_movement",
        "low_stock_count", "out_of_stock_count", "moving_products", "no_movement_products"
    ]
    for k in required_kpis:
        assert k in kpis, f"Missing KPI: {k}"
        assert "current" in kpis[k] and "diff_pct" in kpis[k] and "color_theme" in kpis[k]
    print(f"  -> All 8 KPI cards verified with color themes: {[kpis[k]['color_theme'] for k in required_kpis]}", flush=True)

    assert "movement_trend" in data
    assert "category_distribution" in data
    assert "top_outward" in data
    assert "top_inward" in data
    assert "health_distribution" in data
    assert "slow_moving" in data
    assert "stock_concentration" in data
    assert "insights" in data
    assert "reconciliation" in data
    print("  -> All visual analytics structures validated", flush=True)

    # 3. Product Movement Table
    print("Testing /api/analysis/movement-table...", flush=True)
    table_res = client.get("/api/analysis/movement-table?page=1&page_size=10", headers=viewer_headers)
    assert table_res.status_code == 200, f"Table failed: {table_res.text}"
    tdata = table_res.json()
    assert "items" in tdata and "summary" in tdata
    print(f"  -> Movement table returned {len(tdata['items'])} items, total: {tdata['total']}", flush=True)

    # 4. Filter Options
    print("Testing /api/analysis/filter-options...", flush=True)
    opt_res = client.get("/api/analysis/filter-options", headers=viewer_headers)
    assert opt_res.status_code == 200, f"Filter options failed: {opt_res.text}"
    opts = opt_res.json()
    assert len(opts["categories"]) > 0
    print(f"  -> Categories: {opts['categories']}", flush=True)
    print(f"  -> Finishes: {len(opts['finishes'])}, Thicknesses: {len(opts['thicknesses'])}, Dimensions: {len(opts['dimensions'])}", flush=True)

    # 5. Export Reports
    print("Testing /api/analysis/export for XLSX and CSV...", flush=True)
    excel_res = client.get("/api/analysis/export?report_type=product_movement&export_format=xlsx", headers=admin_headers)
    assert excel_res.status_code == 200
    assert "spreadsheetml.sheet" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000
    print(f"  -> XLSX export generated ({len(excel_res.content)} bytes)", flush=True)

    csv_res = client.get("/api/analysis/export?report_type=stock_summary&export_format=csv", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert len(csv_res.content) > 200
    print(f"  -> CSV export generated ({len(csv_res.content)} bytes)", flush=True)

    print("\nALL BACKEND ANALYTICS TESTS PASSED SUCCESSFULLY!", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        traceback.print_exc()
        sys.exit(1)
