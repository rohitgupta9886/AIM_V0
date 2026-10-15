from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, verify_password

db = SessionLocal()
admin = db.query(User).filter(User.username == "admin").first()
if admin:
    admin.password_hash = get_password_hash("Admin@123")
viewer = db.query(User).filter(User.username == "viewer").first()
if viewer:
    viewer.password_hash = get_password_hash("Viewer@123")
db.commit()

# Verify
assert verify_password("Admin@123", admin.password_hash)
assert verify_password("Viewer@123", viewer.password_hash)
print("Updated and verified admin and viewer passwords!")
db.close()
