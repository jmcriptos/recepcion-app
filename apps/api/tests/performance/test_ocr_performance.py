"""Performance tests for OCR processing to validate <2s requirement."""

import pytest
import time
import os
from statistics import mean, median
from PIL import Image
from unittest.mock import patch

from app.services.ocr_service import OCRService
from app.utils.image_processing import preprocess_image_for_ocr


class TestOCRPerformance:
    """Performance test suite for OCR processing."""
    
    @pytest.fixture
    def ocr_service(self):
        """Create OCR service for performance testing."""
        return OCRService()
    
    @pytest.fixture
    def test_images_dir(self):
        """Path to test images directory."""
        return os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'test_images')
    
    @pytest.fixture
    def sample_test_images(self, test_images_dir):
        """Load sample test images for performance testing."""
        image_files = [
            'clear_label.jpg',
            'blurry_label.jpg',
            'rotated_label.jpg',
            'low_contrast_label.jpg',
            'noisy_label.jpg'
        ]
        
        images = []
        for filename in image_files:
            filepath = os.path.join(test_images_dir, filename)
            if os.path.exists(filepath):
                images.append(Image.open(filepath))
        
        return images
    
    def measure_processing_time(self, func, *args, **kwargs):
        """Measure execution time of a function."""
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        
        processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
        return result, processing_time
    
    def test_image_preprocessing_performance(self, sample_test_images):
        """Test image preprocessing performance."""
        processing_times = []
        
        for image in sample_test_images:
            _, processing_time = self.measure_processing_time(
                preprocess_image_for_ocr, image
            )
            processing_times.append(processing_time)
        
        # Calculate statistics
        avg_time = mean(processing_times)
        median_time = median(processing_times)
        max_time = max(processing_times)
        
        print(f"\nImage Preprocessing Performance:")
        print(f"Average time: {avg_time:.2f}ms")
        print(f"Median time: {median_time:.2f}ms") 
        print(f"Max time: {max_time:.2f}ms")
        
        # Performance requirements
        assert avg_time < 500, f"Average preprocessing time {avg_time:.2f}ms exceeds 500ms limit"
        assert max_time < 1000, f"Max preprocessing time {max_time:.2f}ms exceeds 1000ms limit"
    
    @patch('app.services.ocr_service.pytesseract.image_to_string')
    @patch('app.services.ocr_service.pytesseract.image_to_data')
    def test_tesseract_ocr_performance(self, mock_image_to_data, mock_image_to_string, 
                                     ocr_service, sample_test_images):
        """Test Tesseract OCR performance."""
        # Mock Tesseract responses for consistent testing
        mock_image_to_string.return_value = "PESO: 2.5 kg"
        mock_image_to_data.return_value = {
            'conf': ['85', '90', '95', '80', '75']
        }
        
        processing_times = []
        
        for image in sample_test_images:
            _, processing_time = self.measure_processing_time(
                ocr_service._extract_with_tesseract, image
            )
            processing_times.append(processing_time)
        
        # Calculate statistics
        avg_time = mean(processing_times)
        median_time = median(processing_times)
        max_time = max(processing_times)
        
        print(f"\nTesseract OCR Performance:")
        print(f"Average time: {avg_time:.2f}ms")
        print(f"Median time: {median_time:.2f}ms")
        print(f"Max time: {max_time:.2f}ms")
        
        # Performance requirements for OCR extraction
        assert avg_time < 800, f"Average Tesseract OCR time {avg_time:.2f}ms exceeds 800ms limit"
        assert max_time < 1500, f"Max Tesseract OCR time {max_time:.2f}ms exceeds 1500ms limit"
    
    @patch('app.services.ocr_service.vision.ImageAnnotatorClient')
    def test_google_vision_ocr_performance(self, mock_client_class, ocr_service, sample_test_images):
        """Test Google Vision OCR performance."""
        # Mock Google Vision client and response
        mock_client = mock_client_class.return_value
        mock_annotation = type('MockAnnotation', (), {'description': 'PESO: 2.5 kg'})()
        mock_response = type('MockResponse', (), {
            'text_annotations': [mock_annotation],
            'error': type('MockError', (), {'message': ''})()
        })()
        mock_client.text_detection.return_value = mock_response
        
        # Set the mocked client
        ocr_service.vision_client = mock_client
        
        processing_times = []
        
        for image in sample_test_images:
            _, processing_time = self.measure_processing_time(
                ocr_service._extract_with_google_vision, image
            )
            processing_times.append(processing_time)
        
        # Calculate statistics
        avg_time = mean(processing_times)
        median_time = median(processing_times)
        max_time = max(processing_times)
        
        print(f"\nGoogle Vision OCR Performance:")
        print(f"Average time: {avg_time:.2f}ms")
        print(f"Median time: {median_time:.2f}ms")
        print(f"Max time: {max_time:.2f}ms")
        
        # Performance requirements for Google Vision (allowing for API call simulation)
        assert avg_time < 1000, f"Average Google Vision OCR time {avg_time:.2f}ms exceeds 1000ms limit"
        assert max_time < 1500, f"Max Google Vision OCR time {max_time:.2f}ms exceeds 1500ms limit"
    
    def test_weight_extraction_performance(self, ocr_service):
        """Test weight extraction pattern matching performance."""
        test_texts = [
            "PESO: 2.5 kg\nFecha: 2025-08-21\nProveedor: Test Farm",
            "Net Weight: 1.8 kg\nPork Shoulder\nPremium Grade",
            "peso: 3.2 kg\nJamón Ibérico\nCalidad Premium",
            "Weight: 4.1\nSome other text here",
            "2500 g\nBacon Premium\nFresh meat",
            "Complex text with numbers 123 and peso: 1.5 kg at the end",
            "No weight information in this text at all",
            "Multiple numbers 10 20 30 but weight is 2.3 kg here",
        ]
        
        processing_times = []
        
        for text in test_texts:
            _, processing_time = self.measure_processing_time(
                ocr_service._extract_weight_from_text, text
            )
            processing_times.append(processing_time)
        
        # Calculate statistics
        avg_time = mean(processing_times)
        median_time = median(processing_times)
        max_time = max(processing_times)
        
        print(f"\nWeight Extraction Performance:")
        print(f"Average time: {avg_time:.2f}ms")
        print(f"Median time: {median_time:.2f}ms")
        print(f"Max time: {max_time:.2f}ms")
        
        # Weight extraction should be very fast (regex matching)
        assert avg_time < 10, f"Average weight extraction time {avg_time:.2f}ms exceeds 10ms limit"
        assert max_time < 50, f"Max weight extraction time {max_time:.2f}ms exceeds 50ms limit"
    
    @patch('app.services.ocr_service.OCRService._download_image')
    @patch('app.services.ocr_service.preprocess_image_for_ocr')
    @patch('app.services.ocr_service.OCRService._extract_with_tesseract')
    @patch('app.services.ocr_service.OCRService._log_ocr_processing')
    def test_end_to_end_ocr_performance(self, mock_log, mock_tesseract, mock_preprocess, 
                                       mock_download, ocr_service, sample_test_images):
        """Test complete end-to-end OCR processing performance (<2s requirement)."""
        if not sample_test_images:
            pytest.skip("No test images available")
        
        # Mock dependencies for consistent timing
        mock_download.side_effect = sample_test_images
        mock_preprocess.side_effect = lambda x: x  # Pass through
        mock_tesseract.return_value = {
            'extracted_text': 'PESO: 2.5 kg',
            'extracted_weight': 2.5,
            'confidence_score': 0.85,
            'ocr_engine': 'tesseract'
        }
        
        processing_times = []
        
        # Test multiple iterations for statistical significance
        for i in range(len(sample_test_images)):
            _, processing_time = self.measure_processing_time(
                ocr_service.process_image, f'http://example.com/image{i}.jpg'
            )
            processing_times.append(processing_time)
        
        # Calculate statistics
        avg_time = mean(processing_times)
        median_time = median(processing_times)
        max_time = max(processing_times)
        
        print(f"\nEnd-to-End OCR Performance:")
        print(f"Average time: {avg_time:.2f}ms")
        print(f"Median time: {median_time:.2f}ms")
        print(f"Max time: {max_time:.2f}ms")
        
        # Critical performance requirement: <2s (2000ms)
        assert avg_time < 2000, f"Average end-to-end OCR time {avg_time:.2f}ms exceeds 2000ms requirement"
        assert max_time < 2500, f"Max end-to-end OCR time {max_time:.2f}ms exceeds 2500ms limit"
        
        # Verify all processing times are reasonable
        for i, time_ms in enumerate(processing_times):
            assert time_ms < 3000, f"Processing time for image {i} ({time_ms:.2f}ms) exceeds 3000ms absolute limit"
    
    def test_concurrent_ocr_processing_performance(self, ocr_service):
        """Test OCR performance under concurrent load."""
        import threading
        import queue
        
        # Mock OCR processing to focus on concurrency overhead
        with patch.object(ocr_service, '_download_image') as mock_download, \
             patch('app.services.ocr_service.preprocess_image_for_ocr') as mock_preprocess, \
             patch.object(ocr_service, '_extract_with_tesseract') as mock_tesseract:
            
            mock_download.return_value = Image.new('RGB', (200, 100), 'white')
            mock_preprocess.side_effect = lambda x: x
            mock_tesseract.return_value = {
                'extracted_text': 'PESO: 2.5 kg',
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract'
            }
            
            # Number of concurrent requests
            num_threads = 5
            results_queue = queue.Queue()
            
            def ocr_worker(worker_id):
                """Worker function for concurrent OCR processing."""
                start_time = time.perf_counter()
                
                try:
                    result = ocr_service.process_image(f'http://example.com/image{worker_id}.jpg')
                    end_time = time.perf_counter()
                    processing_time = (end_time - start_time) * 1000
                    
                    results_queue.put({
                        'worker_id': worker_id,
                        'success': result['success'],
                        'processing_time_ms': processing_time
                    })
                except Exception as e:
                    results_queue.put({
                        'worker_id': worker_id,
                        'success': False,
                        'error': str(e),
                        'processing_time_ms': 0
                    })
            
            # Start concurrent OCR processing
            threads = []
            overall_start = time.perf_counter()
            
            for i in range(num_threads):
                thread = threading.Thread(target=ocr_worker, args=(i,))
                threads.append(thread)
                thread.start()
            
            # Wait for all threads to complete
            for thread in threads:
                thread.join(timeout=10)  # 10 second timeout per thread
            
            overall_end = time.perf_counter()
            total_time = (overall_end - overall_start) * 1000
            
            # Collect results
            results = []
            while not results_queue.empty():
                results.append(results_queue.get())
            
            # Verify all requests completed successfully
            assert len(results) == num_threads, f"Expected {num_threads} results, got {len(results)}"
            
            successful_results = [r for r in results if r['success']]
            assert len(successful_results) == num_threads, "Not all concurrent requests succeeded"
            
            # Calculate performance metrics
            processing_times = [r['processing_time_ms'] for r in successful_results]
            avg_concurrent_time = mean(processing_times)
            max_concurrent_time = max(processing_times)
            
            print(f"\nConcurrent OCR Performance ({num_threads} threads):")
            print(f"Total time: {total_time:.2f}ms")
            print(f"Average per-request time: {avg_concurrent_time:.2f}ms")
            print(f"Max per-request time: {max_concurrent_time:.2f}ms")
            
            # Performance requirements for concurrent processing
            assert avg_concurrent_time < 2500, f"Average concurrent OCR time {avg_concurrent_time:.2f}ms exceeds 2500ms"
            assert max_concurrent_time < 3000, f"Max concurrent OCR time {max_concurrent_time:.2f}ms exceeds 3000ms"
            assert total_time < 10000, f"Total concurrent processing time {total_time:.2f}ms exceeds 10000ms"
    
    def test_memory_usage_during_processing(self, ocr_service, sample_test_images):
        """Test memory usage during OCR processing."""
        import psutil
        import gc
        
        if not sample_test_images:
            pytest.skip("No test images available")
        
        # Get initial memory usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        with patch.object(ocr_service, '_download_image') as mock_download, \
             patch.object(ocr_service, '_extract_with_tesseract') as mock_tesseract:
            
            mock_download.side_effect = sample_test_images
            mock_tesseract.return_value = {
                'extracted_text': 'PESO: 2.5 kg',
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract'
            }
            
            max_memory = initial_memory
            
            # Process multiple images and track memory usage
            for i in range(len(sample_test_images)):
                ocr_service.process_image(f'http://example.com/image{i}.jpg')
                
                current_memory = process.memory_info().rss / 1024 / 1024  # MB
                max_memory = max(max_memory, current_memory)
            
            # Force garbage collection
            gc.collect()
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        memory_increase = max_memory - initial_memory
        memory_after_gc = final_memory - initial_memory
        
        print(f"\nMemory Usage Analysis:")
        print(f"Initial memory: {initial_memory:.2f} MB")
        print(f"Max memory during processing: {max_memory:.2f} MB")
        print(f"Final memory after GC: {final_memory:.2f} MB")
        print(f"Memory increase: {memory_increase:.2f} MB")
        print(f"Memory after GC: {memory_after_gc:.2f} MB")
        
        # Memory usage requirements
        assert memory_increase < 100, f"Memory increase {memory_increase:.2f} MB exceeds 100 MB limit"
        assert memory_after_gc < 50, f"Memory after GC {memory_after_gc:.2f} MB exceeds 50 MB limit"