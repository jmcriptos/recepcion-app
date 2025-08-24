"""Integration tests for health check endpoint."""
import pytest
from datetime import datetime
from unittest.mock import patch
from app import create_app
from app.models import db


class TestHealthEndpoint:
    """Test cases for the health check endpoint."""
    
    def test_health_endpoint_success(self, app, client):
        """Test health endpoint returns 200 when database is connected."""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['status'] == 'healthy'
        assert data['database_connected'] is True
        assert 'timestamp' in data
        
        # Verify timestamp is in ISO format
        timestamp = data['timestamp']
        assert timestamp.endswith('Z')
        # Should be able to parse as ISO datetime
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    
    def test_health_endpoint_database_failure(self, app, client):
        """Test health endpoint returns 503 when database is disconnected."""
        with patch('app.routes.health.db.session.execute') as mock_execute:
            mock_execute.side_effect = Exception("Database connection failed")
            
            response = client.get('/health')
            
            assert response.status_code == 503
            data = response.get_json()
            
            assert data['status'] == 'unhealthy'
            assert data['database_connected'] is False
            assert 'timestamp' in data
    
    def test_health_endpoint_response_format(self, app, client):
        """Test health endpoint response has correct format."""
        response = client.get('/health')
        data = response.get_json()
        
        # Verify all required fields are present
        required_fields = ['status', 'timestamp', 'database_connected']
        for field in required_fields:
            assert field in data
        
        # Verify field types
        assert isinstance(data['status'], str)
        assert isinstance(data['timestamp'], str)
        assert isinstance(data['database_connected'], bool)