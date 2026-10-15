from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc, func
from typing import Optional, List
from decimal import Decimal
import math

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.inventory import InventoryBalance, InventoryTransaction, TransactionType
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    PaginatedProductsResponse
)

router = APIRouter(prefix="/products", tags=["Product Catalogue & Variants"])

def compute_stock_status(quantity: Decimal, min_stock: Decimal) -> str:
    if quantity <= 0:
        return "OUT_OF_STOCK"
    elif quantity <= min_stock:
        return "LOW_STOCK"
    return "NORMAL"

@router.get("", response_model=PaginatedProductsResponse)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search across SKU, name, description, finish, dimensions"),
    category: Optional[str] = Query(None),
    thickness: Optional[str] = Query(None),
    colour_finish: Optional[str] = Query(None),
    dimensions: Optional[str] = Query(None),
    length: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None, pattern="^(ALL|NORMAL|LOW_STOCK|OUT_OF_STOCK)$"),
    active: Optional[bool] = Query(None),
    sort_by: str = Query("name", pattern="^(name|sku|category|quantity|created_at)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product, InventoryBalance.current_quantity).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    )

    if active is not None:
        query = query.filter(Product.active == active)

    if category:
        query = query.filter(Product.category == category)
    if thickness:
        query = query.filter(Product.thickness == thickness)
    if colour_finish:
        query = query.filter(Product.colour_finish == colour_finish)
    if dimensions:
        query = query.filter(Product.dimensions == dimensions)
    if length:
        query = query.filter(Product.length == length)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.sku.ilike(search_term),
                Product.name.ilike(search_term),
                Product.original_description.ilike(search_term),
                Product.category.ilike(search_term),
                Product.colour_finish.ilike(search_term),
                Product.dimensions.ilike(search_term),
                Product.thickness.ilike(search_term),
                Product.length.ilike(search_term)
            )
        )

    # Filter stock status
    if stock_status and stock_status != "ALL":
        if stock_status == "OUT_OF_STOCK":
            query = query.filter(or_(InventoryBalance.current_quantity == None, InventoryBalance.current_quantity <= 0))
        elif stock_status == "LOW_STOCK":
            query = query.filter(
                and_(
                    InventoryBalance.current_quantity > 0,
                    InventoryBalance.current_quantity <= Product.minimum_stock
                )
            )
        elif stock_status == "NORMAL":
            query = query.filter(InventoryBalance.current_quantity > Product.minimum_stock)

    # Sort
    sort_column = Product.name
    if sort_by == "sku":
        sort_column = Product.sku
    elif sort_by == "category":
        sort_column = Product.category
    elif sort_by == "quantity":
        sort_column = func.coalesce(InventoryBalance.current_quantity, Decimal("0.0"))
    elif sort_by == "created_at":
        sort_column = Product.created_at

    query = query.order_by(desc(sort_column) if sort_dir == "desc" else asc(sort_column))

    total = query.count()
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    items: List[ProductResponse] = []
    for prod, qty in results:
        curr_qty = qty if qty is not None else Decimal("0.0")
        status_val = compute_stock_status(curr_qty, prod.minimum_stock)
        items.append(ProductResponse(
            id=prod.id,
            sku=prod.sku,
            name=prod.name,
            category=prod.category,
            original_description=prod.original_description,
            unit=prod.unit,
            thickness=prod.thickness,
            colour_finish=prod.colour_finish,
            dimensions=prod.dimensions,
            length=prod.length,
            minimum_stock=prod.minimum_stock,
            active=prod.active,
            current_quantity=curr_qty,
            stock_status=status_val,
            created_at=prod.created_at,
            updated_at=prod.updated_at
        ))

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedProductsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/filters", tags=["Product Catalogue & Variants"])
def get_catalogue_filters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prod_cats = {r[0] for r in db.query(Product.category).distinct().filter(Product.category != None).all() if r[0]}
    cat_table = {r[0] for r in db.query(Category.name).all() if r[0]}
    categories = sorted(list(prod_cats | cat_table))
    finishes = [r[0] for r in db.query(Product.colour_finish).distinct().filter(Product.colour_finish != None).all() if r[0]]
    thicknesses = [r[0] for r in db.query(Product.thickness).distinct().filter(Product.thickness != None).all() if r[0]]
    dimensions = [r[0] for r in db.query(Product.dimensions).distinct().filter(Product.dimensions != None).all() if r[0]]
    lengths = [r[0] for r in db.query(Product.length).distinct().filter(Product.length != None).all() if r[0]]

    return {
        "categories": categories,
        "finishes": sorted(finishes),
        "thicknesses": sorted(thicknesses),
        "dimensions": sorted(dimensions),
        "lengths": sorted(lengths)
    }

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    balance = db.query(InventoryBalance).filter(InventoryBalance.product_id == prod.id).first()
    curr_qty = balance.current_quantity if balance else Decimal("0.0")

    return ProductResponse(
        id=prod.id,
        sku=prod.sku,
        name=prod.name,
        category=prod.category,
        original_description=prod.original_description,
        unit=prod.unit,
        thickness=prod.thickness,
        colour_finish=prod.colour_finish,
        dimensions=prod.dimensions,
        length=prod.length,
        minimum_stock=prod.minimum_stock,
        active=prod.active,
        current_quantity=curr_qty,
        stock_status=compute_stock_status(curr_qty, prod.minimum_stock),
        created_at=prod.created_at,
        updated_at=prod.updated_at
    )

