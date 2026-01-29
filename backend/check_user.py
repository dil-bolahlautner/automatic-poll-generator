from app.users import SessionLocal, get_user_by_email
import sys

def check_user(email: str):
    db = SessionLocal()
    try:
        user = get_user_by_email(db, email)
        if user:
            print(f"\nFelhasználó találat:")
            print(f"- Email: {user.email}")
            print(f"- ID: {user.id}")
            print(f"- Admin: {user.is_admin}")
            print(f"- Regisztráció ideje: {user.created_at}")
        else:
            print(f"\nNem található felhasználó ezzel az email címmel: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Használat: python check_user.py email@cim.hu")
    else:
        check_user(sys.argv[1]) 