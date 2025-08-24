"""Integration tests for database operations."""
import pytest
from app.models import db, User, WeightRegistration


class TestDatabaseOperations:
    """Test database operations and transactions."""
    
    def test_database_connection(self, app):
        """Test database connection is working."""
        with app.app_context():
            # Test basic database operations
            result = db.session.execute(db.text('SELECT 1')).scalar()
            assert result == 1
    
    def test_user_crud_operations(self, app):
        """Test complete CRUD operations for User model."""
        with app.app_context():
            # CREATE
            user = User(name='crud_test_user', role='operator')
            db.session.add(user)
            db.session.commit()
            
            user_id = user.id
            assert user_id is not None
            
            # READ
            retrieved_user = User.query.get(user_id)
            assert retrieved_user is not None
            assert retrieved_user.name == 'crud_test_user'
            
            # UPDATE
            retrieved_user.name = 'updated_crud_user'
            retrieved_user.is_active = False
            db.session.commit()
            
            updated_user = User.query.get(user_id)
            assert updated_user.name == 'updated_crud_user'
            assert not updated_user.is_active
            
            # DELETE
            db.session.delete(updated_user)
            db.session.commit()
            
            deleted_user = User.query.get(user_id)
            assert deleted_user is None
    
    def test_weight_registration_crud_operations(self, app, sample_user):
        """Test complete CRUD operations for WeightRegistration model."""
        with app.app_context():
            # CREATE
            registration = WeightRegistration(
                weight=18.250,
                cut_type='jamón',
                supplier='CRUD Test Supplier',
                registered_by=sample_user.id
            )
            db.session.add(registration)
            db.session.commit()
            
            reg_id = registration.id
            assert reg_id is not None
            
            # READ
            retrieved_reg = WeightRegistration.query.get(reg_id)
            assert retrieved_reg is not None
            assert retrieved_reg.supplier == 'CRUD Test Supplier'
            
            # UPDATE
            retrieved_reg.supplier = 'Updated Supplier'
            retrieved_reg.sync_status = 'pending'
            db.session.commit()
            
            updated_reg = WeightRegistration.query.get(reg_id)
            assert updated_reg.supplier == 'Updated Supplier'
            assert updated_reg.sync_status == 'pending'
            
            # DELETE
            db.session.delete(updated_reg)
            db.session.commit()
            
            deleted_reg = WeightRegistration.query.get(reg_id)
            assert deleted_reg is None
    
    def test_transaction_rollback(self, app, sample_user):
        """Test transaction rollback on error."""
        with app.app_context():
            initial_count = WeightRegistration.query.count()
            
            try:
                # Add valid registration
                reg1 = WeightRegistration(
                    weight=20.0,
                    cut_type='jamón',
                    supplier='Valid Registration',
                    registered_by=sample_user.id
                )
                db.session.add(reg1)
                
                # Add invalid registration (duplicate name constraint violation)
                user1 = User(name='transaction_test', role='operator')
                user2 = User(name='transaction_test', role='supervisor')  # Duplicate name
                db.session.add(user1)
                db.session.add(user2)
                
                db.session.commit()  # This should fail
            except Exception:
                db.session.rollback()
            
            # Verify no records were added due to rollback
            final_count = WeightRegistration.query.count()
            assert final_count == initial_count
            
            # Verify user wasn't created either
            user = User.query.filter_by(name='transaction_test').first()
            assert user is None
    
    def test_cascade_operations(self, app):
        """Test cascade operations between User and WeightRegistration."""
        with app.app_context():
            # Create user with registrations
            user = User(name='cascade_test_user', role='operator')
            db.session.add(user)
            db.session.commit()
            
            reg1 = WeightRegistration(
                weight=15.0,
                cut_type='jamón',
                supplier='Cascade Test 1',
                registered_by=user.id
            )
            reg2 = WeightRegistration(
                weight=25.0,
                cut_type='chuleta',
                supplier='Cascade Test 2',
                registered_by=user.id
            )
            
            db.session.add(reg1)
            db.session.add(reg2)
            db.session.commit()
            
            # Verify relationships
            user_registrations = user.registrations.all()
            assert len(user_registrations) == 2
            
            # Note: In production, you'd want to handle user deletion carefully
            # to avoid orphaned registrations. For this test, we just verify
            # the foreign key relationship exists
            assert reg1.user == user
            assert reg2.user == user
    
    def test_query_operations(self, app, sample_user):
        """Test various query operations."""
        with app.app_context():
            # Create test data
            registrations = [
                WeightRegistration(weight=10.0, cut_type='jamón', supplier='Supplier A', registered_by=sample_user.id),
                WeightRegistration(weight=20.0, cut_type='chuleta', supplier='Supplier B', registered_by=sample_user.id),
                WeightRegistration(weight=30.0, cut_type='jamón', supplier='Supplier A', registered_by=sample_user.id),
            ]
            
            for reg in registrations:
                db.session.add(reg)
            db.session.commit()
            
            # Test filtering
            jamon_regs = WeightRegistration.query.filter_by(cut_type='jamón').all()
            assert len(jamon_regs) >= 2
            
            supplier_a_regs = WeightRegistration.query.filter_by(supplier='Supplier A').all()
            assert len(supplier_a_regs) >= 2
            
            # Test ordering
            ordered_regs = WeightRegistration.query.order_by(WeightRegistration.weight.desc()).all()
            weights = [float(reg.weight) for reg in ordered_regs]
            assert weights == sorted(weights, reverse=True)
            
            # Test counting
            total_count = WeightRegistration.query.count()
            assert total_count >= 3
    
    def test_database_constraints(self, app, sample_user):
        """Test database constraints are enforced."""
        with app.app_context():
            # Test unique constraint on user name
            user1 = User(name='constraint_test', role='operator')
            db.session.add(user1)
            db.session.commit()
            
            user2 = User(name='constraint_test', role='supervisor')
            db.session.add(user2)
            
            with pytest.raises(Exception):
                db.session.commit()
            
            db.session.rollback()
            
            # Test NOT NULL constraints
            with pytest.raises(Exception):
                invalid_user = User(name=None, role='operator')
                db.session.add(invalid_user)
                db.session.commit()
            
            db.session.rollback()
            
            # Test foreign key constraint
            from uuid import uuid4
            with pytest.raises(Exception):
                invalid_reg = WeightRegistration(
                    weight=20.0,
                    cut_type='jamón',
                    supplier='Invalid FK Test',
                    registered_by=uuid4()  # Non-existent user
                )
                db.session.add(invalid_reg)
                db.session.commit()
    
    def test_bulk_operations(self, app, sample_user):
        """Test bulk database operations."""
        with app.app_context():
            initial_count = WeightRegistration.query.count()
            
            # Bulk insert
            registrations = []
            for i in range(5):
                reg = WeightRegistration(
                    weight=10.0 + i,
                    cut_type='jamón' if i % 2 == 0 else 'chuleta',
                    supplier=f'Bulk Supplier {i}',
                    registered_by=sample_user.id
                )
                registrations.append(reg)
            
            db.session.add_all(registrations)
            db.session.commit()
            
            # Verify bulk insert
            final_count = WeightRegistration.query.count()
            assert final_count == initial_count + 5
            
            # Bulk update
            WeightRegistration.query.filter(
                WeightRegistration.supplier.like('Bulk Supplier%')
            ).update({'sync_status': 'pending'})
            db.session.commit()
            
            # Verify bulk update
            pending_regs = WeightRegistration.query.filter_by(sync_status='pending').count()
            assert pending_regs >= 5
            
            # Bulk delete
            deleted_count = WeightRegistration.query.filter(
                WeightRegistration.supplier.like('Bulk Supplier%')
            ).delete()
            db.session.commit()
            
            assert deleted_count == 5