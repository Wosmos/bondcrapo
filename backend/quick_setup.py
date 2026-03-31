"""
Quick setup script - creates admin user with default credentials
Run this to quickly set up authentication
"""

import sys
sys.path.append('.')

from auth import create_user, init_auth_tables

def quick_setup():
    """Quick setup with default admin credentials"""
    print("="*60)
    print("BondCheck PRO - Quick Auth Setup")
    print("="*60)
    
    # Initialize tables
    print("\nInitializing database tables...")
    init_auth_tables()
    print("SUCCESS: Tables created!")
    
    # Create admin with default credentials
    print("\nCreating admin user...")
    admin_id = create_user(
        username="admin",
        email="admin@bondcheck.com",
        password="admin123",  # Change this after first login!
        full_name="Administrator",
        is_admin=True
    )
    
    if admin_id:
        print(f"\nSUCCESS: Admin user created!")
        print(f"   ID: {admin_id}")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   Email: admin@bondcheck.com")
        print("\n" + "!"*60)
        print("IMPORTANT: Change the password after first login!")
        print("!"*60)
    else:
        print("\nNOTE: Admin user may already exist.")
        print("Try logging in with: admin / admin123")
    
    print("\n" + "="*60)
    print("Setup complete! Start the server with: python app.py")
    print("="*60)

if __name__ == "__main__":
    quick_setup()
