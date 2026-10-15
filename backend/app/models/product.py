from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    original_description = Column(Text, nullable=True)
    unit = Column(String(50), default="Pcs", nullable=False)
    thickness = Column(String(50), nullable=True, index=True)
    colour_finish = Column(String(100), nullable=True, index=True)
    dimensions = Column(String(100), nullable=True, index=True)
    length = Column(String(50), nullable=True, index=True)
    minimum_stock = Column(Numeric(12, 2), default=0.0, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    balance = relationship("InventoryBalance", back_populates="product", uselist=False, cascade="all, delete-orphan")
    transactions = relationship("InventoryTransaction", back_populates="product", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', category='{self.category}')>"
