"""Unit tests for enhanced registration CRUD operations."""
import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock
from app.models.registration import WeightRegistration
from app.models.audit_log import RegistrationAuditLog
from app.utils.audit import calculate_changes, log_registration_action


class TestWeightRegistrationModel:
    """Test the enhanced WeightRegistration model."""
    
    def test_initialization_with_new_fields(self):
        """Test model initialization with new audit fields."""
        registration = WeightRegistration(
            weight=15.5,
            cut_type='jamón',
            supplier='Test Supplier',
            registered_by='user-123',
            ocr_confidence=0.95
        )
        
        assert registration.weight == Decimal('15.5')
        assert registration.cut_type == 'jamón'
        assert registration.supplier == 'Test Supplier'
        assert registration.ocr_confidence == Decimal('0.95')
        assert registration.updated_at is None  # Not set until update
        assert registration.deleted_at is None
    
    def test_soft_delete(self):
        """Test soft delete functionality."""
        registration = WeightRegistration(
            weight=10.0,
            cut_type='chuleta',
            supplier='Test Supplier',
            registered_by='user-123'
        )
        
        assert not registration.is_deleted()
        
        registration.soft_delete('admin-456')
        
        assert registration.is_deleted()
        assert registration.deleted_at is not None
        assert registration.updated_by == 'admin-456'
        assert registration.update_reason == 'deleted'
    
    def test_to_dict_includes_new_fields(self):
        """Test that to_dict includes new audit fields."""
        registration = WeightRegistration(
            weight=12.0,
            cut_type='jamón',
            supplier='Test Supplier',
            registered_by='user-123',
            ocr_confidence=0.87
        )
        
        registration.updated_by = 'user-456'
        registration.update_reason = 'weight_correction'
        
        result = registration.to_dict()
        
        assert 'updated_at' in result
        assert 'deleted_at' in result
        assert 'updated_by' in result
        assert 'update_reason' in result
        assert 'ocr_confidence' in result
        assert result['ocr_confidence'] == 0.87
        assert result['updated_by'] == 'user-456'
        assert result['update_reason'] == 'weight_correction'


class TestAuditUtilities:
    """Test audit utility functions."""
    
    def test_calculate_changes_with_updates(self):
        """Test calculating changes between old and new data."""
        # Mock registration object
        old_registration = MagicMock()
        old_registration.weight = Decimal('10.0')
        old_registration.cut_type = 'jamón'
        old_registration.supplier = 'Old Supplier'
        old_registration.photo_url = 'old-photo.jpg'
        old_registration.ocr_confidence = Decimal('0.8')
        
        new_data = {
            'weight': 12.0,
            'supplier': 'New Supplier',
            'ocr_confidence': 0.95
        }
        
        changes = calculate_changes(old_registration, new_data)
        
        assert 'weight' in changes
        assert changes['weight']['old'] == 10.0
        assert changes['weight']['new'] == 12.0
        
        assert 'supplier' in changes
        assert changes['supplier']['old'] == 'Old Supplier'
        assert changes['supplier']['new'] == 'New Supplier'
        
        assert 'ocr_confidence' in changes
        assert changes['ocr_confidence']['old'] == 0.8
        assert changes['ocr_confidence']['new'] == 0.95
        
        # cut_type not changed, should not be in changes
        assert 'cut_type' not in changes
    
    def test_calculate_changes_no_changes(self):
        """Test that no changes returns None."""
        old_registration = MagicMock()
        old_registration.weight = Decimal('10.0')
        old_registration.cut_type = 'jamón'
        old_registration.supplier = 'Same Supplier'
        
        new_data = {
            'weight': 10.0,
            'supplier': 'Same Supplier'
        }
        
        changes = calculate_changes(old_registration, new_data)
        
        assert changes is None
    
    @patch('app.utils.audit.current_app')
    @patch('app.utils.audit.current_user')
    @patch('app.utils.audit.request')
    @patch('app.utils.audit.db')
    def test_log_registration_action(self, mock_db, mock_request, mock_user, mock_app):
        """Test audit logging functionality."""
        # Setup mocks
        mock_user.id = 'user-123'
        mock_request.remote_addr = '192.168.1.1'
        mock_request.headers.get.return_value = 'TestAgent/1.0'
        
        changes = {'weight': {'old': 10.0, 'new': 12.0}}
        
        # Call the function
        log_registration_action('reg-123', 'UPDATE', changes)
        
        # Verify audit log was created
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()
        mock_app.logger.info.assert_called_once()


class TestRegistrationAuditLogModel:
    """Test the RegistrationAuditLog model."""
    
    def test_initialization(self):
        """Test audit log model initialization."""
        audit_log = RegistrationAuditLog(
            registration_id='reg-123',
            action='UPDATE',
            user_id='user-456',
            changes={'weight': {'old': 10.0, 'new': 12.0}},
            ip_address='192.168.1.1',
            user_agent='TestAgent/1.0'
        )
        
        assert audit_log.registration_id == 'reg-123'
        assert audit_log.action == 'UPDATE'
        assert audit_log.user_id == 'user-456'
        assert audit_log.changes == {'weight': {'old': 10.0, 'new': 12.0}}
        assert audit_log.ip_address == '192.168.1.1'
        assert audit_log.user_agent == 'TestAgent/1.0'
    
    def test_to_dict(self):
        """Test audit log to_dict method."""
        audit_log = RegistrationAuditLog(
            registration_id='reg-123',
            action='DELETE',
            user_id='admin-789',
            changes={'deleted_by': 'admin-789'}
        )
        
        result = audit_log.to_dict()
        
        assert result['registration_id'] == 'reg-123'
        assert result['action'] == 'DELETE'
        assert result['user_id'] == 'admin-789'
        assert result['changes'] == {'deleted_by': 'admin-789'}
        assert 'timestamp' in result
        assert 'id' in result


if __name__ == '__main__':
    pytest.main([__file__])