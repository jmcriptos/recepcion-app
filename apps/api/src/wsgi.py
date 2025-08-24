"""WSGI entry point for Heroku deployment."""
import os
import sys

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app import create_app

# Create Flask application instance
app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == "__main__":
    app.run()