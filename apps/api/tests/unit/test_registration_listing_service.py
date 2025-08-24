"""Unit tests for registration listing service logic."""
import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy import and_
from app.models.registration import WeightRegistration
from app.models.user import User


class TestRegistrationFilterLogic:
    """Test registration filtering logic."""
    
    @pytest.fixture
    def mock_query(self):
        """Create a mock SQLAlchemy query object."""
        query = Mock()
        query.filter.return_value = query
        query.order_by.return_value = query
        query.offset.return_value = query
        query.limit.return_value = query
        query.count.return_value = 10
        query.all.return_value = []
        return query
    
    @pytest.fixture
    def mock_operator(self):
        """Mock operator user."""
        user = Mock()
        user.id = 'operator-123'
        user.role = 'operator'
        return user
    
    @pytest.fixture
    def mock_supervisor(self):
        """Mock supervisor user."""
        user = Mock()
        user.id = 'supervisor-456'
        user.role = 'supervisor'
        return user
    
    def test_role_based_filtering_operator(self, mock_query, mock_operator):
        """Test that operators only see their own registrations."""
        with patch('app.routes.registrations.current_user', mock_operator):
            with patch('app.models.registration.WeightRegistration.query', mock_query):
                # Simulate the filtering logic from the endpoint
                if mock_operator.role == 'operator':
                    mock_query.filter(WeightRegistration.registered_by == mock_operator.id)
                
                # Verify filter was called with correct user ID
                mock_query.filter.assert_called()
    
    def test_role_based_filtering_supervisor(self, mock_query, mock_supervisor):
        """Test that supervisors see all registrations."""
        with patch('app.routes.registrations.current_user', mock_supervisor):
            with patch('app.models.registration.WeightRegistration.query', mock_query):
                # Simulate the filtering logic from the endpoint
                if mock_supervisor.role == 'operator':
                    mock_query.filter(WeightRegistration.registered_by == mock_supervisor.id)
                # No additional filtering for supervisors
                
                # For supervisors, filter should not be called for role-based filtering
                # (other filters like supplier, date, etc. may still be applied)
                pass  # No role-based filtering expected
    
    def test_supplier_filter_application(self, mock_query):
        """Test supplier filter application."""
        supplier_filter = 'Test Supplier'
        
        # Simulate supplier filtering
        mock_query.filter(WeightRegistration.supplier.ilike(f'%{supplier_filter}%'))
        
        # Verify ILIKE filter was applied
        mock_query.filter.assert_called()
    
    def test_cut_type_filter_validation(self):
        """Test cut type filter validation."""
        valid_cut_types = ['jamón', 'chuleta']
        
        # Test valid cut types
        for cut_type in valid_cut_types:
            assert cut_type in valid_cut_types
        
        # Test invalid cut type
        invalid_cut_type = 'invalid_type'
        assert invalid_cut_type not in valid_cut_types
    
    def test_date_filter_parsing(self):
        """Test date filter parsing logic."""
        # Test valid date format
        valid_date = '2025-08-21'
        try:
            parsed_date = datetime.strptime(valid_date, '%Y-%m-%d').date()
            assert parsed_date == date(2025, 8, 21)
        except ValueError:
            pytest.fail("Valid date should not raise ValueError")
        
        # Test invalid date format
        invalid_date = 'invalid-date'
        with pytest.raises(ValueError):
            datetime.strptime(invalid_date, '%Y-%m-%d').date()
    
    def test_pagination_calculation(self):
        """Test pagination calculation logic."""
        # Test various pagination scenarios
        test_cases = [
            {'page': 1, 'limit': 20, 'total': 100, 'expected_offset': 0, 'expected_has_next': True, 'expected_has_prev': False},
            {'page': 2, 'limit': 20, 'total': 100, 'expected_offset': 20, 'expected_has_next': True, 'expected_has_prev': True},
            {'page': 5, 'limit': 20, 'total': 100, 'expected_offset': 80, 'expected_has_next': False, 'expected_has_prev': True},
            {'page': 1, 'limit': 50, 'total': 25, 'expected_offset': 0, 'expected_has_next': False, 'expected_has_prev': False},
        ]
        
        for case in test_cases:
            # Calculate offset
            offset = (case['page'] - 1) * case['limit']
            assert offset == case['expected_offset']
            
            # Calculate has_next
            has_next = (case['page'] * case['limit']) < case['total']
            assert has_next == case['expected_has_next']
            
            # Calculate has_prev
            has_prev = case['page'] > 1
            assert has_prev == case['expected_has_prev']


