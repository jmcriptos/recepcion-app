"""Reports and export routes for supervisor data analysis."""
import csv
import io
from datetime import datetime, date
from flask import Blueprint, request, jsonify, current_app, make_response
from flask_login import current_user
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_
from app.models.registration import WeightRegistration
from app.models.user import User
from app.models import db
from app.middleware.auth_middleware import supervisor_only

# Create reports blueprint
reports_bp = Blueprint('reports', __name__, url_prefix='/api/v1/reports')


@reports_bp.route('/export', methods=['GET'])
@supervisor_only
def export_registrations():
    """Export weight registrations as CSV (supervisors only).
    
    Query parameters:
        - date_from: Start date (YYYY-MM-DD)
        - date_to: End date (YYYY-MM-DD)
        - supplier: Filter by supplier name
        - cut_type: Filter by cut type
        - user_id: Filter by user who registered
        - format: Export format (csv, json) - defaults to csv
    
    Returns:
        200: CSV file with registration data
        400: Invalid query parameters
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
    """
    try:
        # Parse query parameters
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        supplier = request.args.get('supplier', '').strip()
        cut_type = request.args.get('cut_type', '').strip()
        user_id = request.args.get('user_id', '').strip()
        export_format = request.args.get('format', 'csv').strip().lower()
        
        # Validate export format
        if export_format not in ['csv', 'json']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Format must be csv or json',
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request.headers.get('X-Request-ID', 'unknown')
                }
            }), 400
        
        # Start with base query including user information
        query = db.session.query(
            WeightRegistration,
            User.name.label('user_name'),
            User.role.label('user_role')
        ).join(User, WeightRegistration.registered_by == User.id)
        
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
        
        if user_id:
            query = query.filter(WeightRegistration.registered_by == user_id)
        
        # Order by creation date
        query = query.order_by(WeightRegistration.created_at.desc())
        
        # Execute query
        results = query.all()
        
        if export_format == 'csv':
            return _export_csv(results, date_from, date_to)
        else:
            return _export_json(results)
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error exporting registrations: {str(e)}")
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Database operation failed',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error exporting registrations: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500


def _export_csv(results, date_from=None, date_to=None):
    """Export results as CSV format."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'ID',
        'Weight (kg)',
        'Cut Type',
        'Supplier',
        'Registered By',
        'User Role',
        'Photo URL',
        'OCR Confidence',
        'Sync Status',
        'Created At',
        'Updated At'
    ])
    
    # Write data rows
    for result in results:
        registration = result.WeightRegistration
        user_name = result.user_name
        user_role = result.user_role
        
        writer.writerow([
            str(registration.id),
            registration.weight,
            registration.cut_type,
            registration.supplier,
            user_name,
            user_role,
            registration.photo_url or '',
            registration.ocr_confidence or '',
            registration.sync_status,
            registration.created_at.isoformat(),
            registration.updated_at.isoformat()
        ])
    
    # Create response
    output.seek(0)
    csv_data = output.getvalue()
    output.close()
    
    response = make_response(csv_data)
    
    # Generate filename with date range
    filename = 'weight_registrations'
    if date_from and date_to:
        filename += f'_{date_from}_to_{date_to}'
    elif date_from:
        filename += f'_from_{date_from}'
    elif date_to:
        filename += f'_to_{date_to}'
    filename += '.csv'
    
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    
    current_app.logger.info(f"Export completed: {len(results)} registrations exported as CSV")
    
    return response


def _export_json(results):
    """Export results as JSON format."""
    data = []
    for result in results:
        registration = result.WeightRegistration
        reg_dict = registration.to_dict()
        reg_dict['registered_by_name'] = result.user_name
        reg_dict['registered_by_role'] = result.user_role
        data.append(reg_dict)
    
    response_data = {
        'registrations': data,
        'total_count': len(data),
        'exported_at': datetime.utcnow().isoformat(),
        'exported_by': current_user.name
    }
    
    current_app.logger.info(f"Export completed: {len(results)} registrations exported as JSON")
    
    return jsonify(response_data), 200


@reports_bp.route('/summary', methods=['GET'])
@supervisor_only
def get_summary_report():
    """Get summary statistics for a date range (supervisors only).
    
    Query parameters:
        - date_from: Start date (YYYY-MM-DD)
        - date_to: End date (YYYY-MM-DD)
    
    Returns:
        200: Summary statistics
        400: Invalid query parameters
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
    """
    try:
        # Parse query parameters
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        
        # Default to last 30 days if no dates provided
        if not date_from and not date_to:
            end_date = date.today()
            start_date = end_date.replace(day=1)  # First day of current month
        else:
            # Parse provided dates
            try:
                start_date = datetime.strptime(date_from, '%Y-%m-%d').date() if date_from else date.today().replace(day=1)
                end_date = datetime.strptime(date_to, '%Y-%m-%d').date() if date_to else date.today()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': 'Invalid date format. Use YYYY-MM-DD',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown')
                    }
                }), 400
        
        # Build query for date range
        query_filter = and_(
            WeightRegistration.created_at >= start_date,
            WeightRegistration.created_at < end_date
        )
        
        # Total registrations and weight
        total_registrations = WeightRegistration.query.filter(query_filter).count()
        total_weight = db.session.query(
            db.func.sum(WeightRegistration.weight)
        ).filter(query_filter).scalar() or 0
        
        # Average weight
        avg_weight = db.session.query(
            db.func.avg(WeightRegistration.weight)
        ).filter(query_filter).scalar() or 0
        
        # By cut type
        cut_type_summary = db.session.query(
            WeightRegistration.cut_type,
            db.func.count(WeightRegistration.id).label('count'),
            db.func.sum(WeightRegistration.weight).label('total_weight'),
            db.func.avg(WeightRegistration.weight).label('avg_weight')
        ).filter(query_filter).group_by(WeightRegistration.cut_type).all()
        
        # By user
        user_summary = db.session.query(
            User.name,
            User.role,
            db.func.count(WeightRegistration.id).label('count'),
            db.func.sum(WeightRegistration.weight).label('total_weight')
        ).join(
            WeightRegistration, User.id == WeightRegistration.registered_by
        ).filter(query_filter).group_by(User.id, User.name, User.role).all()
        
        # Top suppliers
        supplier_summary = db.session.query(
            WeightRegistration.supplier,
            db.func.count(WeightRegistration.id).label('count'),
            db.func.sum(WeightRegistration.weight).label('total_weight')
        ).filter(query_filter).group_by(
            WeightRegistration.supplier
        ).order_by(
            db.func.sum(WeightRegistration.weight).desc()
        ).limit(10).all()
        
        response_data = {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'totals': {
                'total_registrations': total_registrations,
                'total_weight': float(total_weight),
                'average_weight': float(avg_weight)
            },
            'by_cut_type': [
                {
                    'cut_type': item.cut_type,
                    'count': item.count,
                    'total_weight': float(item.total_weight or 0),
                    'avg_weight': float(item.avg_weight or 0)
                }
                for item in cut_type_summary
            ],
            'by_user': [
                {
                    'user_name': item.name,
                    'user_role': item.role,
                    'count': item.count,
                    'total_weight': float(item.total_weight or 0)
                }
                for item in user_summary
            ],
            'top_suppliers': [
                {
                    'supplier': item.supplier,
                    'count': item.count,
                    'total_weight': float(item.total_weight or 0)
                }
                for item in supplier_summary
            ],
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error generating summary report: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request.headers.get('X-Request-ID', 'unknown')
            }
        }), 500