from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime, date
from decimal import Decimal

class ColumnMapping(BaseModel):
    particulars_col: int = 1      # Column index (1-based)
    opening_qty_col: int = 2
    inwards_col: int = 5
    outwards_col: int = 6
    closing_col: int = 7

class RowPreviewItem(BaseModel):
    row_number: int
    row_type: str                 # "PRODUCT", "CATEGORY", "TOTAL", "HEADER", "EMPTY"
    raw_description: Optional[str] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    thickness: Optional[str] = None
    colour_finish: Optional[str] = None
    dimensions: Optional[str] = None
    length: Optional[str] = None
    unit: str = "Pcs"
    opening_qty: Decimal = Decimal("0.0")
    inwards_qty: Decimal = Decimal("0.0")
    outwards_qty: Decimal = Decimal("0.0")
    closing_qty: Decimal = Decimal("0.0")
    status: str = "VALID"         # "VALID", "WARNING", "ERROR", "EXCLUDED"
    message: Optional[str] = None
    is_duplicate: bool = False

class ReconciliationReport(BaseModel):
    source_period_start: Optional[str] = None
    source_period_end: Optional[str] = None
    grand_total_inwards: Decimal = Decimal("0.0")
    grand_total_outwards: Decimal = Decimal("0.0")
    grand_total_closing: Decimal = Decimal("0.0")
    calculated_items_inwards: Decimal = Decimal("0.0")
    calculated_items_outwards: Decimal = Decimal("0.0")
    calculated_items_closing: Decimal = Decimal("0.0")
    closing_discrepancy: Decimal = Decimal("0.0")
    inward_discrepancy: Decimal = Decimal("0.0")
    outward_discrepancy: Decimal = Decimal("0.0")
    discrepancy_explanation: Optional[str] = None
    negative_stock_rows_count: int = 0
    duplicate_skus_count: int = 0

class ImportPreviewResponse(BaseModel):
    filename: str
    sheet_name: str
    available_sheets: List[str]
    total_rows: int
    product_rows_count: int
    category_rows_count: int
    header_rows_count: int
    reconciliation: ReconciliationReport
    preview_rows: List[RowPreviewItem]

class ImportConfirmRequest(BaseModel):
    filename: str
    sheet_name: Optional[str] = None
    allow_negative_stock: bool = True     # Allow importing legacy closing stock even if negative (-5)
    update_existing_products: bool = False

class ImportRowResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_sheet: str
    source_row: int
    source_description: Optional[str] = None
    status: str
    message: Optional[str] = None

class ImportBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    source_period_start: Optional[date] = None
    source_period_end: Optional[date] = None
    imported_at: datetime
    imported_by: Optional[str] = None
    imported_count: int
    skipped_count: int
    error_count: int
    reconciliation_data: Optional[Dict[str, Any]] = None

class ImportBatchDetailResponse(ImportBatchResponse):
    row_results: List[ImportRowResultResponse] = []
