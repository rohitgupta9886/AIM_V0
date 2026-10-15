from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.inventory import InventoryBalance, InventoryTransaction, TransactionType
from app.services.excel_import import ExcelImportService

def seed_users(db: Session = None):
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        users_to_seed = [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "admin",
            },
            {
                "username": "viewer",
                "password": "Viewer@123",
                "role": "viewer",
            }
        ]
        
        for u_data in users_to_seed:
            existing = db.query(User).filter(User.username == u_data["username"]).first()
            if not existing:
                user = User(
                    username=u_data["username"],
                    password_hash=get_password_hash(u_data["password"]),
                    role=u_data["role"],
                    active=True
                )
                db.add(user)
                print(f"[Seed] Created user: {u_data['username']} ({u_data['role']})")
            else:
                if not verify_password(u_data["password"], existing.password_hash):
                    existing.password_hash = get_password_hash(u_data["password"])
                    existing.active = True
                    print(f"[Seed] Synchronized credentials for user: {u_data['username']}")
                else:
                    print(f"[Seed] User {u_data['username']} already exists with valid credentials.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Seed ERROR] Failed to seed users: {e}")
        raise
    finally:
        if own_session:
            db.close()

def seed_sample_activity(db: Session):
    """Adds realistic sample dispatches and adjustments so Analytics and Reports have live charts on initial boot."""
    try:
        sample_txs = [
            # Inward stock
            {"sku": "WPC-D-25MM-75X27-IVORY", "type": TransactionType.INWARD, "qty": Decimal("20.00"), "ref": "INW-INIT-001", "remarks": "PO Received from Factory"},
            {"sku": "PVC-PVC-SHEET-PCS", "type": TransactionType.INWARD, "qty": Decimal("15.00"), "ref": "INW-INIT-002", "remarks": "Restock batch arrived"},
            # Outward stock
            {"sku": "WPC-DF-100X63-DBROWN-10FT", "type": TransactionType.OUTWARD, "qty": Decimal("5.00"), "ref": "DISPATCH-101", "remarks": "Dispatched to Delhi Site"},
            {"sku": "WPC-D-25MM-72X24-IVORY", "type": TransactionType.OUTWARD, "qty": Decimal("3.00"), "ref": "DISPATCH-102", "remarks": "Commercial Client Order"},
            # Adjustments
            {"sku": "WPC-D-25MM-72X27-IVORY", "type": TransactionType.ADJUSTMENT, "qty": Decimal("-2.00"), "ref": "ADJ-AUDIT-01", "remarks": "Audit count mismatch adjusted"}
        ]
        
        for item in sample_txs:
            prod = db.query(Product).filter(Product.sku == item["sku"]).first()
            if not prod:
                continue
            
            # Check if this specific reference already exists
            existing_tx = db.query(InventoryTransaction).filter(
                InventoryTransaction.product_id == prod.id,
                InventoryTransaction.reference_number == item["ref"]
            ).first()
            if existing_tx:
                continue

            balance = db.query(InventoryBalance).filter(InventoryBalance.product_id == prod.id).first()
            if not balance:
                balance = InventoryBalance(product_id=prod.id, current_quantity=Decimal("0.00"))
                db.add(balance)

            # Record transaction
            now_dt = datetime.now(timezone.utc)
            tx = InventoryTransaction(
                product_id=prod.id,
                transaction_type=item["type"],
                quantity=item["qty"],
                transaction_date=now_dt,
                reference_number=item["ref"],
                remarks=item["remarks"],
                user_name="admin"
            )
            db.add(tx)
            balance.current_quantity += item["qty"]
            balance.last_updated = now_dt
            
        db.commit()
        print("[Seed] Sample operational activity populated for analytics visualizations.")
    except Exception as e:
        db.rollback()
        print(f"[Seed WARNING] Sample activity seeding skipped: {e}")

def seed_inventory(db: Session = None):
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        product_count = db.query(Product).count()
        if product_count > 0:
            print(f"[Seed] Database already has {product_count} products. Skipping initial Excel workbook ingestion.")
            return

        print("[Seed] No products found. Starting initial inventory workbook ingestion...")
        
        possible_paths = [
            Path(__file__).resolve().parent.parent.parent / "desktop.xlsx",
            Path(__file__).resolve().parent.parent.parent.parent / "desktop.xlsx",
            Path("desktop.xlsx"),
            Path("backend/desktop.xlsx")
        ]
        
        workbook_path = None
        for p in possible_paths:
            if p.exists() and p.is_file():
                workbook_path = p
                break
                
        if not workbook_path:
            print("[Seed WARNING] desktop.xlsx workbook not found. Skipping automatic inventory seeding.")
            return

        print(f"[Seed] Reading source workbook: {workbook_path}...")
        with open(workbook_path, "rb") as f:
            file_bytes = f.read()

        batch = ExcelImportService.execute_import(
            db=db,
            file_bytes=file_bytes,
            filename="desktop.xlsx",
            user_name="admin",
            sheet_name="Stock Summary",
            allow_negative_stock=True,
            update_existing_products=True
        )
        print(f"[Seed] Successfully ingested {batch.imported_count} products from {workbook_path.name} into database.")
        
        # Populate sample transactions for immediate dashboard and reports metrics
        seed_sample_activity(db)
        
    except Exception as e:
        db.rollback()
        print(f"[Seed ERROR] Failed to seed inventory: {e}")
        raise
    finally:
        if own_session:
            db.close()

def seed_all(db: Session = None):
    print("[Seed] Initializing seed routine...")
    seed_users(db)
    seed_inventory(db)
    print("[Seed] All seeding tasks completed successfully.")

if __name__ == "__main__":
    seed_all()
