"""
OCR Service for extracting weight values from meat label images.
Supports Tesseract OCR with Google Vision API fallback.
"""

import re
import time
import logging
from typing import Dict, Optional, Tuple, Any
from io import BytesIO
import requests
from PIL import Image
import pytesseract
import cv2
import numpy as np
from google.cloud import vision
from google.api_core.exceptions import GoogleAPIError

from app.models.ocr_log import OCRProcessingLog
from app.utils.image_processing import preprocess_image_for_ocr
from app import db


logger = logging.getLogger(__name__)


class OCRService:
    """Service for processing images and extracting weight information using OCR."""
    
    def __init__(self):
        """Initialize OCR service with configuration."""
        # Configure Tesseract for Spanish language and number recognition
        self.tesseract_config = '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789.,KkGg'
        
        # Initialize Google Vision client (will be configured via environment)
        self.vision_client = None
        try:
            self.vision_client = vision.ImageAnnotatorClient()
        except Exception as e:
            logger.warning(f"Google Vision client initialization failed: {e}")
    
    def process_image(self, image_url: str, registration_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process an image to extract weight information using OCR.
        
        Args:
            image_url: URL of the image to process
            registration_id: Optional registration ID for logging
            
        Returns:
            Dict containing extracted weight, confidence, and processing metadata
        """
        start_time = time.time()
        
        try:
            # Download image from URL
            image = self._download_image(image_url)
            
            # Preprocess image for better OCR accuracy
            processed_image = preprocess_image_for_ocr(image)
            
            # Try Tesseract OCR first
            tesseract_result = self._extract_with_tesseract(processed_image)
            
            # Check if Tesseract confidence is acceptable
            if tesseract_result['confidence_score'] >= 0.7:
                result = tesseract_result
            else:
                # Fallback to Google Vision API
                logger.info("Tesseract confidence low, falling back to Google Vision")
                vision_result = self._extract_with_google_vision(image)
                
                # Use best result based on confidence
                if vision_result['confidence_score'] > tesseract_result['confidence_score']:
                    result = vision_result
                else:
                    result = tesseract_result
            
            # Calculate processing time
            processing_time_ms = int((time.time() - start_time) * 1000)
            result['processing_time_ms'] = processing_time_ms
            
            # Log OCR processing attempt
            if registration_id:
                self._log_ocr_processing(
                    registration_id=registration_id,
                    extracted_text=result['extracted_text'],
                    confidence_score=result['confidence_score'],
                    processing_time_ms=processing_time_ms,
                    ocr_engine=result['ocr_engine']
                )
            
            # Validate weight against business rules
            if result['extracted_weight'] is not None:
                result['extracted_weight'] = self._validate_weight_value(result['extracted_weight'])
            
            result['success'] = True
            return result
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Log failed attempt
            if registration_id:
                self._log_ocr_processing(
                    registration_id=registration_id,
                    extracted_text="",
                    confidence_score=0.0,
                    processing_time_ms=processing_time_ms,
                    ocr_engine="error"
                )
            
            return {
                'success': False,
                'extracted_weight': None,
                'confidence_score': 0.0,
                'ocr_engine': 'error',
                'processing_time_ms': processing_time_ms,
                'error': str(e)
            }
    
    def _download_image(self, image_url: str) -> Image.Image:
        """Download image from URL or load from local file and return PIL Image object."""
        try:
            # Handle local file URLs (for development/testing)
            if image_url.startswith('file://'):
                local_path = image_url[7:]  # Remove 'file://' prefix
                return Image.open(local_path)
            
            # Handle remote URLs (production with Cloudinary)
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            return Image.open(BytesIO(response.content))
        except Exception as e:
            raise ValueError(f"Failed to load image from {image_url}: {e}")
    
    def _extract_with_tesseract(self, image: Image.Image) -> Dict[str, Any]:
        """Extract text using Tesseract OCR."""
        try:
            # Convert PIL Image to numpy array for OpenCV
            image_np = np.array(image)
            if len(image_np.shape) == 3:
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
            
            # Extract text with confidence data
            extracted_text = pytesseract.image_to_string(
                image_np, 
                config=self.tesseract_config,
                lang='spa+eng'
            )
            
            # Get confidence data
            confidence_data = pytesseract.image_to_data(
                image_np, 
                config=self.tesseract_config,
                lang='spa+eng',
                output_type=pytesseract.Output.DICT
            )
            
            # Calculate average confidence
            confidences = [int(conf) for conf in confidence_data['conf'] if int(conf) > 0]
            avg_confidence = (sum(confidences) / len(confidences) / 100) if confidences else 0.0
            
            # Extract weight from text
            extracted_weight = self._extract_weight_from_text(extracted_text)
            
            return {
                'extracted_text': extracted_text.strip(),
                'extracted_weight': extracted_weight,
                'confidence_score': avg_confidence,
                'ocr_engine': 'tesseract'
            }
            
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            return {
                'extracted_text': "",
                'extracted_weight': None,
                'confidence_score': 0.0,
                'ocr_engine': 'tesseract'
            }
    
    def _extract_with_google_vision(self, image: Image.Image) -> Dict[str, Any]:
        """Extract text using Google Vision API."""
        if not self.vision_client:
            logger.error("Google Vision client not available")
            return {
                'extracted_text': "",
                'extracted_weight': None,
                'confidence_score': 0.0,
                'ocr_engine': 'google_vision'
            }
        
        try:
            # Convert PIL Image to bytes
            img_byte_arr = BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            # Create Vision API image object
            vision_image = vision.Image(content=img_byte_arr)
            
            # Perform text detection
            response = self.vision_client.text_detection(image=vision_image)
            texts = response.text_annotations
            
            if response.error.message:
                raise GoogleAPIError(response.error.message)
            
            if texts:
                # First annotation contains all detected text
                extracted_text = texts[0].description
                # Google Vision doesn't provide confidence per character, use fixed high confidence
                confidence_score = 0.85
                
                # Extract weight from text
                extracted_weight = self._extract_weight_from_text(extracted_text)
                
                return {
                    'extracted_text': extracted_text.strip(),
                    'extracted_weight': extracted_weight,
                    'confidence_score': confidence_score,
                    'ocr_engine': 'google_vision'
                }
            else:
                return {
                    'extracted_text': "",
                    'extracted_weight': None,
                    'confidence_score': 0.0,
                    'ocr_engine': 'google_vision'
                }
                
        except Exception as e:
            logger.error(f"Google Vision OCR failed: {e}")
            return {
                'extracted_text': "",
                'extracted_weight': None,
                'confidence_score': 0.0,
                'ocr_engine': 'google_vision'
            }
    
    def _extract_weight_from_text(self, text: str) -> Optional[float]:
        """
        Extract weight value from OCR text using pattern recognition.
        Looks for numbers followed by weight units (kg, g, etc.).
        """
        # Clean text and convert to lowercase
        text = text.lower().replace(',', '.')
        
        # Pattern to match weight values: number + optional decimal + weight unit
        weight_patterns = [
            r'(\d+\.?\d*)\s*kg',  # X.X kg
            r'(\d+\.?\d*)\s*k',   # X.X k
            r'(\d+\.?\d*)\s*g',   # X.X g (convert to kg)
            r'peso\s*:?\s*(\d+\.?\d*)',  # peso: X.X
            r'weight\s*:?\s*(\d+\.?\d*)',  # weight: X.X
        ]
        
        for pattern in weight_patterns:
            matches = re.findall(pattern, text)
            if matches:
                try:
                    weight = float(matches[0])
                    
                    # Convert grams to kilograms if necessary
                    if 'g' in pattern and 'kg' not in pattern:
                        weight = weight / 1000
                    
                    # Validate weight range (reasonable for meat boxes)
                    if 0.1 <= weight <= 50.0:  # 100g to 50kg
                        return weight
                        
                except ValueError:
                    continue
        
        # If no pattern matches, try to extract any number that could be a weight
        number_pattern = r'\b(\d+\.?\d*)\b'
        numbers = re.findall(number_pattern, text)
        
        for num_str in numbers:
            try:
                num = float(num_str)
                # Reasonable weight range for meat boxes in kg
                if 0.1 <= num <= 50.0:
                    return num
            except ValueError:
                continue
        
        return None
    
    def _validate_weight_value(self, weight: float) -> Optional[float]:
        """Validate extracted weight against business rules."""
        # Meat box weight should be between 100g and 50kg
        if 0.1 <= weight <= 50.0:
            return round(weight, 2)  # Round to 2 decimal places
        
        logger.warning(f"Weight value {weight} outside valid range (0.1-50.0 kg)")
        return None
    
    def _log_ocr_processing(self, registration_id: str, extracted_text: str, 
                          confidence_score: float, processing_time_ms: int, 
                          ocr_engine: str) -> None:
        """Log OCR processing attempt to database."""
        try:
            ocr_log = OCRProcessingLog(
                registration_id=registration_id,
                extracted_text=extracted_text,
                confidence_score=confidence_score,
                processing_time_ms=processing_time_ms,
                ocr_engine=ocr_engine
            )
            
            db.session.add(ocr_log)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to log OCR processing: {e}")
            db.session.rollback()