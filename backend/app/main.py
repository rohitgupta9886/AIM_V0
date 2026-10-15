from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, engine
from app.api.auth import router as auth_router
from app.api.import_data import router as import_router
from app.api.products import router as products_router
from app.api.categories import router as categories_router
from app.api.inventory import router as inventory_router
from app.api.analysis import router as analysis_router
from app.core.database import Base
import app.models  # ensure models are registered

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation: verify PostgreSQL connection, ensure tables & seed default users
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        from app.core.seed import seed_all
        seed_all()
        print("[Startup] PostgreSQL database connection verified, schema synced, and data seeded.")
    except Exception as e:
        print(f"[Startup ERROR] Failed to connect to PostgreSQL: {e}")
        raise RuntimeError(f"PostgreSQL connection failure: {e}")
    yield
    print("[Shutdown] Cleaning up resources.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Grade Inventory Management System with PostgreSQL, FastAPI, and React",
    lifespan=lifespan
)

# CORS Middleware (Supporting local dev, custom domains, and Cloudflare Pages *.pages.dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX if settings.CORS_ORIGIN_REGEX else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(import_router, prefix=settings.API_V1_STR)
app.include_router(products_router, prefix=settings.API_V1_STR)
app.include_router(categories_router, prefix=settings.API_V1_STR)
app.include_router(inventory_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["System"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "online",
        "docs_url": "/docs"
    }

# Health Check Endpoints (both /health for Render and /api/health for clients)
@app.get("/health", tags=["System"])
@app.get(f"{settings.API_V1_STR}/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION
    }
