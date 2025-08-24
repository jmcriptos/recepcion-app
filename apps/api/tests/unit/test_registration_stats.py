"""Unit tests for registration statistics endpoint."""
import pytest
from datetime import datetime, date
from unittest.mock import patch, MagicMock
from flask import Flask
from app.routes.registrations import registrations_bp


class TestRegistrationStatsEndpoint:
    """Test the GET /api/v1/registrations/stats endpoint."""
    
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
    @patch('app.routes.registrations.func')
    def test_get_stats_supervisor_success(self, mock_func, mock_db, mock_registration, mock_user, client):
        """Test successful stats retrieval for supervisor."""
        # Setup mocks
        mock_user.role = 'supervisor'
        mock_user.id = 'supervisor-123'
        
        # Mock query results
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 150
        
        mock_registration.query = mock_query
        
        # Mock aggregation results
        mock_db.session.query.return_value.filter.return_value.scalar.return_value = 2250.5
        
        # Mock supplier stats
        mock_db.session.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = [
            ('Proveedor A', 50, 750.0),
            ('Proveedor B', 30, 450.0)
        ]
        
        # Make request
        response = client.get('/api/v1/registrations/stats')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert 'stats' in data
        assert 'metadata' in data
        assert data['stats']['total_registrations'] == 150
        assert data['stats']['total_weight'] == 2250.5
        assert data['metadata']['user_role'] == 'supervisor'
        assert not data['metadata']['filtered_by_user']
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    def test_get_stats_operator_filtered(self, mock_db, mock_registration, mock_user, client):
        """Test that operators see filtered stats (their own data only)."""
        # Setup mocks
        mock_user.role = 'operator'
        mock_user.id = 'operator-456'
        
        # Mock query with user filtering
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 25
        
        mock_registration.query = mock_query
        
        # Mock aggregation results
        mock_db.session.query.return_value.filter.return_value.scalar.return_value = 375.0
        
        # Mock supplier stats (filtered)
        mock_db.session.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = [
            ('Proveedor A', 25, 375.0)
        ]
        
        # Make request
        response = client.get('/api/v1/registrations/stats')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['stats']['total_registrations'] == 25
        assert data['stats']['total_weight'] == 375.0
        assert data['metadata']['user_role'] == 'operator'
        assert data['metadata']['filtered_by_user']
        
        # Verify filtering was applied
        mock_query.filter.assert_called()
    
    def test_get_stats_invalid_date_format(self, client):
        """Test error handling for invalid date format."""
        response = client.get('/api/v1/registrations/stats?date_from=invalid-date')
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert 'error' in data
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert 'formato' in data['error']['message'].lower()
    
    def test_get_stats_invalid_grouping(self, client):
        """Test error handling for invalid grouping parameter."""
        response = client.get('/api/v1/registrations/stats?grouping=invalid')
        
        assert response.status_code == 400
        data = response.get_json()
        
        assert 'error' in data
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert 'agrupación' in data['error']['message'].lower()
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    def test_get_stats_with_date_range(self, mock_db, mock_registration, mock_user, client):
        """Test stats with custom date range."""
        # Setup mocks
        mock_user.role = 'supervisor'
        
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 75
        
        mock_registration.query = mock_query
        mock_db.session.query.return_value.filter.return_value.scalar.return_value = 1125.0
        mock_db.session.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        
        # Make request with date range
        response = client.get('/api/v1/registrations/stats?date_from=2025-08-01&date_to=2025-08-20')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['stats']['date_range']['from'] == '2025-08-01'
        assert data['stats']['date_range']['to'] == '2025-08-20'
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    def test_get_stats_cut_type_breakdown(self, mock_db, mock_registration, mock_user, client):
        """Test that stats include cut type breakdown."""
        # Setup mocks
        mock_user.role = 'supervisor'
        
        # Mock base query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.side_effect = [100, 60, 40]  # total, jamón, chuleta
        
        mock_registration.query = mock_query
        
        # Mock weight aggregations
        mock_db.session.query.return_value.filter.return_value.scalar.side_effect = [
            1500.0,  # total weight
            900.0,   # jamón weight
            600.0    # chuleta weight
        ]
        
        # Mock supplier stats
        mock_db.session.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
        
        # Make request
        response = client.get('/api/v1/registrations/stats')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert 'by_cut_type' in data['stats']
        assert 'jamón' in data['stats']['by_cut_type']
        assert 'chuleta' in data['stats']['by_cut_type']
        
        jamon_stats = data['stats']['by_cut_type']['jamón']
        assert jamon_stats['count'] == 60
        assert jamon_stats['total_weight'] == 900.0
        assert jamon_stats['average_weight'] == 15.0  # 900/60
        
        chuleta_stats = data['stats']['by_cut_type']['chuleta']
        assert chuleta_stats['count'] == 40
        assert chuleta_stats['total_weight'] == 600.0
        assert chuleta_stats['average_weight'] == 15.0  # 600/40


if __name__ == '__main__':
    pytest.main([__file__])