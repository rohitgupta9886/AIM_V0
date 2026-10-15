import pytest
import uuid
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

def test_category_crud_lifecycle(admin_token, viewer_token):
    unique_suffix = uuid.uuid4().hex[:6]
    cat_name = f"Cat_{unique_suffix}"
    cat_updated = f"Cat_Renamed_{unique_suffix}"

    # 1. Viewer can list categories
    list_res = client.get("/api/categories", headers={"Authorization": f"Bearer {viewer_token}"})
    assert list_res.status_code == 200
    categories = list_res.json()
    assert isinstance(categories, list)

    # 2. Viewer cannot create category (403)
    viewer_create = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"name": cat_name, "description": "Test Desc"}
    )
    assert viewer_create.status_code == 403

    # 3. Admin creates category
    create_res = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": cat_name, "description": "Category for testing variant CRUD"}
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["name"] == cat_name
    assert created["product_count"] == 0
    cat_id = created["id"]

    # 4. Duplicate name rejected (409)
    dup_res = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": cat_name.lower()}
    )
    assert dup_res.status_code == 409

    # 5. Create a product variant with this category
    sku = f"SKU-CAT-{unique_suffix}".upper()
    prod_res = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "sku": sku,
            "name": f"Variant In {cat_name}",
            "category": cat_name,
            "unit": "Pcs",
            "minimum_stock": 5.0,
            "opening_stock": 10.0
        }
    )
    assert prod_res.status_code == 200
    prod_data = prod_res.json()
    assert prod_data["category"] == cat_name

    # 6. Verify product_count increased to 1
    list_res_after = client.get("/api/categories", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_res_after.status_code == 200
    matching = [c for c in list_res_after.json() if c["id"] == cat_id]
    assert len(matching) == 1
    assert matching[0]["product_count"] == 1

    # 7. Update category name -> propagates to product
    update_res = client.put(
        f"/api/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": cat_updated, "description": "Updated Description"}
    )
    assert update_res.status_code == 200
    updated_cat = update_res.json()
    assert updated_cat["name"] == cat_updated
    assert updated_cat["product_count"] == 1

    # Verify product in database was updated to new category name
    get_prod = client.get(f"/api/products/{prod_data['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert get_prod.status_code == 200
    assert get_prod.json()["category"] == cat_updated

    # 8. Deleting category without reassign should fail because 1 product is assigned
    del_fail = client.delete(
        f"/api/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_fail.status_code == 400
    assert "assigned to it" in del_fail.json()["detail"]

    # 9. Delete with reassign_to another category
    reassign_target = "WPC Door"
    del_reassign = client.delete(
        f"/api/categories/{cat_id}?reassign_to={reassign_target}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_reassign.status_code == 200

    # Verify product was reassigned to WPC Door
    get_prod_reassigned = client.get(f"/api/products/{prod_data['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert get_prod_reassigned.status_code == 200
    assert get_prod_reassigned.json()["category"] == reassign_target
