"""API v1 endpoints for versioned API structure."""
import time
from datetime import datetime
from flask import Blueprint, jsonify
from sqlalchemy import text
from app.models import db

api_v1_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')


@api_v1_bp.route('/ping', methods=['GET'])
def ping():
    """API v1 ping endpoint with database connectivity and response time metrics.
    
    Returns:
        JSON response with:
        - message: "pong" indicating successful response
        - timestamp: Server timestamp in UTC ISO format
        - database_connected: boolean indicating database connectivity
        - response_time_ms: Response time in milliseconds
        - database_response_time_ms: Database query response time
    """
    start_time = time.time()
    
    # Test database connectivity and measure response time
    db_start_time = time.time()
    try:
        db.session.execute(text('SELECT 1'))
        database_connected = True
        db_response_time = (time.time() - db_start_time) * 1000  # Convert to milliseconds
    except Exception:
        database_connected = False
        db_response_time = None
    
    total_response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    
    response_data = {
        "message": "pong",
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "database_connected": database_connected,
        "response_time_ms": round(total_response_time, 2),
        "database_response_time_ms": round(db_response_time, 2) if db_response_time else None
    }
    
    return jsonify(response_data), 200


@api_v1_bp.after_request
def add_version_headers(response):
    """Add API version headers to all v1 responses."""
    response.headers['X-API-Version'] = 'v1'
    response.headers['X-API-Deprecated'] = 'false'
    return response