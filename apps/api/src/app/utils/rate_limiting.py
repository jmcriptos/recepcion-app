"""Rate limiting utilities for API endpoints."""
import time
from functools import wraps
from flask import request, jsonify, current_app
from flask_login import current_user
from datetime import datetime, timedelta
from collections import defaultdict, deque


class InMemoryRateLimiter:
    """Simple in-memory rate limiter for development/testing."""
    
    def __init__(self):
        # Store request timestamps per user/IP
        self.requests = defaultdict(deque)
    
    def is_allowed(self, key, limit, window_seconds):
        """Check if request is allowed based on rate limit."""
        now = time.time()
        window_start = now - window_seconds
        
        # Remove old requests outside the window
        while self.requests[key] and self.requests[key][0] < window_start:
            self.requests[key].popleft()
        
        # Check if under limit
        if len(self.requests[key]) < limit:
            self.requests[key].append(now)
            return True
        
        return False
    
    def time_until_reset(self, key, window_seconds):
        """Get time until rate limit resets."""
        if not self.requests[key]:
            return 0
        
        oldest_request = self.requests[key][0]
        reset_time = oldest_request + window_seconds
        return max(0, reset_time - time.time())


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


def rate_limit(limit=60, window=60, per='user'):
    """Rate limiting decorator.
    
    Args:
        limit: Number of requests allowed
        window: Time window in seconds
        per: Rate limit per 'user' or 'ip'
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Determine the key for rate limiting
            if per == 'user' and current_user.is_authenticated:
                key = f"user:{current_user.id}"
            else:
                key = f"ip:{request.remote_addr}"
            
            # Check rate limit
            if not rate_limiter.is_allowed(key, limit, window):
                reset_time = rate_limiter.time_until_reset(key, window)
                
                current_app.logger.warning(f"Rate limit exceeded for {key} on {request.endpoint}")
                
                return jsonify({
                    'error': {
                        'code': 'RATE_LIMIT_EXCEEDED',
                        'message': 'Demasiadas solicitudes. Intente nuevamente más tarde.',
                        'timestamp': datetime.utcnow().isoformat(),
                        'requestId': request.headers.get('X-Request-ID', 'unknown'),
                        'retry_after': int(reset_time) + 1
                    }
                }), 429
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_client_key():
    """Get unique key for rate limiting."""
    if current_user.is_authenticated:
        return f"user:{current_user.id}"
    return f"ip:{request.remote_addr}"


def log_rate_limit_hit(key, endpoint):
    """Log rate limit violations for monitoring."""
    current_app.logger.warning(
        f"Rate limit exceeded - Key: {key}, Endpoint: {endpoint}, "
        f"User-Agent: {request.headers.get('User-Agent', 'Unknown')}"
    )