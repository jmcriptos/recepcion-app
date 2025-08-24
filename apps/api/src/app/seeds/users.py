"""User seed data for development and testing."""
from datetime import datetime
from app.models import db, User


def seed_users():
    """Create test users for development environment."""
    # Check if users already exist
    if User.query.first():
        print("Users already exist. Skipping user seeding.")
        return

    # Create test operators
    operators = [
        User(name='juan_operator', role='operator'),
        User(name='maria_operator', role='operator'),
        User(name='carlos_operator', role='operator'),
    ]

    # Create test supervisors
    supervisors = [
        User(name='ana_supervisor', role='supervisor'),
        User(name='luis_supervisor', role='supervisor'),
    ]

    try:
        # Add all users to session
        for user in operators + supervisors:
            db.session.add(user)
        
        # Commit all users
        db.session.commit()
        
        print(f"Successfully created {len(operators)} operators and {len(supervisors)} supervisors:")
        for user in operators + supervisors:
            print(f"  - {user.name} ({user.role})")
            
    except Exception as e:
        db.session.rollback()
        print(f"Error creating users: {e}")
        raise


def clear_users():
    """Remove all users from database (for testing purposes)."""
    try:
        count = User.query.count()
        if count > 0:
            User.query.delete()
            db.session.commit()
            print(f"Deleted {count} users from database.")
        else:
            print("No users found to delete.")
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting users: {e}")
        raise