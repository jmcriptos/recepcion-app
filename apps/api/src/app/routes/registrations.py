"""Weight registration routes for creating and managing weight entries."""
from datetime import datetime, date
from decimal import Decimal
import re
from urllib.parse import urlparse
from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_, func, or_
from app.models.registration import WeightRegistration
from app.models import db
from app.middleware.auth_middleware import operator_or_supervisor_required, supervisor_only
from app.utils.audit import log_registration_action, calculate_changes
from app.utils.pagination import apply_cursor_pagination, get_pagination_params, create_pagination_response
from app.utils.rate_limiting import rate_limit

# Create registrations blueprint
registrations_bp = Blueprint('registrations', __name__, url_prefix='/api/v1/registrations')


def validate_photo_url(url):
    """Validate photo URL for security and format.
    
    Args:
        url: Photo URL to validate
        
    Returns:
        tuple: (is_valid, error_message)
    """
    if not url:
        return True, None
    
    # Check URL length
    if len(url) > 500:
        return False, "La URL de la foto debe ser menor a 500 caracteres"
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Formato de URL inválido"
    
    # Check scheme
    if parsed.scheme not in ['http', 'https']:
        return False, "La URL debe usar protocolo HTTP o HTTPS"
    
    # Check for suspicious patterns
    suspicious_patterns = [
        r'javascript:',
        r'data:',
        r'file:',
        r'ftp:',
        r'localhost',
        r'127\.0\.0\.1',
        r'0\.0\.0\.0',
        r'<script',
        r'<iframe',
        r'<object',
        r'<embed'
    ]
    
    url_lower = url.lower()
    for pattern in suspicious_patterns:
        if re.search(pattern, url_lower):
            return False, "URL de foto contiene contenido no permitido"
    
    # Check file extension for images
    if parsed.path:
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        path_lower = parsed.path.lower()
        if not any(path_lower.endswith(ext) for ext in valid_extensions):
            return False, "La URL debe apuntar a un archivo de imagen válido"
    
    return True, None


