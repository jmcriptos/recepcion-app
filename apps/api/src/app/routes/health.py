"""Health check endpoints for system monitoring and deployment validation."""
import os
import psutil
from datetime import datetime
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from app.models import db

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint with system information.
    
    Returns:
        JSON response with:
        - status: "healthy" if system is operational
        - timestamp: ISO date-time of the check
        - database_connected: boolean indicating database connectivity
        - environment: current environment (development/production)
        - version: application version
        - uptime_seconds: system uptime in seconds
        - memory_usage_percent: current memory usage percentage
        - cpu_usage_percent: current CPU usage percentage
    """
    try:
        # Test database connectivity with a simple query
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        database_connected = True
    except Exception:
        database_connected = False
    
    # Get system information
    try:
        memory_info = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        boot_time = psutil.boot_time()
        uptime_seconds = int(datetime.utcnow().timestamp() - boot_time)
    except Exception:
        memory_info = None
        cpu_percent = None
        uptime_seconds = None
    
    # Get environment and version information
    environment = current_app.config.get('ENV', 'unknown')
    version = os.environ.get('HEROKU_SLUG_COMMIT', '1.0.0')[:8]  # Short commit hash
    
    response_data = {
        "status": "healthy" if database_connected else "unhealthy",
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "database_connected": database_connected,
        "environment": environment,
        "version": version,
        "uptime_seconds": uptime_seconds,
        "memory_usage_percent": memory_info.percent if memory_info else None,
        "cpu_usage_percent": cpu_percent
    }
    
    status_code = 200 if database_connected else 503
    response = jsonify(response_data)
    
    # Add API version headers
    response.headers['X-API-Version'] = 'v1'
    response.headers['X-API-Deprecated'] = 'false'
    
    return response, status_code