"""Unit tests for OCRProcessingLog model."""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.models.ocr_log import OCRProcessingLog
from app.models.registration import WeightRegistration
from app.models.user import User
from app.models import db


class TestOCRProcessingLog:
    """Test suite for OCRProcessingLog model."""
    
    @pytest.fixture
    def sample_user(self, app_with_db):
        """Create a sample user for testing."""
        with app_with_db.app_context():
            user = User(name="Test User", role="operator")
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def sample_registration(self, app_with_db, sample_user):
        """Create a sample weight registration for testing."""
        with app_with_db.app_context():
            registration = WeightRegistration(
                weight=Decimal('2.5'),
                cut_type='jamón',
                supplier='Test Supplier',
                registered_by=sample_user.id
            )
            db.session.add(registration)
            db.session.commit()
            return registration
    
    @pytest.fixture
    def sample_ocr_log(self, app_with_db, sample_registration):
        """Create a sample OCR processing log for testing."""
        with app_with_db.app_context():
            ocr_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="PESO: 2.5 kg",
                confidence_score=Decimal('0.85'),
                processing_time_ms=1500,
                ocr_engine='tesseract'
            )
            db.session.add(ocr_log)
            db.session.commit()
            return ocr_log
    
    def test_ocr_log_creation(self, app_with_db, sample_registration):
        """Test OCR processing log creation."""
        with app_with_db.app_context():
            ocr_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="PESO: 3.2 kg\nProveedor: Test",
                confidence_score=Decimal('0.90'),
                processing_time_ms=1200,
                ocr_engine='google_vision'
            )
            
            assert ocr_log.registration_id == sample_registration.id
            assert ocr_log.extracted_text == "PESO: 3.2 kg\nProveedor: Test"
            assert ocr_log.confidence_score == Decimal('0.90')
            assert ocr_log.processing_time_ms == 1200
            assert ocr_log.ocr_engine == 'google_vision'
            assert isinstance(ocr_log.id, uuid.UUID)
            assert isinstance(ocr_log.created_at, datetime)
    
    def test_ocr_log_persistence(self, app_with_db, sample_registration):
        """Test OCR processing log database persistence."""
        with app_with_db.app_context():
            ocr_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="PESO: 1.8 kg",
                confidence_score=Decimal('0.75'),
                processing_time_ms=2000,
                ocr_engine='tesseract'
            )
            
            db.session.add(ocr_log)
            db.session.commit()
            
            # Verify it was saved
            retrieved_log = OCRProcessingLog.query.filter_by(id=ocr_log.id).first()
            assert retrieved_log is not None
            assert retrieved_log.extracted_text == "PESO: 1.8 kg"
            assert retrieved_log.confidence_score == Decimal('0.75')
            assert retrieved_log.processing_time_ms == 2000
            assert retrieved_log.ocr_engine == 'tesseract'
    
    def test_ocr_log_relationship_with_registration(self, app_with_db, sample_ocr_log, sample_registration):
        """Test relationship between OCR log and weight registration."""
        with app_with_db.app_context():
            # Access relationship from OCR log to registration
            assert sample_ocr_log.registration is not None
            assert sample_ocr_log.registration.id == sample_registration.id
            
            # Access relationship from registration to OCR logs
            assert len(sample_registration.ocr_logs) > 0
            assert sample_ocr_log in sample_registration.ocr_logs
    
    def test_ocr_log_str_representation(self, app_with_db, sample_ocr_log):
        """Test OCR processing log string representation."""
        with app_with_db.app_context():
            str_repr = str(sample_ocr_log)
            assert 'OCRProcessingLog' in str_repr
            assert str(sample_ocr_log.id) in str_repr
            assert str(sample_ocr_log.registration_id) in str_repr
            assert sample_ocr_log.ocr_engine in str_repr
            assert str(sample_ocr_log.confidence_score) in str_repr
    
    def test_ocr_log_to_dict(self, app_with_db, sample_ocr_log):
        """Test OCR processing log dictionary conversion."""
        with app_with_db.app_context():
            log_dict = sample_ocr_log.to_dict()
            
            assert 'id' in log_dict
            assert 'registration_id' in log_dict
            assert 'extracted_text' in log_dict
            assert 'confidence_score' in log_dict
            assert 'processing_time_ms' in log_dict
            assert 'ocr_engine' in log_dict
            assert 'created_at' in log_dict
            
            # Verify data types
            assert isinstance(log_dict['id'], str)
            assert isinstance(log_dict['registration_id'], str)
            assert isinstance(log_dict['extracted_text'], str)
            assert isinstance(log_dict['confidence_score'], float)
            assert isinstance(log_dict['processing_time_ms'], int)
            assert isinstance(log_dict['ocr_engine'], str)
            assert isinstance(log_dict['created_at'], str)
    
    def test_get_by_registration(self, app_with_db, sample_registration):
        """Test getting OCR logs by registration ID."""
        with app_with_db.app_context():
            # Create multiple OCR logs for the same registration
            ocr_log1 = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="First attempt",
                confidence_score=Decimal('0.60'),
                processing_time_ms=1800,
                ocr_engine='tesseract'
            )
            
            ocr_log2 = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="Second attempt",
                confidence_score=Decimal('0.85'),
                processing_time_ms=1200,
                ocr_engine='google_vision'
            )
            
            db.session.add(ocr_log1)
            db.session.add(ocr_log2)
            db.session.commit()
            
            # Retrieve logs by registration
            logs = OCRProcessingLog.get_by_registration(str(sample_registration.id))
            
            assert len(logs) >= 2
            # Should be ordered by created_at desc (most recent first)
            assert logs[0].created_at >= logs[1].created_at
    
    def test_get_avg_confidence_by_engine(self, app_with_db, sample_registration):
        """Test getting average confidence by OCR engine."""
        with app_with_db.app_context():
            # Create logs with different engines and confidence scores
            tesseract_logs = [
                OCRProcessingLog(
                    registration_id=sample_registration.id,
                    extracted_text="Test 1",
                    confidence_score=Decimal('0.80'),
                    processing_time_ms=1500,
                    ocr_engine='tesseract'
                ),
                OCRProcessingLog(
                    registration_id=sample_registration.id,
                    extracted_text="Test 2",
                    confidence_score=Decimal('0.70'),
                    processing_time_ms=1600,
                    ocr_engine='tesseract'
                )
            ]
            
            vision_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="Test 3",
                confidence_score=Decimal('0.90'),
                processing_time_ms=1200,
                ocr_engine='google_vision'
            )
            
            for log in tesseract_logs + [vision_log]:
                db.session.add(log)
            db.session.commit()
            
            # Get average confidence by engine
            results = OCRProcessingLog.get_avg_confidence_by_engine(days=30)
            
            # Convert to dict for easier testing
            results_dict = {result.ocr_engine: result for result in results}
            
            assert 'tesseract' in results_dict
            assert 'google_vision' in results_dict
            
            # Check tesseract average (0.80 + 0.70) / 2 = 0.75
            tesseract_result = results_dict['tesseract']
            assert abs(float(tesseract_result.avg_confidence) - 0.75) < 0.01
            assert tesseract_result.total_attempts == 2
            
            # Check google vision average
            vision_result = results_dict['google_vision']
            assert float(vision_result.avg_confidence) == 0.90
            assert vision_result.total_attempts == 1
    
    def test_get_avg_processing_time(self, app_with_db, sample_registration):
        """Test getting average processing time."""
        with app_with_db.app_context():
            # Create logs with different processing times
            processing_times = [1200, 1500, 1800, 2000]
            
            for i, time_ms in enumerate(processing_times):
                ocr_log = OCRProcessingLog(
                    registration_id=sample_registration.id,
                    extracted_text=f"Test {i+1}",
                    confidence_score=Decimal('0.80'),
                    processing_time_ms=time_ms,
                    ocr_engine='tesseract'
                )
                db.session.add(ocr_log)
            
            db.session.commit()
            
            # Get average processing time
            avg_time = OCRProcessingLog.get_avg_processing_time(days=30)
            
            expected_avg = sum(processing_times) / len(processing_times)
            assert abs(avg_time - expected_avg) < 1.0
    
    def test_get_avg_processing_time_no_logs(self, app_with_db):
        """Test getting average processing time when no logs exist."""
        with app_with_db.app_context():
            avg_time = OCRProcessingLog.get_avg_processing_time(days=30)
            assert avg_time == 0.0
    
    def test_cascade_delete_with_registration(self, app_with_db, sample_registration, sample_ocr_log):
        """Test that OCR logs are deleted when registration is deleted."""
        with app_with_db.app_context():
            ocr_log_id = sample_ocr_log.id
            
            # Verify log exists
            assert OCRProcessingLog.query.filter_by(id=ocr_log_id).first() is not None
            
            # Delete the registration
            db.session.delete(sample_registration)
            db.session.commit()
            
            # Verify OCR log was also deleted (cascade)
            assert OCRProcessingLog.query.filter_by(id=ocr_log_id).first() is None
    
    def test_confidence_score_precision(self, app_with_db, sample_registration):
        """Test confidence score decimal precision."""
        with app_with_db.app_context():
            ocr_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="Precision test",
                confidence_score=Decimal('0.856'),  # 3 decimal places
                processing_time_ms=1500,
                ocr_engine='tesseract'
            )
            
            db.session.add(ocr_log)
            db.session.commit()
            
            # Should be rounded to 2 decimal places in database
            retrieved_log = OCRProcessingLog.query.filter_by(id=ocr_log.id).first()
            assert retrieved_log.confidence_score == Decimal('0.86')
    
    def test_ocr_engine_constraint(self, app_with_db, sample_registration):
        """Test OCR engine constraint validation."""
        with app_with_db.app_context():
            # Valid engines should work
            valid_engines = ['tesseract', 'google_vision']
            
            for engine in valid_engines:
                ocr_log = OCRProcessingLog(
                    registration_id=sample_registration.id,
                    extracted_text="Test",
                    confidence_score=Decimal('0.80'),
                    processing_time_ms=1500,
                    ocr_engine=engine
                )
                db.session.add(ocr_log)
            
            db.session.commit()
            
            # Verify logs were created successfully
            assert OCRProcessingLog.query.filter_by(ocr_engine='tesseract').first() is not None
            assert OCRProcessingLog.query.filter_by(ocr_engine='google_vision').first() is not None
    
    def test_empty_extracted_text_allowed(self, app_with_db, sample_registration):
        """Test that empty extracted text is allowed."""
        with app_with_db.app_context():
            ocr_log = OCRProcessingLog(
                registration_id=sample_registration.id,
                extracted_text="",  # Empty text should be allowed
                confidence_score=Decimal('0.00'),
                processing_time_ms=1500,
                ocr_engine='tesseract'
            )
            
            db.session.add(ocr_log)
            db.session.commit()
            
            retrieved_log = OCRProcessingLog.query.filter_by(id=ocr_log.id).first()
            assert retrieved_log.extracted_text == ""