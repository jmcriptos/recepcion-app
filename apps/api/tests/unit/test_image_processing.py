"""Unit tests for image preprocessing utilities."""

import pytest
import numpy as np
from PIL import Image
from unittest.mock import patch, Mock
import cv2

from app.utils.image_processing import (
    preprocess_image_for_ocr,
    enhance_contrast,
    adjust_brightness,
    correct_rotation,
    reduce_noise,
    sharpen_image,
    resize_for_ocr,
    convert_to_binary
)


class TestImageProcessing:
    """Test suite for image preprocessing utilities."""
    
    @pytest.fixture
    def sample_pil_image(self):
        """Create a sample PIL Image for testing."""
        return Image.new('RGB', (200, 100), 'white')
    
    @pytest.fixture
    def sample_cv_image(self):
        """Create a sample OpenCV image for testing."""
        return np.ones((100, 200, 3), dtype=np.uint8) * 128  # Gray image
    
    @pytest.fixture
    def sample_grayscale_image(self):
        """Create a sample grayscale OpenCV image for testing."""
        return np.ones((100, 200), dtype=np.uint8) * 128
    
    def test_preprocess_image_for_ocr_success(self, sample_pil_image):
        """Test complete image preprocessing pipeline."""
        with patch('app.utils.image_processing.enhance_contrast') as mock_contrast, \
             patch('app.utils.image_processing.adjust_brightness') as mock_brightness, \
             patch('app.utils.image_processing.correct_rotation') as mock_rotation, \
             patch('app.utils.image_processing.reduce_noise') as mock_noise, \
             patch('app.utils.image_processing.sharpen_image') as mock_sharpen:
            
            # Mock each processing step to return the input
            mock_contrast.side_effect = lambda x: x
            mock_brightness.side_effect = lambda x: x
            mock_rotation.side_effect = lambda x: x
            mock_noise.side_effect = lambda x: x
            mock_sharpen.side_effect = lambda x: x
            
            result = preprocess_image_for_ocr(sample_pil_image)
            
            # Verify all processing steps were called
            assert mock_contrast.called
            assert mock_brightness.called
            assert mock_rotation.called
            assert mock_noise.called
            assert mock_sharpen.called
            
            # Result should be a PIL Image
            assert isinstance(result, Image.Image)
    
    def test_preprocess_image_for_ocr_failure_fallback(self, sample_pil_image):
        """Test preprocessing failure fallback to original image."""
        with patch('app.utils.image_processing.enhance_contrast') as mock_contrast:
            mock_contrast.side_effect = Exception("Processing failed")
            
            result = preprocess_image_for_ocr(sample_pil_image)
            
            # Should return original image on failure
            assert result == sample_pil_image
    
    def test_enhance_contrast_color_image(self, sample_cv_image):
        """Test contrast enhancement on color image."""
        with patch('cv2.createCLAHE') as mock_clahe_create, \
             patch('cv2.cvtColor') as mock_cvt_color:
            
            mock_clahe = Mock()
            mock_clahe_create.return_value = mock_clahe
            mock_clahe.apply.return_value = np.ones((100, 200), dtype=np.uint8) * 150
            
            # Mock color conversion
            mock_cvt_color.side_effect = [
                np.ones((100, 200), dtype=np.uint8) * 128,  # BGR2GRAY
                sample_cv_image  # GRAY2BGR
            ]
            
            result = enhance_contrast(sample_cv_image)
            
            # Verify CLAHE was created with correct parameters
            mock_clahe_create.assert_called_once_with(clipLimit=2.0, tileGridSize=(8, 8))
            
            # Verify color conversions were called
            assert mock_cvt_color.call_count == 2
            
            # Result should be same shape as input
            assert result.shape == sample_cv_image.shape
    
    def test_enhance_contrast_grayscale_image(self, sample_grayscale_image):
        """Test contrast enhancement on grayscale image."""
        with patch('cv2.createCLAHE') as mock_clahe_create:
            mock_clahe = Mock()
            mock_clahe_create.return_value = mock_clahe
            mock_clahe.apply.return_value = sample_grayscale_image
            
            result = enhance_contrast(sample_grayscale_image)
            
            # Verify CLAHE was applied
            mock_clahe.apply.assert_called_once()
            
            # Result should maintain grayscale shape
            assert len(result.shape) == 2
    
    def test_enhance_contrast_failure(self, sample_cv_image):
        """Test contrast enhancement failure handling."""
        with patch('cv2.createCLAHE') as mock_clahe_create:
            mock_clahe_create.side_effect = Exception("CLAHE failed")
            
            result = enhance_contrast(sample_cv_image)
            
            # Should return original image on failure
            np.testing.assert_array_equal(result, sample_cv_image)
    
    def test_adjust_brightness_very_dark_image(self):
        """Test brightness adjustment for very dark image."""
        dark_image = np.ones((100, 200, 3), dtype=np.uint8) * 20  # Very dark
        
        with patch('cv2.convertScaleAbs') as mock_convert:
            mock_convert.return_value = np.ones((100, 200, 3), dtype=np.uint8) * 70
            
            result = adjust_brightness(dark_image)
            
            # Should apply brightness adjustment for very dark image
            mock_convert.assert_called_once_with(dark_image, alpha=1.0, beta=50)
    
    def test_adjust_brightness_very_bright_image(self):
        """Test brightness adjustment for very bright image."""
        bright_image = np.ones((100, 200, 3), dtype=np.uint8) * 220  # Very bright
        
        with patch('cv2.convertScaleAbs') as mock_convert:
            mock_convert.return_value = np.ones((100, 200, 3), dtype=np.uint8) * 190
            
            result = adjust_brightness(bright_image)
            
            # Should apply negative brightness adjustment for very bright image
            mock_convert.assert_called_once_with(bright_image, alpha=1.0, beta=-30)
    
    def test_adjust_brightness_normal_image(self):
        """Test brightness adjustment for normal brightness image."""
        normal_image = np.ones((100, 200, 3), dtype=np.uint8) * 100  # Normal brightness
        
        with patch('cv2.convertScaleAbs') as mock_convert:
            mock_convert.return_value = np.ones((100, 200, 3), dtype=np.uint8) * 128
            
            result = adjust_brightness(normal_image)
            
            # Should apply adjustment to reach target brightness (128)
            mock_convert.assert_called_once_with(normal_image, alpha=1.0, beta=28)
    
    def test_adjust_brightness_no_adjustment_needed(self):
        """Test brightness adjustment when no adjustment is needed."""
        target_brightness_image = np.ones((100, 200, 3), dtype=np.uint8) * 128
        
        result = adjust_brightness(target_brightness_image)
        
        # Should return original image when no adjustment needed
        np.testing.assert_array_equal(result, target_brightness_image)
    
    def test_correct_rotation_with_lines_detected(self, sample_cv_image):
        """Test rotation correction when lines are detected."""
        with patch('cv2.Canny') as mock_canny, \
             patch('cv2.HoughLines') as mock_hough, \
             patch('app.utils.image_processing.rotate_image') as mock_rotate:
            
            # Mock edge detection
            mock_canny.return_value = np.zeros((100, 200), dtype=np.uint8)
            
            # Mock line detection with significant angle
            mock_hough.return_value = np.array([
                [[100, np.pi/180 * 95]],  # 5 degree rotation
                [[120, np.pi/180 * 93]],  # 3 degree rotation
            ])
            
            rotated_image = np.ones((100, 200, 3), dtype=np.uint8) * 150
            mock_rotate.return_value = rotated_image
            
            result = correct_rotation(sample_cv_image)
            
            # Should call rotation with average angle (4 degrees)
            mock_rotate.assert_called_once()
            call_args = mock_rotate.call_args[0]
            assert abs(call_args[1] - 4.0) < 0.1  # Average angle should be ~4 degrees
    
    def test_correct_rotation_no_lines_detected(self, sample_cv_image):
        """Test rotation correction when no lines are detected."""
        with patch('cv2.Canny') as mock_canny, \
             patch('cv2.HoughLines') as mock_hough:
            
            mock_canny.return_value = np.zeros((100, 200), dtype=np.uint8)
            mock_hough.return_value = None  # No lines detected
            
            result = correct_rotation(sample_cv_image)
            
            # Should return original image when no lines detected
            np.testing.assert_array_equal(result, sample_cv_image)
    
    def test_correct_rotation_small_angle_ignored(self, sample_cv_image):
        """Test rotation correction ignores small angles."""
        with patch('cv2.Canny') as mock_canny, \
             patch('cv2.HoughLines') as mock_hough:
            
            mock_canny.return_value = np.zeros((100, 200), dtype=np.uint8)
            
            # Mock line detection with small angle (< 2 degrees)
            mock_hough.return_value = np.array([
                [[100, np.pi/180 * 91]],  # 1 degree rotation
            ])
            
            result = correct_rotation(sample_cv_image)
            
            # Should return original image for small angles
            np.testing.assert_array_equal(result, sample_cv_image)
    
    def test_reduce_noise_color_image(self, sample_cv_image):
        """Test noise reduction on color image."""
        with patch('cv2.bilateralFilter') as mock_bilateral:
            denoised_image = np.ones((100, 200, 3), dtype=np.uint8) * 130
            mock_bilateral.return_value = denoised_image
            
            result = reduce_noise(sample_cv_image)
            
            mock_bilateral.assert_called_once_with(sample_cv_image, 9, 75, 75)
            np.testing.assert_array_equal(result, denoised_image)
    
    def test_reduce_noise_grayscale_image(self, sample_grayscale_image):
        """Test noise reduction on grayscale image."""
        with patch('cv2.bilateralFilter') as mock_bilateral:
            denoised_image = np.ones((100, 200), dtype=np.uint8) * 130
            mock_bilateral.return_value = denoised_image
            
            result = reduce_noise(sample_grayscale_image)
            
            mock_bilateral.assert_called_once_with(sample_grayscale_image, 9, 75, 75)
            np.testing.assert_array_equal(result, denoised_image)
    
    def test_sharpen_image(self, sample_cv_image):
        """Test image sharpening."""
        with patch('cv2.filter2D') as mock_filter:
            sharpened_image = np.ones((100, 200, 3), dtype=np.uint8) * 140
            mock_filter.return_value = sharpened_image
            
            result = sharpen_image(sample_cv_image)
            
            # Verify sharpening kernel was applied
            mock_filter.assert_called_once()
            args, kwargs = mock_filter.call_args
            
            assert np.array_equal(args[0], sample_cv_image)
            assert args[1] == -1
            
            # Check sharpening kernel
            expected_kernel = np.array([
                [-1, -1, -1],
                [-1,  9, -1],
                [-1, -1, -1]
            ])
            np.testing.assert_array_equal(args[2], expected_kernel)
    
    def test_resize_for_ocr_small_image_upscaling(self):
        """Test resizing small image for OCR."""
        small_image = np.ones((50, 100, 3), dtype=np.uint8) * 128  # Height < 300
        
        with patch('cv2.resize') as mock_resize:
            large_image = np.ones((300, 600, 3), dtype=np.uint8) * 128
            mock_resize.return_value = large_image
            
            result = resize_for_ocr(small_image, min_height=300)
            
            # Should upscale to minimum height
            mock_resize.assert_called_once()
            args, kwargs = mock_resize.call_args
            
            assert args[1] == (600, 300)  # New width, height
            assert kwargs['interpolation'] == cv2.INTER_CUBIC
    
    def test_resize_for_ocr_large_image_no_change(self):
        """Test that large images are not resized."""
        large_image = np.ones((400, 800, 3), dtype=np.uint8) * 128  # Height > 300
        
        result = resize_for_ocr(large_image, min_height=300)
        
        # Should return original image
        np.testing.assert_array_equal(result, large_image)
    
    def test_convert_to_binary_adaptive_method(self, sample_grayscale_image):
        """Test binary conversion using adaptive thresholding."""
        with patch('cv2.adaptiveThreshold') as mock_adaptive:
            binary_image = np.ones((100, 200), dtype=np.uint8) * 255
            mock_adaptive.return_value = binary_image
            
            result = convert_to_binary(sample_grayscale_image, method='adaptive')
            
            mock_adaptive.assert_called_once_with(
                sample_grayscale_image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 11, 2
            )
    
    def test_convert_to_binary_otsu_method(self, sample_grayscale_image):
        """Test binary conversion using Otsu's method."""
        with patch('cv2.threshold') as mock_threshold:
            mock_threshold.return_value = (127, np.ones((100, 200), dtype=np.uint8) * 255)
            
            result = convert_to_binary(sample_grayscale_image, method='otsu')
            
            mock_threshold.assert_called_once_with(
                sample_grayscale_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
    
    def test_convert_to_binary_fixed_method(self, sample_grayscale_image):
        """Test binary conversion using fixed threshold."""
        with patch('cv2.threshold') as mock_threshold:
            mock_threshold.return_value = (127, np.ones((100, 200), dtype=np.uint8) * 255)
            
            result = convert_to_binary(sample_grayscale_image, method='fixed')
            
            mock_threshold.assert_called_once_with(
                sample_grayscale_image, 127, 255, cv2.THRESH_BINARY
            )
    
    def test_convert_to_binary_color_image_conversion(self, sample_cv_image):
        """Test binary conversion automatically converts color to grayscale."""
        with patch('cv2.cvtColor') as mock_cvt_color, \
             patch('cv2.adaptiveThreshold') as mock_adaptive:
            
            # Mock color to grayscale conversion
            mock_cvt_color.return_value = np.ones((100, 200), dtype=np.uint8) * 128
            mock_adaptive.return_value = np.ones((100, 200), dtype=np.uint8) * 255
            
            result = convert_to_binary(sample_cv_image)
            
            # Should convert color to grayscale first
            mock_cvt_color.assert_called_once_with(sample_cv_image, cv2.COLOR_BGR2GRAY)
    
    def test_processing_functions_error_handling(self, sample_cv_image):
        """Test that processing functions handle errors gracefully."""
        functions_to_test = [
            enhance_contrast,
            adjust_brightness,
            correct_rotation,
            reduce_noise,
            sharpen_image,
            resize_for_ocr,
            convert_to_binary
        ]
        
        for func in functions_to_test:
            with patch('cv2.cvtColor') as mock_cvt:
                mock_cvt.side_effect = Exception("OpenCV error")
                
                result = func(sample_cv_image)
                
                # Each function should return original image on error
                np.testing.assert_array_equal(result, sample_cv_image)