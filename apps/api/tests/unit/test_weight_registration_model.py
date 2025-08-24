"""Unit tests for WeightRegistration model."""
import pytest
from decimal import Decimal
from app.models import db, User, WeightRegistration


class TestWeightRegistrationModel:
    """Test WeightRegistration model functionality."""
    
    def test_weight_registration_creation(self, app, sample_user):
        """Test basic weight registration creation."""
        with app.app_context():
            registration = WeightRegistration(
                weight=15.750,
                cut_type='chuleta',
                supplier='Test Supplier',
                registered_by=sample_user.id
            )
            
            assert registration.weight == Decimal('15.750')
            assert registration.cut_type == 'chuleta'
            assert registration.supplier == 'Test Supplier'
            assert registration.registered_by == sample_user.id
            assert registration.sync_status == 'synced'  # Default value
            assert registration.photo_url is None
    
    def test_weight_registration_save_and_retrieve(self, app, sample_user):
        """Test registration can be saved and retrieved from database."""
        with app.app_context():
            registration = WeightRegistration(
                weight=22.125,
                cut_type='jamón',
                supplier='Premium Meat Co',
                registered_by=sample_user.id,
                photo_url='https://example.com/photo.jpg'
            )
            
            db.session.add(registration)
            db.session.commit()
            
            # Retrieve registration
            retrieved = WeightRegistration.query.filter_by(supplier='Premium Meat Co').first()
            assert retrieved is not None
            assert retrieved.weight == Decimal('22.125')
            assert retrieved.cut_type == 'jamón'
            assert retrieved.supplier == 'Premium Meat Co'
            assert retrieved.photo_url == 'https://example.com/photo.jpg'
            assert retrieved.id is not None
            assert retrieved.created_at is not None
    
    def test_weight_decimal_conversion(self, app, sample_user):
        """Test weight is properly converted to Decimal."""
        with app.app_context():
            # Test float input
            registration1 = WeightRegistration(
                weight=10.5,
                cut_type='jamón',
                supplier='Test',
                registered_by=sample_user.id
            )
            assert isinstance(registration1.weight, Decimal)
            assert registration1.weight == Decimal('10.5')
            
            # Test string input
            registration2 = WeightRegistration(
                weight='15.750',
                cut_type='chuleta',
                supplier='Test',
                registered_by=sample_user.id
            )
            assert isinstance(registration2.weight, Decimal)
            assert registration2.weight == Decimal('15.750')
    
    def test_cut_type_validation(self, app, sample_user):
        """Test cut_type accepts valid values."""
        with app.app_context():
            # Valid cut types
            jamon_reg = WeightRegistration(
                weight=20.0,
                cut_type='jamón',
                supplier='Test',
                registered_by=sample_user.id
            )
            chuleta_reg = WeightRegistration(
                weight=20.0,
                cut_type='chuleta',
                supplier='Test',
                registered_by=sample_user.id
            )
            
            db.session.add(jamon_reg)
            db.session.add(chuleta_reg)
            db.session.commit()
            
            assert jamon_reg.cut_type == 'jamón'
            assert chuleta_reg.cut_type == 'chuleta'
    
    def test_sync_status_methods(self, app, sample_user):
        """Test sync status helper methods."""
        with app.app_context():
            registration = WeightRegistration(
                weight=25.0,
                cut_type='jamón',
                supplier='Test',
                registered_by=sample_user.id
            )
            
            # Default should be synced
            assert registration.is_synced()
            
            # Test marking pending sync
            registration.mark_pending_sync()
            assert registration.sync_status == 'pending'
            assert not registration.is_synced()
            
            # Test marking sync error
            registration.mark_sync_error()
            assert registration.sync_status == 'error'
            assert not registration.is_synced()
            
            # Test marking synced
            registration.mark_synced()
            assert registration.sync_status == 'synced'
            assert registration.is_synced()
    
    def test_validate_weight_range(self, app, sample_user):
        """Test weight range validation method."""
        with app.app_context():
            registration = WeightRegistration(
                weight=25.5,
                cut_type='jamón',
                supplier='Test',
                registered_by=sample_user.id
            )
            
            # Test normal weight range
            assert registration.validate_weight_range()
            
            # Test weight too low
            registration.weight = Decimal('0.05')
            assert not registration.validate_weight_range()
            
            # Test weight too high
            registration.weight = Decimal('1000.0')
            assert not registration.validate_weight_range()
            
            # Test custom range
            registration.weight = Decimal('50.0')
            assert registration.validate_weight_range(min_weight=10.0, max_weight=100.0)
            assert not registration.validate_weight_range(min_weight=10.0, max_weight=40.0)
    
    def test_user_relationship(self, app, sample_user):
        """Test relationship with User model."""
        with app.app_context():
            registration = WeightRegistration(
                weight=30.0,
                cut_type='chuleta',
                supplier='Relationship Test',
                registered_by=sample_user.id
            )
            
            db.session.add(registration)
            db.session.commit()
            
            # Test forward relationship
            retrieved_reg = WeightRegistration.query.filter_by(supplier='Relationship Test').first()
            assert retrieved_reg.user is not None
            assert retrieved_reg.user.id == sample_user.id
            assert retrieved_reg.user.name == sample_user.name
            
            # Test backward relationship
            user = User.query.get(sample_user.id)
            user_registrations = user.registrations.all()
            assert len(user_registrations) >= 1
            assert retrieved_reg in user_registrations
    
    def test_to_dict_method(self, app, sample_registration):
        """Test to_dict serialization method."""
        with app.app_context():
            registration = WeightRegistration.query.get(sample_registration.id)
            reg_dict = registration.to_dict()
            
            assert isinstance(reg_dict, dict)
            required_fields = ['id', 'weight', 'cut_type', 'supplier', 'registered_by', 
                             'photo_url', 'created_at', 'sync_status', 'user']
            
            for field in required_fields:
                assert field in reg_dict
            
            assert reg_dict['weight'] == float(registration.weight)
            assert reg_dict['cut_type'] == registration.cut_type
            assert reg_dict['supplier'] == registration.supplier
            assert isinstance(reg_dict['user'], dict)  # User should be serialized too
    
    def test_weight_registration_repr(self, app, sample_user):
        """Test string representation of WeightRegistration."""
        with app.app_context():
            registration = WeightRegistration(
                weight=12.5,
                cut_type='jamón',
                supplier='Repr Test',
                registered_by=sample_user.id
            )
            
            expected = '<WeightRegistration 12.5kg jamón from Repr Test>'
            assert repr(registration) == expected
    
    def test_foreign_key_constraint(self, app):
        """Test foreign key constraint with invalid user ID."""
        with app.app_context():
            from uuid import uuid4
            
            registration = WeightRegistration(
                weight=20.0,
                cut_type='jamón',
                supplier='Invalid User Test',
                registered_by=uuid4()  # Non-existent user ID
            )
            
            db.session.add(registration)
            with pytest.raises(Exception):  # Should raise foreign key constraint error
                db.session.commit()