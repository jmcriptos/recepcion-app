"""Integration tests for authentication endpoints."""
import pytest
import json
from datetime import datetime
from app.models.user import User
from app.models import db


class TestAuthLoginEndpoint:
    """Test the POST /api/v1/auth/login endpoint."""
    
    def test_successful_login(self, client, sample_users):
        """Test successful login with valid credentials."""
        # Use the first user from sample data
        user_data = sample_users[0]
        
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['name'] == user_data['name']
        assert data['role'] == user_data['role']
        assert data['active'] is True
        assert 'id' in data
        assert 'last_login' in data
        
        # Check that session cookie is set
        assert 'Set-Cookie' in response.headers
    
    def test_login_updates_last_login(self, client, sample_users):
        """Test that login updates the last_login timestamp."""
        user_data = sample_users[0]
        
        # Get user before login
        user = User.query.filter_by(name=user_data['name']).first()
        initial_last_login = user.last_login
        
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        
        # Check that last_login was updated
        user = User.query.filter_by(name=user_data['name']).first()
        assert user.last_login != initial_last_login
        assert user.last_login is not None
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': 'Nonexistent User'}),
            content_type='application/json'
        )
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['code'] == 'AUTHENTICATION_ERROR'
        assert data['error']['message'] == 'Invalid credentials'
        assert 'timestamp' in data['error']
    
    def test_login_inactive_user(self, client, sample_users):
        """Test login with inactive user."""
        # Create an inactive user
        inactive_user = User(name="Inactive User", role="operator", active=False)
        db.session.add(inactive_user)
        db.session.commit()
        
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': 'Inactive User'}),
            content_type='application/json'
        )
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['code'] == 'AUTHENTICATION_ERROR'
        assert data['error']['message'] == 'Account is inactive'
    
    def test_login_missing_name(self, client):
        """Test login with missing name field."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({}),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert data['error']['message'] == 'Name is required'
    
    def test_login_empty_name(self, client):
        """Test login with empty name."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': '   '}),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert data['error']['message'] == 'Name is required'
    
    def test_login_name_too_long(self, client):
        """Test login with name exceeding 255 characters."""
        long_name = 'A' * 256
        
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': long_name}),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert 'must be 255 characters or less' in data['error']['message']
    
    def test_login_invalid_json(self, client):
        """Test login with invalid JSON."""
        response = client.post(
            '/api/v1/auth/login',
            data='invalid json',
            content_type='application/json'
        )
        
        assert response.status_code == 400
    
    def test_login_non_json_request(self, client):
        """Test login with non-JSON content type."""
        response = client.post(
            '/api/v1/auth/login',
            data='name=Test User',
            content_type='application/x-www-form-urlencoded'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert data['error']['code'] == 'INVALID_REQUEST'
        assert data['error']['message'] == 'Request must be JSON'


class TestAuthLogoutEndpoint:
    """Test the POST /api/v1/auth/logout endpoint."""
    
    def test_successful_logout(self, client, authenticated_user):
        """Test successful logout with authenticated user."""
        response = client.post('/api/v1/auth/logout')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['message'] == 'Logout successful'
        assert 'timestamp' in data
    
    def test_logout_without_authentication(self, client):
        """Test logout without being authenticated."""
        response = client.post('/api/v1/auth/logout')
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['code'] == 'AUTHENTICATION_ERROR'


class TestCurrentUserEndpoint:
    """Test the GET /api/v1/auth/current-user endpoint."""
    
    def test_get_current_user_authenticated(self, client, authenticated_user):
        """Test getting current user when authenticated."""
        response = client.get('/api/v1/auth/current-user')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['name'] == authenticated_user.name
        assert data['role'] == authenticated_user.role
        assert data['active'] is True
        assert 'id' in data
    
    def test_get_current_user_not_authenticated(self, client):
        """Test getting current user when not authenticated."""
        response = client.get('/api/v1/auth/current-user')
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['code'] == 'AUTHENTICATION_ERROR'


class TestAuthenticationFlow:
    """Test complete authentication flows."""
    
    def test_complete_login_logout_flow(self, client, sample_users):
        """Test complete login -> access -> logout flow."""
        user_data = sample_users[0]
        
        # Step 1: Login
        login_response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        assert login_response.status_code == 200
        
        # Step 2: Access protected resource
        user_response = client.get('/api/v1/auth/current-user')
        assert user_response.status_code == 200
        user_data_response = user_response.get_json()
        assert user_data_response['name'] == user_data['name']
        
        # Step 3: Logout
        logout_response = client.post('/api/v1/auth/logout')
        assert logout_response.status_code == 200
        
        # Step 4: Try to access protected resource after logout
        protected_response = client.get('/api/v1/auth/current-user')
        assert protected_response.status_code == 401
    
    def test_session_persistence_across_requests(self, client, sample_users):
        """Test that session persists across multiple requests."""
        user_data = sample_users[0]
        
        # Login
        login_response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        assert login_response.status_code == 200
        
        # Make multiple requests to verify session persistence
        for _ in range(3):
            response = client.get('/api/v1/auth/current-user')
            assert response.status_code == 200
            data = response.get_json()
            assert data['name'] == user_data['name']
    
    def test_multiple_logins_same_user(self, client, sample_users):
        """Test multiple logins with the same user."""
        user_data = sample_users[0]
        
        # First login
        response1 = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        assert response1.status_code == 200
        
        # Second login (should work and update session)
        response2 = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': user_data['name']}),
            content_type='application/json'
        )
        assert response2.status_code == 200
        
        # Should still be able to access protected resources
        user_response = client.get('/api/v1/auth/current-user')
        assert user_response.status_code == 200


class TestErrorHandling:
    """Test error handling in authentication endpoints."""
    
    def test_error_response_format(self, client):
        """Test that error responses follow the expected format."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': 'Nonexistent User'}),
            content_type='application/json'
        )
        
        assert response.status_code == 401
        data = response.get_json()
        
        # Check error response structure
        assert 'error' in data
        error = data['error']
        assert 'code' in error
        assert 'message' in error
        assert 'timestamp' in error
        assert 'requestId' in error
        
        # Check timestamp format
        timestamp = error['timestamp']
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))  # Should not raise
    
    def test_request_id_in_errors(self, client):
        """Test that request ID is included in error responses."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': 'Nonexistent User'}),
            content_type='application/json',
            headers={'X-Request-ID': 'test-request-123'}
        )
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['requestId'] == 'test-request-123'
    
    def test_default_request_id_in_errors(self, client):
        """Test that default request ID is used when not provided."""
        response = client.post(
            '/api/v1/auth/login',
            data=json.dumps({'name': 'Nonexistent User'}),
            content_type='application/json'
        )
        
        assert response.status_code == 401
        data = response.get_json()
        
        assert data['error']['requestId'] == 'unknown'