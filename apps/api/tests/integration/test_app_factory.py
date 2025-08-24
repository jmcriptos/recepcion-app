"""Integration tests for Flask application factory."""
import pytest
from app import create_app


class TestAppFactory:
    """Test Flask application factory."""
    
    def test_create_app_development(self):
        """Test creating app with development config."""
        app = create_app('development')
        assert app is not None
        assert app.config['DEBUG'] is True
        assert app.config['TESTING'] is False
    
    def test_create_app_testing(self):
        """Test creating app with testing config."""
        app = create_app('testing')
        assert app is not None
        assert app.config['TESTING'] is True
        assert app.config['WTF_CSRF_ENABLED'] is False
    
    def test_create_app_production(self):
        """Test creating app with production config."""
        app = create_app('production')
        assert app is not None
        assert app.config['DEBUG'] is False
        assert app.config['TESTING'] is False
    
    def test_app_context(self, app):
        """Test Flask application context."""
        with app.app_context():
            assert app.config['TESTING'] is True