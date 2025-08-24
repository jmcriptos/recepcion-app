"""Integration tests for audit logging functionality."""
import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from flask import Flask
from app.routes.registrations import registrations_bp
from app.models.registration import WeightRegistration
from app.models.audit_log import RegistrationAuditLog
from app.utils.audit import log_registration_action


class TestAuditLoggingIntegration:
    """Integration tests for audit logging across the registration workflow."""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app with database setup."""
        app = Flask(__name__)
        app.register_blueprint(registrations_bp)
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.db')
    @patch('app.routes.registrations.log_registration_action')
    def test_create_registration_audit_logging(self, mock_log_action, mock_db, mock_user, client):
        """Test that creating a registration logs the action."""
        # Setup mocks
        mock_user.id = 'user-123'
        mock_user.name = 'Test User'
        mock_user.role = 'operator'
        
        # Mock successful registration creation
        mock_registration = MagicMock()
        mock_registration.id = 'reg-123'
        mock_registration.to_dict.return_value = {
            'id': 'reg-123',
            'weight': 15.5,
            'cut_type': 'jamón',
            'supplier': 'Test Supplier'
        }
        
        mock_db.session.add.return_value = None
        mock_db.session.commit.return_value = None
        
        # Mock model creation
        with patch('app.routes.registrations.WeightRegistration') as mock_model:
            mock_model.return_value = mock_registration
            
            # Make request
            response = client.post('/api/v1/registrations', 
                                 json={
                                     'weight': 15.5,
                                     'cut_type': 'jamón',
                                     'supplier': 'Test Supplier'
                                 },
                                 headers={'Content-Type': 'application/json'})
            
            # Verify response
            assert response.status_code == 201
            
            # Verify audit logging was called
            mock_log_action.assert_called_once_with('reg-123', 'CREATE', None)
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    @patch('app.routes.registrations.log_registration_action')
    @patch('app.routes.registrations.calculate_changes')
    def test_update_registration_audit_logging(self, mock_calc_changes, mock_log_action, 
                                             mock_db, mock_registration, mock_user, client):
        """Test that updating a registration logs the changes."""
        # Setup mocks
        mock_user.id = 'user-123'
        mock_user.role = 'supervisor'
        
        # Mock existing registration
        existing_reg = MagicMock()
        existing_reg.id = 'reg-123'
        existing_reg.registered_by = 'user-123'
        existing_reg.weight = 15.5
        existing_reg.supplier = 'Old Supplier'
        existing_reg.to_dict.return_value = {'id': 'reg-123', 'weight': 16.0}
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = existing_reg
        mock_registration.query = mock_query
        
        # Mock change calculation
        changes = {'weight': {'old': 15.5, 'new': 16.0}}
        mock_calc_changes.return_value = changes
        
        # Make request
        response = client.put('/api/v1/registrations/reg-123',
                            json={
                                'weight': 16.0,
                                'update_reason': 'weight_correction'
                            },
                            headers={'Content-Type': 'application/json'})
        
        # Verify response
        assert response.status_code == 200
        
        # Verify audit logging was called with changes
        mock_log_action.assert_called_once_with('reg-123', 'UPDATE', changes)
        
        # Verify change calculation was called
        mock_calc_changes.assert_called_once()
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    @patch('app.routes.registrations.log_registration_action')
    def test_delete_registration_audit_logging(self, mock_log_action, mock_db, 
                                             mock_registration, mock_user, client):
        """Test that deleting a registration logs the action."""
        # Setup mocks
        mock_user.id = 'supervisor-456'
        mock_user.role = 'supervisor'
        
        # Mock existing registration
        existing_reg = MagicMock()
        existing_reg.id = 'reg-123'
        existing_reg.soft_delete = MagicMock()
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = existing_reg
        mock_registration.query = mock_query
        
        # Make request
        response = client.delete('/api/v1/registrations/reg-123')
        
        # Verify response
        assert response.status_code == 204
        
        # Verify soft delete was called
        existing_reg.soft_delete.assert_called_once_with('supervisor-456')
        
        # Verify audit logging was called
        mock_log_action.assert_called_once_with('reg-123', 'DELETE', 
                                              {'deleted_by': 'supervisor-456'})
    
    @patch('app.routes.registrations.current_user')
    @patch('app.routes.registrations.WeightRegistration')
    @patch('app.routes.registrations.db')
    @patch('app.routes.registrations.log_registration_action')
    def test_photo_update_audit_logging(self, mock_log_action, mock_db, 
                                       mock_registration, mock_user, client):
        """Test that updating a photo logs the changes."""
        # Setup mocks
        mock_user.id = 'user-123'
        mock_user.role = 'operator'
        
        # Mock existing registration
        existing_reg = MagicMock()
        existing_reg.id = 'reg-123'
        existing_reg.registered_by = 'user-123'
        existing_reg.photo_url = 'old-photo.jpg'
        existing_reg.ocr_confidence = 0.8
        existing_reg.to_dict.return_value = {'id': 'reg-123', 'photo_url': 'new-photo.jpg'}
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = existing_reg
        mock_registration.query = mock_query
        
        # Make request
        response = client.patch('/api/v1/registrations/reg-123/photo',
                              json={
                                  'photo_url': 'https://example.com/new-photo.jpg',
                                  'ocr_confidence': 0.95,
                                  'update_reason': 'better_photo'
                              },
                              headers={'Content-Type': 'application/json'})
        
        # Verify response
        assert response.status_code == 200
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()
        call_args = mock_log_action.call_args
        assert call_args[0][0] == 'reg-123'  # registration_id
        assert call_args[0][1] == 'UPDATE'   # action
        
        # Verify changes include photo_url
        changes = call_args[0][2]
        assert 'photo_url' in changes
        assert changes['photo_url']['old'] == 'old-photo.jpg'
        assert changes['photo_url']['new'] == 'https://example.com/new-photo.jpg'
    
    def test_audit_log_model_creation(self):
        """Test that audit log entries are created correctly."""
        # Create audit log entry
        audit_log = RegistrationAuditLog(
            registration_id='reg-123',
            action='UPDATE',
            user_id='user-456',
            changes={'weight': {'old': 10.0, 'new': 12.0}},
            ip_address='192.168.1.100',
            user_agent='TestAgent/1.0'
        )
        
        # Verify fields
        assert audit_log.registration_id == 'reg-123'
        assert audit_log.action == 'UPDATE'
        assert audit_log.user_id == 'user-456'
        assert audit_log.changes == {'weight': {'old': 10.0, 'new': 12.0}}
        assert audit_log.ip_address == '192.168.1.100'
        assert audit_log.user_agent == 'TestAgent/1.0'
        
        # Test to_dict conversion
        result = audit_log.to_dict()
        assert result['registration_id'] == 'reg-123'
        assert result['action'] == 'UPDATE'
        assert result['changes'] == {'weight': {'old': 10.0, 'new': 12.0}}
    
    @patch('app.utils.audit.current_app')
    @patch('app.utils.audit.current_user')
    @patch('app.utils.audit.request')
    @patch('app.utils.audit.db')
    def test_log_registration_action_integration(self, mock_db, mock_request, 
                                               mock_user, mock_app):
        """Test the complete audit logging workflow."""
        # Setup mocks
        mock_user.id = 'user-789'
        mock_request.remote_addr = '10.0.0.1'
        mock_request.headers.get.return_value = 'Mobile/1.0'
        
        changes = {
            'weight': {'old': 15.0, 'new': 16.5},
            'supplier': {'old': 'Old Supplier', 'new': 'New Supplier'}
        }
        
        # Call the function
        log_registration_action('reg-456', 'UPDATE', changes)
        
        # Verify database operations
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()
        
        # Verify logging
        mock_app.logger.info.assert_called_once()
        
        # Get the audit log object that was added
        add_call_args = mock_db.session.add.call_args[0]
        audit_log = add_call_args[0]
        
        # Verify the audit log properties
        assert audit_log.registration_id == 'reg-456'
        assert audit_log.action == 'UPDATE'
        assert audit_log.user_id == 'user-789'
        assert audit_log.changes == changes
        assert audit_log.ip_address == '10.0.0.1'
        assert audit_log.user_agent == 'Mobile/1.0'
    
    @patch('app.utils.audit.current_app')
    @patch('app.utils.audit.db')
    def test_audit_logging_error_handling(self, mock_db, mock_app):
        """Test that audit logging errors don't break main operations."""
        # Setup mock to raise exception
        mock_db.session.add.side_effect = Exception("Database error")
        
        # This should not raise an exception
        log_registration_action('reg-error', 'CREATE', None)
        
        # Verify error was logged
        mock_app.logger.error.assert_called_once()
        
        # Verify rollback was called
        mock_db.session.rollback.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__])