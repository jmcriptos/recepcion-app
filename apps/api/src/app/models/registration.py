"""WeightRegistration model for storing meat weight data."""
from datetime import datetime
from uuid import uuid4
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum as SQLEnum, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import DECIMAL
from sqlalchemy.orm import relationship
from flask_sqlalchemy import SQLAlchemy
from . import db


class WeightRegistration(db.Model):
    """WeightRegistration model for storing meat reception weight data with full traceability."""
    
    __tablename__ = 'weight_registrations'
    
    # Primary key with UUID
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=db.text('gen_random_uuid()'))
    
    # Weight and meat data
    weight = Column(DECIMAL(8, 3), nullable=False)
    cut_type = Column(SQLEnum('jamón', 'chuleta', name='cut_types'), nullable=False)
    supplier = Column(String(255), nullable=False, index=True)
    
    # User relationship and photo
    registered_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    photo_url = Column(Text, nullable=True)
    
    # Timestamps and sync status
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=db.text('NOW()'), index=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True, index=True)  # For soft delete
    sync_status = Column(SQLEnum('synced', 'pending', 'error', name='sync_statuses'), 
                        nullable=False, default='synced')
    
    # Audit fields
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    update_reason = Column(String(255), nullable=True)
    ocr_confidence = Column(DECIMAL(3, 2), nullable=True)  # 0.00 to 1.00
    
    # Relationships
    user = relationship('User', back_populates='registrations', foreign_keys=[registered_by])
    updated_by_user = relationship('User', foreign_keys=[updated_by])
    ocr_logs = relationship('OCRProcessingLog', back_populates='registration', cascade='all, delete-orphan')
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('weight > 0', name='check_weight_positive'),
        Index('idx_registrations_created_at', 'created_at'),
        Index('idx_registrations_supplier', 'supplier'),
        Index('idx_registrations_cut_type', 'cut_type'),
        Index('idx_registrations_user', 'registered_by'),
    )
    
    def __init__(self, weight, cut_type, supplier, registered_by, photo_url=None, sync_status='synced', ocr_confidence=None):
        """Initialize WeightRegistration instance."""
        self.weight = Decimal(str(weight)) if not isinstance(weight, Decimal) else weight
        self.cut_type = cut_type
        self.supplier = supplier
        self.registered_by = registered_by
        self.photo_url = photo_url
        self.sync_status = sync_status
        self.ocr_confidence = Decimal(str(ocr_confidence)) if ocr_confidence is not None else None
    
    def __repr__(self):
        """String representation of WeightRegistration."""
        return f'<WeightRegistration {self.weight}kg {self.cut_type} from {self.supplier}>'
    
    def is_synced(self):
        """Check if registration is synced."""
        return self.sync_status == 'synced'
    
    def mark_pending_sync(self):
        """Mark registration as pending sync."""
        self.sync_status = 'pending'
    
    def mark_sync_error(self):
        """Mark registration as having sync error."""
        self.sync_status = 'error'
    
    def mark_synced(self):
        """Mark registration as successfully synced."""
        self.sync_status = 'synced'
    
    def is_deleted(self):
        """Check if registration is soft deleted."""
        return self.deleted_at is not None
    
    def soft_delete(self, deleted_by):
        """Soft delete the registration."""
        self.deleted_at = datetime.utcnow()
        self.updated_by = deleted_by
        self.update_reason = "deleted"
    
    def validate_weight_range(self, min_weight=0.1, max_weight=999.999):
        """Validate weight is within expected range."""
        return min_weight <= float(self.weight) <= max_weight
    
    def to_dict(self):
        """Convert WeightRegistration instance to dictionary."""
        return {
            'id': str(self.id),
            'weight': float(self.weight),
            'cut_type': self.cut_type,
            'supplier': self.supplier,
            'registered_by': str(self.registered_by),
            'photo_url': self.photo_url,
            'ocr_confidence': float(self.ocr_confidence) if self.ocr_confidence else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None,
            'sync_status': self.sync_status,
            'updated_by': str(self.updated_by) if self.updated_by else None,
            'update_reason': self.update_reason,
            'user': self.user.to_dict() if self.user else None
        }