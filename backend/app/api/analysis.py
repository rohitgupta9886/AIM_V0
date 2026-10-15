from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_, asc
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
import io
import pandas as pd

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.inventory import InventoryBalance, InventoryTransaction, TransactionType
from app.api.products import compute_stock_status

router = APIRouter(prefix="/analysis", tags=["Inventory Analysis & Reports"])


# ==============================================================================
# Helper functions
# ==============================================================================

def parse_date_boundaries(from_date_str: Optional[str], to_date_str: Optional[str], db: Session):
    """
    Parses and validates inclusive date boundaries.
    Validates date format, checks From <= To, and prevents future dates beyond today.
    If not specified, defaults to the span of recorded data or past 30 days.
    """
    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    if from_date_str and to_date_str:
        try:
            f_dt = datetime.strptime(from_date_str.strip(), "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )
            t_dt = datetime.strptime(to_date_str.strip(), "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

        if f_dt > t_dt:
            raise HTTPException(status_code=400, detail="From Date cannot be after To Date.")

        if f_dt.date() > today_date:
            raise HTTPException(status_code=400, detail="From Date cannot be in the future.")
        if t_dt.date() > today_date:
            raise HTTPException(status_code=400, detail="To Date cannot be in the future.")

        return f_dt, t_dt, True
    else:
        min_date = db.query(func.min(InventoryTransaction.transaction_date)).scalar()
        max_date = db.query(func.max(InventoryTransaction.transaction_date)).scalar()

        t_dt = min(max_date, now_utc) if max_date else now_utc
        t_dt = t_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        if min_date:
            f_dt = min_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            f_dt = (t_dt - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)

        return f_dt, t_dt, False


def get_comparison_boundaries(from_dt: datetime, to_dt: datetime):
    """
    Returns an immediately preceding period of equal length.
    """
    duration_days = max(1, (to_dt.date() - from_dt.date()).days + 1)
    prev_to_dt = (from_dt - timedelta(seconds=1)).replace(tzinfo=timezone.utc)
    prev_from_dt = (from_dt - timedelta(days=duration_days)).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )
    return prev_from_dt, prev_to_dt, duration_days


def calc_delta(curr: float, prev: float) -> Dict[str, Any]:
    """
    Calculates absolute and percentage changes safely handling zero denominators.
    """
    diff_abs = round(curr - prev, 2)
    if prev != 0:
        diff_pct = round((diff_abs / abs(prev)) * 100, 1)
    else:
        if curr > 0:
            diff_pct = 100.0
        elif curr == 0:
            diff_pct = 0.0
        else:
            diff_pct = -100.0
    return {
        "current": round(curr, 2),
        "previous": round(prev, 2),
        "diff_abs": diff_abs,
        "diff_pct": diff_pct
    }


def compute_period_product_ledger(
    db: Session,
    from_dt: datetime,
    to_dt: datetime,
    category_filter: Optional[str] = None,
    product_id_filter: Optional[int] = None,
    thickness_filter: Optional[str] = None,
    colour_filter: Optional[str] = None,
    dimensions_filter: Optional[str] = None,
    length_filter: Optional[str] = None,
    sku_filter: Optional[str] = None,
    slow_threshold: float = 5.0
):
    """
    Computes rigorous opening balance, period inward, period outward,
    period adjustment, closing balance, current stock, and movement status
    for all matching active products.
    """
    # 1. Fetch active products with current balance
    prod_query = db.query(Product, InventoryBalance.current_quantity).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(Product.active == True)

    if category_filter:
        prod_query = prod_query.filter(Product.category == category_filter)
    if thickness_filter:
        prod_query = prod_query.filter(Product.thickness == thickness_filter)
    if colour_filter:
        prod_query = prod_query.filter(Product.colour_finish == colour_filter)
    if dimensions_filter:
        prod_query = prod_query.filter(Product.dimensions == dimensions_filter)
    if length_filter:
        prod_query = prod_query.filter(Product.length == length_filter)
    if sku_filter:
        prod_query = prod_query.filter(Product.sku.ilike(f"%{sku_filter.strip()}%"))
    if product_id_filter:
        prod_query = prod_query.filter(Product.id == product_id_filter)

    products = prod_query.order_by(Product.category, Product.name).all()

    product_ids = [p.id for p, _ in products]
    if not product_ids:
        return {}

    # 2. Fetch all transactions for these products chronologically
    tx_query = db.query(
        InventoryTransaction.product_id,
        InventoryTransaction.transaction_type,
        InventoryTransaction.quantity,
        InventoryTransaction.transaction_date,
        InventoryTransaction.reference_number,
        InventoryTransaction.remarks
    ).filter(
        InventoryTransaction.product_id.in_(product_ids)
    ).order_by(asc(InventoryTransaction.transaction_date), asc(InventoryTransaction.id))

    txs = tx_query.all()

    # 3. Process running balance ledger per product
    product_map = {}
    for p, cur_q in products:
        product_map[p.id] = {
            "product": p,
            "current_stock": float(cur_q or Decimal("0.0")),
            "running_bal": Decimal("0.0"),
            "opening_stock": Decimal("0.0"),
            "period_inward": Decimal("0.0"),
            "period_outward": Decimal("0.0"),
            "period_adj": Decimal("0.0"),
            "closing_stock": Decimal("0.0"),
            "last_movement_date": None,
            "has_period_movement": False,
            "has_ever_moved": False
        }

    for pid, ttype, qty, tx_date, ref_no, remarks in txs:
        if pid not in product_map:
            continue
        st = product_map[pid]
        t = (ttype or "").upper()
        q = qty if qty is not None else Decimal("0.0")

        # Update per-product running balance
        if t in [TransactionType.OPENING.value, "INITIAL_OPENING"]:
            st["running_bal"] = q
        elif t == TransactionType.INWARD.value:
            st["running_bal"] += abs(q)
        elif t == TransactionType.OUTWARD.value:
            st["running_bal"] -= abs(q)
        elif t == TransactionType.ADJUSTMENT.value:
            st["running_bal"] += q
        elif t == TransactionType.REVERSAL.value:
            st["running_bal"] -= q
        else:
            st["running_bal"] += q

        st["last_movement_date"] = tx_date
        st["has_ever_moved"] = True

        # Segment by period
        if tx_date < from_dt:
            st["opening_stock"] = st["running_bal"]
        elif tx_date <= to_dt:
            st["has_period_movement"] = True
            if t in [TransactionType.INWARD.value, TransactionType.OPENING.value]:
                st["period_inward"] += abs(q)
            elif t == TransactionType.OUTWARD.value:
                st["period_outward"] += abs(q)
            elif t == TransactionType.ADJUSTMENT.value:
                st["period_adj"] += q
            elif t == TransactionType.REVERSAL.value:
                st["period_adj"] -= abs(q)
            st["closing_stock"] = st["running_bal"]

    # Finalize closing stock if no transaction occurred inside the period
    now_utc = datetime.now(timezone.utc)
    for pid, st in product_map.items():
        if not st["has_period_movement"]:
            st["closing_stock"] = st["opening_stock"]

        # Determine movement status
        out_val = float(st["period_outward"])
        in_val = float(st["period_inward"])
        adj_val = float(st["period_adj"])

        if out_val > slow_threshold:
            st["movement_status"] = "MOVING"
        elif out_val > 0 or in_val > 0 or adj_val != 0:
            st["movement_status"] = "SLOW_MOVING"
        elif st["current_stock"] > 0 and st["has_ever_moved"]:
            st["movement_status"] = "SLOW_MOVING"
        else:
            st["movement_status"] = "NO_MOVEMENT"

        # Days since last movement
        if st["last_movement_date"]:
            days_ago = max(0, (now_utc.date() - st["last_movement_date"].date()).days)
            st["days_since_last_movement"] = days_ago
        else:
            st["days_since_last_movement"] = None

    return product_map


# ==============================================================================
# Filter Options Endpoint
# ==============================================================================

@router.get("/filter-options")
def get_analysis_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns available filter criteria (categories, finishes, thicknesses, dimensions, lengths)
    extracted from active catalog records for structured analytics filtering.
    """
    prod_cats = {r[0] for r in db.query(Product.category).distinct().filter(Product.category != None).all() if r[0]}
    cat_table = {r[0] for r in db.query(Category.name).all() if r[0]}
    categories = sorted(list(prod_cats | cat_table))

    finishes = sorted([r[0] for r in db.query(Product.colour_finish).distinct().filter(Product.colour_finish != None).all() if r[0]])
    thicknesses = sorted([r[0] for r in db.query(Product.thickness).distinct().filter(Product.thickness != None).all() if r[0]])
    dimensions = sorted([r[0] for r in db.query(Product.dimensions).distinct().filter(Product.dimensions != None).all() if r[0]])
    lengths = sorted([r[0] for r in db.query(Product.length).distinct().filter(Product.length != None).all() if r[0]])

    return {
        "categories": categories,
        "finishes": finishes,
        "thicknesses": thicknesses,
        "dimensions": dimensions,
        "lengths": lengths
    }


# ==============================================================================
# 1. Main Workspace Intelligence Endpoint
# ==============================================================================

@router.get("/workspace")
def get_analytics_workspace(
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    compare_period: bool = Query(False, description="Compare with prior period of equal length"),
    category: Optional[str] = Query(None, description="Filter by category"),
    thickness: Optional[str] = Query(None, description="Filter by thickness"),
    colour_finish: Optional[str] = Query(None, description="Filter by colour finish"),
    dimensions: Optional[str] = Query(None, description="Filter by dimensions"),
    length: Optional[str] = Query(None, description="Filter by length"),
    sku: Optional[str] = Query(None, description="Filter by SKU"),
    stock_status: Optional[str] = Query("ALL", description="ALL, NORMAL, LOW_STOCK, OUT_OF_STOCK"),
    movement_status: Optional[str] = Query("ALL", description="ALL, MOVING, SLOW, SLOW_MOVING, NO_MOVEMENT"),
    trend_interval: Optional[str] = Query("daily", pattern="^(daily|weekly|monthly)$"),
    slow_threshold: float = Query(5.0, description="Outward units threshold for slow moving classification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Primary workspace intelligence payload supporting interactive date-range
    filtering, period-over-period comparison, Recharts visualizations,
    actionable deterministic insights, live stock health, and audited reconciliations.
    """
    from_dt, to_dt, is_custom_range = parse_date_boundaries(from_date, to_date, db)
    days_in_period = max(1, (to_dt.date() - from_dt.date()).days + 1)

    # 1. Compute current period ledger
    curr_ledger = compute_period_product_ledger(
        db, from_dt, to_dt,
        category_filter=category,
        thickness_filter=thickness,
        colour_filter=colour_finish,
        dimensions_filter=dimensions,
        length_filter=length,
        sku_filter=sku,
        slow_threshold=slow_threshold
    )

    # 2. Compute comparison period ledger if requested
    prev_from_dt, prev_to_dt, prev_days = get_comparison_boundaries(from_dt, to_dt)
    prev_ledger = None
    if compare_period:
        prev_ledger = compute_period_product_ledger(
            db, prev_from_dt, prev_to_dt,
            category_filter=category,
            thickness_filter=thickness,
            colour_filter=colour_finish,
            dimensions_filter=dimensions,
            length_filter=length,
            sku_filter=sku,
            slow_threshold=slow_threshold
        )

    # 3. Aggregate Core KPIs
    tot_curr_stock = sum(item["current_stock"] for item in curr_ledger.values())
    tot_inward = float(sum(item["period_inward"] for item in curr_ledger.values()))
    tot_outward = float(sum(item["period_outward"] for item in curr_ledger.values()))
    tot_adj = float(sum(item["period_adj"] for item in curr_ledger.values()))
    net_movement = round(tot_inward - tot_outward + tot_adj, 2)

    low_stock_pids = set()
    out_of_stock_pids = set()
    healthy_pids = set()
    moving_pids = set()
    no_movement_pids = set()

    for pid, it in curr_ledger.items():
        q = it["current_stock"]
        min_s = float(it["product"].minimum_stock or 0.0)
        if q <= 0:
            out_of_stock_pids.add(pid)
        elif q <= min_s:
            low_stock_pids.add(pid)
        else:
            healthy_pids.add(pid)

        if it["has_period_movement"]:
            moving_pids.add(pid)
        else:
            no_movement_pids.add(pid)

    # Previous metrics for delta calculation
    prev_tot_stock = tot_curr_stock
    prev_tot_inward = 0.0
    prev_tot_outward = 0.0
    prev_net_movement = 0.0
    prev_low_stock_count = len(low_stock_pids)
    prev_out_of_stock_count = len(out_of_stock_pids)
    prev_moving_count = 0
    prev_no_movement_count = len(curr_ledger)

    if prev_ledger:
        prev_tot_inward = float(sum(item["period_inward"] for item in prev_ledger.values()))
        prev_tot_outward = float(sum(item["period_outward"] for item in prev_ledger.values()))
        prev_tot_adj = float(sum(item["period_adj"] for item in prev_ledger.values()))
        prev_net_movement = round(prev_tot_inward - prev_tot_outward + prev_tot_adj, 2)
        prev_moving_count = sum(1 for item in prev_ledger.values() if item["has_period_movement"])
        prev_no_movement_count = len(prev_ledger) - prev_moving_count

    kpis = {
        "total_current_stock": {
            **calc_delta(tot_curr_stock, prev_tot_stock if compare_period else tot_curr_stock),
            "unit": "Pcs",
            "title": "Total Current Stock",
            "subtitle": "Live physical on-hand quantity",
            "color_theme": "blue"
        },
        "total_inward": {
            **calc_delta(tot_inward, prev_tot_inward if compare_period else 0.0),
            "unit": "Pcs",
            "title": "Total Inward",
            "subtitle": "Received during selected period",
            "color_theme": "teal"
        },
        "total_outward": {
            **calc_delta(tot_outward, prev_tot_outward if compare_period else 0.0),
            "unit": "Pcs",
            "title": "Total Outward",
            "subtitle": "Dispatched during selected period",
            "color_theme": "purple"
        },
        "net_movement": {
            **calc_delta(net_movement, prev_net_movement if compare_period else 0.0),
            "unit": "Pcs",
            "title": "Net Stock Movement",
            "subtitle": "Inward - Outward + Adjustments",
            "color_theme": "indigo"
        },
        "low_stock_count": {
            **calc_delta(len(low_stock_pids), prev_low_stock_count if compare_period else len(low_stock_pids)),
            "unit": "SKUs",
            "title": "Low-Stock Products",
            "subtitle": "Below configured safety buffer",
            "color_theme": "amber"
        },
        "out_of_stock_count": {
            **calc_delta(len(out_of_stock_pids), prev_out_of_stock_count if compare_period else len(out_of_stock_pids)),
            "unit": "SKUs",
            "title": "Out-of-Stock Products",
            "subtitle": "Zero or negative available balance",
            "color_theme": "rose"
        },
        "moving_products": {
            **calc_delta(len(moving_pids), prev_moving_count if compare_period else 0.0),
            "unit": "SKUs",
            "title": "Moving Products",
            "subtitle": "SKUs with active transactions in period",
            "color_theme": "green"
        },
        "no_movement_products": {
            **calc_delta(len(no_movement_pids), prev_no_movement_count if compare_period else len(no_movement_pids)),
            "unit": "SKUs",
            "title": "No-Movement Products",
            "subtitle": "Dormant with zero period activity",
            "color_theme": "slate"
        }
    }

    # 4. Movement Trend Time Series (Daily, Weekly, Monthly)
    date_format_str = 'YYYY-MM-DD'
    if trend_interval == 'weekly':
        date_format_str = 'IYYY-IW'
    elif trend_interval == 'monthly':
        date_format_str = 'YYYY-MM'

    curr_pids = list(curr_ledger.keys())
    tx_timeline_query = db.query(
        func.to_char(InventoryTransaction.transaction_date, date_format_str).label("bucket"),
        InventoryTransaction.transaction_type,
        func.sum(InventoryTransaction.quantity).label("total_qty")
    ).filter(
        InventoryTransaction.transaction_date >= from_dt,
        InventoryTransaction.transaction_date <= to_dt
    )

    if curr_pids:
        tx_timeline_query = tx_timeline_query.filter(InventoryTransaction.product_id.in_(curr_pids))
    elif category:
        tx_timeline_query = tx_timeline_query.join(Product, InventoryTransaction.product_id == Product.id).filter(
            Product.category == category
        )

    tx_timeline = tx_timeline_query.group_by("bucket", InventoryTransaction.transaction_type).order_by("bucket").all()

    timeline_map = {}
    for bucket, ttype, qty in tx_timeline:
        if bucket not in timeline_map:
            timeline_map[bucket] = {"date": bucket, "label": bucket, "inward": 0.0, "outward": 0.0, "net": 0.0}
        t = (ttype or "").upper()
        q = float(qty or 0.0)
        if t in [TransactionType.INWARD.value, TransactionType.OPENING.value]:
            timeline_map[bucket]["inward"] += q
            timeline_map[bucket]["net"] += q
        elif t == TransactionType.OUTWARD.value:
            timeline_map[bucket]["outward"] += q
            timeline_map[bucket]["net"] -= q
        elif t == TransactionType.ADJUSTMENT.value:
            timeline_map[bucket]["net"] += q

    movement_trend = list(timeline_map.values())
    movement_trend.sort(key=lambda x: x["date"])

    # 5. Category Breakdown: Inward vs Outward vs Stock
    cat_stats_map = {}
    for pid, it in curr_ledger.items():
        c_name = it["product"].category or "General"
        if c_name not in cat_stats_map:
            cat_stats_map[c_name] = {
                "category": c_name,
                "sku_count": 0,
                "total_stock": 0.0,
                "total_inward": 0.0,
                "total_outward": 0.0,
                "total_adjustment": 0.0,
                "net_movement": 0.0
            }
        cat_stats_map[c_name]["sku_count"] += 1
        cat_stats_map[c_name]["total_stock"] += it["current_stock"]
        cat_stats_map[c_name]["total_inward"] += float(it["period_inward"])
        cat_stats_map[c_name]["total_outward"] += float(it["period_outward"])
        cat_stats_map[c_name]["total_adjustment"] += float(it["period_adj"])
        cat_stats_map[c_name]["net_movement"] += float(it["period_inward"] - it["period_outward"] + it["period_adj"])

    category_distribution = []
    for c_name, c_data in cat_stats_map.items():
        share = round((c_data["total_stock"] / tot_curr_stock * 100), 1) if tot_curr_stock > 0 else 0.0
        category_distribution.append({
            "category": c_name,
            "sku_count": c_data["sku_count"],
            "total_stock": round(c_data["total_stock"], 2),
            "share_pct": share,
            "total_inward": round(c_data["total_inward"], 2),
            "total_outward": round(c_data["total_outward"], 2),
            "net_movement": round(c_data["net_movement"], 2)
        })
    category_distribution.sort(key=lambda x: x["total_stock"], reverse=True)

    # 6. Top Products by Outward and Inward Movement (with variant details)
    sorted_by_outward = sorted(curr_ledger.values(), key=lambda x: float(x["period_outward"]), reverse=True)
    top_outward = []
    for it in sorted_by_outward[:10]:
        out_qty = float(it["period_outward"])
        if out_qty <= 0:
            break
        sh = round((out_qty / tot_outward * 100), 1) if tot_outward > 0 else 0.0
        p = it["product"]
        top_outward.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "quantity": out_qty,
            "share_pct": sh,
            "current_stock": it["current_stock"],
            "unit": p.unit or "Pcs",
            "thickness": p.thickness or "",
            "colour_finish": p.colour_finish or "",
            "dimensions": p.dimensions or "",
            "length": p.length or ""
        })

    sorted_by_inward = sorted(curr_ledger.values(), key=lambda x: float(x["period_inward"]), reverse=True)
    top_inward = []
    for it in sorted_by_inward[:10]:
        in_qty = float(it["period_inward"])
        if in_qty <= 0:
            break
        sh = round((in_qty / tot_inward * 100), 1) if tot_inward > 0 else 0.0
        p = it["product"]
        top_inward.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "quantity": in_qty,
            "share_pct": sh,
            "current_stock": it["current_stock"],
            "unit": p.unit or "Pcs",
            "thickness": p.thickness or "",
            "colour_finish": p.colour_finish or "",
            "dimensions": p.dimensions or "",
            "length": p.length or ""
        })

    # 7. Inventory Health Distribution
    tot_ledg_count = max(1, len(curr_ledger))
    health_distribution = {
        "healthy": len(healthy_pids),
        "low_stock": len(low_stock_pids),
        "out_of_stock": len(out_of_stock_pids),
        "total": len(curr_ledger),
        "healthy_pct": round((len(healthy_pids) / tot_ledg_count) * 100, 1),
        "low_stock_pct": round((len(low_stock_pids) / tot_ledg_count) * 100, 1),
        "out_of_stock_pct": round((len(out_of_stock_pids) / tot_ledg_count) * 100, 1)
    }

    # 8. Slow-Moving and No-Movement Inventory
    dormant_candidates = [
        it for it in curr_ledger.values()
        if float(it["period_outward"]) <= slow_threshold and it["current_stock"] > 0
    ]
    dormant_candidates.sort(key=lambda x: x["current_stock"], reverse=True)

    slow_moving = []
    for it in dormant_candidates[:12]:
        p = it["product"]
        out_q = float(it["period_outward"])
        status_label = "NO_MOVEMENT" if out_q == 0 else "SLOW_MOVING"
        slow_moving.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "current_stock": it["current_stock"],
            "unit": p.unit or "Pcs",
            "outward_qty": out_q,
            "last_movement_date": it["last_movement_date"].isoformat() if it["last_movement_date"] else None,
            "days_since_last_movement": it["days_since_last_movement"],
            "movement_status": status_label,
            "turnover_risk": "High Holding / Dormant" if out_q == 0 else "Low Velocity"
        })

    # 9. Stock Concentration (Pareto: SKUs holding majority of physical volume)
    sorted_by_stock = sorted(curr_ledger.values(), key=lambda x: x["current_stock"], reverse=True)
    stock_concentration = []
    cumulative_qty = 0.0
    for it in sorted_by_stock[:15]:
        p = it["product"]
        st_qty = it["current_stock"]
        cumulative_qty += st_qty
        cumulative_share = round((cumulative_qty / tot_curr_stock * 100), 1) if tot_curr_stock > 0 else 0.0
        indiv_share = round((st_qty / tot_curr_stock * 100), 1) if tot_curr_stock > 0 else 0.0
        stock_concentration.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "current_stock": st_qty,
            "unit": p.unit or "Pcs",
            "share_pct": indiv_share,
            "cumulative_share_pct": cumulative_share
        })

    # 10. Actionable Deterministic Insights
    insights = []

    if len(out_of_stock_pids) > 0:
        insights.append({
            "id": "crit_out_of_stock",
            "level": "critical",
            "title": f"{len(out_of_stock_pids)} SKUs Completely Out of Stock",
            "description": "Immediate reorder recommended to prevent supply disruption and fulfilment halts.",
            "badge": "Depleted",
            "action_type": "FILTER_STATUS",
            "action_target": "OUT_OF_STOCK"
        })

    if len(low_stock_pids) > 0:
        insights.append({
            "id": "warn_low_stock",
            "level": "warning",
            "title": f"{len(low_stock_pids)} SKUs Operating Below Safety Buffer",
            "description": "Stock levels have breached configured minimum buffer limits. Review procurement orders.",
            "badge": "Reorder Alert",
            "action_type": "FILTER_STATUS",
            "action_target": "LOW_STOCK"
        })

    if len(dormant_candidates) > 0:
        dormant_stock_sum = sum(x["current_stock"] for x in dormant_candidates)
        insights.append({
            "id": "warn_dormant_stock",
            "level": "warning",
            "title": f"{len(dormant_candidates)} Dormant/Slow SKUs Holding {int(dormant_stock_sum):,} Pcs",
            "description": f"Under {slow_threshold} dispatches recorded during the selected period ({days_in_period} days). Check holding cost and storage utilization.",
            "badge": "Capital Tied",
            "action_type": "FILTER_MOVEMENT",
            "action_target": "SLOW"
        })

    if category_distribution:
        top_cat = category_distribution[0]
        insights.append({
            "id": "info_top_cat",
            "level": "info",
            "title": f"Category '{top_cat['category']}' Dominates Inventory",
            "description": f"Accounts for {top_cat['share_pct']}% of warehouse physical volume ({int(top_cat['total_stock']):,} units across {top_cat['sku_count']} SKUs).",
            "badge": "Volume Concentration",
            "action_type": "FILTER_CATEGORY",
            "action_target": top_cat['category']
        })

    if top_outward:
        top_sku = top_outward[0]
        insights.append({
            "id": "info_top_outward",
            "level": "info",
            "title": f"Top Volume Mover: {top_sku['sku']}",
            "description": f"Dispatched {int(top_sku['quantity']):,} {top_sku['unit']} ({top_sku['share_pct']}% of total outward volume in this period).",
            "badge": "Demand Driver",
            "action_type": "SEARCH_SKU",
            "action_target": top_sku['sku']
        })

    if compare_period and prev_tot_outward > 0:
        out_diff = tot_outward - prev_tot_outward
        out_pct = round((out_diff / prev_tot_outward) * 100, 1)
        direction = "increased" if out_diff >= 0 else "decreased"
        insights.append({
            "id": "info_period_shift",
            "level": "info",
            "title": f"Period Demand {direction.capitalize()} by {abs(out_pct)}%",
            "description": f"Outward volume moved from {int(prev_tot_outward):,} to {int(tot_outward):,} Pcs compared to preceding {prev_days} days.",
            "badge": "Period Trend",
            "action_type": "NONE",
            "action_target": None
        })

    # 11. Rigorous Stock Reconciliation & Mathematical Data Quality Audit
    total_db_balance = db.query(
        func.coalesce(func.sum(InventoryBalance.current_quantity), Decimal("0.0"))
    ).scalar()

    total_cat_stock = sum(c["total_stock"] for c in category_distribution)
    discrepancy = round(float(total_db_balance) - total_cat_stock, 2)

    unref_count = db.query(func.count(InventoryTransaction.id)).filter(
        or_(InventoryTransaction.reference_number == None, InventoryTransaction.reference_number == "")
    ).scalar() or 0

    negative_stock_count = sum(1 for it in curr_ledger.values() if it["current_stock"] < 0)

    # Line-by-line parity verification: Opening + Inward - Outward + Adj = Closing
    formula_discrepancies = []
    for pid, it in curr_ledger.items():
        exp_close = round(float(it["opening_stock"]) + float(it["period_inward"]) - float(it["period_outward"]) + float(it["period_adj"]), 2)
        act_close = round(float(it["closing_stock"]), 2)
        variance = round(act_close - exp_close, 2)
        if abs(variance) > 0.01:
            p = it["product"]
            formula_discrepancies.append({
                "product_id": p.id,
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "opening_stock": round(float(it["opening_stock"]), 2),
                "inward": round(float(it["period_inward"]), 2),
                "outward": round(float(it["period_outward"]), 2),
                "adjustment": round(float(it["period_adj"]), 2),
                "expected_closing": exp_close,
                "actual_closing": act_close,
                "variance": variance,
                "issue_type": "Ledger Formula Variance"
            })

    # Duplicate transaction check
    duplicate_rows = db.query(
        InventoryTransaction.product_id,
        InventoryTransaction.transaction_type,
        InventoryTransaction.quantity,
        InventoryTransaction.transaction_date,
        func.count(InventoryTransaction.id).label("cnt")
    ).group_by(
        InventoryTransaction.product_id,
        InventoryTransaction.transaction_type,
        InventoryTransaction.quantity,
        InventoryTransaction.transaction_date
    ).having(func.count(InventoryTransaction.id) > 1).all()

    duplicate_tx_count = sum(int(r.cnt - 1) for r in duplicate_rows)

    is_reconciled = (
        discrepancy == 0.0 and
        negative_stock_count == 0 and
        len(formula_discrepancies) == 0
    )

    reconciliation = {
        "status": "RECONCILED" if is_reconciled else "DISCREPANCY_FOUND",
        "summary": "100% Balanced across all ledger lines" if is_reconciled else f"Audit flagged issues: {len(formula_discrepancies)} formula variances, {negative_stock_count} negative stock SKUs, {discrepancy} category discrepancy.",
        "formula_audit_passed": len(formula_discrepancies) == 0,
        "total_database_stock": float(total_db_balance),
        "total_category_stock": total_cat_stock,
        "discrepancy": discrepancy,
        "products_audited": len(curr_ledger),
        "transactions_in_period": len(tx_timeline),
        "duplicate_tx_count": duplicate_tx_count,
        "unreferenced_tx_count": unref_count,
        "negative_stock_count": negative_stock_count,
        "discrepancy_items": formula_discrepancies[:25]
    }

    return {
        "period": {
            "from_date": from_dt.strftime("%Y-%m-%d"),
            "to_date": to_dt.strftime("%Y-%m-%d"),
            "display_label": f"{from_dt.strftime('%d %b %Y')} – {to_dt.strftime('%d %b %Y')}",
            "is_custom": is_custom_range,
            "days": days_in_period,
            "has_transactions": len(tx_timeline) > 0
        },
        "comparison_period": {
            "enabled": compare_period,
            "from_date": prev_from_dt.strftime("%Y-%m-%d"),
            "to_date": prev_to_dt.strftime("%Y-%m-%d"),
            "display_label": f"{prev_from_dt.strftime('%d %b %Y')} – {prev_to_dt.strftime('%d %b %Y')}",
            "days": prev_days
        },
        "kpis": kpis,
        "movement_trend": movement_trend,
        "category_distribution": category_distribution,
        "top_outward": top_outward,
        "top_inward": top_inward,
        "health_distribution": health_distribution,
        "slow_moving": slow_moving,
        "stock_concentration": stock_concentration,
        "insights": insights,
        "reconciliation": reconciliation
    }


