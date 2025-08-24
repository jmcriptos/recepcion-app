"""Application configuration module."""
import os
from datetime import timedelta
from typing import Type


class Config:
    """Base configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DATABASE_URL = os.environ.get('DATABASE_URL') or 'postgresql://josedasilva@localhost/recepcion_db'
    
    # Fix Heroku postgres:// URL to postgresql:// for SQLAlchemy compatibility
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379'
    CLOUDINARY_URL = os.environ.get('CLOUDINARY_URL')
    GOOGLE_VISION_API_KEY = os.environ.get('GOOGLE_VISION_API_KEY')
    LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'INFO'
    TESTING = False
    
    # Session configuration for Flask-Session with Redis
    SESSION_TYPE = 'redis'
    SESSION_PERMANENT = True
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = 'meat_reception:'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=4)  # 4-hour timeout for industrial shifts
    
    # Cookie security settings
    SESSION_COOKIE_SECURE = False  # Will be True in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'


class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


class TestingConfig(Config):
    """Testing environment configuration."""
    TESTING = True
    DATABASE_URL = os.environ.get('TEST_DATABASE_URL') or 'sqlite:///:memory:'
    
    # Fix Heroku postgres:// URL to postgresql:// for SQLAlchemy compatibility
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    WTF_CSRF_ENABLED = False
    
    # Use in-memory Redis for testing
    REDIS_URL = 'redis://localhost:6379/1'  # Use test database
    SESSION_TYPE = 'filesystem'  # Use filesystem sessions for testing
    SESSION_PERMANENT = False


class ProductionConfig(Config):
    """Production environment configuration."""
    DEBUG = False
    LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'WARNING'
    
    # Secure cookies in production
    SESSION_COOKIE_SECURE = True


def get_config(config_name: str = None) -> Type[Config]:
    """Get configuration class based on environment.
    
    Args:
        config_name (str): Configuration environment name
        
    Returns:
        Type[Config]: Configuration class for the specified environment
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    config_mapping = {
        'development': DevelopmentConfig,
        'testing': TestingConfig,
        'production': ProductionConfig
    }
    
    return config_mapping.get(config_name, DevelopmentConfig)