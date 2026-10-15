from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.import_batch import ImportBatch
from app.schemas.import_batch import (
    ImportPreviewResponse,
    ImportBatchResponse,
    ImportBatchDetailResponse
)
from app.services.excel_import import ExcelImportService

router = APIRouter(prefix="/import", tags=["Excel Import & Reconciliation"])

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent

@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_excel_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload an Excel workbook (.xlsx or .xls)"
        )
    
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )
        
    try:
        preview = ExcelImportService.preview_workbook(
            file_bytes=contents,
            filename=file.filename,
            sheet_name=sheet_name,
            db=db
        )
        return preview
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse Excel workbook: {str(e)}"
        )

@router.post("/confirm", response_model=ImportBatchResponse)
async def confirm_excel_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    allow_negative_stock: bool = Form(True),
    update_existing_products: bool = Form(False),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )
        
    try:
        batch = ExcelImportService.execute_import(
            db=db,
            file_bytes=contents,
            filename=file.filename,
            user_name=admin_user.username,
            sheet_name=sheet_name,
            allow_negative_stock=allow_negative_stock,
            update_existing_products=update_existing_products
        )
        return ImportBatchResponse.model_validate(batch)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import execution error: {str(e)}"
        )

@router.get("/history", response_model=List[ImportBatchResponse])
def get_import_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batches = db.query(ImportBatch).order_by(ImportBatch.imported_at.desc()).offset(skip).limit(limit).all()
    return [ImportBatchResponse.model_validate(b) for b in batches]

@router.get("/batch/{batch_id}", response_model=ImportBatchDetailResponse)
def get_import_batch_details(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import batch not found")
    return ImportBatchDetailResponse.model_validate(batch)

@router.get("/download-source-excel")
def download_source_excel(current_user: User = Depends(get_current_user)):
    source_path = WORKSPACE_ROOT / "desktop.xlsx"
    if not source_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source Excel workbook not found")
    return FileResponse(
        path=str(source_path),
        filename="desktop.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
