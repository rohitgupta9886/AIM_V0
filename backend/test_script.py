import json
from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.inventory import InventoryTransaction
from app.api.analysis import get_category_stock_report, get_product_movement_report

db = SessionLocal()
try:
    user = db.query(User).first()
    print("User:", user.username if user else "None")

    prod = db.query(Product).first()
    if prod:
        print(f"PROD: id={prod.id}, sku={prod.sku}, name={prod.name}")
        mov = get_product_movement_report(
            product_id=prod.id,
            category=None,
            start_date=None,
            end_date=None,
            db=db,
            current_user=user
        )
        print("MOVEMENT_COUNT:", len(mov))
        for m in mov:
            print("MOV_SAMPLE:", json.dumps(m))
finally:
    db.close()
