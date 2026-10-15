from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func, or_
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
import math

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.product import Product
from app.models.inventory import InventoryBalance, InventoryTransaction, TransactionType
from app.schemas.inventory import (
    StockInwardRequest,
    StockOutwardRequest,
    StockAdjustmentRequest,
    TransactionResponse,
    PaginatedTransactionsResponse,
    StockSummaryItem
)
from app.api.products import compute_stock_status

router = APIRouter(prefix="/inventory", tags=["Stock Transactions & Ledger"])

@router.post("/inward", response_model=TransactionResponse)
def post_stock_inward(
    req: StockInwardRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not product.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot post transaction for deactivated product")

    # Lock row for concurrency safety
    balance = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == req.product_id
    ).with_for_update().first()

    if not balance:
        balance = InventoryBalance(product_id=req.product_id, current_quantity=Decimal("0.0"))
        db.add(balance)
        db.flush()

    new_quantity = balance.current_quantity + req.quantity
    balance.current_quantity = new_quantity
    balance.updated_at = datetime.now(timezone.utc)

    tx_date = req.transaction_date or datetime.now(timezone.utc)
    ref_num = req.reference_number or f"INW-{int(datetime.now(timezone.utc).timestamp())}"

    tx = InventoryTransaction(
        product_id=product.id,
        transaction_type=TransactionType.INWARD.value,
        transaction_date=tx_date,
        quantity=req.quantity,
        reference_number=ref_num,
        remarks=req.remarks or "Stock inward received",
        created_by=admin_user.username
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return TransactionResponse(
        id=tx.id,
        product_id=product.id,
        product_sku=product.sku,
        product_name=product.name,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        quantity=tx.quantity,
        reference_number=tx.reference_number,
        remarks=tx.remarks,
        created_by=tx.created_by,
        created_at=tx.created_at,
        current_balance_after=new_quantity
    )

@router.post("/outward", response_model=TransactionResponse)
def post_stock_outward(
    req: StockOutwardRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not product.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot dispatch stock for deactivated product")

    # Lock row for concurrency safety
    balance = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == req.product_id
    ).with_for_update().first()

    current_qty = balance.current_quantity if balance else Decimal("0.0")

    # Insufficient stock validation
    if current_qty < req.quantity and not req.allow_negative_override:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient stock for SKU '{product.sku}'. "
                f"Available: {current_qty} {product.unit}, requested outward: {req.quantity} {product.unit}. "
                "Negative stock policy blocks this transaction."
            )
        )

    new_quantity = current_qty - req.quantity
    if not balance:
        balance = InventoryBalance(product_id=req.product_id, current_quantity=new_quantity)
        db.add(balance)
    else:
        balance.current_quantity = new_quantity
        balance.updated_at = datetime.now(timezone.utc)

    tx_date = req.transaction_date or datetime.now(timezone.utc)
    ref_num = req.reference_number or f"OUT-{int(datetime.now(timezone.utc).timestamp())}"

    tx = InventoryTransaction(
        product_id=product.id,
        transaction_type=TransactionType.OUTWARD.value,
        transaction_date=tx_date,
        quantity=req.quantity,
        reference_number=ref_num,
        remarks=req.remarks or "Stock outward dispatched",
        created_by=admin_user.username
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return TransactionResponse(
        id=tx.id,
        product_id=product.id,
        product_sku=product.sku,
        product_name=product.name,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        quantity=tx.quantity,
        reference_number=tx.reference_number,
        remarks=tx.remarks,
        created_by=tx.created_by,
        created_at=tx.created_at,
        current_balance_after=new_quantity
    )

@router.post("/adjustment", response_model=TransactionResponse)
def post_stock_adjustment(
    req: StockAdjustmentRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    balance = db.query(InventoryBalance).filter(
        InventoryBalance.product_id == req.product_id
    ).with_for_update().first()

    current_qty = balance.current_quantity if balance else Decimal("0.0")
    new_quantity = current_qty + req.quantity

    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment of {req.quantity} results in negative balance ({new_quantity}). Rejected."
        )

    if not balance:
        balance = InventoryBalance(product_id=req.product_id, current_quantity=new_quantity)
        db.add(balance)
    else:
        balance.current_quantity = new_quantity
        balance.updated_at = datetime.now(timezone.utc)

    tx_date = req.transaction_date or datetime.now(timezone.utc)
    ref_num = req.reference_number or f"ADJ-{int(datetime.now(timezone.utc).timestamp())}"

    tx = InventoryTransaction(
        product_id=product.id,
        transaction_type=TransactionType.ADJUSTMENT.value,
        transaction_date=tx_date,
        quantity=req.quantity,
        reference_number=ref_num,
        remarks=f"Reason: {req.reason}. {req.remarks or ''}".strip(),
        created_by=admin_user.username
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return TransactionResponse(
        id=tx.id,
        product_id=product.id,
        product_sku=product.sku,
        product_name=product.name,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        quantity=tx.quantity,
        reference_number=tx.reference_number,
        remarks=tx.remarks,
        created_by=tx.created_by,
        created_at=tx.created_at,
        current_balance_after=new_quantity
    )

@router.get("/transactions", response_model=PaginatedTransactionsResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    product_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InventoryTransaction, Product.sku, Product.name).join(
        Product, InventoryTransaction.product_id == Product.id
    )

    if product_id:
        query = query.filter(InventoryTransaction.product_id == product_id)
    if transaction_type:
        query = query.filter(InventoryTransaction.transaction_type == transaction_type)
    if start_date:
        query = query.filter(InventoryTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(InventoryTransaction.transaction_date <= end_date)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.sku.ilike(term),
                Product.name.ilike(term),
                InventoryTransaction.reference_number.ilike(term),
                InventoryTransaction.remarks.ilike(term)
            )
        )

    query = query.order_by(desc(InventoryTransaction.transaction_date), desc(InventoryTransaction.id))

    total = query.count()
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    items: List[TransactionResponse] = []
    for tx, sku, name in results:
        items.append(TransactionResponse(
            id=tx.id,
            product_id=tx.product_id,
            product_sku=sku,
            product_name=name,
            transaction_type=tx.transaction_type,
            transaction_date=tx.transaction_date,
            quantity=tx.quantity,
            reference_number=tx.reference_number,
            remarks=tx.remarks,
            created_by=tx.created_by,
            created_at=tx.created_at,
            reversal_of_id=tx.reversal_of_id
        ))

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedTransactionsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/summary", response_model=List[StockSummaryItem])
def get_stock_summary(
    category: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve all products with current balances
    query = db.query(Product, InventoryBalance.current_quantity).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(Product.active == True)

    if category:
        query = query.filter(Product.category == category)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.sku.ilike(term),
                Product.name.ilike(term),
                Product.colour_finish.ilike(term),
                Product.dimensions.ilike(term)
            )
        )

    results = query.order_by(Product.category, Product.name).all()

    # Pre-aggregate transaction totals
    inward_sums = dict(
        db.query(
            InventoryTransaction.product_id,
            func.sum(InventoryTransaction.quantity)
        ).filter(
            InventoryTransaction.transaction_type.in_([TransactionType.INWARD.value, TransactionType.OPENING.value])
        ).group_by(InventoryTransaction.product_id).all()
    )

    outward_sums = dict(
        db.query(
            InventoryTransaction.product_id,
            func.sum(InventoryTransaction.quantity)
        ).filter(
            InventoryTransaction.transaction_type == TransactionType.OUTWARD.value
        ).group_by(InventoryTransaction.product_id).all()
    )

    adj_sums = dict(
        db.query(
            InventoryTransaction.product_id,
            func.sum(InventoryTransaction.quantity)
        ).filter(
            InventoryTransaction.transaction_type == TransactionType.ADJUSTMENT.value
        ).group_by(InventoryTransaction.product_id).all()
    )

    summary_items: List[StockSummaryItem] = []
    for prod, qty in results:
        curr_qty = qty if qty is not None else Decimal("0.0")
        st = compute_stock_status(curr_qty, prod.minimum_stock)

        if stock_status and stock_status != "ALL" and st != stock_status:
            continue

        summary_items.append(StockSummaryItem(
            product_id=prod.id,
            sku=prod.sku,
            name=prod.name,
            category=prod.category,
            unit=prod.unit,
            thickness=prod.thickness,
            colour_finish=prod.colour_finish,
            dimensions=prod.dimensions,
            length=prod.length,
            current_quantity=curr_qty,
            minimum_stock=prod.minimum_stock,
            stock_status=st,
            total_inward=Decimal(str(inward_sums.get(prod.id, 0.0))),
            total_outward=Decimal(str(outward_sums.get(prod.id, 0.0))),
            total_adjustment=Decimal(str(adj_sums.get(prod.id, 0.0)))
        ))

    return summary_items
