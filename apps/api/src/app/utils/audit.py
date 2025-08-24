"""Audit logging utilities for tracking registration changes."""
from datetime import datetime
from flask import request, current_app
from flask_login import current_user
from app.models.audit_log import RegistrationAuditLog
from app.models import db


def log_registration_action(registration_id, action, changes=None):
    """Log a registration action for audit purposes.
    
    Args:
        registration_id: UUID of the registration
        action: Action performed ('CREATE', 'UPDATE', 'DELETE')
        changes: Dictionary of field changes (old_value -> new_value)
    """
    try:
        # Get request metadata
        ip_address = request.remote_addr if request else None
        user_agent = request.headers.get('User-Agent') if request else None
        
        # Create audit log entry
        audit_log = RegistrationAuditLog(
            registration_id=registration_id,
            action=action,
            user_id=current_user.id,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.session.add(audit_log)
        db.session.commit()
        
        current_app.logger.info(
            f"Audit log created: {action} on registration {registration_id} by user {current_user.id}"
        )
        
    except Exception as e:
        current_app.logger.error(f"Failed to create audit log: {str(e)}")
        # Don't let audit logging failures break the main operation
        db.session.rollback()


def calculate_changes(old_obj, new_data):
    """Calculate changes between old object and new data.
    
    Args:
        old_obj: Original registration object
        new_data: Dictionary of new values
        
    Returns:
        Dictionary of changes in format {field: {'old': old_value, 'new': new_value}}
    """
    changes = {}
    
    # Fields to track for changes
    tracked_fields = ['weight', 'cut_type', 'supplier', 'photo_url', 'ocr_confidence']
    
    for field in tracked_fields:
        if field in new_data:
            old_value = getattr(old_obj, field, None)
            new_value = new_data[field]
            
            # Convert Decimal to float for comparison
            if hasattr(old_value, '__float__'):
                old_value = float(old_value)
            if hasattr(new_value, '__float__'):
                new_value = float(new_value)
            
            if old_value != new_value:
                changes[field] = {
                    'old': old_value,
                    'new': new_value
                }
    
    return changes if changes else None


def get_client_ip():
    """Get the client IP address from request headers."""
    if request:
        # Check for forwarded headers first (proxy/load balancer)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
            
        return request.remote_addr
    
    return None


def sanitize_user_agent(user_agent):
    """Sanitize user agent string for logging."""
    if not user_agent:
        return None
    
    # Truncate to prevent storage issues
    return user_agent[:500] if len(user_agent) > 500 else user_agent