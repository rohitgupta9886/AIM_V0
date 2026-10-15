from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["Product Categories"])

def ensure_categories_synced(db: Session):
    """
    Auto-seeds existing distinct categories from products if they aren't in the categories table.
    """
    try:
        existing_names = {c.name.strip().lower() for c in db.query(Category.name).all()}
        distinct_product_cats = db.query(Product.category).distinct().filter(Product.category != None).all()
        added = False
        for (cat_name,) in distinct_product_cats:
            if cat_name and cat_name.strip() and cat_name.strip().lower() not in existing_names:
                new_cat = Category(name=cat_name.strip())
                db.add(new_cat)
                existing_names.add(cat_name.strip().lower())
                added = True
        if added:
            db.commit()
    except Exception as e:
        db.rollback()
        # Non-fatal if table doesn't exist yet prior to create_all
        pass

@router.get("", response_model=List[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_categories_synced(db)

    # Query all categories
    categories = db.query(Category).order_by(Category.name.asc()).all()

    # Query product counts grouped by category name
    counts = dict(
        db.query(Product.category, func.count(Product.id))
        .group_by(Product.category)
        .all()
    )

    result = []
    for cat in categories:
        result.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            product_count=counts.get(cat.name, 0),
            created_at=cat.created_at,
            updated_at=cat.updated_at
        ))
    return result

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    name_clean = cat_in.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Category name cannot be empty"
        )

    # Check for duplicate name (case-insensitive)
    existing = db.query(Category).filter(func.lower(Category.name) == func.lower(name_clean)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{name_clean}' already exists"
        )

    new_cat = Category(
        name=name_clean,
        description=cat_in.description.strip() if cat_in.description else None
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    return CategoryResponse(
        id=new_cat.id,
        name=new_cat.name,
        description=new_cat.description,
        product_count=0,
        created_at=new_cat.created_at,
        updated_at=new_cat.updated_at
    )

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    cat_in: CategoryUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    old_name = cat.name

    if cat_in.name is not None:
        name_clean = cat_in.name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Category name cannot be empty"
            )

        # Check collision with other categories
        conflict = db.query(Category).filter(
            func.lower(Category.name) == func.lower(name_clean),
            Category.id != category_id
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another category named '{name_clean}' already exists"
            )

        cat.name = name_clean

        # Propagate rename across products if name changed
        if old_name != name_clean:
            db.query(Product).filter(Product.category == old_name).update(
                {Product.category: name_clean},
                synchronize_session=False
            )

    if cat_in.description is not None:
        cat.description = cat_in.description.strip() if cat_in.description else None

    db.commit()
    db.refresh(cat)

    # Recalculate product count
    count = db.query(Product).filter(Product.category == cat.name).count()

    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        product_count=count,
        created_at=cat.created_at,
        updated_at=cat.updated_at
    )

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    reassign_to: Optional[str] = Query(None, description="Category name to reassign products to"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    product_count = db.query(Product).filter(Product.category == cat.name).count()

    if product_count > 0:
        if not reassign_to or not reassign_to.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete category '{cat.name}' because {product_count} product(s) are assigned to it. Please reassign them first or specify a replacement category."
            )
        target_name = reassign_to.strip()
        if target_name.lower() == cat.name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reassign products to the category being deleted."
            )
        # Ensure target category exists or create it
        target_cat = db.query(Category).filter(func.lower(Category.name) == func.lower(target_name)).first()
        if not target_cat:
            target_cat = Category(name=target_name)
            db.add(target_cat)
            db.flush()

        # Reassign products
        db.query(Product).filter(Product.category == cat.name).update(
            {Product.category: target_cat.name},
            synchronize_session=False
        )

    deleted_name = cat.name
    db.delete(cat)
    db.commit()

    return {
        "message": f"Category '{deleted_name}' successfully deleted",
        "reassigned_products": product_count if reassign_to else 0
    }
