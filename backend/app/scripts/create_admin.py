"""
Secure Administrative User Creation & Provisioning Script.

Usage:
    python -m app.scripts.create_admin --seed-demo
    python -m app.scripts.create_admin --email admin@ezfinanz.com --phone 8888888888 --password AdminPass@123
    python -m app.scripts.create_admin
"""

import argparse
import getpass
import re
import sys
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import ConflictError, ValidationError
from app.core.security import hash_password, validate_password_strength
from app.models.user import User, UserRole


def normalize_admin_phone(phone: str) -> str:
    """Sanitizes phone string to standard 10-digit format."""
    clean_phone = re.sub(r"[\s\-\(\)\+]", "", phone.strip())
    if clean_phone.startswith("91") and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]
    if not re.match(r"^[6-9]\d{9}$", clean_phone):
        raise ValidationError("Phone number must be a valid 10-digit Indian mobile number starting with 6-9.")
    return clean_phone


def provision_admin_user(
    db: Session,
    email: str,
    phone: str,
    password: str,
) -> User:
    """
    Creates or validates an administrative account in the database.
    - Validates email and phone syntax
    - Validates password complexity
    - Hashes password with Argon2id
    - Enforces role=ADMIN
    - Prevents duplicates
    """
    clean_email = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean_email):
        raise ValidationError(f"Invalid email format '{clean_email}'.")

    clean_phone = normalize_admin_phone(phone)
    validate_password_strength(password)

    # 1. Check existing email
    stmt_email = select(User).where(User.email == clean_email)
    existing_user = db.execute(stmt_email).scalar_one_or_none()
    if existing_user:
        if existing_user.role == UserRole.ADMIN:
            # Update password for existing admin
            existing_user.password_hash = hash_password(password)
            existing_user.phone = clean_phone
            existing_user.is_active = True
            db.commit()
            db.refresh(existing_user)
            return existing_user
        raise ConflictError(f"A non-admin user with email '{clean_email}' already exists.")

    # 2. Check existing phone
    stmt_phone = select(User).where(User.phone == clean_phone)
    existing_phone = db.execute(stmt_phone).scalar_one_or_none()
    if existing_phone:
        raise ConflictError(f"A user with phone number '{clean_phone}' already exists.")

    # 3. Create Admin user
    hashed_pwd = hash_password(password)
    admin = User(
        email=clean_email,
        phone=clean_phone,
        password_hash=hashed_pwd,
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def main():
    parser = argparse.ArgumentParser(description="EZFINANZ Administrator Account Provisioning CLI.")
    parser.add_argument("--email", help="Admin email address", required=False)
    parser.add_argument("--phone", help="Admin 10-digit mobile number", required=False)
    parser.add_argument("--password", help="Admin password", required=False)
    parser.add_argument("--seed-demo", action="store_true", help="Seed default development demo admin account (admin@ezfinanz.com)")

    args = parser.parse_args()

    print("==================================================")
    print(" EZFINANZ — Secure Admin Account Provisioning Tool")
    print("==================================================")

    if args.seed_demo:
        email = "admin@ezfinanz.com"
        phone = "8888888888"
        password = "AdminPass@123"
        print(">> Provisioning default development demo admin account...")
    else:
        email = args.email
        phone = args.phone
        password = args.password

        # Interactive prompts if arguments omitted
        if not email:
            try:
                email = input("Enter admin email address: ").strip().lower()
            except (KeyboardInterrupt, EOFError):
                print("\nOperation cancelled.")
                sys.exit(1)

        if not phone:
            try:
                phone = input("Enter admin 10-digit mobile number: ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\nOperation cancelled.")
                sys.exit(1)

        if not password:
            try:
                password = getpass.getpass("Enter strong admin password: ")
                confirm = getpass.getpass("Confirm admin password: ")
            except (KeyboardInterrupt, EOFError):
                print("\nOperation cancelled.")
                sys.exit(1)

            if password != confirm:
                print("Error: Passwords do not match.")
                sys.exit(1)

    db = SessionLocal()
    try:
        admin_user = provision_admin_user(db, email=email, phone=phone, password=password)
        print("\n==================================================")
        print(" SUCCESS: Admin account provisioned successfully!")
        print(f" User ID: {admin_user.id}")
        print(f" Email:   {admin_user.email}")
        print(f" Phone:   {admin_user.phone}")
        print(f" Role:    {admin_user.role.value}")
        print(f" Active:  {admin_user.is_active}")
        print("==================================================")
    except (ValidationError, ConflictError) as e:
        print(f"\nProvisioning Failed: {e.message}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
