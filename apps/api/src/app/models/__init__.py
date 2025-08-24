"""Models package initialization with SQLAlchemy setup."""
# Import db from the main app module to avoid multiple instances
from app import db

# Import models after db initialization to avoid circular imports
from .user import User
from .registration import WeightRegistration
from .ocr_log import OCRProcessingLog

# Make models available at package level
__all__ = ['db', 'User', 'WeightRegistration', 'OCRProcessingLog']