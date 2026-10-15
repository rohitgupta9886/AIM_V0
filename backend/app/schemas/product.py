from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    original_description: Optional[str] = None
    unit: str = "Pcs"
    thickness: Optional[str] = None
    colour_finish: Optional[str] = None
    dimensions: Optional[str] = None
    length: Optional[str] = None
    minimum_stock: Decimal = Decimal("5.0")
    active: bool = True

class ProductCreate(ProductBase):
    opening_stock: Optional[Decimal] = Decimal("0.0")

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    original_description: Optional[str] = None
    unit: Optional[str] = None
    thickness: Optional[str] = None
    colour_finish: Optional[str] = None
    dimensions: Optional[str] = None
    length: Optional[str] = None
    minimum_stock: Optional[Decimal] = None
    active: Optional[bool] = None

class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    current_quantity: Decimal = Decimal("0.0")
    stock_status: str = "NORMAL"  # "NORMAL", "LOW_STOCK", "OUT_OF_STOCK"
    created_at: datetime
    updated_at: datetime

class PaginatedProductsResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
