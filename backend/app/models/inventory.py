from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class TransactionType(str, enum.Enum):
    OPENING = "OPENING"
    INWARD = "INWARD"
    OUTWARD = "OUTWARD"
    ADJUSTMENT = "ADJUSTMENT"
    REVERSAL = "REVERSAL"

class InventoryBalance(Base):
    __tablename__ = "inventory_balances"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    current_quantity = Column(Numeric(12, 2), default=0.0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    product = relationship("Product", back_populates="balance")

    def __repr__(self):
        return f"<InventoryBalance(product_id={self.product_id}, qty={self.current_quantity})>"

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False, index=True)  # OPENING, INWARD, OUTWARD, ADJUSTMENT, REVERSAL
    transaction_date = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    quantity = Column(Numeric(12, 2), nullable=False)  # Quantity for this transaction (positive for INWARD/OPENING, positive/negative for ADJUSTMENT, positive stored for OUTWARD)
    reference_number = Column(String(100), nullable=True, index=True)
    remarks = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    reversal_of_id = Column(Integer, ForeignKey("inventory_transactions.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    product = relationship("Product", back_populates="transactions")
    reversal_of = relationship("InventoryTransaction", remote_side=[id])

    def __repr__(self):
        return f"<InventoryTransaction(id={self.id}, type='{self.transaction_type}', qty={self.quantity}, ref='{self.reference_number}')>"
