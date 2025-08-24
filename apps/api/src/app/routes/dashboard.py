"""Dashboard routes for supervisor analytics and real-time metrics."""
from datetime import datetime, date, timedelta
from flask import Blueprint, jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, and_
from app.models.registration import WeightRegistration
from app.models.user import User
from app.models import db
from app.middleware.auth_middleware import supervisor_only

# Create dashboard blueprint
dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/v1/dashboard')


@dashboard_bp.route('', methods=['GET'])
@supervisor_only
def get_dashboard_stats():
    """Get real-time dashboard statistics for supervisors.
    
    Returns:
        200: Dashboard statistics including:
            - total_boxes_today: Number of registrations today
            - total_weight_today: Total weight registered today
            - registrations_by_supplier: Breakdown by supplier
            - registrations_by_user: Breakdown by user
            - recent_registrations: Last 10 registrations
            - hourly_stats: Registrations per hour today
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
    """
    try:
        # Get today's date range
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        # Total boxes and weight today
        today_query = WeightRegistration.query.filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        )
        
        total_boxes_today = today_query.count()
        total_weight_today = db.session.query(
            func.sum(WeightRegistration.weight)
        ).filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        ).scalar() or 0
        
        # Registrations by supplier today
        supplier_stats = db.session.query(
            WeightRegistration.supplier,
            func.count(WeightRegistration.id).label('count'),
            func.sum(WeightRegistration.weight).label('total_weight')
        ).filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        ).group_by(WeightRegistration.supplier).all()
        
        registrations_by_supplier = [
            {
                'supplier': stat.supplier,
                'count': stat.count,
                'total_weight': float(stat.total_weight or 0)
            }
            for stat in supplier_stats
        ]
        
        # Registrations by user today
        user_stats = db.session.query(
            User.name,
            User.role,
            func.count(WeightRegistration.id).label('count'),
            func.sum(WeightRegistration.weight).label('total_weight')
        ).join(
            WeightRegistration, User.id == WeightRegistration.registered_by
        ).filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        ).group_by(User.id, User.name, User.role).all()
        
        registrations_by_user = [
            {
                'user_name': stat.name,
                'user_role': stat.role,
                'count': stat.count,
                'total_weight': float(stat.total_weight or 0)
            }
            for stat in user_stats
        ]
        
        # Recent registrations (last 10)
        recent_registrations = WeightRegistration.query.order_by(
            WeightRegistration.created_at.desc()
        ).limit(10).all()
        
        # Hourly stats for today
        hourly_stats = []
        for hour in range(24):
            hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
            hour_end = hour_start + timedelta(hours=1)
            
            hour_count = WeightRegistration.query.filter(
                and_(
                    WeightRegistration.created_at >= hour_start,
                    WeightRegistration.created_at < hour_end
                )
            ).count()
            
            hourly_stats.append({
                'hour': hour,
                'count': hour_count
            })
        
        # Cut type breakdown today
        cut_type_stats = db.session.query(
            WeightRegistration.cut_type,
            func.count(WeightRegistration.id).label('count'),
            func.sum(WeightRegistration.weight).label('total_weight')
        ).filter(
            and_(
                WeightRegistration.created_at >= today,
                WeightRegistration.created_at < tomorrow
            )
        ).group_by(WeightRegistration.cut_type).all()
        
        registrations_by_cut_type = [
            {
                'cut_type': stat.cut_type,
                'count': stat.count,
                'total_weight': float(stat.total_weight or 0)
            }
            for stat in cut_type_stats
        ]
        
        response_data = {
            'date': today.isoformat(),
            'total_boxes_today': total_boxes_today,
            'total_weight_today': float(total_weight_today),
            'registrations_by_supplier': registrations_by_supplier,
            'registrations_by_user': registrations_by_user,
            'registrations_by_cut_type': registrations_by_cut_type,
            'recent_registrations': [reg.to_dict() for reg in recent_registrations],
            'hourly_stats': hourly_stats,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data), 200
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error getting dashboard stats: {str(e)}")
        return jsonify({
            'error': {
                'code': 'DATABASE_ERROR',
                'message': 'Database operation failed',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': 'unknown'
            }
        }), 500
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting dashboard stats: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': 'unknown'
            }
        }), 500


@dashboard_bp.route('/weekly', methods=['GET'])
@supervisor_only
def get_weekly_stats():
    """Get weekly statistics for the dashboard.
    
    Returns:
        200: Weekly statistics including daily breakdowns
        401: Not authenticated
        403: Insufficient permissions (not supervisor)
    """
    try:
        # Get the last 7 days
        today = date.today()
        week_ago = today - timedelta(days=7)
        
        daily_stats = []
        for i in range(7):
            day = week_ago + timedelta(days=i)
            next_day = day + timedelta(days=1)
            
            day_query = WeightRegistration.query.filter(
                and_(
                    WeightRegistration.created_at >= day,
                    WeightRegistration.created_at < next_day
                )
            )
            
            day_count = day_query.count()
            day_weight = db.session.query(
                func.sum(WeightRegistration.weight)
            ).filter(
                and_(
                    WeightRegistration.created_at >= day,
                    WeightRegistration.created_at < next_day
                )
            ).scalar() or 0
            
            daily_stats.append({
                'date': day.isoformat(),
                'day_name': day.strftime('%A'),
                'count': day_count,
                'total_weight': float(day_weight)
            })
        
        # Calculate week totals
        total_week_count = sum(day['count'] for day in daily_stats)
        total_week_weight = sum(day['total_weight'] for day in daily_stats)
        
        response_data = {
            'week_start': week_ago.isoformat(),
            'week_end': today.isoformat(),
            'total_week_count': total_week_count,
            'total_week_weight': total_week_weight,
            'daily_stats': daily_stats,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting weekly stats: {str(e)}")
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error',
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': 'unknown'
            }
        }), 500