from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    source_period_start = Column(Date, nullable=True)
    source_period_end = Column(Date, nullable=True)
    imported_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    imported_by = Column(String(100), nullable=True)
    imported_count = Column(Integer, default=0, nullable=False)
    skipped_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    reconciliation_data = Column(JSON, nullable=True)  # Store totals, discrepancies, source stats

    # Relationships
    row_results = relationship("ImportRowResult", back_populates="batch", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ImportBatch(id={self.id}, file='{self.filename}', count={self.imported_count})>"

class ImportRowResult(Base):
    __tablename__ = "import_row_results"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    source_sheet = Column(String(100), nullable=False)
    source_row = Column(Integer, nullable=False)
    source_description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False)  # "IMPORTED", "SKIPPED", "ERROR", "WARNING"
    message = Column(Text, nullable=True)

    # Relationships
    batch = relationship("ImportBatch", back_populates="row_results")

    def __repr__(self):
        return f"<ImportRowResult(row={self.source_row}, status='{self.status}')>"