@registrations_bp.route('', methods=['POST'])
@operator_or_supervisor_required
def create_registration():
    """Create a new weight registration.
    
    Request format:
        POST /api/v1/registrations
        {
            "weight": 15.5,
            "cut_type": "jamón",
            "supplier": "Proveedor Cárnico SA",
            "photo_url": "https://cloudinary.com/...",
            "ocr_confidence": 0.95
        }
    
    Returns:
        201: Created registration object
        400: Validation error
        401: Not authenticated
        500: Server error
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
        required_fields = ['weight', 'cut_type', 'supplier']
        for field in required_fields:
            if field not in data or data[field] is None:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': f'Field {field} is required',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Validate weight range (5-50 kg)
        weight = data['weight']
        if not isinstance(weight, (int, float)) or weight < 5 or weight > 50:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Weight must be between 5 and 50 kg',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate cut_type
        valid_cut_types = ['jamón', 'chuleta']
        if data['cut_type'] not in valid_cut_types:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': f'Cut type must be one of: {", ".join(valid_cut_types)}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate supplier
        supplier = data['supplier'].strip()
        if not supplier or len(supplier) > 255:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Supplier must be non-empty and less than 255 characters',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate optional fields
        photo_url = data.get('photo_url')
        if photo_url:
            is_valid, error_msg = validate_photo_url(photo_url)
            if not is_valid:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': error_msg,
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        ocr_confidence = data.get('ocr_confidence')
        if ocr_confidence is not None:
            if not isinstance(ocr_confidence, (int, float)) or ocr_confidence < 0 or ocr_confidence > 1:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'OCR confidence must be between 0 and 1',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Create new registration
        registration = WeightRegistration(
            weight=weight,
            cut_type=data['cut_type'],
            supplier=supplier,
            photo_url=photo_url,
            ocr_confidence=ocr_confidence,
            registered_by=current_user.id,
            sync_status='synced'  # Default for new registrations
        )
        
        db.session.add(registration)
        db.session.commit()
        
        current_app.logger.info(f"Registration created by user {current_user.name} (ID: {current_user.id})")
        
        return jsonify(registration.to_dict()), 201
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error creating registration: {str(e)}")
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
        current_app.logger.error(f"Unexpected error creating registration: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('', methods=['GET'])
@rate_limit(limit=60, window=60, per='user')  # 60 requests per minute per user
@operator_or_supervisor_required
def list_registrations():
    """List weight registrations with optional filtering.
    
    Query parameters:
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
        - supplier: Filter by supplier name
        - cut_type: Filter by cut type
        - date_from: Filter by date (YYYY-MM-DD)
        - date_to: Filter by date (YYYY-MM-DD)
    
    Returns:
        200: List of registrations with metadata
        400: Invalid query parameters
        401: Not authenticated
        403: Insufficient permissions
    """
    try:
        # Log request for monitoring
        current_app.logger.info(f"Registration list request from user {current_user.id} ({current_user.role}): {request.args}")
        
        # Parse and validate query parameters
        try:
            page = request.args.get('page', 1, type=int)
            if page < 1:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Page number must be 1 or greater',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Page must be a valid integer',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        try:
            limit = request.args.get('limit', 20, type=int)
            if limit < 1:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Limit must be 1 or greater',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
            limit = min(limit, 100)  # Cap at 100
        except (ValueError, TypeError):
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Limit must be a valid integer',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        supplier = request.args.get('supplier', '').strip()
        cut_type = request.args.get('cut_type', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        
        # Validate supplier length if provided
        if supplier and len(supplier) > 255:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Supplier filter must be 255 characters or less',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Start with base query
        query = WeightRegistration.query
        
        # Apply role-based filtering: operators see only their own data
        if current_user.role == 'operator':
            query = query.filter(WeightRegistration.registered_by == current_user.id)
        # Supervisors see all data (no additional filtering)
        
        # Apply optional filters
        if supplier:
            query = query.filter(WeightRegistration.supplier.ilike(f'%{supplier}%'))
        
        if cut_type:
            valid_cut_types = ['jamón', 'chuleta']
            if cut_type not in valid_cut_types:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': f'Invalid cut_type. Must be one of: {", ".join(valid_cut_types)}',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
            query = query.filter(WeightRegistration.cut_type == cut_type)
        
        # Apply date filters
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                query = query.filter(WeightRegistration.created_at >= date_from_obj)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Invalid date_from format. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                # Add one day to include the entire date_to day
                query = query.filter(WeightRegistration.created_at < date_to_obj)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Invalid date_to format. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Order by most recent first
        query = query.order_by(WeightRegistration.created_at.desc())
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        registrations = query.offset((page - 1) * limit).limit(limit).all()
        
        # Calculate total weight for current filter
        weight_sum_query = WeightRegistration.query
        if current_user.role == 'operator':
            weight_sum_query = weight_sum_query.filter(WeightRegistration.registered_by == current_user.id)
        if supplier:
            weight_sum_query = weight_sum_query.filter(WeightRegistration.supplier.ilike(f'%{supplier}%'))
        if cut_type:
            weight_sum_query = weight_sum_query.filter(WeightRegistration.cut_type == cut_type)
        if date_from:
            weight_sum_query = weight_sum_query.filter(WeightRegistration.created_at >= date_from_obj)
        if date_to:
            weight_sum_query = weight_sum_query.filter(WeightRegistration.created_at < date_to_obj)
        
        total_weight = db.session.query(db.func.sum(WeightRegistration.weight)).filter(
            weight_sum_query.whereclause
        ).scalar() or 0
        
        # Calculate registrations by supplier for metadata
        supplier_stats_query = weight_sum_query.with_entities(
            WeightRegistration.supplier,
            db.func.count(WeightRegistration.id).label('count'),
            db.func.sum(WeightRegistration.weight).label('total_weight')
        ).group_by(WeightRegistration.supplier)
        
        supplier_stats = supplier_stats_query.all()
        registrations_by_supplier = [
            {
                'supplier': stat.supplier,
                'count': stat.count,
                'total_weight': float(stat.total_weight or 0)
            }
            for stat in supplier_stats
        ]
        
        response_data = {
            'registrations': [reg.to_dict() for reg in registrations],
            'total_count': total_count,
            'total_weight': float(total_weight),
            'registrations_by_supplier': registrations_by_supplier,
            'page': page,
            'limit': limit,
            'has_next': (page * limit) < total_count,
            'has_prev': page > 1
        }
        
        return jsonify(response_data), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error listing registrations: {str(e)}")
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Database operation failed',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error listing registrations: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/today', methods=['GET'])
@rate_limit(limit=60, window=60, per='user')  # 60 requests per minute per user
@operator_or_supervisor_required
def today_registrations():
    """Get today's registrations for the current user (or all for supervisors).
    
    Returns:
        200: Today's registrations with summary
        401: Not authenticated
        403: Insufficient permissions
    """
    try:
        # Log request for monitoring
        current_app.logger.info(f"Today registrations request from user {current_user.id} ({current_user.role})")
        
        # Get today's date range
        today = date.today()
        tomorrow = date.today().replace(day=today.day + 1) if today.day < 28 else date(today.year, today.month + 1, 1)
        
        # Base query for today's registrations
        query = WeightRegistration.query.filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        )
        
        # Apply role-based filtering
        if current_user.role == 'operator':
            query = query.filter(WeightRegistration.registered_by == current_user.id)
        
        # Order by most recent first
        registrations = query.order_by(WeightRegistration.created_at.desc()).all()
        
        # Calculate summary statistics
        total_count = len(registrations)
        total_weight = sum(reg.weight for reg in registrations)
        
        # Calculate registrations by supplier for today
        supplier_breakdown = {}
        for reg in registrations:
            supplier = reg.supplier
            if supplier not in supplier_breakdown:
                supplier_breakdown[supplier] = {
                    'count': 0,
                    'total_weight': 0
                }
            supplier_breakdown[supplier]['count'] += 1
            supplier_breakdown[supplier]['total_weight'] += float(reg.weight)
        
        registrations_by_supplier = [
            {
                'supplier': supplier,
                'count': stats['count'],
                'total_weight': stats['total_weight']
            }
            for supplier, stats in supplier_breakdown.items()
        ]
        
        response_data = {
            'registrations': [reg.to_dict() for reg in registrations],
            'total_count': total_count,
            'total_weight': float(total_weight),
            'registrations_by_supplier': registrations_by_supplier,
            'date': today.isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting today's registrations: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/<registration_id>', methods=['GET'])
@operator_or_supervisor_required
def get_registration(registration_id):
    """Get a specific registration by ID.
    
    Args:
        registration_id: UUID of the registration
    
    Returns:
        200: Registration object
        403: Access denied (operators can only see their own)
        404: Registration not found
    """
    try:
        registration = WeightRegistration.query.get_or_404(registration_id)
        
        # Check if operator is trying to access someone else's registration
        if current_user.role == 'operator' and registration.registered_by != current_user.id:
            return jsonify({
                'error': {
                    'code': 'INSUFFICIENT_PERMISSIONS',
                    'message': 'No tienes permisos para ver este registro',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 403
        
        return jsonify(registration.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting registration {registration_id}: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/<registration_id>', methods=['PUT'])
@operator_or_supervisor_required
def update_registration(registration_id):
    """Update an existing weight registration.
    
    Args:
        registration_id: UUID of the registration to update
    
    Request format:
        PUT /api/v1/registrations/{id}
        {
            "weight": 16.0,
            "cut_type": "chuleta",
            "supplier": "Nuevo Proveedor SA",
            "photo_url": "https://cloudinary.com/new-photo.jpg",
            "ocr_confidence": 0.98,
            "update_reason": "weight_correction"
        }
    
    Returns:
        200: Updated registration object
        400: Validation error
        403: Access denied (operators can only update their own)
        404: Registration not found
        500: Server error
    """
    try:
        # Validate request data
        if not request.is_json:
            return jsonify({
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'La solicitud debe ser JSON',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        data = request.get_json()
        
        # Find the registration
        registration = WeightRegistration.query.filter(
            and_(
                WeightRegistration.id == registration_id,
                WeightRegistration.deleted_at.is_(None)  # Exclude soft deleted
            )
        ).first()
        
        if not registration:
            return jsonify({
                'error': {
                    'code': 'REGISTRATION_NOT_FOUND',
                    'message': 'No se encontró el registro con el ID especificado',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 404
        
        # Check permissions: operators can only update their own registrations
        if current_user.role == 'operator' and registration.registered_by != current_user.id:
            return jsonify({
                'error': {
                    'code': 'INSUFFICIENT_UPDATE_PERMISSIONS',
                    'message': 'No tienes permisos para actualizar este registro',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 403
        
        # Validate fields if provided
        if 'weight' in data:
            weight = data['weight']
            if not isinstance(weight, (int, float)) or weight < 5 or weight > 50:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'El peso debe estar entre 5 y 50 kg',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if 'cut_type' in data:
            valid_cut_types = ['jamón', 'chuleta']
            if data['cut_type'] not in valid_cut_types:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': f'Tipo de corte debe ser uno de: {", ".join(valid_cut_types)}',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if 'supplier' in data:
            supplier = data['supplier'].strip()
            if not supplier or len(supplier) > 255:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'El proveedor debe ser no vacío y menor a 255 caracteres',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if 'photo_url' in data:
            is_valid, error_msg = validate_photo_url(data['photo_url'])
            if not is_valid:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': error_msg,
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if 'ocr_confidence' in data and data['ocr_confidence'] is not None:
            ocr_confidence = data['ocr_confidence']
            if not isinstance(ocr_confidence, (int, float)) or ocr_confidence < 0 or ocr_confidence > 1:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'La confianza OCR debe estar entre 0 y 1',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Calculate changes for audit log
        changes = calculate_changes(registration, data)
        
        # Update the registration
        if 'weight' in data:
            registration.weight = Decimal(str(data['weight']))
        if 'cut_type' in data:
            registration.cut_type = data['cut_type']
        if 'supplier' in data:
            registration.supplier = data['supplier'].strip()
        if 'photo_url' in data:
            registration.photo_url = data['photo_url']
        if 'ocr_confidence' in data:
            registration.ocr_confidence = Decimal(str(data['ocr_confidence'])) if data['ocr_confidence'] is not None else None
        
        # Set audit fields
        registration.updated_by = current_user.id
        registration.update_reason = data.get('update_reason', 'manual_update')
        registration.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Log the update action
        log_registration_action(registration.id, 'UPDATE', changes)
        
        current_app.logger.info(f"Registration {registration_id} updated by user {current_user.name} (ID: {current_user.id})")
        
        return jsonify({
            'registration': registration.to_dict(),
            'metadata': {
                'updated_by': str(current_user.id),
                'update_reason': registration.update_reason,
                'changes': changes
            }
        }), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error updating registration {registration_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Error en la operación de base de datos',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error updating registration {registration_id}: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Error interno del servidor',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/<registration_id>', methods=['DELETE'])
@supervisor_only
def delete_registration(registration_id):
    """Soft delete a weight registration (supervisors only).
    
    Args:
        registration_id: UUID of the registration to delete
    
    Returns:
        204: Registration deleted successfully
        403: Access denied (supervisors only)
        404: Registration not found
        500: Server error
    """
    try:
        # Find the registration
        registration = WeightRegistration.query.filter(
            and_(
                WeightRegistration.id == registration_id,
                WeightRegistration.deleted_at.is_(None)  # Exclude already deleted
            )
        ).first()
        
        if not registration:
            return jsonify({
                'error': {
                    'code': 'REGISTRATION_NOT_FOUND',
                    'message': 'No se encontró el registro con el ID especificado',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 404
        
        # Perform soft delete
        registration.soft_delete(current_user.id)
        
        db.session.commit()
        
        # Log the delete action
        log_registration_action(registration.id, 'DELETE', {'deleted_by': str(current_user.id)})
        
        current_app.logger.info(f"Registration {registration_id} deleted by supervisor {current_user.name} (ID: {current_user.id})")
        
        return '', 204
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error deleting registration {registration_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Error en la operación de base de datos',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error deleting registration {registration_id}: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Error interno del servidor',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/stats', methods=['GET'])
@rate_limit(limit=30, window=60, per='user')  # 30 requests per minute per user
@operator_or_supervisor_required
def get_registration_stats():
    """Get aggregate statistics for weight registrations.
    
    Query parameters:
        - date_from: Start date (YYYY-MM-DD, default: 30 days ago)
        - date_to: End date (YYYY-MM-DD, default: today)
        - grouping: Grouping level ('daily', 'weekly', 'monthly', default: 'daily')
    
    Returns:
        200: Statistics object with aggregated data
        400: Invalid query parameters
        401: Not authenticated
        500: Server error
    """
    try:
        # Parse query parameters
        date_from_str = request.args.get('date_from')
        date_to_str = request.args.get('date_to')
        grouping = request.args.get('grouping', 'daily')
        
        # Default date range: last 30 days
        if not date_from_str:
            date_from = datetime.utcnow().date().replace(day=1)  # First day of current month
        else:
            try:
                date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Formato de fecha_desde inválido. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if not date_to_str:
            date_to = datetime.utcnow().date()
        else:
            try:
                date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Formato de fecha_hasta inválido. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Validate grouping
        valid_groupings = ['daily', 'weekly', 'monthly']
        if grouping not in valid_groupings:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': f'Agrupación debe ser uno de: {", ".join(valid_groupings)}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Base query with date filtering and soft delete exclusion
        base_query = WeightRegistration.query.filter(
            and_(
                WeightRegistration.created_at >= date_from,
                WeightRegistration.created_at <= date_to,
                WeightRegistration.deleted_at.is_(None)
            )
        )
        
        # Apply role-based filtering
        if current_user.role == 'operator':
            base_query = base_query.filter(WeightRegistration.registered_by == current_user.id)
        
        # Calculate total statistics
        total_count = base_query.count()
        total_weight = db.session.query(func.sum(WeightRegistration.weight)).filter(
            base_query.whereclause
        ).scalar() or 0
        
        average_weight = float(total_weight / total_count) if total_count > 0 else 0
        
        # Calculate statistics by cut type
        cut_type_stats = {}
        for cut_type in ['jamón', 'chuleta']:
            cut_query = base_query.filter(WeightRegistration.cut_type == cut_type)
            cut_count = cut_query.count()
            cut_weight = db.session.query(func.sum(WeightRegistration.weight)).filter(
                cut_query.whereclause
            ).scalar() or 0
            
            cut_type_stats[cut_type] = {
                'count': cut_count,
                'total_weight': float(cut_weight),
                'average_weight': float(cut_weight / cut_count) if cut_count > 0 else 0
            }
        
        # Calculate statistics by supplier (top 5)
        supplier_stats = db.session.query(
            WeightRegistration.supplier,
            func.count(WeightRegistration.id).label('count'),
            func.sum(WeightRegistration.weight).label('total_weight')
        ).filter(
            base_query.whereclause
        ).group_by(WeightRegistration.supplier).order_by(
            func.sum(WeightRegistration.weight).desc()
        ).limit(5).all()
        
        supplier_data = {}
        for supplier, count, weight in supplier_stats:
            supplier_data[supplier] = {
                'count': count,
                'total_weight': float(weight),
                'average_weight': float(weight / count) if count > 0 else 0
            }
        
        response_data = {
            'stats': {
                'total_registrations': total_count,
                'total_weight': float(total_weight),
                'average_weight': round(average_weight, 2),
                'by_cut_type': cut_type_stats,
                'by_supplier': supplier_data,
                'date_range': {
                    'from': date_from.isoformat(),
                    'to': date_to.isoformat(),
                    'grouping': grouping
                }
            },
            'metadata': {
                'user_role': current_user.role,
                'generated_at': datetime.utcnow().isoformat(),
                'filtered_by_user': current_user.role == 'operator'
            }
        }
        
        return jsonify(response_data), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error calculating statistics: {str(e)}")
        return jsonify({
            'error': {
                'code': 'STATISTICS_CALCULATION_ERROR',
                'message': 'Error calculando estadísticas',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error calculating statistics: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Error interno del servidor',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/search', methods=['GET'])
@rate_limit(limit=60, window=60, per='user')  # 60 requests per minute per user
@operator_or_supervisor_required
def search_registrations():
    """Advanced search for weight registrations with multiple criteria.
    
    Query parameters:
        - q: General search query (searches supplier names)
        - supplier: Exact or partial supplier name match
        - cut_type: Filter by cut type ('jamón' or 'chuleta')
        - min_weight: Minimum weight (kg)
        - max_weight: Maximum weight (kg)
        - date_from: Start date (YYYY-MM-DD)
        - date_to: End date (YYYY-MM-DD)
        - sort_by: Sort field ('weight', 'date', 'supplier', default: 'created_at')
        - sort_order: Sort direction ('asc' or 'desc', default: 'desc')
        - cursor: Pagination cursor
        - limit: Items per page (1-100, default: 20)
    
    Returns:
        200: Search results with pagination
        400: Invalid search criteria
        401: Not authenticated
        500: Server error
    """
    try:
        # Get pagination parameters
        pagination_params = get_pagination_params()
        
        # Parse search parameters
        query_text = request.args.get('q', '').strip()
        supplier = request.args.get('supplier', '').strip()
        cut_type = request.args.get('cut_type', '').strip()
        min_weight = request.args.get('min_weight', type=float)
        max_weight = request.args.get('max_weight', type=float)
        date_from_str = request.args.get('date_from', '').strip()
        date_to_str = request.args.get('date_to', '').strip()
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Validate sort parameters
        valid_sort_fields = ['weight', 'created_at', 'supplier', 'cut_type']
        if sort_by not in valid_sort_fields:
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': f'Campo de ordenamiento debe ser uno de: {", ".join(valid_sort_fields)}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        if sort_order not in ['asc', 'desc']:
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': 'Orden debe ser "asc" o "desc"',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate cut_type if provided
        if cut_type and cut_type not in ['jamón', 'chuleta']:
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': 'Tipo de corte debe ser "jamón" o "chuleta"',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate weight range
        if min_weight is not None and (min_weight < 0 or min_weight > 100):
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': 'Peso mínimo debe estar entre 0 y 100 kg',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        if max_weight is not None and (max_weight < 0 or max_weight > 100):
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': 'Peso máximo debe estar entre 0 y 100 kg',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        if min_weight is not None and max_weight is not None and min_weight > max_weight:
            return jsonify({
                'error': {
                    'code': 'INVALID_SEARCH_CRITERIA',
                    'message': 'Peso mínimo no puede ser mayor que peso máximo',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Parse dates
        date_from = None
        date_to = None
        
        if date_from_str:
            try:
                date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'INVALID_SEARCH_CRITERIA',
                        'message': 'Formato de fecha_desde inválido. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        if date_to_str:
            try:
                date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'INVALID_SEARCH_CRITERIA',
                        'message': 'Formato de fecha_hasta inválido. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Build base query
        query = WeightRegistration.query.filter(
            WeightRegistration.deleted_at.is_(None)  # Exclude soft deleted
        )
        
        # Apply role-based filtering
        if current_user.role == 'operator':
            query = query.filter(WeightRegistration.registered_by == current_user.id)
        
        # Apply search filters
        if query_text or supplier:
            search_term = query_text or supplier
            query = query.filter(WeightRegistration.supplier.ilike(f'%{search_term}%'))
        
        if cut_type:
            query = query.filter(WeightRegistration.cut_type == cut_type)
        
        if min_weight is not None:
            query = query.filter(WeightRegistration.weight >= min_weight)
        
        if max_weight is not None:
            query = query.filter(WeightRegistration.weight <= max_weight)
        
        if date_from:
            query = query.filter(WeightRegistration.created_at >= date_from)
        
        if date_to:
            # Include the entire end date
            end_datetime = datetime.combine(date_to, datetime.max.time())
            query = query.filter(WeightRegistration.created_at <= end_datetime)
        
        # Apply cursor-based pagination
        items, next_cursor, has_next = apply_cursor_pagination(
            query=query,
            model=WeightRegistration,
            cursor=pagination_params['cursor'],
            limit=pagination_params['limit'],
            order_by=sort_by,
            order_dir=sort_order
        )
        
        # Get total count for search results
        total_count = query.count()
        
        # Calculate total weight for current search
        total_weight = db.session.query(func.sum(WeightRegistration.weight)).filter(
            query.whereclause
        ).scalar() or 0
        
        response_data = {
            'search_results': [item.to_dict() for item in items],
            'pagination': {
                'has_next': has_next,
                'next_cursor': next_cursor,
                'count': len(items),
                'total_count': total_count
            },
            'summary': {
                'total_weight': float(total_weight),
                'average_weight': float(total_weight / total_count) if total_count > 0 else 0
            },
            'search_criteria': {
                'query': query_text,
                'supplier': supplier,
                'cut_type': cut_type,
                'min_weight': min_weight,
                'max_weight': max_weight,
                'date_from': date_from.isoformat() if date_from else None,
                'date_to': date_to.isoformat() if date_to else None,
                'sort_by': sort_by,
                'sort_order': sort_order
            }
        }
        
        return jsonify(response_data), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error during search: {str(e)}")
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Error en la operación de base de datos',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error during search: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Error interno del servidor',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


@registrations_bp.route('/<registration_id>/photo', methods=['PATCH'])
@operator_or_supervisor_required  
def update_registration_photo(registration_id):
    """Update the photo for a weight registration.
    
    Args:
        registration_id: UUID of the registration to update
    
    Request format:
        PATCH /api/v1/registrations/{id}/photo
        {
            "photo_url": "https://cloudinary.com/new-photo.jpg",
            "ocr_confidence": 0.95,
            "update_reason": "better_photo"
        }
    
    Returns:
        200: Updated registration object
        400: Validation error
        403: Access denied (operators can only update their own)
        404: Registration not found
        500: Server error
    """
    try:
        # Validate request data
        if not request.is_json:
            return jsonify({
                'error': {
                    'code': 'INVALID_REQUEST',
                    'message': 'La solicitud debe ser JSON',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'photo_url' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Se requiere el campo photo_url',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Find the registration
        registration = WeightRegistration.query.filter(
            and_(
                WeightRegistration.id == registration_id,
                WeightRegistration.deleted_at.is_(None)  # Exclude soft deleted
            )
        ).first()
        
        if not registration:
            return jsonify({
                'error': {
                    'code': 'REGISTRATION_NOT_FOUND',
                    'message': 'No se encontró el registro con el ID especificado',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 404
        
        # Check permissions: operators can only update their own registrations
        if current_user.role == 'operator' and registration.registered_by != current_user.id:
            return jsonify({
                'error': {
                    'code': 'INSUFFICIENT_UPDATE_PERMISSIONS',
                    'message': 'No tienes permisos para actualizar este registro',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 403
        
        # Validate photo URL
        photo_url = data['photo_url']
        is_valid, error_msg = validate_photo_url(photo_url)
        if not is_valid:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': error_msg,
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Validate OCR confidence if provided
        ocr_confidence = data.get('ocr_confidence')
        if ocr_confidence is not None:
            if not isinstance(ocr_confidence, (int, float)) or ocr_confidence < 0 or ocr_confidence > 1:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'La confianza OCR debe estar entre 0 y 1',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Store old photo URL for audit purposes
        old_photo_url = registration.photo_url
        
        # Calculate changes for audit log
        changes = {
            'photo_url': {
                'old': old_photo_url,
                'new': photo_url
            }
        }
        
        if ocr_confidence is not None:
            old_confidence = float(registration.ocr_confidence) if registration.ocr_confidence else None
            changes['ocr_confidence'] = {
                'old': old_confidence,
                'new': ocr_confidence
            }
        
        # Update the registration
        registration.photo_url = photo_url
        if ocr_confidence is not None:
            registration.ocr_confidence = Decimal(str(ocr_confidence))
        
        # Set audit fields
        registration.updated_by = current_user.id
        registration.update_reason = data.get('update_reason', 'photo_update')
        registration.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Log the update action
        log_registration_action(registration.id, 'UPDATE', changes)
        
        current_app.logger.info(f"Photo updated for registration {registration_id} by user {current_user.name} (ID: {current_user.id})")
        
        # TODO: In production, implement old photo cleanup from storage here
        # This would involve calling the storage service (S3/Cloudinary) to delete the old photo
        if old_photo_url and old_photo_url != photo_url:
            current_app.logger.info(f"Old photo URL marked for cleanup: {old_photo_url}")
        
        return jsonify({
            'registration': registration.to_dict(),
            'metadata': {
                'updated_by': str(current_user.id),
                'update_reason': registration.update_reason,
                'old_photo_url': old_photo_url,
                'changes': changes
            }
        }), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error updating photo for registration {registration_id}: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'PHOTO_UPDATE_FAILED',
                'message': 'Error actualizando la foto del registro',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error updating photo for registration {registration_id}: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Error interno del servidor',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500