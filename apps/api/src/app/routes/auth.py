"""Authentication routes for user login, logout, and session management."""
import re
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, current_user, login_required
from sqlalchemy.exc import SQLAlchemyError
from app.models.user import User
from app.models import db

# Simple in-memory rate limiting storage
login_attempts = defaultdict(list)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

def check_rate_limit(ip_address, max_attempts=10, window_minutes=1):
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=window_minutes)
    login_attempts[ip_address] = [timestamp for timestamp in login_attempts[ip_address] if timestamp > cutoff]
    if len(login_attempts[ip_address]) >= max_attempts:
        return False
    login_attempts[ip_address].append(now)
    return True

def sanitize_name_input(name):
    """Sanitize user name input to prevent injection attacks.

    Args:
        name (str): User name input

    Returns:
        str: Sanitized name or None if invalid
    """
    if not name or not isinstance(name, str):
        return None

    name = name.strip()

    dangerous_patterns = [
        r"('|(\\'))",               # SQL injection patterns
        r"(;|--|/\*|\*/)",          # SQL comment patterns
        r"(\bor\b|\band\b|\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b)",  # SQL keywords
        r"[<>\"&]",                 # XSS characters
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, name, re.IGNORECASE):
            return None

    if not re.match(r"^[a-zA-ZÀ-ÿ0-9\s\-'\.]+$", name):
        return None

    return name

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user with name-based login.
    
    Request format:
        POST /api/v1/auth/login
        {
            "name": "Juan Pérez"
        }
    
    Returns:
        200: User object with session cookie
        400: Missing or invalid name
        401: Invalid credentials (user not found or inactive)
        500: Server error
    """
    try:
        client_ip = request.remote_addr or 'unknown'
        if not check_rate_limit(client_ip):
            current_app.logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return jsonify({
                'error': {
                    'code': 'RATE_LIMIT_EXCEEDED',
                    'message': 'Too many login attempts. Please try again later.',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 429
        
        if not request.is_json:
            return jsonify({
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'Request must be JSON',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        data = request.get_json()
        name = data.get('name', '')
        
        name = sanitize_name_input(name)
        if not name:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Name is required and must contain only valid characters',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        if len(name) > 255:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Name must be 255 characters or less',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        user = User.query.filter_by(name=name).first()
        
        if not user:
            current_app.logger.warning(f"Login attempt for non-existent user: {name}")
            return jsonify({
                'error': {
                    'code': 'AUTHENTICATION_ERROR',
                    'message': 'Invalid credentials',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 401

        if not user.is_active:
            current_app.logger.warning(f"Login attempt for inactive user: {name}")
            return jsonify({
                'error': {
                    'code': 'AUTHENTICATION_ERROR',
                    'message': 'Account is inactive',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 401

        user.last_login = datetime.utcnow()
        db.session.commit()

        login_user(user, remember=True, duration=current_app.config['PERMANENT_SESSION_LIFETIME'])
        current_app.logger.info(f"Successful login for user: {name} (ID: {user.id})")
        return jsonify(user.to_dict()), 200

    except SQLAlchemyError as e:
        import traceback
        tb = traceback.format_exc()
        # Loguea detalle completo y el origen DBAPI si existe
        current_app.logger.error(f"Database error during login: {str(e)}\n{tb}")
        if hasattr(e, 'orig'):
            current_app.logger.error(f"DBAPI error origin: {repr(e.orig)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Database operation failed',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(f"Unexpected error during login: {str(e)}\n{tb}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Logout current user and invalidate session.
    
    Request format:
        POST /api/v1/auth/logout
        (No body required, uses session cookie)
    
    Returns:
        200: Success confirmation
        401: Not authenticated
    """
    try:
        user_name = current_user.name if current_user.is_authenticated else 'unknown'
        logout_user()
        current_app.logger.info(f"Successful logout for user: {user_name}")
        return jsonify({
            'message': 'Logout successful',
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error during logout: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500

@auth_bp.route('/current-user', methods=['GET'])
@login_required
def current_user_info():
    """Get current authenticated user information.
    
    Request format:
        GET /api/v1/auth/current-user
        (Uses session cookie for authentication)
    
    Returns:
        200: Current user object
        401: Not authenticated
    """
    try:
        if not current_user.is_authenticated:
            return jsonify({
                'error': {
                    'code': 'AUTHENTICATION_ERROR',
                    'message': 'Not authenticated',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 401
        
        return jsonify(current_user.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting current user: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500

@auth_bp.errorhandler(401)
def unauthorized(error):
    """Handle unauthorized access attempts."""
    return jsonify({
        'error': {
            'code': 'AUTHENTICATION_ERROR',
            'message': 'Authentication required',
            'timestamp': datetime.utcnow().isoformat(),
            'requestId': request.headers.get('X-Request-ID', 'unknown')
        }
    }), 401