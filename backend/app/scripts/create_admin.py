"""
Secure Administrative User Creation CLI Script.

Usage:
    python -m app.scripts.create_admin
    python -m app.scripts.create_admin --email admin@ezfinanz.com --phone 9876543210 --password StrongAdmin@123
"""

import argparse
import getpass
import re
import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password, validate_password_strength
from app.core.exceptions import ValidationError
from app.models.user import User, UserRole


def create_admin(
    email: str | None = None,
    phone: str | None = None,
    password: str | None = None,
) -> None:
    """Creates a user with the ADMIN role in the database."""
    print("==================================================")
    print(" EZFINANZ — Secure Admin Account Creation Tool")
    print("==================================================")

    # 1. Collect Email
    if not email:
        try:
            email = input("Enter admin email address: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(1)
    else:
        email = email.strip().lower()

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        print(f"Error: Invalid email format '{email}'.")
        sys.exit(1)

    # 2. Collect Phone
    if not phone:
        try:
            phone = input("Enter admin 10-digit mobile number: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(1)
    else:
        phone = phone.strip()

    clean_phone = re.sub(r"[\s\-\(\)\+]", "", phone)
    if clean_phone.startswith("91") and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]
    if not re.match(r"^[6-9]\d{9}$", clean_phone):
        print(f"Error: Phone number must be a valid 10-digit number.")
        sys.exit(1)
    phone = clean_phone

    # 3. Collect Password securely
    if not password:
        try:
            password = getpass.getpass("Enter strong admin password: ")
            confirm = getpass.getpass("Confirm password: ")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(1)

        if password != confirm:
            print("Error: Passwords do not match.")
            sys.exit(1)

    # 4. Validate password policy
    try:
        validate_password_strength(password)
    except ValidationError as e:
        print(f"Error: {e.message}")
        sys.exit(1)

    # 5. Connect to PostgreSQL and create admin
    db = SessionLocal()
    try:
        # Check existing email
        stmt_email = select(User).where(User.email == email)
        if db.execute(stmt_email).scalar_one_or_none():
            print(f"Error: A user with email '{email}' already exists.")
            sys.exit(1)

        # Check existing phone
        stmt_phone = select(User).where(User.phone == phone)
        if db.execute(stmt_phone).scalar_one_or_none():
            print(f"Error: A user with phone number '{phone}' already exists.")
            sys.exit(1)

        # Hash password using Argon2id
        hashed_password = hash_password(password)

        admin_user = User(
            email=email,
            phone=phone,
            password_hash=hashed_password,
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("\n==================================================")
        print(" SUCCESS: Admin user created successfully!")
        print(f" User ID: {admin_user.id}")
        print(f" Email:   {admin_user.email}")
        print(f" Role:    {admin_user.role.value}")
        print(f" Active:  {admin_user.is_active}")
        print("==================================================")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Create an EZFINANZ administrator account.")
    parser.add_argument("--email", help="Admin email address", required=False)
    parser.add_argument("--phone", help="Admin phone number", required=False)
    parser.add_argument("--password", help="Admin password (optional, will prompt securely if omitted)", required=False)

    args = parser.parse_args()
    create_admin(email=args.email, phone=args.phone, password=args.password)


if __name__ == "__main__":
    main()