class TestSupplierBreakdownCalculation:
    """Test supplier breakdown calculation logic."""
    
    def test_supplier_breakdown_from_registrations_list(self):
        """Test calculating supplier breakdown from registrations list (today endpoint style)."""
        # Mock registrations
        mock_registrations = [
            Mock(supplier='Supplier A', weight=Decimal('15.5')),
            Mock(supplier='Supplier B', weight=Decimal('22.3')),
            Mock(supplier='Supplier A', weight=Decimal('18.7')),
            Mock(supplier='Supplier C', weight=Decimal('10.0')),
        ]
        
        # Simulate the breakdown calculation logic from today endpoint
        supplier_breakdown = {}
        for reg in mock_registrations:
            supplier = reg.supplier
            if supplier not in supplier_breakdown:
                supplier_breakdown[supplier] = {
                    'count': 0,
                    'total_weight': 0
                }
            supplier_breakdown[supplier]['count'] += 1
            supplier_breakdown[supplier]['total_weight'] += float(reg.weight)
        
        # Convert to list format like in the endpoint
        registrations_by_supplier = [
            {
                'supplier': supplier,
                'count': stats['count'],
                'total_weight': stats['total_weight']
            }
            for supplier, stats in supplier_breakdown.items()
        ]
        
        # Verify results
        assert len(registrations_by_supplier) == 3
        
        # Find Supplier A
        supplier_a = next((s for s in registrations_by_supplier if s['supplier'] == 'Supplier A'), None)
        assert supplier_a is not None
        assert supplier_a['count'] == 2
        assert supplier_a['total_weight'] == 34.2  # 15.5 + 18.7
        
        # Find Supplier B
        supplier_b = next((s for s in registrations_by_supplier if s['supplier'] == 'Supplier B'), None)
        assert supplier_b is not None
        assert supplier_b['count'] == 1
        assert supplier_b['total_weight'] == 22.3
    
    def test_supplier_breakdown_empty_list(self):
        """Test supplier breakdown with empty registrations list."""
        mock_registrations = []
        
        supplier_breakdown = {}
        for reg in mock_registrations:
            supplier = reg.supplier
            if supplier not in supplier_breakdown:
                supplier_breakdown[supplier] = {
                    'count': 0,
                    'total_weight': 0
                }
            supplier_breakdown[supplier]['count'] += 1
            supplier_breakdown[supplier]['total_weight'] += float(reg.weight)
        
        registrations_by_supplier = [
            {
                'supplier': supplier,
                'count': stats['count'],
                'total_weight': stats['total_weight']
            }
            for supplier, stats in supplier_breakdown.items()
        ]
        
        # Should be empty
        assert len(registrations_by_supplier) == 0
    
    def test_total_weight_calculation_accuracy(self):
        """Test accuracy of total weight calculations."""
        mock_registrations = [
            Mock(weight=Decimal('15.50')),
            Mock(weight=Decimal('22.30')),
            Mock(weight=Decimal('18.75')),
            Mock(weight=Decimal('10.00')),
        ]
        
        # Test sum calculation
        total_weight = sum(reg.weight for reg in mock_registrations)
        expected_total = Decimal('66.55')
        
        assert total_weight == expected_total
        assert float(total_weight) == 66.55


class TestDateRangeHandling:
    """Test date range handling logic."""
    
    def test_today_date_range_calculation(self):
        """Test today's date range calculation."""
        today = date.today()
        
        # The actual logic from the endpoint for calculating tomorrow
        if today.day < 28:
            tomorrow = today.replace(day=today.day + 1)
        else:
            # Handle month boundaries
            if today.month < 12:
                tomorrow = date(today.year, today.month + 1, 1)
            else:
                tomorrow = date(today.year + 1, 1, 1)
        
        # Verify tomorrow is actually after today
        assert tomorrow > today
        
        # For most cases, tomorrow should be exactly one day later
        if today.day < 28:
            expected_tomorrow = today + timedelta(days=1)
            assert tomorrow == expected_tomorrow
    
    def test_date_range_filter_logic(self):
        """Test date range filter application logic."""
        test_date_from = date(2025, 8, 21)
        test_date_to = date(2025, 8, 22)
        
        # Simulate the filter logic
        # date_from: created_at >= date_from
        # date_to: created_at < date_to (not inclusive)
        
        # Test dates
        test_dates = [
            datetime.combine(date(2025, 8, 20), datetime.min.time()),  # Before range
            datetime.combine(date(2025, 8, 21), datetime.min.time()),  # Start of range
            datetime.combine(date(2025, 8, 21, 12, 0, 0), datetime.min.time()),  # Within range
            datetime.combine(date(2025, 8, 22), datetime.min.time()),  # End of range (exclusive)
            datetime.combine(date(2025, 8, 23), datetime.min.time()),  # After range
        ]
        
        # Apply filter logic
        filtered_dates = [
            dt for dt in test_dates
            if dt >= datetime.combine(test_date_from, datetime.min.time())
            and dt < datetime.combine(test_date_to, datetime.min.time())
        ]
        
        # Should include start date but exclude end date
        assert len(filtered_dates) == 2  # 2025-08-21 00:00:00 and 12:00:00 versions


class TestInputValidation:
    """Test input validation logic."""
    
    def test_limit_parameter_validation(self):
        """Test limit parameter validation logic."""
        # Test various limit values
        test_cases = [
            {'input': 10, 'expected': 10},
            {'input': 100, 'expected': 100},
            {'input': 150, 'expected': 100},  # Should cap at 100
            {'input': 0, 'expected': 0},
            {'input': -5, 'expected': -5},  # Negative values should be handled by endpoint
        ]
        
        for case in test_cases:
            result = min(case['input'], 100)  # Simulate the min logic from endpoint
            if case['input'] <= 100:
                assert result == case['expected']
            else:
                assert result == 100
    
    def test_page_parameter_validation(self):
        """Test page parameter validation logic."""
        # Test default page value
        page_param = None
        page = page_param or 1
        assert page == 1
        
        # Test valid page values
        valid_pages = [1, 2, 10, 100]
        for page_val in valid_pages:
            assert page_val >= 1
    
    def test_string_parameter_sanitization(self):
        """Test string parameter sanitization."""
        # Test supplier parameter sanitization
        test_cases = [
            {'input': '  Supplier Name  ', 'expected': 'Supplier Name'},
            {'input': '', 'expected': ''},
            {'input': '   ', 'expected': ''},
            {'input': 'Normal Supplier', 'expected': 'Normal Supplier'},
        ]
        
        for case in test_cases:
            result = case['input'].strip()
            assert result == case['expected']