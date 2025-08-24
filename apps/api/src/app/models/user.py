"""User model for authentication and registration tracking."""
from datetime import datetime
from app import db
from sqlalchemy import Column, String, Boolean, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from flask_login import UserMixin
import uuid


class User(UserMixin, db.Model):
    """User model representing operators and supervisors in the meat reception system."""
    
    __tablename__ = 'users'
    
    # Primary key UUID (coincide con gen_random_uuid() en la DB)
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    
    # User fields (name existe en la tabla)
    name = Column(String(255), nullable=False, unique=True, index=True)
    
    # role existe en la tabla como enum; aquí lo mapeamos como String para evitar errores
    role = Column(String(50), nullable=False)
    
    # No mapear is_active / active porque la columna no existe en la DB actual.
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    def __init__(self, name, role='operator'):
        self.name = name
        self.role = role
        self.created_at = datetime.utcnow()

    def to_dict(self):
        return {
            'id': str(self.id) if self.id else None,
            'name': self.name,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
    
    # Elimina las implementaciones duplicadas de los métodos/properties de Flask-Login
    # UserMixin ya provee is_authenticated, is_active, is_anonymous y get_id