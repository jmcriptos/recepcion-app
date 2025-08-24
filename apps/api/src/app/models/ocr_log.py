"""OCR Processing Log model for tracking OCR accuracy and performance."""

from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.models import db


class OCRProcessingLog(db.Model):
    """
    Model for logging OCR processing attempts and results.
    Used for accuracy analysis, performance monitoring, and troubleshooting.
    """
    
    __tablename__ = 'ocr_processing_logs'
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key to weight_registrations table
    registration_id = Column(
        UUID(as_uuid=True), 
        ForeignKey('weight_registrations.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # OCR processing results
    extracted_text = Column(Text, nullable=False, default='')
    confidence_score = Column(Numeric(3, 2), nullable=False)  # 0.00 to 1.00
    processing_time_ms = Column(Integer, nullable=False)
    
    # OCR engine used ('tesseract' | 'google_vision')
    ocr_engine = Column(
        String(20), 
        nullable=False,
        index=True
    )
    
    # Timestamp
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=datetime.utcnow,
        index=True
    )
    
    # Relationship to WeightRegistration
    registration = relationship("WeightRegistration", back_populates="ocr_logs")
    
    def __repr__(self):
        return (f"<OCRProcessingLog(id={self.id}, "
                f"registration_id={self.registration_id}, "
                f"engine={self.ocr_engine}, "
                f"confidence={self.confidence_score})>")
    
    def to_dict(self):
        """Convert OCR log to dictionary representation."""
        return {
            'id': str(self.id),
            'registration_id': str(self.registration_id),
            'extracted_text': self.extracted_text,
            'confidence_score': float(self.confidence_score),
            'processing_time_ms': self.processing_time_ms,
            'ocr_engine': self.ocr_engine,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_by_registration(cls, registration_id: str):
        """Get all OCR logs for a specific registration."""
        return cls.query.filter_by(registration_id=registration_id).order_by(cls.created_at.desc()).all()
    
    @classmethod
    def get_avg_confidence_by_engine(cls, days: int = 30):
        """Get average confidence score by OCR engine for the last N days."""
        from sqlalchemy import func
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        return db.session.query(
            cls.ocr_engine,
            func.avg(cls.confidence_score).label('avg_confidence'),
            func.count(cls.id).label('total_attempts')
        ).filter(
            cls.created_at >= cutoff_date
        ).group_by(cls.ocr_engine).all()
    
    @classmethod
    def get_avg_processing_time(cls, days: int = 30):
        """Get average processing time for the last N days."""
        from sqlalchemy import func
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = db.session.query(
            func.avg(cls.processing_time_ms).label('avg_processing_time_ms')
        ).filter(
            cls.created_at >= cutoff_date
        ).scalar()
        
        return float(result) if result else 0.0