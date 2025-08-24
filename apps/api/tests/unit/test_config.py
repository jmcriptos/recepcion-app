"""Unit tests for configuration module."""
import pytest
from app.config import get_config, DevelopmentConfig, TestingConfig, ProductionConfig


class TestConfig:
    """Test configuration classes."""
    
    def test_development_config(self):
        """Test development configuration."""
        config = get_config('development')
        assert config == DevelopmentConfig
        assert config.DEBUG is True
        assert config.LOG_LEVEL == 'DEBUG'
        assert config.TESTING is False
    
    def test_testing_config(self):
        """Test testing configuration."""
        config = get_config('testing')
        assert config == TestingConfig
        assert config.TESTING is True
        assert config.WTF_CSRF_ENABLED is False
    
    def test_production_config(self):
        """Test production configuration."""
        config = get_config('production')
        assert config == ProductionConfig
        assert config.DEBUG is False
        assert config.TESTING is False
    
    def test_default_config(self):
        """Test default configuration fallback."""
        config = get_config(None)
        assert config == DevelopmentConfig
        
        config = get_config('invalid')
        assert config == DevelopmentConfig