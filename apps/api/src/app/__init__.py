"""Flask application factory module."""
import redis
from flask import Flask, g, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_session import Session
from app.config import get_config
import logging
import uuid


# Declara el objeto db, lo cual permitirá importarlo en otros módulos
db = SQLAlchemy()


def create_app(config_name=None):
    """Create and configure Flask application instance.
    
    Args:
        config_name (str): Configuration environment name (development, testing, production)
        
    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)
    
    # Cargar configuración
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Ensure every log record has request_id to avoid KeyError in formatter
    class RequestIDFilter(logging.Filter):
        def filter(self, record):
            try:
                record.request_id = getattr(g, "request_id", "unknown")
            except Exception:
                record.request_id = "unknown"
            return True

    # Assign request_id per request
    @app.before_request
    def _assign_request_id():
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        g.request_id = rid

    # Inicializar extensiones
    db.init_app(app)
    Migrate(app, db)
    
    # attach filter to existing handlers (and app.logger)
    for handler in list(app.logger.handlers):
        handler.addFilter(RequestIDFilter())

    # Inicializar Flask-Login si se usa
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user by ID for Flask-Login."""
        from app.models.user import User
        return User.query.get(user_id)
    
    # Inicializar Flask-Migrate con un directorio de migraciones personalizado
    import os
    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'migrations')
    migrate = Migrate(app, db, directory=migrations_dir)
    
    # Setup error handling and logging
    from app.middleware.error_handler import setup_error_handlers, setup_logging
    setup_error_handlers(app)
    setup_logging(app)
    
    # Register CLI commands
    from app.seeds.seed_data import seed_all, clear_all, seed_users_only
    app.cli.add_command(seed_all)
    app.cli.add_command(clear_all)
    app.cli.add_command(seed_users_only)
    
    # Register blueprints
    from app.routes.health import health_bp
    from app.routes.api_v1 import api_v1_bp
    from app.routes.auth import auth_bp
    from app.routes.registrations import registrations_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.users import users_bp
    from app.routes.reports import reports_bp
    #from app.routes.ocr import ocr_bp
    
    app.register_blueprint(health_bp)
    app.register_blueprint(api_v1_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(registrations_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(reports_bp)
    #app.register_blueprint(ocr_bp)
    
    return app