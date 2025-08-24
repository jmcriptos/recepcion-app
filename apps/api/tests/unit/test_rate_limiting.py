"""Unit tests for rate limiting functionality."""
import pytest
import time
from unittest.mock import patch, MagicMock
from flask import Flask
from app.utils.rate_limiting import InMemoryRateLimiter, rate_limit, get_client_key
from app.routes.registrations import registrations_bp


class TestInMemoryRateLimiter:
    """Test the in-memory rate limiter implementation."""
    
    def test_allows_requests_under_limit(self):
        """Test that requests under the limit are allowed."""
        limiter = InMemoryRateLimiter()
        
        # Should allow first 5 requests
        for i in range(5):
            assert limiter.is_allowed('user:123', limit=5, window_seconds=60)
    
    def test_blocks_requests_over_limit(self):
        """Test that requests over the limit are blocked."""
        limiter = InMemoryRateLimiter()
        
        # Fill up the limit
        for i in range(5):
            limiter.is_allowed('user:123', limit=5, window_seconds=60)
        
        # Next request should be blocked
        assert not limiter.is_allowed('user:123', limit=5, window_seconds=60)
    
    def test_different_keys_independent(self):
        """Test that different keys have independent rate limits."""
        limiter = InMemoryRateLimiter()
        
        # Fill up limit for user1
        for i in range(5):
            limiter.is_allowed('user:1', limit=5, window_seconds=60)
        
        # user2 should still be allowed
        assert limiter.is_allowed('user:2', limit=5, window_seconds=60)
        
        # user1 should be blocked
        assert not limiter.is_allowed('user:1', limit=5, window_seconds=60)
    
    def test_window_expiration(self):
        """Test that rate limit resets after time window."""
        limiter = InMemoryRateLimiter()
        
        # Mock time to control window expiration
        with patch('app.utils.rate_limiting.time.time') as mock_time:
            # Start at time 0
            mock_time.return_value = 0
            
            # Fill up the limit
            for i in range(3):
                limiter.is_allowed('user:123', limit=3, window_seconds=10)
            
            # Should be blocked
            assert not limiter.is_allowed('user:123', limit=3, window_seconds=10)
            
            # Move time forward past window
            mock_time.return_value = 11
            
            # Should be allowed again
            assert limiter.is_allowed('user:123', limit=3, window_seconds=10)
    
    def test_time_until_reset(self):
        """Test calculation of time until rate limit resets."""
        limiter = InMemoryRateLimiter()
        
        with patch('app.utils.rate_limiting.time.time') as mock_time:
            mock_time.return_value = 100
            
            # Make a request
            limiter.is_allowed('user:123', limit=1, window_seconds=60)
            
            # Check time until reset
            mock_time.return_value = 130  # 30 seconds later
            reset_time = limiter.time_until_reset('user:123', window_seconds=60)
            
            # Should have 30 seconds left (160 - 130)
            assert reset_time == 30
    
    def test_empty_key_reset_time(self):
        """Test reset time for key with no requests."""
        limiter = InMemoryRateLimiter()
        
        reset_time = limiter.time_until_reset('unknown:key', window_seconds=60)
        assert reset_time == 0


