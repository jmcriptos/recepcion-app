"""Performance tests for registration listing endpoints with large datasets."""
import pytest
import time
from datetime import datetime, date, timedelta
from decimal import Decimal
from statistics import mean, median
from app.models.registration import WeightRegistration
from app.models.user import User
from app.models import db


class TestRegistrationListingPerformance:
    """Performance test suite for registration listing operations."""
    
    @pytest.fixture
    def performance_user(self, app_with_db):
        """Create a user for performance testing."""
        with app_with_db.app_context():
            user = User(name="Performance Test User", role="supervisor")
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def large_registration_dataset(self, app_with_db, performance_user):
        """Create a large dataset of registrations for performance testing."""
        with app_with_db.app_context():
            suppliers = [
                'Proveedor Cárnico Alpha',
                'Distribuidora Beta',
                'Carnes Premium Gamma',
                'Suministros Delta',
                'Procesadora Epsilon',
                'Industrial Zeta',
                'Comercial Eta',
                'Alimentos Theta'
            ]
            cut_types = ['jamón', 'chuleta']
            
            registrations = []
            base_date = datetime.now() - timedelta(days=30)
            
            # Create 1000 registrations over the last 30 days
            for i in range(1000):
                reg = WeightRegistration(
                    weight=Decimal('10.0') + Decimal(str(i % 40)),  # Weights between 10-50kg
                    cut_type=cut_types[i % 2],
                    supplier=suppliers[i % len(suppliers)],
                    registered_by=performance_user.id,
                    created_at=base_date + timedelta(hours=i % 720),  # Spread over 30 days
                    ocr_confidence=Decimal('0.7') + Decimal('0.3') * (i % 10) / 10  # 0.7-1.0
                )
                registrations.append(reg)
                
                # Batch insert every 200 records for better performance
                if len(registrations) >= 200:
                    db.session.bulk_save_objects(registrations)
                    registrations = []
            
            # Insert any remaining records
            if registrations:
                db.session.bulk_save_objects(registrations)
            
            db.session.commit()
            
            print(f"Created {1000} registrations for performance testing")
    
    def measure_endpoint_performance(self, client, endpoint, iterations=5):
        """Measure endpoint performance over multiple iterations."""
        times = []
        
        for _ in range(iterations):
            start_time = time.perf_counter()
            response = client.get(endpoint)
            end_time = time.perf_counter()
            
            assert response.status_code == 200
            times.append((end_time - start_time) * 1000)  # Convert to milliseconds
        
        return {
            'avg_time_ms': mean(times),
            'median_time_ms': median(times),
            'min_time_ms': min(times),
            'max_time_ms': max(times),
            'all_times': times
        }
    
    def test_list_registrations_basic_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test basic listing performance with large dataset."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Test default pagination
        results = self.measure_endpoint_performance(client, '/api/v1/registrations')
        
        print(f"\nList Registrations Basic Performance:")
        print(f"Average time: {results['avg_time_ms']:.2f}ms")
        print(f"Median time: {results['median_time_ms']:.2f}ms")
        print(f"Min time: {results['min_time_ms']:.2f}ms")
        print(f"Max time: {results['max_time_ms']:.2f}ms")
        
        # Performance requirements
        assert results['avg_time_ms'] < 1000, f"Average response time {results['avg_time_ms']:.2f}ms exceeds 1000ms limit"
        assert results['max_time_ms'] < 2000, f"Max response time {results['max_time_ms']:.2f}ms exceeds 2000ms limit"
    
    def test_list_registrations_with_filters_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test listing performance with various filters applied."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Test supplier filter
        supplier_results = self.measure_endpoint_performance(
            client, '/api/v1/registrations?supplier=Alpha'
        )
        
        # Test cut type filter
        cut_type_results = self.measure_endpoint_performance(
            client, '/api/v1/registrations?cut_type=jamón'
        )
        
        # Test date range filter
        date_from = (datetime.now() - timedelta(days=7)).date().isoformat()
        date_to = datetime.now().date().isoformat()
        date_filter_results = self.measure_endpoint_performance(
            client, f'/api/v1/registrations?date_from={date_from}&date_to={date_to}'
        )
        
        # Test combined filters
        combined_results = self.measure_endpoint_performance(
            client, f'/api/v1/registrations?supplier=Alpha&cut_type=jamón&date_from={date_from}'
        )
        
        print(f"\nFiltered Queries Performance:")
        print(f"Supplier filter - Avg: {supplier_results['avg_time_ms']:.2f}ms")
        print(f"Cut type filter - Avg: {cut_type_results['avg_time_ms']:.2f}ms")
        print(f"Date range filter - Avg: {date_filter_results['avg_time_ms']:.2f}ms")
        print(f"Combined filters - Avg: {combined_results['avg_time_ms']:.2f}ms")
        
        # All filtered queries should still be fast
        all_results = [supplier_results, cut_type_results, date_filter_results, combined_results]
        for result in all_results:
            assert result['avg_time_ms'] < 1500, f"Filtered query avg time {result['avg_time_ms']:.2f}ms too slow"
    
    def test_pagination_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test pagination performance across different pages."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Test different pages and limits
        test_cases = [
            ('page=1&limit=20', 'First page, small limit'),
            ('page=1&limit=100', 'First page, large limit'),
            ('page=5&limit=20', 'Middle page, small limit'),
            ('page=10&limit=50', 'Later page, medium limit'),
        ]
        
        for query_params, description in test_cases:
            results = self.measure_endpoint_performance(
                client, f'/api/v1/registrations?{query_params}'
            )
            
            print(f"\n{description}: {results['avg_time_ms']:.2f}ms avg")
            
            # Even later pages should be reasonably fast
            assert results['avg_time_ms'] < 1500, f"{description} too slow: {results['avg_time_ms']:.2f}ms"
    
    def test_today_registrations_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test today's registrations endpoint performance."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        results = self.measure_endpoint_performance(client, '/api/v1/registrations/today')
        
        print(f"\nToday Registrations Performance:")
        print(f"Average time: {results['avg_time_ms']:.2f}ms")
        print(f"Median time: {results['median_time_ms']:.2f}ms")
        
        # Today endpoint should be very fast since it's a smaller dataset
        assert results['avg_time_ms'] < 500, f"Today endpoint avg time {results['avg_time_ms']:.2f}ms too slow"
        assert results['max_time_ms'] < 1000, f"Today endpoint max time {results['max_time_ms']:.2f}ms too slow"
    
    def test_supplier_breakdown_calculation_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test performance of supplier breakdown calculations."""
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Measure time spent on requests with supplier breakdown
        start_time = time.perf_counter()
        response = client.get('/api/v1/registrations')
        end_time = time.perf_counter()
        
        assert response.status_code == 200
        processing_time = (end_time - start_time) * 1000
        
        data = response.get_json()
        supplier_breakdown = data['registrations_by_supplier']
        
        print(f"\nSupplier Breakdown Performance:")
        print(f"Processing time: {processing_time:.2f}ms")
        print(f"Number of suppliers: {len(supplier_breakdown)}")
        print(f"Time per supplier: {processing_time / len(supplier_breakdown):.2f}ms")
        
        # Verify accuracy of calculations
        total_from_breakdown = sum(supplier['total_weight'] for supplier in supplier_breakdown)
        total_from_response = data['total_weight']
        
        # Should be accurate within floating point precision
        assert abs(total_from_breakdown - total_from_response) < 0.01, "Supplier breakdown calculation inaccurate"
        
        # Performance should scale well with number of suppliers
        assert processing_time < 2000, f"Supplier breakdown calculation too slow: {processing_time:.2f}ms"
    
    def test_memory_usage_during_large_queries(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test memory usage during large query processing."""
        import psutil
        import os
        
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Execute several queries
        endpoints = [
            '/api/v1/registrations',
            '/api/v1/registrations?limit=100',
            '/api/v1/registrations/today',
            '/api/v1/registrations?supplier=Alpha',
        ]
        
        max_memory = initial_memory
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            
            current_memory = process.memory_info().rss / 1024 / 1024
            max_memory = max(max_memory, current_memory)
        
        memory_increase = max_memory - initial_memory
        
        print(f"\nMemory Usage Analysis:")
        print(f"Initial memory: {initial_memory:.2f} MB")
        print(f"Max memory during queries: {max_memory:.2f} MB")
        print(f"Memory increase: {memory_increase:.2f} MB")
        
        # Memory usage should be reasonable
        assert memory_increase < 50, f"Memory increase {memory_increase:.2f} MB too high"
    
    def test_concurrent_request_performance(self, client, app_with_db, performance_user, large_registration_dataset):
        """Test performance under simulated concurrent requests."""
        import threading
        import queue
        
        with client.session_transaction() as sess:
            sess['user_id'] = str(performance_user.id)
            sess['user_name'] = performance_user.name
            sess['user_role'] = performance_user.role
        
        # Number of simulated concurrent requests
        num_requests = 5
        results_queue = queue.Queue()
        
        def make_request(request_id):
            """Worker function to make API requests."""
            start_time = time.perf_counter()
            try:
                response = client.get('/api/v1/registrations?limit=50')
                end_time = time.perf_counter()
                
                results_queue.put({
                    'request_id': request_id,
                    'success': response.status_code == 200,
                    'time_ms': (end_time - start_time) * 1000
                })
            except Exception as e:
                results_queue.put({
                    'request_id': request_id,
                    'success': False,
                    'error': str(e),
                    'time_ms': 0
                })
        
        # Start concurrent requests
        threads = []
        overall_start = time.perf_counter()
        
        for i in range(num_requests):
            thread = threading.Thread(target=make_request, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all requests to complete
        for thread in threads:
            thread.join(timeout=10)  # 10 second timeout
        
        overall_end = time.perf_counter()
        total_time = (overall_end - overall_start) * 1000
        
        # Collect results
        results = []
        while not results_queue.empty():
            results.append(results_queue.get())
        
        successful_results = [r for r in results if r['success']]
        
        print(f"\nConcurrent Request Performance ({num_requests} requests):")
        print(f"Total time: {total_time:.2f}ms")
        print(f"Successful requests: {len(successful_results)}/{num_requests}")
        
        if successful_results:
            avg_time = mean([r['time_ms'] for r in successful_results])
            max_time = max([r['time_ms'] for r in successful_results])
            
            print(f"Average request time: {avg_time:.2f}ms")
            print(f"Max request time: {max_time:.2f}ms")
            
            # All requests should complete successfully
            assert len(successful_results) == num_requests, "Not all concurrent requests succeeded"
            
            # Performance should be reasonable even under concurrent load
            assert avg_time < 2000, f"Concurrent request avg time {avg_time:.2f}ms too slow"
            assert total_time < 5000, f"Total concurrent processing time {total_time:.2f}ms too slow"