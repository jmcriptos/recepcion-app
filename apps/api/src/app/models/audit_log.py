"""Audit log model for tracking registration changes."""
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from . import db


class RegistrationAuditLog(db.Model):
    """Audit log for tracking changes to weight registrations."""
    
    __tablename__ = 'registration_audit_logs'
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=db.text('gen_random_uuid()'))
    
    # Reference to registration
    registration_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Action performed
    action = Column(SQLEnum('CREATE', 'UPDATE', 'DELETE', name='audit_actions'), nullable=False)
    
    # User who performed the action
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    
    # Changes made (JSON format)
    changes = Column(JSON, nullable=True)
    
    # Additional metadata
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(String(500), nullable=True)
    
    # Timestamp
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=db.text('NOW()'), index=True)
    
    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    
    # Table constraints and indexes
    __table_args__ = (
        Index('idx_audit_registration_id', 'registration_id'),
        Index('idx_audit_user_id', 'user_id'),
        Index('idx_audit_timestamp', 'timestamp'),
        Index('idx_audit_action', 'action'),
    )
    
    def __init__(self, registration_id, action, user_id, changes=None, ip_address=None, user_agent=None):
        """Initialize RegistrationAuditLog instance."""
        self.registration_id = registration_id
        self.action = action
        self.user_id = user_id
        self.changes = changes
        self.ip_address = ip_address
        self.user_agent = user_agent
    
    def __repr__(self):
        """String representation of RegistrationAuditLog."""
        return f'<RegistrationAuditLog {self.action} on {self.registration_id} by {self.user_id}>'
    
    def to_dict(self):
        """Convert RegistrationAuditLog instance to dictionary."""
        return {
            'id': str(self.id),
            'registration_id': str(self.registration_id),
            'action': self.action,
            'user_id': str(self.user_id),
            'changes': self.changes,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'user': self.user.to_dict() if self.user else None
        }