class TestRateLimitDecorator:
    """Test the rate limit decorator."""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        app = Flask(__name__)
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @patch('app.utils.rate_limiting.current_user')
    @patch('app.utils.rate_limiting.request')
    def test_rate_limit_allows_under_limit(self, mock_request, mock_user, app):
        """Test that requests under rate limit are allowed."""
        # Setup mocks
        mock_user.is_authenticated = True
        mock_user.id = 'user-123'
        mock_request.remote_addr = '192.168.1.1'
        mock_request.endpoint = 'test_endpoint'
        mock_request.headers.get.return_value = 'test-id'
        
        @app.route('/test')
        @rate_limit(limit=5, window=60, per='user')
        def test_endpoint():
            return 'success', 200
        
        with app.test_client() as client:
            # First few requests should succeed
            for i in range(3):
                with app.test_request_context('/test'):
                    response = client.get('/test')
                    assert response.status_code == 200
    
    @patch('app.utils.rate_limiting.current_user')
    @patch('app.utils.rate_limiting.request')
    @patch('app.utils.rate_limiting.rate_limiter')
    def test_rate_limit_blocks_over_limit(self, mock_limiter, mock_request, mock_user, app):
        """Test that requests over rate limit are blocked."""
        # Setup mocks
        mock_user.is_authenticated = True
        mock_user.id = 'user-123'
        mock_request.remote_addr = '192.168.1.1'
        mock_request.endpoint = 'test_endpoint'
        mock_request.headers.get.return_value = 'test-id'
        
        # Mock rate limiter to return False (over limit)
        mock_limiter.is_allowed.return_value = False
        mock_limiter.time_until_reset.return_value = 30
        
        @app.route('/test')
        @rate_limit(limit=5, window=60, per='user')
        def test_endpoint():
            return 'success', 200
        
        with app.test_client() as client:
            with app.test_request_context('/test'):
                response = client.get('/test')
                assert response.status_code == 429
                
                data = response.get_json()
                assert data['error']['code'] == 'RATE_LIMIT_EXCEEDED'
                assert 'retry_after' in data['error']
    
    @patch('app.utils.rate_limiting.current_user')
    @patch('app.utils.rate_limiting.request')
    def test_rate_limit_per_ip_unauthenticated(self, mock_request, mock_user, app):
        """Test rate limiting by IP for unauthenticated users."""
        # Setup mocks
        mock_user.is_authenticated = False
        mock_request.remote_addr = '192.168.1.100'
        mock_request.endpoint = 'test_endpoint'
        mock_request.headers.get.return_value = 'test-id'
        
        @app.route('/test')
        @rate_limit(limit=2, window=60, per='ip')
        def test_endpoint():
            return 'success', 200
        
        with app.test_client() as client:
            # Should use IP-based limiting
            with app.test_request_context('/test'):
                response = client.get('/test')
                assert response.status_code == 200


class TestGetClientKey:
    """Test the get_client_key utility function."""
    
    @patch('app.utils.rate_limiting.current_user')
    @patch('app.utils.rate_limiting.request')
    def test_authenticated_user_key(self, mock_request, mock_user):
        """Test key generation for authenticated users."""
        mock_user.is_authenticated = True
        mock_user.id = 'user-456'
        mock_request.remote_addr = '10.0.0.1'
        
        key = get_client_key()
        assert key == 'user:user-456'
    
    @patch('app.utils.rate_limiting.current_user')
    @patch('app.utils.rate_limiting.request')
    def test_unauthenticated_user_key(self, mock_request, mock_user):
        """Test key generation for unauthenticated users."""
        mock_user.is_authenticated = False
        mock_request.remote_addr = '10.0.0.1'
        
        key = get_client_key()
        assert key == 'ip:10.0.0.1'


class TestRateLimitIntegration:
    """Integration tests for rate limiting with actual endpoints."""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        app = Flask(__name__)
        app.register_blueprint(registrations_bp)
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    @patch('app.utils.rate_limiting.rate_limiter')
    def test_stats_endpoint_rate_limiting(self, mock_limiter, mock_db, 
                                        mock_registration, mock_user, client):
        """Test that stats endpoint has rate limiting applied."""
        # Setup mocks
        mock_user.role = 'supervisor'
        mock_user.is_authenticated = True
        mock_user.id = 'supervisor-123'
        
        # Mock rate limiter to block request
        mock_limiter.is_allowed.return_value = False
        mock_limiter.time_until_reset.return_value = 45
        
        # Make request to stats endpoint
        response = client.get('/api/v1/registrations/stats')
        
        # Should be rate limited
        assert response.status_code == 429
        
        data = response.get_json()
        assert data['error']['code'] == 'RATE_LIMIT_EXCEEDED'
        assert data['error']['retry_after'] == 46  # 45 + 1
        
        # Verify rate limiter was called with correct parameters
        mock_limiter.is_allowed.assert_called_once_with('user:supervisor-123', 30, 60)
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    @patch('app.utils.rate_limiting.rate_limiter')
    def test_search_endpoint_rate_limiting(self, mock_limiter, mock_db, 
                                         mock_registration, mock_user, client):
        """Test that search endpoint has rate limiting applied."""
        # Setup mocks
        mock_user.role = 'operator'
        mock_user.is_authenticated = True
        mock_user.id = 'operator-456'
        
        # Mock rate limiter to block request
        mock_limiter.is_allowed.return_value = False
        mock_limiter.time_until_reset.return_value = 30
        
        # Make request to search endpoint
        response = client.get('/api/v1/registrations/search?q=test')
        
        # Should be rate limited
        assert response.status_code == 429
        
        # Verify rate limiter was called with correct parameters for search
        mock_limiter.is_allowed.assert_called_once_with('user:operator-456', 60, 60)


if __name__ == '__main__':
    pytest.main([__file__])