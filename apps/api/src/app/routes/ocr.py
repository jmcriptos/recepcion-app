"""OCR processing endpoints for weight extraction from images."""

import logging
import os
import tempfile
import uuid
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from werkzeug.exceptions import BadRequest, RequestEntityTooLarge
from typing import Dict, Any

from app.services.ocr_service import OCRService
from app.models.registration import WeightRegistration
from app.models import db
from datetime import datetime, timedelta
import redis

logger = logging.getLogger(__name__)

ocr_bp = Blueprint('ocr', __name__, url_prefix='/api/v1/ocr')

# Initialize OCR service
ocr_service = OCRService()

# Allowed file extensions and size limits
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 10  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds


def allowed_file(filename: str) -> bool:
    """Check if file has allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def check_rate_limit(user_id: str) -> bool:
    """
    Simple rate limiting check for OCR requests.
    Returns True if within rate limit, False if exceeded.
    """
    try:
        # Try to get Redis from Flask config, fallback to in-memory tracking
        from flask import current_app
        if hasattr(current_app.config, 'SESSION_REDIS'):
            redis_client = current_app.config['SESSION_REDIS']
            key = f"ocr_rate_limit:{user_id}"
            current_count = redis_client.get(key)
            
            if current_count is None:
                redis_client.setex(key, RATE_LIMIT_WINDOW, 1)
                return True
            elif int(current_count) < RATE_LIMIT_REQUESTS:
                redis_client.incr(key)
                return True
            else:
                return False
        else:
            # Fallback to allowing all requests if Redis unavailable
            logger.warning("Redis not available for rate limiting, allowing request")
            return True
    except Exception as e:
        logger.error(f"Rate limiting check failed: {e}")
        return True  # Allow request on error


def validate_image_request() -> Dict[str, Any]:
    """Validate OCR image processing request."""
    if 'image' not in request.files:
        raise BadRequest("No image file provided")
    
    file = request.files['image']
    if file.filename == '':
        raise BadRequest("No file selected")
    
    if not allowed_file(file.filename):
        raise BadRequest(f"File type not allowed. Supported formats: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Check file size
    if request.content_length and request.content_length > MAX_FILE_SIZE:
        raise RequestEntityTooLarge(f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    return {'file': file}


@ocr_bp.route('/process-image', methods=['POST'])
def process_image():
    """
    Process image for OCR weight extraction.
    
    Expected request:
    - multipart/form-data with 'image' file field
    - Optional: 'registration_id' for logging purposes
    
    Returns:
        JSON response with extracted weight, confidence, and processing metadata
    """
    try:
        # Validate session (user must be authenticated)
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check rate limiting
        if not check_rate_limit(session['user_id']):
            return jsonify({
                'error': f'Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per minute.',
                'success': False
            }), 429
        
        # Validate request
        validation_result = validate_image_request()
        file = validation_result['file']
        
        # Get optional registration ID for logging
        registration_id = request.form.get('registration_id')
        
        # Save uploaded file temporarily for processing
        filename = secure_filename(file.filename)
        # Use secure temp file with timestamp to prevent race conditions
        temp_dir = tempfile.gettempdir()
        unique_id = str(uuid.uuid4())[:8]
        temp_filepath = os.path.join(temp_dir, f'ocr_{session["user_id"]}_{unique_id}_{filename}')
        
        try:
            file.save(temp_filepath)
            
            # Process image with OCR service
            # Note: In production, this should use Cloudinary URL instead of local file
            # For now, we'll create a mock URL since the service expects a URL
            mock_image_url = f"file://{temp_filepath}"
            
            result = ocr_service.process_image(
                image_url=mock_image_url,
                registration_id=registration_id
            )
            
            # Clean up temporary file
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            
            if result['success']:
                response_data = {
                    'success': True,
                    'extracted_weight': result['extracted_weight'],
                    'confidence_score': result['confidence_score'],
                    'ocr_engine': result['ocr_engine'],
                    'processing_time_ms': result['processing_time_ms']
                }
                
                # Update registration record if provided
                if registration_id and result['extracted_weight'] is not None:
                    try:
                        registration = WeightRegistration.query.filter_by(
                            id=registration_id,
                            registered_by=session['user_id']  # Fixed: use registered_by instead of user_id
                        ).first()
                        
                        if registration:
                            registration.ocr_confidence = result['confidence_score']
                            db.session.commit()
                            logger.info(f"Updated registration {registration_id} with OCR confidence")
                    
                    except Exception as e:
                        logger.error(f"Failed to update registration {registration_id}: {e}")
                        # Don't fail the entire request if registration update fails
                
                return jsonify(response_data), 200
            else:
                # OCR processing failed
                error_response = {
                    'success': False,
                    'error': result.get('error', 'OCR processing failed'),
                    'processing_time_ms': result['processing_time_ms']
                }
                return jsonify(error_response), 400
                
        except Exception as processing_error:
            # Clean up temporary file on error
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            raise processing_error
            
    except BadRequest as e:
        logger.warning(f"Bad request for OCR processing: {e}")
        return jsonify({'error': str(e)}), 400
    
    except RequestEntityTooLarge as e:
        logger.warning(f"File too large for OCR processing: {e}")
        return jsonify({'error': str(e)}), 413
    
    except Exception as e:
        logger.error(f"OCR processing endpoint error: {e}")
        return jsonify({
            'error': 'Internal server error during OCR processing',
            'success': False
        }), 500


@ocr_bp.route('/health', methods=['GET'])
def ocr_health():
    """
    OCR service health check endpoint.
    
    Returns:
        JSON response with OCR service status
    """
    try:
        # Check if OCR service components are available
        health_status = {
            'tesseract_available': True,  # Will be checked by OCR service
            'google_vision_available': ocr_service.vision_client is not None,
            'status': 'healthy'
        }
        
        return jsonify(health_status), 200
        
    except Exception as e:
        logger.error(f"OCR health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500


@ocr_bp.after_request
def add_ocr_headers(response):
    """Add OCR-specific headers to all OCR responses."""
    response.headers['X-OCR-Service'] = 'tesseract-google-vision'
    response.headers['X-Rate-Limit'] = '10-per-minute'
    return response


@ocr_bp.errorhandler(413)
def handle_file_too_large(error):
    """Handle file too large errors specifically for OCR endpoint."""
    return jsonify({
        'error': f'File too large. Maximum size allowed: {MAX_FILE_SIZE // (1024*1024)}MB',
        'success': False
    }), 413