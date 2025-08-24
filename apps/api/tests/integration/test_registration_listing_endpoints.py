"""Integration tests for registration listing and search endpoints."""
import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from flask import json
from app.models.registration import WeightRegistration
from app.models.user import User
from app.models import db


class TestRegistrationListEndpoints:
    """Test suite for registration listing endpoints."""
    
    @pytest.fixture
    def test_users(self, app_with_db):
        """Create test users for role-based testing."""
        with app_with_db.app_context():
            operator = User(name="Test Operator", role="operator")
            supervisor = User(name="Test Supervisor", role="supervisor")
            
            db.session.add(operator)
            db.session.add(supervisor)
            db.session.commit()
            
            return {
                'operator': operator,
                'supervisor': supervisor
            }
    
    @pytest.fixture
    def sample_registrations(self, app_with_db, test_users):
        """Create sample registrations for testing."""
        with app_with_db.app_context():
            today = date.today()
            yesterday = today - timedelta(days=1)
            
            registrations = [
                # Today's registrations
                WeightRegistration(
                    weight=Decimal('15.5'),
                    cut_type='jamón',
                    supplier='Proveedor A',
                    registered_by=test_users['operator'].id,
                    created_at=datetime.combine(today, datetime.min.time()),
                    ocr_confidence=Decimal('0.85')
                ),
                WeightRegistration(
                    weight=Decimal('22.3'),
                    cut_type='chuleta',
                    supplier='Proveedor B',
                    registered_by=test_users['operator'].id,
                    created_at=datetime.combine(today, datetime.min.time()),
                    ocr_confidence=Decimal('0.92')
                ),
                WeightRegistration(
                    weight=Decimal('18.7'),
                    cut_type='jamón',
                    supplier='Proveedor A',
                    registered_by=test_users['supervisor'].id,
                    created_at=datetime.combine(today, datetime.min.time()),
                    ocr_confidence=Decimal('0.78')
                ),
                # Yesterday's registrations
                WeightRegistration(
                    weight=Decimal('12.1'),
                    cut_type='chuleta',
                    supplier='Proveedor C',
                    registered_by=test_users['operator'].id,
                    created_at=datetime.combine(yesterday, datetime.min.time()),
                    ocr_confidence=Decimal('0.89')
                ),
            ]
            
            for reg in registrations:
                db.session.add(reg)
            
            db.session.commit()
            return registrations
    
    def test_list_registrations_basic(self, client, app_with_db, test_users, sample_registrations):
        """Test basic registration listing."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'registrations' in data
        assert 'total_count' in data
        assert 'total_weight' in data
        assert 'registrations_by_supplier' in data
        assert 'page' in data
        assert 'limit' in data
        assert 'has_next' in data
        assert 'has_prev' in data
        
        # Supervisor should see all 4 registrations
        assert data['total_count'] == 4
        assert len(data['registrations']) == 4
        
        # Check registrations_by_supplier metadata
        supplier_breakdown = data['registrations_by_supplier']
        assert len(supplier_breakdown) == 3  # 3 different suppliers
        
        # Find Proveedor A breakdown (should have 2 registrations)
        proveedor_a = next((s for s in supplier_breakdown if s['supplier'] == 'Proveedor A'), None)
        assert proveedor_a is not None
        assert proveedor_a['count'] == 2
        assert proveedor_a['total_weight'] == 34.2  # 15.5 + 18.7
    
    def test_list_registrations_operator_role_filter(self, client, app_with_db, test_users, sample_registrations):
        """Test that operators only see their own registrations."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['operator'].id)
            sess['user_name'] = test_users['operator'].name
            sess['user_role'] = test_users['operator'].role
        
        response = client.get('/api/v1/registrations')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Operator should see only their 3 registrations
        assert data['total_count'] == 3
        assert len(data['registrations']) == 3
        
        # All registrations should belong to the operator
        for reg in data['registrations']:
            assert reg['registered_by'] == str(test_users['operator'].id)
    
    def test_list_registrations_pagination(self, client, app_with_db, test_users, sample_registrations):
        """Test pagination parameters."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        # Test first page with limit 2
        response = client.get('/api/v1/registrations?page=1&limit=2')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['page'] == 1
        assert data['limit'] == 2
        assert len(data['registrations']) == 2
        assert data['has_next'] is True
        assert data['has_prev'] is False
        
        # Test second page
        response = client.get('/api/v1/registrations?page=2&limit=2')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['page'] == 2
        assert data['has_next'] is True
        assert data['has_prev'] is True
    
    def test_list_registrations_supplier_filter(self, client, app_with_db, test_users, sample_registrations):
        """Test filtering by supplier."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations?supplier=Proveedor A')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 2
        assert len(data['registrations']) == 2
        
        # Check that registrations_by_supplier only shows filtered results
        supplier_breakdown = data['registrations_by_supplier']
        assert len(supplier_breakdown) == 1
        assert supplier_breakdown[0]['supplier'] == 'Proveedor A'
        assert supplier_breakdown[0]['count'] == 2
    
    def test_list_registrations_cut_type_filter(self, client, app_with_db, test_users, sample_registrations):
        """Test filtering by cut type."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations?cut_type=jamón')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 2
        
        # All returned registrations should be jamón
        for reg in data['registrations']:
            assert reg['cut_type'] == 'jamón'
    
    def test_list_registrations_date_filters(self, client, app_with_db, test_users, sample_registrations):
        """Test filtering by date range."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        today_str = date.today().isoformat()
        
        # Filter for today only
        response = client.get(f'/api/v1/registrations?date_from={today_str}&date_to={today_str}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 3  # Only today's registrations
    
    def test_list_registrations_invalid_cut_type(self, client, app_with_db, test_users):
        """Test validation of invalid cut_type."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations?cut_type=invalid')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'error' in data
        assert 'Invalid cut_type' in data['error']['message']
    
    def test_list_registrations_invalid_date_format(self, client, app_with_db, test_users):
        """Test validation of invalid date format."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations?date_from=invalid-date')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'error' in data
        assert 'Invalid date_from format' in data['error']['message']


class TestTodayRegistrationsEndpoint:
    """Test suite for today's registrations endpoint."""
    
    @pytest.fixture
    def test_users(self, app_with_db):
        """Create test users for role-based testing."""
        with app_with_db.app_context():
            operator = User(name="Test Operator", role="operator")
            supervisor = User(name="Test Supervisor", role="supervisor")
            
            db.session.add(operator)
            db.session.add(supervisor)
            db.session.commit()
            
            return {
                'operator': operator,
                'supervisor': supervisor
            }
    
    @pytest.fixture
    def today_registrations(self, app_with_db, test_users):
        """Create today's registrations for testing."""
        with app_with_db.app_context():
            today = date.today()
            yesterday = today - timedelta(days=1)
            
            # Today's registrations
            today_regs = [
                WeightRegistration(
                    weight=Decimal('15.5'),
                    cut_type='jamón',
                    supplier='Proveedor A',
                    registered_by=test_users['operator'].id,
                    created_at=datetime.combine(today, datetime.min.time())
                ),
                WeightRegistration(
                    weight=Decimal('22.3'),
                    cut_type='chuleta',
                    supplier='Proveedor B',
                    registered_by=test_users['operator'].id,
                    created_at=datetime.combine(today, datetime.min.time())
                ),
                WeightRegistration(
                    weight=Decimal('18.7'),
                    cut_type='jamón',
                    supplier='Proveedor A',
                    registered_by=test_users['supervisor'].id,
                    created_at=datetime.combine(today, datetime.min.time())
                ),
            ]
            
            # Yesterday's registration (should not appear in today's results)
            yesterday_reg = WeightRegistration(
                weight=Decimal('12.1'),
                cut_type='chuleta',
                supplier='Proveedor C',
                registered_by=test_users['operator'].id,
                created_at=datetime.combine(yesterday, datetime.min.time())
            )
            
            all_regs = today_regs + [yesterday_reg]
            for reg in all_regs:
                db.session.add(reg)
            
            db.session.commit()
            return today_regs
    
    def test_today_registrations_basic(self, client, app_with_db, test_users, today_registrations):
        """Test basic today's registrations endpoint."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations/today')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'registrations' in data
        assert 'total_count' in data
        assert 'total_weight' in data
        assert 'registrations_by_supplier' in data
        assert 'date' in data
        
        # Should show today's date
        assert data['date'] == date.today().isoformat()
        
        # Supervisor should see all 3 today's registrations
        assert data['total_count'] == 3
        assert len(data['registrations']) == 3
        
        # Total weight should be sum of today's registrations
        expected_weight = 15.5 + 22.3 + 18.7
        assert data['total_weight'] == expected_weight
        
        # Check registrations_by_supplier metadata
        supplier_breakdown = data['registrations_by_supplier']
        assert len(supplier_breakdown) == 2  # 2 suppliers today
        
        # Find Proveedor A breakdown
        proveedor_a = next((s for s in supplier_breakdown if s['supplier'] == 'Proveedor A'), None)
        assert proveedor_a is not None
        assert proveedor_a['count'] == 2
        assert proveedor_a['total_weight'] == 34.2  # 15.5 + 18.7
    
    def test_today_registrations_operator_role_filter(self, client, app_with_db, test_users, today_registrations):
        """Test that operators only see their own today's registrations."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['operator'].id)
            sess['user_name'] = test_users['operator'].name
            sess['user_role'] = test_users['operator'].role
        
        response = client.get('/api/v1/registrations/today')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Operator should see only their 2 today's registrations
        assert data['total_count'] == 2
        assert len(data['registrations']) == 2
        
        # All registrations should belong to the operator
        for reg in data['registrations']:
            assert reg['registered_by'] == str(test_users['operator'].id)
    
    def test_today_registrations_empty_day(self, client, app_with_db, test_users):
        """Test today's registrations when no registrations exist."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(test_users['supervisor'].id)
            sess['user_name'] = test_users['supervisor'].name
            sess['user_role'] = test_users['supervisor'].role
        
        response = client.get('/api/v1/registrations/today')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 0
        assert len(data['registrations']) == 0
        assert data['total_weight'] == 0
        assert len(data['registrations_by_supplier']) == 0
    
    def test_today_registrations_unauthorized(self, client):
        """Test today's registrations without authentication."""
        response = client.get('/api/v1/registrations/today')
        assert response.status_code == 401
        
        data = json.loads(response.data)
        assert 'error' in data


class TestRegistrationEndpointPerformance:
    """Performance tests for registration endpoints."""
    
    @pytest.fixture
    def supervisor_user(self, app_with_db):
        """Create supervisor user for performance testing."""
        with app_with_db.app_context():
            user = User(name="Performance Test Supervisor", role="supervisor")
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def large_dataset(self, app_with_db, supervisor_user):
        """Create a large dataset of registrations for performance testing."""
        with app_with_db.app_context():
            suppliers = ['Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E']
            cut_types = ['jamón', 'chuleta']
            
            registrations = []
            for i in range(500):  # Create 500 registrations
                reg = WeightRegistration(
                    weight=Decimal('15.0') + (i % 20),  # Vary weights
                    cut_type=cut_types[i % 2],
                    supplier=suppliers[i % 5],
                    registered_by=supervisor_user.id,
                    created_at=datetime.now() - timedelta(hours=i % 24)
                )
                registrations.append(reg)
                
                # Batch insert every 100 records for performance
                if len(registrations) >= 100:
                    db.session.bulk_save_objects(registrations)
                    registrations = []
            
            # Insert remaining records
            if registrations:
                db.session.bulk_save_objects(registrations)
            
            db.session.commit()
    
    def test_list_registrations_large_dataset_performance(self, client, app_with_db, supervisor_user, large_dataset):
        """Test listing performance with large dataset."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(supervisor_user.id)
            sess['user_name'] = supervisor_user.name
            sess['user_role'] = supervisor_user.role
        
        import time
        start_time = time.time()
        
        response = client.get('/api/v1/registrations?limit=20')
        
        end_time = time.time()
        processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        assert response.status_code == 200
        assert processing_time < 1000  # Should complete within 1 second
        
        data = json.loads(response.data)
        assert data['total_count'] == 500
        assert len(data['registrations']) == 20
        assert len(data['registrations_by_supplier']) == 5  # All 5 suppliers
    
    def test_metadata_calculation_performance(self, client, app_with_db, supervisor_user, large_dataset):
        """Test performance of registrations_by_supplier calculation."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(supervisor_user.id)
            sess['user_name'] = supervisor_user.name
            sess['user_role'] = supervisor_user.role
        
        import time
        start_time = time.time()
        
        response = client.get('/api/v1/registrations')
        
        end_time = time.time()
        processing_time = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        assert processing_time < 2000  # Should complete within 2 seconds
        
        data = json.loads(response.data)
        # Verify metadata calculation accuracy
        total_calculated_weight = sum(supplier['total_weight'] for supplier in data['registrations_by_supplier'])
        assert abs(total_calculated_weight - data['total_weight']) < 0.01  # Allow for floating point precision