# ==============================================================================
# 2. Detailed Product Movement Analysis Table (Paginated & Filterable)
# ==============================================================================

@router.get("/movement-table")
def get_product_movement_table(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    thickness: Optional[str] = Query(None),
    colour_finish: Optional[str] = Query(None),
    dimensions: Optional[str] = Query(None),
    length: Optional[str] = Query(None),
    sku: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    stock_status: Optional[str] = Query("ALL"),
    movement_status: Optional[str] = Query("ALL"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=500),
    sort_by: str = Query("period_outward"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    slow_threshold: float = Query(5.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns server-side paginated product movement ledger with opening balance,
    inwards, outwards, net movement, closing stock, and live current balance.
    Fully filterable by date range, category, variant specifications, and statuses.
    """
    from_dt, to_dt, _ = parse_date_boundaries(from_date, to_date, db)
    ledger = compute_period_product_ledger(
        db, from_dt, to_dt,
        category_filter=category,
        thickness_filter=thickness,
        colour_filter=colour_finish,
        dimensions_filter=dimensions,
        length_filter=length,
        sku_filter=sku,
        slow_threshold=slow_threshold
    )

    items = list(ledger.values())

    # Filter by free-text search (SKU, name, dimensions, colour, thickness)
    if search and search.strip():
        term = search.strip().lower()
        items = [
            it for it in items
            if (term in it["product"].sku.lower() or
                term in it["product"].name.lower() or
                (it["product"].dimensions and term in it["product"].dimensions.lower()) or
                (it["product"].colour_finish and term in it["product"].colour_finish.lower()) or
                (it["product"].thickness and term in it["product"].thickness.lower()))
        ]

    # Filter by stock status
    if stock_status and stock_status != "ALL":
        filtered = []
        for it in items:
            q = it["current_stock"]
            min_s = float(it["product"].minimum_stock or 0.0)
            if stock_status == "OUT_OF_STOCK" and q <= 0:
                filtered.append(it)
            elif stock_status == "LOW_STOCK" and (0 < q <= min_s):
                filtered.append(it)
            elif stock_status == "NORMAL" and (q > min_s):
                filtered.append(it)
        items = filtered

    # Filter by movement status
    if movement_status and movement_status != "ALL":
        if movement_status == "MOVING":
            items = [it for it in items if it.get("movement_status") == "MOVING"]
        elif movement_status in ["SLOW", "SLOW_MOVING"]:
            items = [it for it in items if it.get("movement_status") == "SLOW_MOVING"]
        elif movement_status == "NO_MOVEMENT":
            items = [it for it in items if it.get("movement_status") == "NO_MOVEMENT"]

    # Summary totals across all filtered items
    tot_opening = sum(float(it["opening_stock"]) for it in items)
    tot_inward = sum(float(it["period_inward"]) for it in items)
    tot_outward = sum(float(it["period_outward"]) for it in items)
    tot_adj = sum(float(it["period_adj"]) for it in items)
    tot_net = tot_inward - tot_outward + tot_adj
    tot_closing = sum(float(it["closing_stock"]) for it in items)
    tot_current = sum(it["current_stock"] for it in items)

    # Sort
    def sort_key(it):
        if sort_by == "sku":
            return it["product"].sku
        elif sort_by == "name":
            return it["product"].name
        elif sort_by == "category":
            return it["product"].category
        elif sort_by == "opening_stock":
            return float(it["opening_stock"])
        elif sort_by == "period_inward":
            return float(it["period_inward"])
        elif sort_by == "period_outward":
            return float(it["period_outward"])
        elif sort_by == "period_net":
            return float(it["period_inward"] - it["period_outward"] + it["period_adj"])
        elif sort_by == "closing_stock":
            return float(it["closing_stock"])
        elif sort_by == "current_stock":
            return it["current_stock"]
        elif sort_by == "movement_status":
            return it.get("movement_status", "NORMAL")
        elif sort_by == "last_movement_date":
            return it["last_movement_date"].isoformat() if it["last_movement_date"] else ""
        return float(it["period_outward"])

    items.sort(key=sort_key, reverse=(sort_order == "desc"))

    # Pagination
    total = len(items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    paged_items = items[offset:offset + page_size]

    formatted_items = []
    for it in paged_items:
        p = it["product"]
        q = it["current_stock"]
        min_s = float(p.minimum_stock or 0.0)
        st_status = "OUT_OF_STOCK" if q <= 0 else ("LOW_STOCK" if q <= min_s else "NORMAL")

        formatted_items.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "unit": p.unit or "Pcs",
            "thickness": p.thickness or "",
            "colour_finish": p.colour_finish or "",
            "dimensions": p.dimensions or "",
            "length": p.length or "",
            "opening_stock": round(float(it["opening_stock"]), 2),
            "period_inward": round(float(it["period_inward"]), 2),
            "period_outward": round(float(it["period_outward"]), 2),
            "period_adjustment": round(float(it["period_adj"]), 2),
            "period_net": round(float(it["period_inward"] - it["period_outward"] + it["period_adj"]), 2),
            "closing_stock": round(float(it["closing_stock"]), 2),
            "current_stock": round(q, 2),
            "minimum_stock": min_s,
            "stock_status": st_status,
            "movement_status": it.get("movement_status", "NO_MOVEMENT"),
            "last_movement_date": it["last_movement_date"].isoformat() if it["last_movement_date"] else None,
            "days_since_last_movement": it.get("days_since_last_movement")
        })

    return {
        "items": formatted_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "summary": {
            "total_opening": round(tot_opening, 2),
            "total_inward": round(tot_inward, 2),
            "total_outward": round(tot_outward, 2),
            "total_adjustment": round(tot_adj, 2),
            "total_net": round(tot_net, 2),
            "total_closing": round(tot_closing, 2),
            "total_current": round(tot_current, 2),
            "matched_skus": total
        }
    }


# ==============================================================================
# 3. Existing Endpoints Preserved for Backwards Compatibility
# ==============================================================================

@router.get("/dashboard")
def get_dashboard_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    active_sku_count = db.query(Product).filter(Product.active == True).count()
    total_stock_qty = db.query(
        func.coalesce(func.sum(InventoryBalance.current_quantity), Decimal("0.0"))
    ).join(Product, InventoryBalance.product_id == Product.id).filter(Product.active == True).scalar()

    total_inward = db.query(
        func.coalesce(func.sum(InventoryTransaction.quantity), Decimal("0.0"))
    ).filter(
        InventoryTransaction.transaction_type.in_([TransactionType.INWARD.value, TransactionType.OPENING.value])
    ).scalar()

    total_outward = db.query(
        func.coalesce(func.sum(InventoryTransaction.quantity), Decimal("0.0"))
    ).filter(
        InventoryTransaction.transaction_type == TransactionType.OUTWARD.value
    ).scalar()

    all_products = db.query(Product.id, Product.minimum_stock, InventoryBalance.current_quantity).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(Product.active == True).all()

    low_stock_count = 0
    out_of_stock_count = 0
    normal_count = 0

    for pid, min_s, qty in all_products:
        q = qty if qty is not None else Decimal("0.0")
        if q <= 0:
            out_of_stock_count += 1
        elif q <= min_s:
            low_stock_count += 1
        else:
            normal_count += 1

    category_data = db.query(
        Product.category,
        func.count(Product.id).label("sku_count"),
        func.coalesce(func.sum(InventoryBalance.current_quantity), Decimal("0.0")).label("total_quantity")
    ).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(
        Product.active == True
    ).group_by(Product.category).order_by(desc("total_quantity")).all()

    stock_by_category = [
        {"category": c[0], "sku_count": int(c[1]), "total_quantity": float(c[2])}
        for c in category_data
    ]

    top_products = db.query(
        Product.sku, Product.name, Product.category, Product.unit, InventoryBalance.current_quantity
    ).join(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(Product.active == True).order_by(desc(InventoryBalance.current_quantity)).limit(10).all()

    top_skus = [
        {"sku": t[0], "name": t[1], "category": t[2], "unit": t[3], "quantity": float(t[4])}
        for t in top_products
    ]

    monthly_txs = db.query(
        func.to_char(InventoryTransaction.transaction_date, 'YYYY-MM').label("month"),
        InventoryTransaction.transaction_type,
        func.sum(InventoryTransaction.quantity).label("total_qty")
    ).group_by("month", InventoryTransaction.transaction_type).order_by("month").all()

    time_series_map = {}
    for month, tx_type, qty in monthly_txs:
        if month not in time_series_map:
            time_series_map[month] = {"month": month, "inward": 0.0, "outward": 0.0, "opening": 0.0, "adjustment": 0.0}
        if tx_type in [TransactionType.INWARD.value, TransactionType.OPENING.value]:
            time_series_map[month]["inward"] += float(qty)
        elif tx_type == TransactionType.OUTWARD.value:
            time_series_map[month]["outward"] += float(qty)
        elif tx_type == TransactionType.ADJUSTMENT.value:
            time_series_map[month]["adjustment"] += float(qty)

    inward_vs_outward_time = list(time_series_map.values())

    return {
        "kpis": {
            "active_skus": active_sku_count,
            "total_stock_quantity": float(total_stock_qty),
            "primary_unit": "Pcs",
            "total_inward": float(total_inward),
            "total_outward": float(total_outward),
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "normal_stock_count": normal_count
        },
        "stock_by_category": stock_by_category,
        "top_skus": top_skus,
        "inward_vs_outward_time": inward_vs_outward_time
    }


@router.get("/low-stock")
def get_low_stock_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = db.query(Product, InventoryBalance.current_quantity).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(
        Product.active == True,
        or_(
            InventoryBalance.current_quantity == None,
            InventoryBalance.current_quantity <= Product.minimum_stock
        )
    ).order_by(asc(InventoryBalance.current_quantity)).all()

    items = []
    for p, qty in products:
        q = qty if qty is not None else Decimal("0.0")
        items.append({
            "product_id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "current_quantity": float(q),
            "minimum_stock": float(p.minimum_stock),
            "deficit": float(p.minimum_stock - q) if q < p.minimum_stock else 0.0,
            "stock_status": compute_stock_status(q, p.minimum_stock)
        })
    return items


@router.get("/category-stock")
def get_category_stock_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat_summary = db.query(
        Product.category,
        func.count(Product.id).label("sku_count"),
        func.coalesce(func.sum(InventoryBalance.current_quantity), Decimal("0.0")).label("total_stock"),
        func.coalesce(func.avg(InventoryBalance.current_quantity), Decimal("0.0")).label("avg_stock_per_sku")
    ).outerjoin(
        InventoryBalance, Product.id == InventoryBalance.product_id
    ).filter(
        Product.active == True
    ).group_by(Product.category).order_by(desc("total_stock")).all()

    inward_by_cat = dict(
        db.query(
            Product.category,
            func.coalesce(func.sum(InventoryTransaction.quantity), Decimal("0.0"))
        ).join(
            InventoryTransaction, Product.id == InventoryTransaction.product_id
        ).filter(
            Product.active == True,
            InventoryTransaction.transaction_type.in_([TransactionType.INWARD.value, TransactionType.OPENING.value])
        ).group_by(Product.category).all()
    )

    outward_by_cat = dict(
        db.query(
            Product.category,
            func.coalesce(func.sum(InventoryTransaction.quantity), Decimal("0.0"))
        ).join(
            InventoryTransaction, Product.id == InventoryTransaction.product_id
        ).filter(
            Product.active == True,
            InventoryTransaction.transaction_type == TransactionType.OUTWARD.value
        ).group_by(Product.category).all()
    )

    adj_by_cat = dict(
        db.query(
            Product.category,
            func.coalesce(func.sum(InventoryTransaction.quantity), Decimal("0.0"))
        ).join(
            InventoryTransaction, Product.id == InventoryTransaction.product_id
        ).filter(
            Product.active == True,
            InventoryTransaction.transaction_type == TransactionType.ADJUSTMENT.value
        ).group_by(Product.category).all()
    )

    results = []
    for c in cat_summary:
        cat_name = c[0] or "General"
        sku_cnt = int(c[1] or 0)
        tot_stock = float(c[2] or 0.0)
        avg_stock = round(float(c[3] or 0.0), 2)
        if sku_cnt > 0 and (avg_stock == 0.0 or avg_stock is None) and tot_stock > 0:
            avg_stock = round(tot_stock / sku_cnt, 2)
        inw = float(inward_by_cat.get(c[0], Decimal("0.0")) or 0.0)
        outw = float(outward_by_cat.get(c[0], Decimal("0.0")) or 0.0)
        adj = float(adj_by_cat.get(c[0], Decimal("0.0")) or 0.0)

        results.append({
            "category": cat_name,
            "sku_count": sku_cnt,
            "product_count": sku_cnt,
            "total_stock": tot_stock,
            "total_closing_stock": tot_stock,
            "avg_stock_per_sku": avg_stock,
            "total_inward": inw,
            "total_outward": outw,
            "total_adjustment": adj
        })
    return results


@router.get("/product-movement")
def get_product_movement_report(
    product_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        InventoryTransaction,
        Product.sku,
        Product.name,
        Product.category,
        Product.unit
    ).join(Product, InventoryTransaction.product_id == Product.id)

    if product_id:
        query = query.filter(InventoryTransaction.product_id == product_id)
    if category:
        query = query.filter(Product.category == category)
    if start_date:
        query = query.filter(InventoryTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(InventoryTransaction.transaction_date <= end_date)

    chrono_txs = query.order_by(
        asc(InventoryTransaction.transaction_date),
        asc(InventoryTransaction.id)
    ).all()

    product_balances: Dict[int, Decimal] = {}
    tx_list = []
    for tx, sku, name, cat, unit in chrono_txs:
        pid = tx.product_id
        qty = tx.quantity if tx.quantity is not None else Decimal("0.0")
        ttype = (tx.transaction_type or "").upper()

        curr_bal = product_balances.get(pid, Decimal("0.0"))

        if ttype in [TransactionType.OPENING.value, "INITIAL_OPENING"]:
            curr_bal = qty
        elif ttype == TransactionType.INWARD.value:
            curr_bal += abs(qty)
        elif ttype == TransactionType.OUTWARD.value:
            curr_bal -= abs(qty)
        elif ttype == TransactionType.ADJUSTMENT.value:
            curr_bal += qty
        elif ttype == TransactionType.REVERSAL.value:
            curr_bal -= qty
        else:
            curr_bal += qty

        product_balances[pid] = curr_bal

        tx_date_str = tx.transaction_date.isoformat() if tx.transaction_date else None
        created_at_str = tx.created_at.isoformat() if tx.created_at else tx_date_str

        ref_no = tx.reference_number if tx.reference_number and tx.reference_number.strip() else "—"
        notes_val = tx.remarks if tx.remarks and tx.remarks.strip() else "—"

        tx_list.append({
            "id": tx.id,
            "product_id": tx.product_id,
            "sku": sku,
            "name": name,
            "category": cat or "General",
            "unit": unit or "Pcs",
            "transaction_type": tx.transaction_type,
            "transaction_date": tx_date_str,
            "created_at": created_at_str,
            "quantity": float(qty),
            "balance_after": float(curr_bal),
            "current_balance_after": float(curr_bal),
            "reference_number": ref_no,
            "reference_no": ref_no,
            "remarks": notes_val,
            "notes": notes_val,
            "reason": notes_val,
            "created_by": tx.created_by or "system"
        })

    tx_list.reverse()
    return tx_list[:500]


# ==============================================================================
# 4. Multi-Report Export Engine (XLSX & CSV)
# ==============================================================================

@router.get("/export")
def export_report_data(
    report_type: str = Query(
        "product_movement",
        pattern="^(product_movement|stock_summary|low_stock|out_of_stock|slow_moving|category_summary|stock_reconciliation|transactions)$"
    ),
    export_format: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    thickness: Optional[str] = Query(None),
    colour_finish: Optional[str] = Query(None),
    dimensions: Optional[str] = Query(None),
    length: Optional[str] = Query(None),
    sku: Optional[str] = Query(None),
    stock_status: Optional[str] = Query("ALL"),
    movement_status: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports full filtered dataset (not just paginated view) as Microsoft Excel (.xlsx)
    or standard CSV (.csv). Respects all active filters (date range, category, variant specs, stock status).
    """
    eff_format = (export_format or format or "xlsx").lower()
    if eff_format not in ["xlsx", "csv"]:
        eff_format = "xlsx"
    from_dt, to_dt, _ = parse_date_boundaries(from_date, to_date, db)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    date_label = f"{from_dt.strftime('%d-%b-%Y')}_to_{to_dt.strftime('%d-%b-%Y')}"

    if report_type == "product_movement":
        ledger = compute_period_product_ledger(
            db, from_dt, to_dt,
            category_filter=category,
            thickness_filter=thickness,
            colour_filter=colour_finish,
            dimensions_filter=dimensions,
            length_filter=length,
            sku_filter=sku
        )
        items = list(ledger.values())

        if stock_status and stock_status != "ALL":
            filtered = []
            for it in items:
                q = it["current_stock"]
                min_s = float(it["product"].minimum_stock or 0.0)
                if stock_status == "OUT_OF_STOCK" and q <= 0:
                    filtered.append(it)
                elif stock_status == "LOW_STOCK" and (0 < q <= min_s):
                    filtered.append(it)
                elif stock_status == "NORMAL" and (q > min_s):
                    filtered.append(it)
            items = filtered

        if movement_status and movement_status != "ALL":
            if movement_status == "MOVING":
                items = [it for it in items if it.get("movement_status") == "MOVING"]
            elif movement_status in ["SLOW", "SLOW_MOVING"]:
                items = [it for it in items if it.get("movement_status") == "SLOW_MOVING"]
            elif movement_status == "NO_MOVEMENT":
                items = [it for it in items if it.get("movement_status") == "NO_MOVEMENT"]

        data = []
        for it in items:
            p = it["product"]
            q = it["current_stock"]
            min_s = float(p.minimum_stock or 0.0)
            data.append({
                "SKU": p.sku,
                "Product Name": p.name,
                "Category": p.category,
                "Unit": p.unit or "Pcs",
                "Dimensions": p.dimensions or "",
                "Thickness": p.thickness or "",
                "Finish": p.colour_finish or "",
                "Length": p.length or "",
                "Opening Stock": round(float(it["opening_stock"]), 2),
                "Period Inward": round(float(it["period_inward"]), 2),
                "Period Outward": round(float(it["period_outward"]), 2),
                "Period Adjustment": round(float(it["period_adj"]), 2),
                "Period Net Movement": round(float(it["period_inward"] - it["period_outward"] + it["period_adj"]), 2),
                "Period Closing Stock": round(float(it["closing_stock"]), 2),
                "Live Current Stock": round(q, 2),
                "Minimum Safety Stock": min_s,
                "Stock Health": "OUT_OF_STOCK" if q <= 0 else ("LOW_STOCK" if q <= min_s else "NORMAL"),
                "Movement Status": it.get("movement_status", "NO_MOVEMENT"),
                "Last Movement Date": it["last_movement_date"].strftime("%Y-%m-%d %H:%M") if it["last_movement_date"] else "None"
            })
        filename = f"Product_Movement_Report_{date_label}_{timestamp_str}"

    elif report_type == "stock_summary":
        query = db.query(Product, InventoryBalance.current_quantity).outerjoin(
            InventoryBalance, Product.id == InventoryBalance.product_id
        ).filter(Product.active == True)
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
        if sku:
            query = query.filter(Product.sku.ilike(f"%{sku.strip()}%"))

        items = query.order_by(Product.category, Product.name).all()

        data = [
            {
                "SKU": p.sku,
                "Name": p.name,
                "Category": p.category,
                "Thickness": p.thickness or "",
                "Colour/Finish": p.colour_finish or "",
                "Dimensions": p.dimensions or "",
                "Length": p.length or "",
                "Unit": p.unit or "Pcs",
                "Current Stock": float(q or Decimal("0.0")),
                "Minimum Safety Stock": float(p.minimum_stock),
                "Stock Status": compute_stock_status(q or Decimal("0.0"), p.minimum_stock)
            }
            for p, q in items
        ]
        filename = f"Stock_Summary_{timestamp_str}"

    elif report_type == "low_stock":
        items = db.query(Product, InventoryBalance.current_quantity).outerjoin(
            InventoryBalance, Product.id == InventoryBalance.product_id
        ).filter(
            Product.active == True,
            or_(
                InventoryBalance.current_quantity == None,
                InventoryBalance.current_quantity <= Product.minimum_stock
            )
        )
        if category:
            items = items.filter(Product.category == category)
        items = items.order_by(asc(InventoryBalance.current_quantity)).all()

        data = [
            {
                "SKU": p.sku,
                "Name": p.name,
                "Category": p.category,
                "Unit": p.unit or "Pcs",
                "Current Stock": float(q or Decimal("0.0")),
                "Minimum Safety Stock": float(p.minimum_stock),
                "Reorder Deficit": max(0.0, float(p.minimum_stock - (q or Decimal("0.0")))),
                "Stock Status": compute_stock_status(q or Decimal("0.0"), p.minimum_stock)
            }
            for p, q in items
        ]
        filename = f"Low_Stock_Report_{timestamp_str}"

    elif report_type == "out_of_stock":
        items = db.query(Product, InventoryBalance.current_quantity).outerjoin(
            InventoryBalance, Product.id == InventoryBalance.product_id
        ).filter(
            Product.active == True,
            or_(
                InventoryBalance.current_quantity == None,
                InventoryBalance.current_quantity <= Decimal("0.0")
            )
        )
        if category:
            items = items.filter(Product.category == category)
        items = items.order_by(Product.category, Product.name).all()

        data = [
            {
                "SKU": p.sku,
                "Name": p.name,
                "Category": p.category,
                "Unit": p.unit or "Pcs",
                "Current Stock": float(q or Decimal("0.0")),
                "Minimum Safety Stock": float(p.minimum_stock),
                "Status": "OUT_OF_STOCK"
            }
            for p, q in items
        ]
        filename = f"Out_of_Stock_Report_{timestamp_str}"

    elif report_type == "slow_moving":
        ledger = compute_period_product_ledger(
            db, from_dt, to_dt,
            category_filter=category,
            thickness_filter=thickness,
            colour_filter=colour_finish,
            dimensions_filter=dimensions,
            length_filter=length,
            sku_filter=sku
        )
        data = []
        for it in ledger.values():
            if float(it["period_outward"]) <= 5.0 and it["current_stock"] > 0:
                p = it["product"]
                data.append({
                    "SKU": p.sku,
                    "Name": p.name,
                    "Category": p.category,
                    "Current Stock": it["current_stock"],
                    "Unit": p.unit or "Pcs",
                    "Outward in Period": float(it["period_outward"]),
                    "Last Movement Date": it["last_movement_date"].strftime("%Y-%m-%d %H:%M") if it["last_movement_date"] else "None",
                    "Days Since Last Movement": it.get("days_since_last_movement") or "Never",
                    "Movement Classification": "NO_MOVEMENT" if float(it["period_outward"]) == 0 else "SLOW_MOVING"
                })
        filename = f"Slow_Moving_Inventory_{date_label}_{timestamp_str}"

    elif report_type == "category_summary":
        cat_summary = get_category_stock_report(db, current_user)
        data = [
            {
                "Category": c["category"],
                "SKU Count": c["sku_count"],
                "Total Closing Stock": c["total_closing_stock"],
                "Average Stock / SKU": c["avg_stock_per_sku"],
                "Total Inward": c["total_inward"],
                "Total Outward": c["total_outward"],
                "Total Adjustment": c["total_adjustment"]
            }
            for c in cat_summary
        ]
        filename = f"Category_Summary_{timestamp_str}"

    elif report_type == "stock_reconciliation":
        ledger = compute_period_product_ledger(db, from_dt, to_dt, category_filter=category)
        data = []
        for it in ledger.values():
            p = it["product"]
            op = round(float(it["opening_stock"]), 2)
            inw = round(float(it["period_inward"]), 2)
            outw = round(float(it["period_outward"]), 2)
            adj = round(float(it["period_adj"]), 2)
            exp_close = round(op + inw - outw + adj, 2)
            act_close = round(float(it["closing_stock"]), 2)
            cur_st = round(it["current_stock"], 2)
            var = round(act_close - exp_close, 2)
            status_desc = "Balanced" if abs(var) < 0.01 else f"Variance: {var}"

            data.append({
                "SKU": p.sku,
                "Name": p.name,
                "Category": p.category,
                "Unit": p.unit or "Pcs",
                "Opening Stock": op,
                "Inward Quantity": inw,
                "Outward Quantity": outw,
                "Net Adjustment": adj,
                "Expected Closing": exp_close,
                "Actual Recorded Closing": act_close,
                "Live Current Stock": cur_st,
                "Variance": var,
                "Reconciliation Status": status_desc
            })
        filename = f"Stock_Reconciliation_Audit_{date_label}_{timestamp_str}"

    else:  # transactions
        txs = db.query(InventoryTransaction, Product.sku, Product.name, Product.category).join(
            Product, InventoryTransaction.product_id == Product.id
        ).filter(
            InventoryTransaction.transaction_date >= from_dt,
            InventoryTransaction.transaction_date <= to_dt
        )
        if category:
            txs = txs.filter(Product.category == category)
        tx_rows = txs.order_by(desc(InventoryTransaction.transaction_date)).limit(5000).all()

        data = [
            {
                "Transaction ID": t.id,
                "Date": t.transaction_date.strftime("%Y-%m-%d %H:%M:%S") if t.transaction_date else "",
                "SKU": sku,
                "Product Name": name,
                "Category": cat,
                "Type": t.transaction_type,
                "Quantity": float(t.quantity),
                "Reference Number": t.reference_number or "",
                "Remarks": t.remarks or "",
                "Posted By": t.created_by or ""
            }
            for t, sku, name, cat in tx_rows
        ]
        filename = f"Stock_Transactions_{date_label}_{timestamp_str}"

    df = pd.DataFrame(data)

    if eff_format == "csv":
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename={filename}.csv"
        return response
    else:
        stream = io.BytesIO()
        with pd.ExcelWriter(stream, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Audit Report")
        stream.seek(0)
        response = StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = f"attachment; filename={filename}.xlsx"
        return response
