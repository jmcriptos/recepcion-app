"""User management routes for supervisor administration."""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.models.user import User
from app.models import db
from app.middleware.auth_middleware import supervisor_only

# Create users blueprint
users_bp = Blueprint('users', __name__, url_prefix='/api/v1/users')


@users_bp.route('', methods=['GET'])
@supervisor_only
def list_users():
    """List all users in the system (supervisors only).
    
    Returns:
        200: List of all users
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
    """
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        
        response_data = {
            'users': [user.to_dict() for user in users],
            'total_count': len(users)
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error listing users: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@users_bp.route('', methods=['POST'])
@supervisor_only
def create_user():
    """Create a new user (supervisors only).
    
    Request format:
        POST /api/v1/users
        {
            "name": "Juan Pérez",
            "role": "operator"
        }
    
    Returns:
        201: Created user object
        400: Validation error
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
        409: User name already exists
    """
    try:
        # Validate request data
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
        
        # Validate required fields
        if 'name' not in data or not data['name']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Name is required',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        if 'role' not in data or not data['role']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Role is required',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate name
        name = data['name'].strip()
        if len(name) < 2 or len(name) > 255:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Name must be between 2 and 255 characters',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate role
        valid_roles = ['operator', 'supervisor']
        role = data['role'].strip().lower()
        if role not in valid_roles:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': f'Role must be one of: {", ".join(valid_roles)}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Check if user with this name already exists
        existing_user = User.query.filter_by(name=name).first()
        if existing_user:
            return jsonify({
                'error': {
                    'code': 'USER_EXISTS',
                    'message': 'A user with this name already exists',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 409
        
        # Create new user
        user = User(
            name=name,
            role=role,
            active=data.get('active', True)  # Default to active
        )
        
        db.session.add(user)
        db.session.commit()
        
        current_app.logger.info(f"User created: {name} (role: {role}) by supervisor {current_user.name}")
        
        return jsonify(user.to_dict()), 201
        
    except IntegrityError as e:
        current_app.logger.error(f"Integrity error creating user: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'USER_EXISTS',
                'message': 'A user with this name already exists',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 409
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error creating user: {str(e)}")
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
        current_app.logger.error(f"Unexpected error creating user: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@users_bp.route('/<user_id>', methods=['PUT'])
@supervisor_only
def update_user(user_id):
    """Update an existing user (supervisors only).
    
    Request format:
        PUT /api/v1/users/{user_id}
        {
            "name": "Juan Pérez Updated",
            "role": "supervisor",
            "active": true
        }
    
    Returns:
        200: Updated user object
        400: Validation error
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
        404: User not found
        409: Name already exists
    """
    try:
        # Find the user
        user = User.query.get_or_404(user_id)
        
        # Validate request data
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
        
        # Update name if provided
        if 'name' in data:
            name = data['name'].strip()
            if len(name) < 2 or len(name) > 255:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Name must be between 2 and 255 characters',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
            
            # Check if another user has this name
            if name != user.name:
                existing_user = User.query.filter_by(name=name).first()
                if existing_user:
                    return jsonify({
                        'error': {
                            'code': 'USER_EXISTS',
                            'message': 'A user with this name already exists',
                            'timestamp': datetime.utcnow().isoformat(),
                            'requestId': request.headers.get('X-Request-ID', 'unknown')
                        }
                    }), 409
            
            user.name = name
        
        # Update role if provided
        if 'role' in data:
            valid_roles = ['operator', 'supervisor']
            role = data['role'].strip().lower()
            if role not in valid_roles:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': f'Role must be one of: {", ".join(valid_roles)}',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
            
            user.role = role
        
        # Update active status if provided
        if 'active' in data:
            if not isinstance(data['active'], bool):
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Active must be a boolean value',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
            
            user.active = data['active']
        
        db.session.commit()
        
        current_app.logger.info(f"User updated: {user.name} by supervisor {current_user.name}")
        
        return jsonify(user.to_dict()), 200
        
    except IntegrityError as e:
        current_app.logger.error(f"Integrity error updating user: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'USER_EXISTS',
                'message': 'A user with this name already exists',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 409
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error updating user: {str(e)}")
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
        current_app.logger.error(f"Unexpected error updating user: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@users_bp.route('/<user_id>', methods=['GET'])
@supervisor_only
def get_user(user_id):
    """Get a specific user by ID (supervisors only).
    
    Returns:
        200: User object
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
        404: User not found
    """
    try:
        user = User.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting user {user_id}: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500