"""Authentication middleware for route protection and role-based access control."""
from functools import wraps
from datetime import datetime
from flask import jsonify, request, current_app
from flask_login import current_user


def login_required_api(f):
    """Decorator for API routes that require authentication.
    
    Similar to Flask-Login's @login_required but returns JSON errors
    instead of redirecting to login page.
    
    Args:
        f: The function to be decorated
        
    Returns:
        Wrapped function that checks authentication
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            current_app.logger.warning(f"Unauthorized access attempt to {request.endpoint}")
            return jsonify({
                'error': {
                    'code': 'AUTHENTICATION_ERROR',
                    'message': 'Se requiere autenticación',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


def role_required(*allowed_roles):
    """Decorator for routes that require specific user roles.
    
    Args:
        *allowed_roles: One or more roles that are allowed to access the route
                       (e.g., 'operator', 'supervisor')
    
    Returns:
        Decorator function that checks user role
        
    Example:
        @role_required('supervisor')
        def admin_only_route():
            pass
            
        @role_required('operator', 'supervisor')
        def any_user_route():
            pass
    """
    def decorator(f):
        @wraps(f)
        @login_required_api
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                # This should be caught by @login_required_api but adding as safety
                return jsonify({
                    'error': {
                        'code': 'AUTHENTICATION_ERROR',
                        'message': 'Se requiere autenticación',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 401
            
            if current_user.role not in allowed_roles:
                current_app.logger.warning(
                    f"Access denied for user {current_user.name} (role: {current_user.role}) "
                    f"to {request.endpoint}. Required roles: {allowed_roles}"
                )
                return jsonify({
                    'error': {
                        'code': 'INSUFFICIENT_PERMISSIONS',
                        'message': 'No tienes permisos para realizar esta acción',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator


def supervisor_required(f):
    """Decorator for routes that require supervisor role.
    
    Convenience decorator for @role_required('supervisor').
    
    Args:
        f: The function to be decorated
        
    Returns:
        Wrapped function that checks for supervisor role
    """
    return role_required('supervisor')(f)


def supervisor_only(f):
    """Alternative decorator name for supervisor-only endpoints.
    
    Alias for supervisor_required for better readability.
    
    Args:
        f: The function to be decorated
        
    Returns:
        Wrapped function that checks for supervisor role
    """
    return supervisor_required(f)


def operator_or_supervisor_required(f):
    """Decorator for routes that require operator or supervisor role.
    
    Convenience decorator for @role_required('operator', 'supervisor').
    
    Args:
        f: The function to be decorated
        
    Returns:
        Wrapped function that checks for operator or supervisor role
    """
    return role_required('operator', 'supervisor')(f)


def get_current_user_info():
    """Helper function to get current user information for logging.
    
    Returns:
        dict: Dictionary with user info or 'anonymous' if not authenticated
    """
    if current_user.is_authenticated:
        return {
            'user_id': str(current_user.id),
            'name': current_user.name,
            'role': current_user.role
        }
    return {'user_id': None, 'name': 'anonymous', 'role': None}


def log_authentication_event(event_type, details=None):
    """Helper function to log authentication-related events.
    
    Args:
        event_type (str): Type of event (login, logout, access_denied, etc.)
        details (dict, optional): Additional details to log
    """
    user_info = get_current_user_info()
    log_data = {
        'event': event_type,
        'user': user_info,
        'endpoint': request.endpoint,
        'method': request.method,
        'ip': request.remote_addr,
        'user_agent': request.headers.get('User-Agent', 'unknown'),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    if details:
        log_data.update(details)
    
    current_app.logger.info(f"Auth event: {event_type}", extra=log_data)