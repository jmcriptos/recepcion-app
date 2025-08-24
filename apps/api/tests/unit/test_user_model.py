"""Unit tests for User model."""
import pytest
from datetime import datetime
from app.models import db, User


class TestUserModel:
    """Test User model functionality."""
    
    def test_user_creation(self, app):
        """Test basic user creation."""
        with app.app_context():
            user = User(name='test_user', role='operator')
            assert user.name == 'test_user'
            assert user.role == 'operator'
            assert user.is_active is True  # Default value
            assert user.created_at is None  # Not set until saved
            assert user.last_login is None
    
    def test_user_save_and_retrieve(self, app):
        """Test user can be saved and retrieved from database."""
        with app.app_context():
            user = User(name='save_test_user', role='supervisor')
            db.session.add(user)
            db.session.commit()
            
            # Retrieve user
            retrieved_user = User.query.filter_by(name='save_test_user').first()
            assert retrieved_user is not None
            assert retrieved_user.name == 'save_test_user'
            assert retrieved_user.role == 'supervisor'
            assert retrieved_user.id is not None
            assert retrieved_user.created_at is not None
    
    def test_user_unique_name_constraint(self, app):
        """Test that user names must be unique."""
        with app.app_context():
            user1 = User(name='duplicate_name', role='operator')
            user2 = User(name='duplicate_name', role='supervisor')
            
            db.session.add(user1)
            db.session.commit()
            
            db.session.add(user2)
            with pytest.raises(Exception):  # Should raise integrity error
                db.session.commit()
    
    def test_user_role_validation(self, app):
        """Test user role validation."""
        with app.app_context():
            # Valid roles
            operator = User(name='operator_test', role='operator')
            supervisor = User(name='supervisor_test', role='supervisor')
            
            db.session.add(operator)
            db.session.add(supervisor)
            db.session.commit()
            
            assert operator.role == 'operator'
            assert supervisor.role == 'supervisor'
    
    def test_is_supervisor_method(self, app):
        """Test is_supervisor helper method."""
        with app.app_context():
            operator = User(name='op_test', role='operator')
            supervisor = User(name='sup_test', role='supervisor')
            
            assert not operator.is_supervisor()
            assert supervisor.is_supervisor()
    
    def test_is_operator_method(self, app):
        """Test is_operator helper method."""
        with app.app_context():
            operator = User(name='op_test', role='operator')
            supervisor = User(name='sup_test', role='supervisor')
            
            assert operator.is_operator()
            assert not supervisor.is_operator()
    
    def test_update_last_login(self, app, sample_user):
        """Test update_last_login method."""
        with app.app_context():
            # Fresh user should have no last login
            user = User.query.get(sample_user.id)
            assert user.last_login is None
            
            # Update last login
            before_login = datetime.utcnow()
            user.update_last_login()
            
            # Verify last login was updated
            updated_user = User.query.get(sample_user.id)
            assert updated_user.last_login is not None
            assert updated_user.last_login >= before_login
    
    def test_to_dict_method(self, app, sample_user):
        """Test to_dict serialization method."""
        with app.app_context():
            user = User.query.get(sample_user.id)
            user_dict = user.to_dict()
            
            assert isinstance(user_dict, dict)
            assert 'id' in user_dict
            assert 'name' in user_dict
            assert 'role' in user_dict
            assert 'is_active' in user_dict
            assert 'created_at' in user_dict
            assert 'last_login' in user_dict
            
            assert user_dict['name'] == user.name
            assert user_dict['role'] == user.role
            assert user_dict['is_active'] == user.is_active
    
    def test_user_repr(self, app):
        """Test string representation of User."""
        with app.app_context():
            user = User(name='repr_test', role='operator')
            expected = '<User repr_test (operator)>'
            assert repr(user) == expected
    
    def test_user_inactive_state(self, app):
        """Test user can be set to inactive."""
        with app.app_context():
            user = User(name='inactive_test', role='operator', is_active=False)
            db.session.add(user)
            db.session.commit()
            
            retrieved_user = User.query.filter_by(name='inactive_test').first()
            assert not retrieved_user.is_active