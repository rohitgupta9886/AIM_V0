"""
Sync to Supabase Tool for StockMatrix ERP (AIM_V0)

Usage:
    python sync_to_supabase.py "postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require"

Or if DATABASE_URL is set in your environment:
    python sync_to_supabase.py
"""

import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def run_sync(db_url: str = None):
    if not db_url:
        if len(sys.argv) > 1:
            db_url = sys.argv[1].strip()
        else:
            db_url = os.getenv("DATABASE_URL", "").strip()

    if not db_url:
        print("[ERROR] No target database URL provided.")
        print("Usage: python sync_to_supabase.py <SUPABASE_CONNECTION_STRING>")
        sys.exit(1)

    # Normalize driver to postgresql+psycopg2
    if db_url.startswith("postgresql+psycopg://"):
        db_url = db_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    print("\n=======================================================")
    print(" Connecting to Supabase Database...")
    print(f" Target: {db_url.split('@')[-1] if '@' in db_url else 'specified host'}")
    print("=======================================================\n")

    engine = create_engine(db_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[1/3] Database connection verified successfully!")

    print("\n[2/3] Ensuring all database tables exist...")
    from app.core.database import Base
    import app.models  # ensure all models are registered
    Base.metadata.create_all(bind=engine)
    print("Database schema synchronized.")

    SyncSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SyncSession()

    try:
        from app.core.seed import seed_all
        print("\n[3/3] Seeding default users and full inventory dataset...")
        seed_all(session)
        
        from app.models.product import Product
        from app.models.inventory import InventoryBalance, InventoryTransaction
        
        prod_count = session.query(Product).count()
        bal_count = session.query(InventoryBalance).count()
        tx_count = session.query(InventoryTransaction).count()
        
        print("\n=======================================================")
        print(" SYNC COMPLETE!")
        print(f"   • Total Products Ingested:      {prod_count}")
        print(f"   • Total Stock Balances Active: {bal_count}")
        print(f"   • Total Ledger Transactions:   {tx_count}")
        print("=======================================================\n")
    finally:
        session.close()

if __name__ == "__main__":
    run_sync()
