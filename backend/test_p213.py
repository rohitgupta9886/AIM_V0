import json
from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.api.analysis import get_product_movement_report

db = SessionLocal()
try:
    user = db.query(User).first()
    p = db.query(Product).filter(Product.id == 213).first()
    print(f"Product {p.id}: sku={p.sku}, name={p.name}, category={p.category}")
    mov = get_product_movement_report(product_id=p.id, category=None, start_date=None, end_date=None, db=db, current_user=user)
    print("MOVEMENTS COUNT:", len(mov))
    for m in mov:
        print(json.dumps(m))
finally:
    db.close()
