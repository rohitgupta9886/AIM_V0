from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User

def seed_users():
    db: Session = SessionLocal()
    try:
        users_to_seed = [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "admin",
            },
            {
                "username": "viewer",
                "password": "Viewer@123",
                "role": "viewer",
            }
        ]
        
        for u_data in users_to_seed:
            existing = db.query(User).filter(User.username == u_data["username"]).first()
            if not existing:
                user = User(
                    username=u_data["username"],
                    password_hash=get_password_hash(u_data["password"]),
                    role=u_data["role"],
                    active=True
                )
                db.add(user)
                print(f"Created user: {u_data['username']} ({u_data['role']})")
            else:
                print(f"User {u_data['username']} already exists.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding users: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
