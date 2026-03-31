"""
Setup script for authentication system
Creates admin user and initializes auth tables
"""

import sys
sys.path.append('.')

from auth import create_user, init_auth_tables

def setup_auth():
    """Initialize authentication system"""
    print("="*60)
    print("BondCheck PRO - Authentication Setup")
    print("="*60)
    
    # Initialize tables
    print("\nInitializing database tables...")
    init_auth_tables()
    print("Tables created successfully!")
    
    # Create admin user
    print("\nCreating admin user...")
    print("Please enter admin credentials:")
    
    username = input("Username (default: admin): ").strip() or "admin"
    email = input("Email (default: admin@bondcheck.com): ").strip() or "admin@bondcheck.com"
    password = input("Password: ").strip()
    
    if not password:
        print("ERROR: Password cannot be empty!")
        return
    
    full_name = input("Full Name (optional): ").strip() or "Administrator"
    
    # Create admin
    admin_id = create_user(
        username=username,
        email=email,
        password=password,
        full_name=full_name,
        is_admin=True
    )
    
    if admin_id:
        print(f"\nAdmin user created successfully!")
        print(f"   ID: {admin_id}")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print("\nYou can now login with these credentials!")
    else:
        print("\nFailed to create admin user.")
        print("   Username or email may already exist.")
    
    print("\n" + "="*60)
    print("Setup complete! Start the server with: python app.py")
    print("="*60)

if __name__ == "__main__":
    setup_auth()