@router.post("", response_model=ProductResponse)
def create_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    existing = db.query(Product).filter(Product.sku == prod_in.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{prod_in.sku}' already exists"
        )

    prod = Product(
        sku=prod_in.sku.strip().upper(),
        name=prod_in.name.strip(),
        category=prod_in.category.strip(),
        original_description=prod_in.original_description or prod_in.name,
        unit=prod_in.unit or "Pcs",
        thickness=prod_in.thickness,
        colour_finish=prod_in.colour_finish,
        dimensions=prod_in.dimensions,
        length=prod_in.length,
        minimum_stock=prod_in.minimum_stock,
        active=prod_in.active
    )
    db.add(prod)
    db.flush()

    # Initial balance
    opening_qty = prod_in.opening_stock or Decimal("0.0")
    balance = InventoryBalance(
        product_id=prod.id,
        current_quantity=opening_qty
    )
    db.add(balance)

    if opening_qty != 0:
        tx = InventoryTransaction(
            product_id=prod.id,
            transaction_type=TransactionType.OPENING.value,
            quantity=opening_qty,
            reference_number=f"INIT-{prod.sku}",
            remarks="Opening stock entered at product creation",
            created_by=admin_user.username
        )
        db.add(tx)

    db.commit()
    db.refresh(prod)

    return ProductResponse(
        id=prod.id,
        sku=prod.sku,
        name=prod.name,
        category=prod.category,
        original_description=prod.original_description,
        unit=prod.unit,
        thickness=prod.thickness,
        colour_finish=prod.colour_finish,
        dimensions=prod.dimensions,
        length=prod.length,
        minimum_stock=prod.minimum_stock,
        active=prod.active,
        current_quantity=opening_qty,
        stock_status=compute_stock_status(opening_qty, prod.minimum_stock),
        created_at=prod.created_at,
        updated_at=prod.updated_at
    )

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    prod_in: ProductUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = prod_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prod, field, value)

    db.commit()
    db.refresh(prod)

    balance = db.query(InventoryBalance).filter(InventoryBalance.product_id == prod.id).first()
    curr_qty = balance.current_quantity if balance else Decimal("0.0")

    return ProductResponse(
        id=prod.id,
        sku=prod.sku,
        name=prod.name,
        category=prod.category,
        original_description=prod.original_description,
        unit=prod.unit,
        thickness=prod.thickness,
        colour_finish=prod.colour_finish,
        dimensions=prod.dimensions,
        length=prod.length,
        minimum_stock=prod.minimum_stock,
        active=prod.active,
        current_quantity=curr_qty,
        stock_status=compute_stock_status(curr_qty, prod.minimum_stock),
        created_at=prod.created_at,
        updated_at=prod.updated_at
    )

@router.patch("/{product_id}/toggle-active", response_model=ProductResponse)
def toggle_product_active(
    product_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    prod.active = not prod.active
    db.commit()
    db.refresh(prod)

    balance = db.query(InventoryBalance).filter(InventoryBalance.product_id == prod.id).first()
    curr_qty = balance.current_quantity if balance else Decimal("0.0")

    return ProductResponse(
        id=prod.id,
        sku=prod.sku,
        name=prod.name,
        category=prod.category,
        original_description=prod.original_description,
        unit=prod.unit,
        thickness=prod.thickness,
        colour_finish=prod.colour_finish,
        dimensions=prod.dimensions,
        length=prod.length,
        minimum_stock=prod.minimum_stock,
        active=prod.active,
        current_quantity=curr_qty,
        stock_status=compute_stock_status(curr_qty, prod.minimum_stock),
        created_at=prod.created_at,
        updated_at=prod.updated_at
    )
