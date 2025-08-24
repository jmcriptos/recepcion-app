"""Integration tests for API v1 endpoints."""
import pytest
from unittest.mock import patch
from app import create_app
from app.models import db


class TestAPIv1Endpoints:
    """Test cases for API v1 endpoints."""
    
    def test_ping_endpoint_success(self, app, client):
        """Test API v1 ping endpoint returns successful response."""
        response = client.get('/api/v1/ping')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['message'] == 'pong'
        assert data['database_connected'] is True
        assert 'timestamp' in data
        assert 'response_time_ms' in data
        assert 'database_response_time_ms' in data
        
        # Verify response time is reasonable
        assert data['response_time_ms'] < 1000  # Should be under 1 second
        assert data['database_response_time_ms'] < 500  # DB query under 500ms
        
    def test_ping_endpoint_headers(self, app, client):
        """Test API v1 ping endpoint includes correct headers."""
        response = client.get('/api/v1/ping')
        
        assert response.headers['X-API-Version'] == 'v1'
        assert response.headers['X-API-Deprecated'] == 'false'
        assert 'X-Request-ID' in response.headers
        
    def test_ping_endpoint_database_failure(self, app, client):
        """Test API v1 ping endpoint with database connection failure."""
        with patch('app.routes.api_v1.db.session.execute') as mock_execute:
            mock_execute.side_effect = Exception("Database connection failed")
            
            response = client.get('/api/v1/ping')
            
            assert response.status_code == 200  # Ping always returns 200
            data = response.get_json()
            
            assert data['message'] == 'pong'
            assert data['database_connected'] is False
            assert data['database_response_time_ms'] is None
            
    def test_ping_endpoint_response_format(self, app, client):
        """Test API v1 ping endpoint response format."""
        response = client.get('/api/v1/ping')
        data = response.get_json()
        
        # Verify all required fields are present
        required_fields = [
            'message', 'timestamp', 'database_connected', 
            'response_time_ms', 'database_response_time_ms'
        ]
        for field in required_fields:
            assert field in data
            
        # Verify field types
        assert isinstance(data['message'], str)
        assert isinstance(data['timestamp'], str)
        assert isinstance(data['database_connected'], bool)
        assert isinstance(data['response_time_ms'], (int, float))
        
        # database_response_time_ms can be None if DB is down
        if data['database_response_time_ms'] is not None:
            assert isinstance(data['database_response_time_ms'], (int, float))
            
    def test_ping_endpoint_timestamp_format(self, app, client):
        """Test API v1 ping endpoint timestamp format."""
        response = client.get('/api/v1/ping')
        data = response.get_json()
        
        timestamp = data['timestamp']
        assert timestamp.endswith('Z')  # UTC timezone indicator
        
        # Should be parseable as ISO datetime
        from datetime import datetime
        parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        assert parsed_time is not None
        
    def test_api_v1_nonexistent_endpoint(self, app, client):
        """Test API v1 returns proper 404 for nonexistent endpoints."""
        response = client.get('/api/v1/nonexistent')
        
        assert response.status_code == 404
        data = response.get_json()
        
        assert 'error' in data
        assert data['error']['code'] == 'HTTP_404'
        assert 'requestId' in data['error']
        assert 'timestamp' in data['error']