"""Unit tests for authentication middleware."""
import pytest
from unittest.mock import patch, MagicMock
from flask import Flask, jsonify, request
from app.middleware.auth_middleware import (
    login_required_api,
    role_required,
    supervisor_required,
    supervisor_only,
    operator_or_supervisor_required,
    get_current_user_info,
    log_authentication_event
)


class TestLoginRequiredDecorator:
    """Test the @login_required_api decorator."""
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_authenticated_user_can_access(self, mock_current_user):
        """Test that authenticated users can access protected routes."""
        mock_current_user.is_authenticated = True
        
        @login_required_api
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                # Should return the original function result
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_unauthenticated_user_denied(self, mock_current_user):
        """Test that unauthenticated users are denied access."""
        mock_current_user.is_authenticated = False
        
        @login_required_api
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                mock_request.headers.get.return_value = 'test-request-id'
                
                result = test_route()
                
                assert result[1] == 401  # Status code
                data = result[0].get_json()
                assert data['error']['code'] == 'AUTHENTICATION_ERROR'
                assert data['error']['requestId'] == 'test-request-id'


class TestRoleRequiredDecorator:
    """Test the @role_required decorator."""
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_correct_role_can_access(self, mock_current_user):
        """Test that users with correct role can access."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'supervisor'
        
        @role_required('supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_incorrect_role_denied(self, mock_current_user):
        """Test that users with incorrect role are denied."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'operator'
        mock_current_user.name = 'Test User'
        
        @role_required('supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                mock_request.headers.get.return_value = 'test-request-id'
                
                result = test_route()
                
                assert result[1] == 403  # Status code
                data = result[0].get_json()
                assert data['error']['code'] == 'INSUFFICIENT_PERMISSIONS'
                assert data['error']['message'] == 'No tienes permisos para realizar esta acción'
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_multiple_allowed_roles(self, mock_current_user):
        """Test decorator with multiple allowed roles."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'operator'
        
        @role_required('operator', 'supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_unauthenticated_user_denied_in_role_check(self, mock_current_user):
        """Test that unauthenticated users are denied in role check."""
        mock_current_user.is_authenticated = False
        
        @role_required('operator')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                mock_request.headers.get.return_value = 'test-request-id'
                
                result = test_route()
                
                assert result[1] == 401  # Status code
                data = result[0].get_json()
                assert data['error']['code'] == 'AUTHENTICATION_ERROR'


class TestConvenienceDecorators:
    """Test convenience decorators."""
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_supervisor_required_decorator(self, mock_current_user):
        """Test @supervisor_required decorator."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'supervisor'
        
        @supervisor_required
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_supervisor_only_decorator(self, mock_current_user):
        """Test @supervisor_only decorator."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'supervisor'
        
        @supervisor_only
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_operator_or_supervisor_required_decorator(self, mock_current_user):
        """Test @operator_or_supervisor_required decorator."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'operator'
        
        @operator_or_supervisor_required
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200


class TestHelperFunctions:
    """Test helper functions in auth middleware."""
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_get_current_user_info_authenticated(self, mock_current_user):
        """Test getting current user info when authenticated."""
        mock_current_user.is_authenticated = True
        mock_current_user.id = 'test-user-id'
        mock_current_user.name = 'Test User'
        mock_current_user.role = 'operator'
        
        result = get_current_user_info()
        
        expected = {
            'user_id': 'test-user-id',
            'name': 'Test User',
            'role': 'operator'
        }
        assert result == expected
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_get_current_user_info_anonymous(self, mock_current_user):
        """Test getting current user info when not authenticated."""
        mock_current_user.is_authenticated = False
        
        result = get_current_user_info()
        
        expected = {
            'user_id': None,
            'name': 'anonymous',
            'role': None
        }
        assert result == expected
    
    @patch('app.middleware.auth_middleware.get_current_user_info')
    @patch('app.middleware.auth_middleware.current_app')
    @patch('app.middleware.auth_middleware.request')
    def test_log_authentication_event(self, mock_request, mock_app, mock_get_user_info):
        """Test logging authentication events."""
        mock_get_user_info.return_value = {
            'user_id': 'test-user-id',
            'name': 'Test User',
            'role': 'operator'
        }
        mock_request.endpoint = 'test_endpoint'
        mock_request.method = 'POST'
        mock_request.remote_addr = '127.0.0.1'
        mock_request.headers.get.return_value = 'test-user-agent'
        
        log_authentication_event('login_success', {'additional': 'info'})
        
        # Verify logger was called
        mock_app.logger.info.assert_called_once()
        call_args = mock_app.logger.info.call_args
        
        # Check the log message
        assert 'Auth event: login_success' in call_args[0][0]
        
        # Check extra data
        extra_data = call_args[1]['extra']
        assert extra_data['event'] == 'login_success'
        assert extra_data['user']['user_id'] == 'test-user-id'
        assert extra_data['endpoint'] == 'test_endpoint'
        assert extra_data['method'] == 'POST'
        assert extra_data['ip'] == '127.0.0.1'
        assert extra_data['additional'] == 'info'


class TestDecoratorChaining:
    """Test that decorators can be properly chained."""
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_multiple_decorators_success(self, mock_current_user):
        """Test chaining multiple auth decorators."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'supervisor'
        
        @login_required_api
        @role_required('supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                result = test_route()
                
                assert result.status_code == 200
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_multiple_decorators_auth_failure(self, mock_current_user):
        """Test chaining decorators with authentication failure."""
        mock_current_user.is_authenticated = False
        
        @login_required_api
        @role_required('supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                mock_request.headers.get.return_value = 'test-request-id'
                
                result = test_route()
                
                assert result[1] == 401  # Should fail at login_required level
    
    @patch('app.middleware.auth_middleware.current_user')
    def test_multiple_decorators_role_failure(self, mock_current_user):
        """Test chaining decorators with role failure."""
        mock_current_user.is_authenticated = True
        mock_current_user.role = 'operator'
        mock_current_user.name = 'Test User'
        
        @login_required_api
        @role_required('supervisor')
        def test_route():
            return jsonify({'message': 'success'})
        
        with patch('app.middleware.auth_middleware.current_app') as mock_app:
            with patch('app.middleware.auth_middleware.request') as mock_request:
                mock_request.endpoint = 'test_route'
                mock_request.headers.get.return_value = 'test-request-id'
                
                result = test_route()
                
                assert result[1] == 403  # Should fail at role level