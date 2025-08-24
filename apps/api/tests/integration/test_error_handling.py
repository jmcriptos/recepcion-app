"""Integration tests for global error handling middleware."""
import pytest
from unittest.mock import patch
from app import create_app
from app.middleware.error_handler import ValidationError


class TestErrorHandling:
    """Test cases for global error handling middleware."""
    
    def test_request_id_generation(self, app, client):
        """Test that each request gets a unique request ID."""
        response1 = client.get('/health')
        response2 = client.get('/health')
        
        request_id1 = response1.headers.get('X-Request-ID')
        request_id2 = response2.headers.get('X-Request-ID')
        
        assert request_id1 is not None
        assert request_id2 is not None
        assert request_id1 != request_id2
        
    def test_404_error_handling(self, app, client):
        """Test 404 error handling returns structured error response."""
        response = client.get('/nonexistent-endpoint')
        
        assert response.status_code == 404
        data = response.get_json()
        
        assert 'error' in data
        error = data['error']
        assert error['code'] == 'HTTP_404'
        assert 'message' in error
        assert 'timestamp' in error
        assert 'requestId' in error
        
    def test_405_error_handling(self, app, client):
        """Test 405 method not allowed error handling."""
        response = client.post('/health')  # Health endpoint only accepts GET
        
        assert response.status_code == 405
        data = response.get_json()
        
        assert 'error' in data
        error = data['error']
        assert error['code'] == 'HTTP_405'
        assert 'requestId' in error
        
    def test_validation_error_handling(self, app, client):
        """Test custom ValidationError handling."""
        # Create a test route that raises ValidationError
        @app.route('/test-validation-error')
        def test_validation_error():
            raise ValidationError("Test validation failed", {"field": "test_field"})
        
        response = client.get('/test-validation-error')
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert 'error' in data
        error = data['error']
        assert error['code'] == 'VALIDATION_ERROR'
        assert error['message'] == 'Test validation failed'
        assert error['details'] == {"field": "test_field"}
        assert 'requestId' in error
        assert 'timestamp' in error
        
    def test_database_error_handling(self, app, client):
        """Test database error handling."""
        # Create a test route that raises SQLAlchemy error
        from sqlalchemy.exc import SQLAlchemyError
        
        @app.route('/test-database-error')
        def test_database_error():
            raise SQLAlchemyError("Database connection failed")
        
        response = client.get('/test-database-error')
        
        assert response.status_code == 503
        data = response.get_json()
        
        assert 'error' in data
        error = data['error']
        assert error['code'] == 'DATABASE_ERROR'
        assert error['message'] == 'Database operation failed'
        assert 'requestId' in error
        
    def test_generic_error_handling(self, app, client):
        """Test generic exception handling."""
        # Create a test route that raises generic exception
        @app.route('/test-generic-error')
        def test_generic_error():
            raise Exception("Unexpected error occurred")
        
        response = client.get('/test-generic-error')
        
        assert response.status_code == 500
        data = response.get_json()
        
        assert 'error' in data
        error = data['error']
        assert error['code'] == 'INTERNAL_ERROR'
        assert error['message'] == 'Internal server error'
        assert 'requestId' in error
        
    def test_error_response_format_consistency(self, app, client):
        """Test that all error responses follow the same format."""
        # Test 404 error
        response = client.get('/nonexistent')
        data = response.get_json()
        
        # Verify error structure
        assert 'error' in data
        error = data['error']
        
        required_fields = ['code', 'message', 'timestamp', 'requestId']
        for field in required_fields:
            assert field in error
            
        # Verify field types
        assert isinstance(error['code'], str)
        assert isinstance(error['message'], str)
        assert isinstance(error['timestamp'], str)
        assert isinstance(error['requestId'], str)
        
        # Verify timestamp format
        timestamp = error['timestamp']
        assert timestamp.endswith('Z')
        
        from datetime import datetime
        parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        assert parsed_time is not None
        
    def test_error_logging_integration(self, app, client):
        """Test that errors are properly logged with context."""
        with patch('app.middleware.error_handler.current_app.logger') as mock_logger:
            response = client.get('/nonexistent-endpoint')
            
            # Verify logging was called
            assert mock_logger.info.called
            
            # Check that request context was logged
            log_call_args = mock_logger.info.call_args
            assert 'request_id' in str(log_call_args)
            
    def test_cors_headers_preserved_on_error(self, app, client):
        """Test that CORS and custom headers are preserved on error responses."""
        response = client.get('/nonexistent-endpoint')
        
        # Should still have request ID header
        assert 'X-Request-ID' in response.headers