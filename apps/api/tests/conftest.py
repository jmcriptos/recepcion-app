"""Pytest configuration and fixtures."""
import os
import sys
import pytest
import tempfile

# Add src directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from app import create_app
from app.models import db, User, WeightRegistration


@pytest.fixture
def app():
    """Create Flask application for testing."""
    # Create temporary database file
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app('testing')
    app.config.update({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'DATABASE_URL': f'sqlite:///{db_path}',
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}'
    })
    
    with app.app_context():
        # Create all database tables
        db.create_all()
        yield app
        # Clean up database
        db.drop_all()
    
    # Close and remove temporary database file
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create test CLI runner."""
    return app.test_cli_runner()


@pytest.fixture
def auth_headers():
    """Provide authentication headers for API testing."""
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }


@pytest.fixture
def sample_user(app):
    """Create a sample user for testing."""
    with app.app_context():
        user = User(name='test_operator', role='operator')
        db.session.add(user)
        db.session.commit()
        return user


@pytest.fixture
def sample_supervisor(app):
    """Create a sample supervisor for testing."""
    with app.app_context():
        supervisor = User(name='test_supervisor', role='supervisor')
        db.session.add(supervisor)
        db.session.commit()
        return supervisor


@pytest.fixture
def sample_registration(app, sample_user):
    """Create a sample weight registration for testing."""
    with app.app_context():
        registration = WeightRegistration(
            weight=25.5,
            cut_type='jamón',
            supplier='Test Supplier',
            registered_by=sample_user.id
        )
        db.session.add(registration)
        db.session.commit()
        return registration


@pytest.fixture
def sample_users(app):
    """Create multiple sample users for authentication testing."""
    with app.app_context():
        users_data = [
            {'name': 'Juan Pérez', 'role': 'operator'},
            {'name': 'María García', 'role': 'supervisor'},
            {'name': 'Pedro López', 'role': 'operator'},
        ]
        
        users = []
        for user_data in users_data:
            user = User(name=user_data['name'], role=user_data['role'])
            db.session.add(user)
            users.append(user_data)
        
        db.session.commit()
        return users_data


@pytest.fixture
def authenticated_user(app, client, sample_users):
    """Create an authenticated user session for testing."""
    with app.app_context():
        # Login the first user
        user_data = sample_users[0]
        response = client.post(
            '/api/v1/auth/login',
            json={'name': user_data['name']},
            content_type='application/json'
        )
        
        # Return the user object for test verification
        user = User.query.filter_by(name=user_data['name']).first()
        return user


@pytest.fixture
def authenticated_supervisor(app, client, sample_users):
    """Create an authenticated supervisor session for testing."""
    with app.app_context():
        # Find supervisor user
        supervisor_data = next(user for user in sample_users if user['role'] == 'supervisor')
        
        response = client.post(
            '/api/v1/auth/login',
            json={'name': supervisor_data['name']},
            content_type='application/json'
        )
        
        # Return the supervisor object for test verification
        supervisor = User.query.filter_by(name=supervisor_data['name']).first()
        return supervisor