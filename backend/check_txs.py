import json
from app.core.database import SessionLocal
from app.models.inventory import InventoryTransaction
from app.models.product import Product

db = SessionLocal()
try:
    txs = db.query(InventoryTransaction, Product.sku, Product.name).join(Product, InventoryTransaction.product_id == Product.id).filter(InventoryTransaction.transaction_type != 'OPENING').all()
    for t, sku, name in txs:
        print(f"TX {t.id}: pid={t.product_id}, sku={sku}, type={t.transaction_type}, qty={t.quantity}, date={t.transaction_date}, ref={t.reference_number}, remarks={t.remarks}")
finally:
    db.close()
