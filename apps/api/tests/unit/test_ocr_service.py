"""Unit tests for OCR service components."""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from PIL import Image
import numpy as np

from app.services.ocr_service import OCRService


class TestOCRService:
    """Test suite for OCR service functionality."""
    
    @pytest.fixture
    def ocr_service(self):
        """Create OCR service instance for testing."""
        return OCRService()
    
    @pytest.fixture
    def mock_image(self):
        """Create a mock PIL Image for testing."""
        # Create a simple 100x100 white image
        return Image.new('RGB', (100, 100), 'white')
    
    @pytest.fixture
    def sample_weight_text(self):
        """Sample OCR text containing weight information."""
        return "PESO: 2.5 kg\nFecha: 2025-08-21\nProveedor: Test"
    
    def test_initialization(self, ocr_service):
        """Test OCR service initialization."""
        assert ocr_service.tesseract_config == '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789.,KkGg'
        assert hasattr(ocr_service, 'vision_client')
    
    def test_weight_extraction_with_kg_unit(self, ocr_service):
        """Test weight extraction with kg unit."""
        text = "PESO: 2.5 kg"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 2.5
    
    def test_weight_extraction_with_g_unit(self, ocr_service):
        """Test weight extraction with g unit (should convert to kg)."""
        text = "PESO: 2500 g"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 2.5
    
    def test_weight_extraction_with_k_abbreviation(self, ocr_service):
        """Test weight extraction with k abbreviation."""
        text = "2.3 k"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 2.3
    
    def test_weight_extraction_spanish_peso_label(self, ocr_service):
        """Test weight extraction with Spanish 'peso' label."""
        text = "peso: 1.8"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 1.8
    
    def test_weight_extraction_english_weight_label(self, ocr_service):
        """Test weight extraction with English 'weight' label."""
        text = "weight: 3.2"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 3.2
    
    def test_weight_extraction_fallback_to_numbers(self, ocr_service):
        """Test weight extraction fallback to any valid number."""
        text = "Some text 1.5 other text"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight == 1.5
    
    def test_weight_extraction_out_of_range_rejected(self, ocr_service):
        """Test that weights outside valid range are rejected."""
        # Too small
        text = "0.05 kg"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight is None
        
        # Too large
        text = "100 kg"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight is None
    
    def test_weight_extraction_no_weight_found(self, ocr_service):
        """Test behavior when no weight is found in text."""
        text = "Some random text without weights"
        weight = ocr_service._extract_weight_from_text(text)
        assert weight is None
    
    def test_weight_validation_valid_range(self, ocr_service):
        """Test weight validation for valid range."""
        assert ocr_service._validate_weight_value(0.1) == 0.1
        assert ocr_service._validate_weight_value(25.0) == 25.0
        assert ocr_service._validate_weight_value(50.0) == 50.0
    
    def test_weight_validation_invalid_range(self, ocr_service):
        """Test weight validation for invalid range."""
        assert ocr_service._validate_weight_value(0.05) is None
        assert ocr_service._validate_weight_value(55.0) is None
    
    def test_weight_validation_rounding(self, ocr_service):
        """Test weight validation rounds to 2 decimal places."""
        assert ocr_service._validate_weight_value(2.56789) == 2.57
    
    @patch('app.services.ocr_service.requests.get')
    def test_download_image_remote_url(self, mock_get, ocr_service, mock_image):
        """Test downloading image from remote URL."""
        # Mock successful HTTP response
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.content = b'fake_image_data'
        mock_get.return_value = mock_response
        
        with patch('app.services.ocr_service.Image.open') as mock_open:
            mock_open.return_value = mock_image
            result = ocr_service._download_image('http://example.com/image.jpg')
            assert result == mock_image
            mock_get.assert_called_once_with('http://example.com/image.jpg', timeout=10)
    
    @patch('app.services.ocr_service.Image.open')
    def test_download_image_local_file(self, mock_open, ocr_service, mock_image):
        """Test loading image from local file URL."""
        mock_open.return_value = mock_image
        result = ocr_service._download_image('file:///tmp/test.jpg')
        assert result == mock_image
        mock_open.assert_called_once_with('/tmp/test.jpg')
    
    @patch('app.services.ocr_service.requests.get')
    def test_download_image_failure(self, mock_get, ocr_service):
        """Test image download failure handling."""
        mock_get.side_effect = Exception("Network error")
        
        with pytest.raises(ValueError, match="Failed to load image"):
            ocr_service._download_image('http://example.com/image.jpg')
    
    @patch('app.services.ocr_service.pytesseract.image_to_string')
    @patch('app.services.ocr_service.pytesseract.image_to_data')
    def test_extract_with_tesseract_success(self, mock_image_to_data, mock_image_to_string, 
                                          ocr_service, mock_image, sample_weight_text):
        """Test successful Tesseract OCR extraction."""
        mock_image_to_string.return_value = sample_weight_text
        mock_image_to_data.return_value = {
            'conf': ['85', '90', '95', '80', '75']
        }
        
        result = ocr_service._extract_with_tesseract(mock_image)
        
        assert result['extracted_text'] == sample_weight_text.strip()
        assert result['extracted_weight'] == 2.5
        assert result['confidence_score'] == 0.85  # Average of confidences / 100
        assert result['ocr_engine'] == 'tesseract'
    
    @patch('app.services.ocr_service.pytesseract.image_to_string')
    def test_extract_with_tesseract_failure(self, mock_image_to_string, ocr_service, mock_image):
        """Test Tesseract OCR extraction failure."""
        mock_image_to_string.side_effect = Exception("Tesseract error")
        
        result = ocr_service._extract_with_tesseract(mock_image)
        
        assert result['extracted_text'] == ""
        assert result['extracted_weight'] is None
        assert result['confidence_score'] == 0.0
        assert result['ocr_engine'] == 'tesseract'
    
    @patch('app.services.ocr_service.vision.ImageAnnotatorClient')
    def test_extract_with_google_vision_success(self, mock_client_class, ocr_service, 
                                               mock_image, sample_weight_text):
        """Test successful Google Vision OCR extraction."""
        # Mock Google Vision client and response
        mock_client = Mock()
        mock_client_class.return_value = mock_client
        
        mock_annotation = Mock()
        mock_annotation.description = sample_weight_text
        
        mock_response = Mock()
        mock_response.text_annotations = [mock_annotation]
        mock_response.error.message = ""
        
        mock_client.text_detection.return_value = mock_response
        
        # Reinitialize service to use mocked client
        ocr_service.vision_client = mock_client
        
        result = ocr_service._extract_with_google_vision(mock_image)
        
        assert result['extracted_text'] == sample_weight_text.strip()
        assert result['extracted_weight'] == 2.5
        assert result['confidence_score'] == 0.85
        assert result['ocr_engine'] == 'google_vision'
    
    def test_extract_with_google_vision_no_client(self, ocr_service, mock_image):
        """Test Google Vision extraction when client is unavailable."""
        ocr_service.vision_client = None
        
        result = ocr_service._extract_with_google_vision(mock_image)
        
        assert result['extracted_text'] == ""
        assert result['extracted_weight'] is None
        assert result['confidence_score'] == 0.0
        assert result['ocr_engine'] == 'google_vision'
    
    @patch('app.services.ocr_service.OCRProcessingLog')
    @patch('app.services.ocr_service.db.session')
    def test_log_ocr_processing_success(self, mock_session, mock_ocr_log, ocr_service):
        """Test successful OCR processing logging."""
        mock_log_instance = Mock()
        mock_ocr_log.return_value = mock_log_instance
        
        ocr_service._log_ocr_processing(
            registration_id='test-id',
            extracted_text='test text',
            confidence_score=0.85,
            processing_time_ms=1500,
            ocr_engine='tesseract'
        )
        
        mock_ocr_log.assert_called_once_with(
            registration_id='test-id',
            extracted_text='test text',
            confidence_score=0.85,
            processing_time_ms=1500,
            ocr_engine='tesseract'
        )
        mock_session.add.assert_called_once_with(mock_log_instance)
        mock_session.commit.assert_called_once()
    
    @patch('app.services.ocr_service.OCRProcessingLog')
    @patch('app.services.ocr_service.db.session')
    def test_log_ocr_processing_failure(self, mock_session, mock_ocr_log, ocr_service):
        """Test OCR processing logging failure handling."""
        mock_session.commit.side_effect = Exception("Database error")
        
        # Should not raise exception, just log error
        ocr_service._log_ocr_processing(
            registration_id='test-id',
            extracted_text='test text',
            confidence_score=0.85,
            processing_time_ms=1500,
            ocr_engine='tesseract'
        )
        
        mock_session.rollback.assert_called_once()
    
    @patch('app.services.ocr_service.OCRService._download_image')
    @patch('app.services.ocr_service.preprocess_image_for_ocr')
    @patch('app.services.ocr_service.OCRService._extract_with_tesseract')
    @patch('app.services.ocr_service.OCRService._log_ocr_processing')
    def test_process_image_tesseract_high_confidence(self, mock_log, mock_tesseract, 
                                                   mock_preprocess, mock_download, 
                                                   ocr_service, mock_image):
        """Test image processing with high Tesseract confidence."""
        mock_download.return_value = mock_image
        mock_preprocess.return_value = mock_image
        mock_tesseract.return_value = {
            'extracted_text': 'PESO: 2.5 kg',
            'extracted_weight': 2.5,
            'confidence_score': 0.85,
            'ocr_engine': 'tesseract'
        }
        
        result = ocr_service.process_image('http://example.com/image.jpg', 'test-reg-id')
        
        assert result['success'] is True
        assert result['extracted_weight'] == 2.5
        assert result['confidence_score'] == 0.85
        assert result['ocr_engine'] == 'tesseract'
        assert 'processing_time_ms' in result
        
        mock_log.assert_called_once()
    
    @patch('app.services.ocr_service.OCRService._download_image')
    @patch('app.services.ocr_service.preprocess_image_for_ocr')
    @patch('app.services.ocr_service.OCRService._extract_with_tesseract')
    @patch('app.services.ocr_service.OCRService._extract_with_google_vision')
    @patch('app.services.ocr_service.OCRService._log_ocr_processing')
    def test_process_image_fallback_to_google_vision(self, mock_log, mock_google, 
                                                   mock_tesseract, mock_preprocess, 
                                                   mock_download, ocr_service, mock_image):
        """Test image processing fallback to Google Vision for low confidence."""
        mock_download.return_value = mock_image
        mock_preprocess.return_value = mock_image
        
        # Low confidence Tesseract result
        mock_tesseract.return_value = {
            'extracted_text': 'unclear text',
            'extracted_weight': None,
            'confidence_score': 0.3,
            'ocr_engine': 'tesseract'
        }
        
        # Higher confidence Google Vision result
        mock_google.return_value = {
            'extracted_text': 'PESO: 3.2 kg',
            'extracted_weight': 3.2,
            'confidence_score': 0.85,
            'ocr_engine': 'google_vision'
        }
        
        result = ocr_service.process_image('http://example.com/image.jpg', 'test-reg-id')
        
        assert result['success'] is True
        assert result['extracted_weight'] == 3.2
        assert result['confidence_score'] == 0.85
        assert result['ocr_engine'] == 'google_vision'
        
        mock_google.assert_called_once()
        mock_log.assert_called_once()
    
    @patch('app.services.ocr_service.OCRService._download_image')
    def test_process_image_failure(self, mock_download, ocr_service):
        """Test image processing failure handling."""
        mock_download.side_effect = Exception("Download failed")
        
        result = ocr_service.process_image('http://example.com/image.jpg', 'test-reg-id')
        
        assert result['success'] is False
        assert result['extracted_weight'] is None
        assert result['confidence_score'] == 0.0
        assert result['ocr_engine'] == 'error'
        assert 'error' in result
        assert 'processing_time_ms' in result
    
    def test_performance_timing(self, ocr_service):
        """Test that processing time is tracked."""
        with patch.object(ocr_service, '_download_image') as mock_download, \
             patch('app.services.ocr_service.preprocess_image_for_ocr') as mock_preprocess, \
             patch.object(ocr_service, '_extract_with_tesseract') as mock_tesseract:
            
            mock_download.return_value = Image.new('RGB', (100, 100), 'white')
            mock_preprocess.return_value = Image.new('RGB', (100, 100), 'white')
            mock_tesseract.return_value = {
                'extracted_text': 'PESO: 2.5 kg',
                'extracted_weight': 2.5,
                'confidence_score': 0.85,
                'ocr_engine': 'tesseract'
            }
            
            start_time = time.time()
            result = ocr_service.process_image('http://example.com/image.jpg')
            end_time = time.time()
            
            # Processing time should be reasonable and recorded
            assert 'processing_time_ms' in result
            assert result['processing_time_ms'] >= 0
            assert result['processing_time_ms'] <= (end_time - start_time) * 1000 + 100  # Allow some margin