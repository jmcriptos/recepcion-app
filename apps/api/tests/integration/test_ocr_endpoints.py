"""Integration tests for OCR API endpoints."""

import pytest
import os
import tempfile
from io import BytesIO
from PIL import Image
from unittest.mock import patch, Mock
from decimal import Decimal

from app.models.registration import WeightRegistration
from app.models.user import User
from app.models.ocr_log import OCRProcessingLog
from app.models import db


class TestOCREndpoints:
    """Test suite for OCR API endpoints integration."""
    
    @pytest.fixture
    def logged_in_user(self, client, app_with_db):
        """Create and log in a test user."""
        with app_with_db.app_context():
            user = User(name="Test Operator", role="operator")
            db.session.add(user)
            db.session.commit()
            
            # Simulate logged in session
            with client.session_transaction() as sess:
                sess['user_id'] = str(user.id)
                sess['user_name'] = user.name
                sess['user_role'] = user.role
            
            return user
    
    @pytest.fixture
    def sample_registration(self, app_with_db, logged_in_user):
        """Create a sample weight registration."""
        with app_with_db.app_context():
            registration = WeightRegistration(
                weight=Decimal('0.0'),  # Will be updated by OCR
                cut_type='jamón',
                supplier='Test Supplier',
                registered_by=logged_in_user.id
            )
            db.session.add(registration)
            db.session.commit()
            return registration
    
    @pytest.fixture
    def sample_image_file(self):
        """Create a sample image file for testing."""
        # Create a simple test image
        img = Image.new('RGB', (200, 100), 'white')
        
        # Add some text-like patterns
        pixels = img.load()
        # Draw simple "2.5 kg" pattern
        for i in range(50, 150):
            for j in range(40, 60):
                pixels[i, j] = (0, 0, 0)  # Black pixels
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, format='PNG')
        img_io.seek(0)
        
        return img_io
    
    def test_process_image_endpoint_success(self, client, logged_in_user, sample_image_file):
        """Test successful OCR image processing endpoint."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1500,
                'extracted_text': 'PESO: 2.5 kg'
            }
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 200
            
            json_data = response.get_json()
            assert json_data['success'] is True
            assert json_data['extracted_weight'] == 2.5
            assert json_data['confidence_score'] == 0.85
            assert json_data['ocr_engine'] == 'tesseract'
            assert json_data['processing_time_ms'] == 1500
    
    def test_process_image_endpoint_with_registration_update(self, client, logged_in_user, 
                                                           sample_registration, sample_image_file, app_with_db):
        """Test OCR endpoint updates registration confidence."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 3.2,
                'confidence_score': 0.92,
                'ocr_engine': 'google_vision',
                'processing_time_ms': 1200,
                'extracted_text': 'PESO: 3.2 kg'
            }
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png'),
                'registration_id': str(sample_registration.id)
            })
            
            assert response.status_code == 200
            
            # Verify registration was updated
            with app_with_db.app_context():
                updated_registration = WeightRegistration.query.get(sample_registration.id)
                assert updated_registration.ocr_confidence == Decimal('0.92')
    
    def test_process_image_endpoint_unauthorized(self, client, sample_image_file):
        """Test OCR endpoint without authentication."""
        response = client.post('/api/v1/ocr/process-image', data={
            'image': (sample_image_file, 'test_image.png')
        })
        
        assert response.status_code == 401
        
        json_data = response.get_json()
        assert 'Authentication required' in json_data['error']
    
    def test_process_image_endpoint_no_file(self, client, logged_in_user):
        """Test OCR endpoint without image file."""
        response = client.post('/api/v1/ocr/process-image')
        
        assert response.status_code == 400
        
        json_data = response.get_json()
        assert 'No image file provided' in json_data['error']
    
    def test_process_image_endpoint_empty_filename(self, client, logged_in_user):
        """Test OCR endpoint with empty filename."""
        response = client.post('/api/v1/ocr/process-image', data={
            'image': (BytesIO(b'fake_image'), '')  # Empty filename
        })
        
        assert response.status_code == 400
        
        json_data = response.get_json()
        assert 'No file selected' in json_data['error']
    
    def test_process_image_endpoint_invalid_file_type(self, client, logged_in_user):
        """Test OCR endpoint with invalid file type."""
        text_file = BytesIO(b'This is not an image')
        
        response = client.post('/api/v1/ocr/process-image', data={
            'image': (text_file, 'test.txt')
        })
        
        assert response.status_code == 400
        
        json_data = response.get_json()
        assert 'File type not allowed' in json_data['error']
        assert 'png, jpg, jpeg' in json_data['error']
    
    def test_process_image_endpoint_file_too_large(self, client, logged_in_user):
        """Test OCR endpoint with file too large."""
        with patch('flask.request.content_length', 12 * 1024 * 1024):  # 12MB
            large_file = BytesIO(b'x' * 1000)  # Mock large file
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (large_file, 'large_image.png')
            })
            
            assert response.status_code == 413
            
            json_data = response.get_json()
            assert 'File too large' in json_data['error']
            assert '10MB' in json_data['error']
    
    def test_process_image_endpoint_rate_limiting(self, client, logged_in_user, sample_image_file):
        """Test OCR endpoint rate limiting."""
        with patch('app.routes.ocr.check_rate_limit') as mock_rate_limit:
            mock_rate_limit.return_value = False  # Rate limit exceeded
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 429
            
            json_data = response.get_json()
            assert 'Rate limit exceeded' in json_data['error']
            assert '10 requests per minute' in json_data['error']
    
    def test_process_image_endpoint_ocr_processing_failure(self, client, logged_in_user, sample_image_file):
        """Test OCR endpoint when processing fails."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': False,
                'extracted_weight': None,
                'confidence_score': 0.0,
                'ocr_engine': 'error',
                'processing_time_ms': 800,
                'error': 'Failed to download image'
            }
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 400
            
            json_data = response.get_json()
            assert json_data['success'] is False
            assert 'Failed to download image' in json_data['error']
            assert json_data['processing_time_ms'] == 800
    
    def test_process_image_endpoint_internal_server_error(self, client, logged_in_user, sample_image_file):
        """Test OCR endpoint internal server error handling."""
        with patch('app.routes.ocr.validate_image_request') as mock_validate:
            mock_validate.side_effect = Exception("Unexpected error")
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 500
            
            json_data = response.get_json()
            assert 'Internal server error' in json_data['error']
            assert json_data['success'] is False
    
    def test_process_image_endpoint_creates_ocr_log(self, client, logged_in_user, 
                                                   sample_registration, sample_image_file, app_with_db):
        """Test that OCR endpoint creates processing log."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 1.8,
                'confidence_score': 0.75,
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1800,
                'extracted_text': 'peso: 1.8 kg'
            }
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png'),
                'registration_id': str(sample_registration.id)
            })
            
            assert response.status_code == 200
            
            # Verify OCR log was created
            with app_with_db.app_context():
                ocr_logs = OCRProcessingLog.query.filter_by(
                    registration_id=sample_registration.id
                ).all()
                
                # Should have at least one log entry
                assert len(ocr_logs) > 0
    
    def test_process_image_endpoint_temp_file_cleanup(self, client, logged_in_user, sample_image_file):
        """Test that temporary files are cleaned up."""
        temp_files_created = []
        
        # Mock file.save to track created files
        original_save = sample_image_file.save
        def mock_save(filepath):
            temp_files_created.append(filepath)
            with open(filepath, 'wb') as f:
                f.write(b'fake image data')
        
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 2.0,
                'confidence_score': 0.80,
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1400,
                'extracted_text': '2.0 kg'
            }
            
            # Patch the save method
            sample_image_file.save = mock_save
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 200
            
            # Verify temp files were cleaned up
            for temp_file in temp_files_created:
                assert not os.path.exists(temp_file), f"Temp file {temp_file} was not cleaned up"
    
    def test_ocr_health_endpoint(self, client):
        """Test OCR service health check endpoint."""
        with patch('app.routes.ocr.ocr_service') as mock_service:
            mock_service.vision_client = Mock()  # Google Vision available
            
            response = client.get('/api/v1/ocr/health')
            
            assert response.status_code == 200
            
            json_data = response.get_json()
            assert json_data['status'] == 'healthy'
            assert json_data['tesseract_available'] is True
            assert json_data['google_vision_available'] is True
    
    def test_ocr_health_endpoint_google_vision_unavailable(self, client):
        """Test OCR health endpoint when Google Vision is unavailable."""
        with patch('app.routes.ocr.ocr_service') as mock_service:
            mock_service.vision_client = None  # Google Vision not available
            
            response = client.get('/api/v1/ocr/health')
            
            assert response.status_code == 200
            
            json_data = response.get_json()
            assert json_data['status'] == 'healthy'
            assert json_data['tesseract_available'] is True
            assert json_data['google_vision_available'] is False
    
    def test_ocr_health_endpoint_error(self, client):
        """Test OCR health endpoint error handling."""
        with patch('app.routes.ocr.ocr_service') as mock_service:
            mock_service.vision_client = Mock()
            # Make accessing vision_client raise an exception
            type(mock_service).vision_client = property(lambda x: exec('raise Exception("Health check failed")'))
            
            response = client.get('/api/v1/ocr/health')
            
            assert response.status_code == 500
            
            json_data = response.get_json()
            assert json_data['status'] == 'unhealthy'
            assert 'error' in json_data
    
    def test_ocr_response_headers(self, client, logged_in_user, sample_image_file):
        """Test OCR endpoints add proper response headers."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1500,
                'extracted_text': 'PESO: 2.5 kg'
            }
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            assert response.status_code == 200
            
            # Check custom headers
            assert response.headers.get('X-OCR-Service') == 'tesseract-google-vision'
            assert response.headers.get('X-Rate-Limit') == '10-per-minute'
    
    def test_process_image_endpoint_performance_timing(self, client, logged_in_user, sample_image_file):
        """Test that OCR endpoint tracks processing performance."""
        with patch('app.services.ocr_service.OCRService.process_image') as mock_process:
            # Simulate processing that takes some time
            mock_process.return_value = {
                'success': True,
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1750,  # Specific timing
                'extracted_text': 'PESO: 2.5 kg'
            }
            
            import time
            start_time = time.time()
            
            response = client.post('/api/v1/ocr/process-image', data={
                'image': (sample_image_file, 'test_image.png')
            })
            
            end_time = time.time()
            
            assert response.status_code == 200
            
            json_data = response.get_json()
            assert 'processing_time_ms' in json_data
            assert json_data['processing_time_ms'] == 1750
            
            # Verify total request time is reasonable
            total_time_ms = (end_time - start_time) * 1000
            assert total_time_ms < 5000  # Should complete within 5 seconds