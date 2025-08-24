"""Global error handling middleware with structured logging."""
import uuid
import logging
from datetime import datetime
from flask import jsonify, request, current_app, g
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError


class ValidationError(Exception):
    """Custom validation error for business logic validation."""
    def __init__(self, message, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


def setup_error_handlers(app):
    """Setup global error handlers for the Flask application."""
    
    @app.before_request
    def before_request():
        """Generate unique request ID for tracking."""
        g.request_id = str(uuid.uuid4())
        
        # Log incoming request
        current_app.logger.info(
            f"Request {g.request_id} started",
            extra={
                'request_id': g.request_id,
                'method': request.method,
                'url': request.url,
                'remote_addr': request.remote_addr,
                'user_agent': str(request.user_agent)
            }
        )
    
    @app.after_request
    def after_request(response):
        """Log request completion."""
        current_app.logger.info(
            f"Request {g.request_id} completed",
            extra={
                'request_id': g.request_id,
                'status_code': response.status_code,
                'response_size': response.content_length
            }
        )
        
        # Add request ID to response headers
        response.headers['X-Request-ID'] = g.request_id
        return response
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        """Handle custom validation errors."""
        request_id = getattr(g, 'request_id', str(uuid.uuid4()))
        
        current_app.logger.warning(
            f"Validation error in request {request_id}: {error.message}",
            extra={
                'request_id': request_id,
                'error_type': 'ValidationError',
                'error_message': error.message,
                'error_details': error.details,
                'endpoint': request.endpoint,
                'method': request.method,
                'url': request.url
            }
        )
        
        return jsonify({
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': error.message,
                'details': error.details,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'requestId': request_id
            }
        }), 400
    
    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(error):
        """Handle database-related errors."""
        request_id = getattr(g, 'request_id', str(uuid.uuid4()))
        
        current_app.logger.error(
            f"Database error in request {request_id}: {str(error)}",
            extra={
                'request_id': request_id,
                'error_type': 'DatabaseError',
                'error_message': str(error),
                'endpoint': request.endpoint,
                'method': request.method,
                'url': request.url
            }
        )
        
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Database operation failed',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'requestId': request_id
            }
        }), 503
    
    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        """Handle HTTP exceptions (404, 405, etc.)."""
        request_id = getattr(g, 'request_id', str(uuid.uuid4()))
        
        current_app.logger.info(
            f"HTTP error in request {request_id}: {error.code} - {error.description}",
            extra={
                'request_id': request_id,
                'error_type': 'HTTPError',
                'error_code': error.code,
                'error_description': error.description,
                'endpoint': request.endpoint,
                'method': request.method,
                'url': request.url
            }
        )
        
        return jsonify({
            'error': {
                'code': f'HTTP_{error.code}',
                'message': error.description,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'requestId': request_id
            }
        }), error.code
    
    @app.errorhandler(Exception)
    def handle_generic_error(error):
        """Handle all other exceptions."""
        request_id = getattr(g, 'request_id', str(uuid.uuid4()))
        
        current_app.logger.error(
            f"Unhandled exception in request {request_id}: {str(error)}",
            extra={
                'request_id': request_id,
                'error_type': type(error).__name__,
                'error_message': str(error),
                'endpoint': request.endpoint,
                'method': request.method,
                'url': request.url
            },
            exc_info=True
        )
        
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'requestId': request_id
            }
        }), 500


def setup_logging(app):
    """Configure structured logging for Heroku compatibility."""
    # Configure logging format for Heroku
    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s [%(name)s] [%(request_id)s] %(message)s'
    )
    
    # Set up handler based on environment
    if app.config.get('ENV') == 'production':
        handler = logging.StreamHandler()
        handler.setLevel(logging.INFO)
    else:
        handler = logging.StreamHandler()
        handler.setLevel(logging.DEBUG)
    
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO if app.config.get('ENV') == 'production' else logging.DEBUG)
    
    # Suppress werkzeug logs in production
    if app.config.get('ENV') == 'production':
        logging.getLogger('werkzeug').setLevel(logging.WARNING)