import json
from app.core.database import SessionLocal
from app.models.product import Product
from app.models.inventory import InventoryTransaction, InventoryBalance

db = SessionLocal()
try:
    print("TOTAL PRODUCTS:", db.query(Product).count())
    print("TOTAL BALANCES:", db.query(InventoryBalance).count())
    print("TOTAL TRANSACTIONS:", db.query(InventoryTransaction).count())

    # Check distinct transaction types
    from sqlalchemy import func
    types = db.query(InventoryTransaction.transaction_type, func.count(InventoryTransaction.id)).group_by(InventoryTransaction.transaction_type).all()
    print("TX TYPES:", types)

    # Check a few products and their transactions
    prods = db.query(Product).limit(5).all()
    for p in prods:
        b = db.query(InventoryBalance).filter(InventoryBalance.product_id == p.id).first()
        txs = db.query(InventoryTransaction).filter(InventoryTransaction.product_id == p.id).all()
        print(f"Product {p.id} ({p.sku}): balance={b.current_quantity if b else None}, tx_count={len(txs)}")
        for t in txs:
            print(f"   tx id={t.id}, type={t.transaction_type}, date={t.transaction_date}, qty={t.quantity}, ref={t.reference_number}, remarks={t.remarks}")

finally:
    db.close()
