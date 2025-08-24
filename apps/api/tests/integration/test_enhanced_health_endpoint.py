"""Integration tests for enhanced health check endpoint."""
import pytest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db


class TestEnhancedHealthEndpoint:
    """Test cases for the enhanced health check endpoint."""
    
    def test_enhanced_health_endpoint_success(self, app, client):
        """Test enhanced health endpoint returns comprehensive system information."""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify basic fields
        assert data['status'] == 'healthy'
        assert data['database_connected'] is True
        assert 'timestamp' in data
        
        # Verify new enhanced fields
        assert 'environment' in data
        assert 'version' in data
        assert 'uptime_seconds' in data
        assert 'memory_usage_percent' in data
        assert 'cpu_usage_percent' in data
        
    def test_enhanced_health_endpoint_headers(self, app, client):
        """Test enhanced health endpoint includes API version headers."""
        response = client.get('/health')
        
        assert response.headers['X-API-Version'] == 'v1'
        assert response.headers['X-API-Deprecated'] == 'false'
        assert 'X-Request-ID' in response.headers
        
    def test_enhanced_health_endpoint_database_failure(self, app, client):
        """Test enhanced health endpoint with database connection failure."""
        with patch('app.routes.health.db.session.execute') as mock_execute:
            mock_execute.side_effect = Exception("Database connection failed")
            
            response = client.get('/health')
            
            assert response.status_code == 503  # Service Unavailable
            data = response.get_json()
            
            assert data['status'] == 'unhealthy'
            assert data['database_connected'] is False
            # System info should still be available
            assert 'uptime_seconds' in data
            assert 'memory_usage_percent' in data
            
    def test_enhanced_health_endpoint_system_info_failure(self, app, client):
        """Test health endpoint when system info collection fails."""
        with patch('app.routes.health.psutil.virtual_memory') as mock_memory:
            mock_memory.side_effect = Exception("System info unavailable")
            
            response = client.get('/health')
            
            # Should still return 200 if database is healthy
            assert response.status_code == 200
            data = response.get_json()
            
            assert data['status'] == 'healthy'
            assert data['database_connected'] is True
            # System info fields should be None when unavailable
            assert data['memory_usage_percent'] is None
            assert data['uptime_seconds'] is None
            
    def test_enhanced_health_endpoint_response_format(self, app, client):
        """Test enhanced health endpoint response format."""
        response = client.get('/health')
        data = response.get_json()
        
        # Verify all enhanced fields are present
        enhanced_fields = [
            'status', 'timestamp', 'database_connected', 'environment',
            'version', 'uptime_seconds', 'memory_usage_percent', 'cpu_usage_percent'
        ]
        for field in enhanced_fields:
            assert field in data
            
        # Verify field types
        assert isinstance(data['status'], str)
        assert isinstance(data['timestamp'], str)
        assert isinstance(data['database_connected'], bool)
        assert isinstance(data['environment'], str)
        assert isinstance(data['version'], str)
        
        # System metrics can be None if collection fails
        if data['uptime_seconds'] is not None:
            assert isinstance(data['uptime_seconds'], int)
        if data['memory_usage_percent'] is not None:
            assert isinstance(data['memory_usage_percent'], (int, float))
        if data['cpu_usage_percent'] is not None:
            assert isinstance(data['cpu_usage_percent'], (int, float))
            
    def test_enhanced_health_endpoint_version_fallback(self, app, client):
        """Test health endpoint version fallback when Heroku commit unavailable."""
        with patch('app.routes.health.os.environ.get') as mock_environ:
            mock_environ.return_value = None  # No HEROKU_SLUG_COMMIT
            
            response = client.get('/health')
            data = response.get_json()
            
            # Should fallback to default version
            assert data['version'] == '1.0.0'
            
    def test_enhanced_health_endpoint_environment_detection(self, app, client):
        """Test health endpoint environment detection."""
        response = client.get('/health')
        data = response.get_json()
        
        # Environment should be detected from Flask config
        assert data['environment'] in ['development', 'testing', 'production', 'unknown']
        
    def test_enhanced_health_endpoint_memory_cpu_ranges(self, app, client):
        """Test health endpoint memory and CPU values are within expected ranges."""
        response = client.get('/health')
        data = response.get_json()
        
        # Memory usage percentage should be reasonable
        if data['memory_usage_percent'] is not None:
            assert 0 <= data['memory_usage_percent'] <= 100
            
        # CPU usage percentage should be reasonable
        if data['cpu_usage_percent'] is not None:
            assert 0 <= data['cpu_usage_percent'] <= 100