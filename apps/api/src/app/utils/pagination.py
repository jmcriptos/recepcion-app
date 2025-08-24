"""Pagination utilities for efficient data retrieval."""
import base64
import json
from datetime import datetime
from flask import request
from sqlalchemy import desc, asc


def encode_cursor(data):
    """Encode cursor data to base64 string.
    
    Args:
        data: Dictionary containing cursor data
        
    Returns:
        Base64 encoded cursor string
    """
    cursor_json = json.dumps(data, default=str)
    return base64.b64encode(cursor_json.encode()).decode()


def decode_cursor(cursor_str):
    """Decode base64 cursor string to data.
    
    Args:
        cursor_str: Base64 encoded cursor string
        
    Returns:
        Dictionary containing cursor data or None if invalid
    """
    try:
        cursor_json = base64.b64decode(cursor_str.encode()).decode()
        return json.loads(cursor_json)
    except (ValueError, json.JSONDecodeError):
        return None


def apply_cursor_pagination(query, model, cursor=None, limit=20, order_by='created_at', order_dir='desc'):
    """Apply cursor-based pagination to a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy query object
        model: SQLAlchemy model class
        cursor: Cursor string from previous request
        limit: Number of items per page (max 100)
        order_by: Field to order by (default: created_at)
        order_dir: Order direction ('asc' or 'desc', default: 'desc')
        
    Returns:
        Tuple of (items, next_cursor, has_next)
    """
    # Validate and sanitize limit
    limit = min(max(1, limit), 100)
    
    # Get the order field and direction
    order_field = getattr(model, order_by, model.created_at)
    order_func = desc if order_dir == 'desc' else asc
    
    # Apply cursor filtering if provided
    if cursor:
        cursor_data = decode_cursor(cursor)
        if cursor_data and order_by in cursor_data:
            cursor_value = cursor_data[order_by]
            
            # Convert string back to datetime if needed
            if order_by in ['created_at', 'updated_at'] and isinstance(cursor_value, str):
                try:
                    cursor_value = datetime.fromisoformat(cursor_value.replace('Z', '+00:00'))
                except ValueError:
                    cursor_value = None
            
            if cursor_value is not None:
                if order_dir == 'desc':
                    query = query.filter(order_field < cursor_value)
                else:
                    query = query.filter(order_field > cursor_value)
    
    # Apply ordering and limit
    query = query.order_by(order_func(order_field))
    
    # Fetch one extra item to check if there are more pages
    items = query.limit(limit + 1).all()
    
    # Check if there are more items
    has_next = len(items) > limit
    if has_next:
        items = items[:-1]  # Remove the extra item
    
    # Generate next cursor
    next_cursor = None
    if has_next and items:
        last_item = items[-1]
        cursor_value = getattr(last_item, order_by)
        
        # Convert datetime to string for JSON serialization
        if isinstance(cursor_value, datetime):
            cursor_value = cursor_value.isoformat()
        
        next_cursor = encode_cursor({order_by: cursor_value})
    
    return items, next_cursor, has_next


def get_pagination_params():
    """Extract pagination parameters from request.
    
    Returns:
        Dictionary with pagination parameters
    """
    return {
        'cursor': request.args.get('cursor'),
        'limit': request.args.get('limit', 20, type=int),
        'order_by': request.args.get('order_by', 'created_at'),
        'order_dir': request.args.get('order_dir', 'desc')
    }


def create_pagination_response(items, next_cursor, has_next, total_count=None):
    """Create standardized pagination response.
    
    Args:
        items: List of items for current page
        next_cursor: Cursor for next page (None if no next page)
        has_next: Boolean indicating if there are more pages
        total_count: Optional total count of items
        
    Returns:
        Dictionary with pagination metadata
    """
    response = {
        'items': [item.to_dict() if hasattr(item, 'to_dict') else item for item in items],
        'pagination': {
            'has_next': has_next,
            'next_cursor': next_cursor,
            'count': len(items)
        }
    }
    
    if total_count is not None:
        response['pagination']['total_count'] = total_count
    
    return response