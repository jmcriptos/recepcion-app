"""
Image preprocessing utilities for OCR optimization.
Provides functions to enhance image quality for better text recognition.
"""

import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)


def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Apply comprehensive preprocessing pipeline to optimize image for OCR.
    
    Args:
        image: PIL Image object to preprocess
        
    Returns:
        Preprocessed PIL Image optimized for OCR
    """
    try:
        # Convert PIL to OpenCV format
        img_cv = np.array(image)
        if len(img_cv.shape) == 3:
            img_cv = cv2.cvtColor(img_cv, cv2.COLOR_RGB2BGR)
        
        # Apply preprocessing pipeline
        img_cv = enhance_contrast(img_cv)
        img_cv = adjust_brightness(img_cv)
        img_cv = correct_rotation(img_cv)
        img_cv = reduce_noise(img_cv)
        img_cv = sharpen_image(img_cv)
        
        # Convert back to PIL Image
        if len(img_cv.shape) == 3:
            img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
        
        return Image.fromarray(img_cv)
        
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        return image  # Return original image if preprocessing fails


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """
    Enhance image contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization).
    
    Args:
        image: OpenCV image array
        
    Returns:
        Contrast-enhanced image
    """
    try:
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Apply CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Convert back to original format if needed
        if len(image.shape) == 3:
            enhanced = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        
        return enhanced
        
    except Exception as e:
        logger.error(f"Contrast enhancement failed: {e}")
        return image


def adjust_brightness(image: np.ndarray) -> np.ndarray:
    """
    Automatically adjust brightness based on image histogram.
    
    Args:
        image: OpenCV image array
        
    Returns:
        Brightness-adjusted image
    """
    try:
        # Convert to grayscale for analysis
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Calculate mean brightness
        mean_brightness = np.mean(gray)
        target_brightness = 128  # Target brightness value
        
        # Calculate adjustment factor
        if mean_brightness < 50:  # Very dark image
            brightness_adjustment = 50
        elif mean_brightness > 200:  # Very bright image
            brightness_adjustment = -30
        else:
            brightness_adjustment = target_brightness - mean_brightness
        
        # Apply brightness adjustment
        if brightness_adjustment != 0:
            adjusted = cv2.convertScaleAbs(image, alpha=1.0, beta=brightness_adjustment)
            return adjusted
        
        return image
        
    except Exception as e:
        logger.error(f"Brightness adjustment failed: {e}")
        return image


def correct_rotation(image: np.ndarray) -> np.ndarray:
    """
    Detect and correct image rotation for better text recognition.
    
    Args:
        image: OpenCV image array
        
    Returns:
        Rotation-corrected image
    """
    try:
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Apply edge detection
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        
        # Detect lines using Hough transform
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)
        
        if lines is not None and len(lines) > 0:
            # Calculate average angle of detected lines
            angles = []
            for line in lines[:10]:  # Use first 10 lines to avoid noise
                rho, theta = line[0]
                angle = np.degrees(theta) - 90
                if -45 <= angle <= 45:  # Only consider reasonable rotation angles
                    angles.append(angle)
            
            if angles:
                avg_angle = np.median(angles)
                
                # Only rotate if angle is significant (> 2 degrees)
                if abs(avg_angle) > 2:
                    return rotate_image(image, avg_angle)
        
        return image
        
    except Exception as e:
        logger.error(f"Rotation correction failed: {e}")
        return image


def rotate_image(image: np.ndarray, angle: float) -> np.ndarray:
    """
    Rotate image by specified angle.
    
    Args:
        image: OpenCV image array
        angle: Rotation angle in degrees
        
    Returns:
        Rotated image
    """
    try:
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        
        # Create rotation matrix
        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        # Calculate new dimensions to avoid cropping
        cos_angle = abs(rotation_matrix[0, 0])
        sin_angle = abs(rotation_matrix[0, 1])
        new_w = int((h * sin_angle) + (w * cos_angle))
        new_h = int((h * cos_angle) + (w * sin_angle))
        
        # Adjust rotation matrix for new dimensions
        rotation_matrix[0, 2] += (new_w / 2) - center[0]
        rotation_matrix[1, 2] += (new_h / 2) - center[1]
        
        # Apply rotation
        rotated = cv2.warpAffine(image, rotation_matrix, (new_w, new_h), 
                                flags=cv2.INTER_LINEAR, 
                                borderMode=cv2.BORDER_CONSTANT,
                                borderValue=(255, 255, 255))
        
        return rotated
        
    except Exception as e:
        logger.error(f"Image rotation failed: {e}")
        return image


def reduce_noise(image: np.ndarray) -> np.ndarray:
    """
    Apply noise reduction filters to improve text clarity.
    
    Args:
        image: OpenCV image array
        
    Returns:
        Noise-reduced image
    """
    try:
        # Apply bilateral filter to reduce noise while preserving edges
        if len(image.shape) == 3:
            # Color image
            denoised = cv2.bilateralFilter(image, 9, 75, 75)
        else:
            # Grayscale image
            denoised = cv2.bilateralFilter(image, 9, 75, 75)
        
        return denoised
        
    except Exception as e:
        logger.error(f"Noise reduction failed: {e}")
        return image


def sharpen_image(image: np.ndarray) -> np.ndarray:
    """
    Apply sharpening filter to enhance text edges.
    
    Args:
        image: OpenCV image array
        
    Returns:
        Sharpened image
    """
    try:
        # Define sharpening kernel
        sharpening_kernel = np.array([
            [-1, -1, -1],
            [-1,  9, -1],
            [-1, -1, -1]
        ])
        
        # Apply sharpening filter
        sharpened = cv2.filter2D(image, -1, sharpening_kernel)
        
        return sharpened
        
    except Exception as e:
        logger.error(f"Image sharpening failed: {e}")
        return image


def resize_for_ocr(image: np.ndarray, min_height: int = 300) -> np.ndarray:
    """
    Resize image to optimal dimensions for OCR processing.
    Small images are upscaled to improve OCR accuracy.
    
    Args:
        image: OpenCV image array
        min_height: Minimum height for OCR processing
        
    Returns:
        Resized image
    """
    try:
        h, w = image.shape[:2]
        
        # If image is too small, upscale it
        if h < min_height:
            scale_factor = min_height / h
            new_w = int(w * scale_factor)
            new_h = int(h * scale_factor)
            
            # Use INTER_CUBIC for upscaling to preserve quality
            resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            return resized
        
        return image
        
    except Exception as e:
        logger.error(f"Image resizing failed: {e}")
        return image


def convert_to_binary(image: np.ndarray, method: str = 'adaptive') -> np.ndarray:
    """
    Convert image to binary (black and white) for OCR processing.
    
    Args:
        image: OpenCV image array
        method: Binarization method ('adaptive', 'otsu', 'fixed')
        
    Returns:
        Binary image
    """
    try:
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        if method == 'adaptive':
            # Adaptive thresholding works well for varying lighting conditions
            binary = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
        elif method == 'otsu':
            # Otsu's method automatically finds optimal threshold
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:  # fixed threshold
            # Fixed threshold at 127
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
        
        return binary
        
    except Exception as e:
        logger.error(f"Binary conversion failed: {e}")
        return image