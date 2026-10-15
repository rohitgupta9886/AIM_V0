from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class StockInwardRequest(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0, description="Quantity must be greater than zero")
    transaction_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class StockOutwardRequest(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0, description="Quantity must be greater than zero")
    transaction_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    allow_negative_override: bool = False

class StockAdjustmentRequest(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., description="Quantity delta (positive or negative) or counted difference")
    reason: str = Field(..., min_length=3, description="Mandatory reason for stock adjustment")
    transaction_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    transaction_type: str
    transaction_date: datetime
    quantity: Decimal
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    reversal_of_id: Optional[int] = None
    current_balance_after: Optional[Decimal] = None

class PaginatedTransactionsResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class StockSummaryItem(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str
    unit: str
    thickness: Optional[str] = None
    colour_finish: Optional[str] = None
    dimensions: Optional[str] = None
    length: Optional[str] = None
    current_quantity: Decimal
    minimum_stock: Decimal
    stock_status: str
    total_inward: Decimal = Decimal("0.0")
    total_outward: Decimal = Decimal("0.0")
    total_adjustment: Decimal = Decimal("0.0")
