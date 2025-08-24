"""Unit tests for photo URL validation functionality."""
import pytest
from app.routes.registrations import validate_photo_url


class TestPhotoUrlValidation:
    """Test the validate_photo_url function."""
    
    def test_valid_http_url(self):
        """Test that valid HTTP URLs are accepted."""
        valid_urls = [
            'http://example.com/photo.jpg',
            'http://cdn.example.com/images/photo.jpeg',
            'http://storage.googleapis.com/bucket/image.png'
        ]
        
        for url in valid_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"URL {url} should be valid, but got error: {error_msg}"
            assert error_msg is None
    
    def test_valid_https_url(self):
        """Test that valid HTTPS URLs are accepted."""
        valid_urls = [
            'https://example.com/photo.jpg',
            'https://cdn.example.com/images/photo.jpeg',
            'https://s3.amazonaws.com/bucket/image.png',
            'https://cloudinary.com/user/image/upload/photo.webp'
        ]
        
        for url in valid_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"URL {url} should be valid, but got error: {error_msg}"
            assert error_msg is None
    
    def test_valid_image_extensions(self):
        """Test that various valid image extensions are accepted."""
        extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        
        for ext in extensions:
            url = f'https://example.com/photo{ext}'
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"Extension {ext} should be valid, but got error: {error_msg}"
    
    def test_case_insensitive_extensions(self):
        """Test that image extensions are case insensitive."""
        urls = [
            'https://example.com/photo.JPG',
            'https://example.com/photo.JPEG',
            'https://example.com/photo.PNG',
            'https://example.com/photo.GIF'
        ]
        
        for url in urls:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"URL {url} should be valid (case insensitive)"
    
    def test_empty_url(self):
        """Test that empty/None URLs are allowed."""
        assert validate_photo_url(None) == (True, None)
        assert validate_photo_url('') == (True, None)
        assert validate_photo_url('   ') == (True, None)  # whitespace only
    
    def test_url_too_long(self):
        """Test that URLs over 500 characters are rejected."""
        long_url = 'https://example.com/' + 'a' * 500 + '.jpg'
        
        is_valid, error_msg = validate_photo_url(long_url)
        assert not is_valid
        assert 'menor a 500 caracteres' in error_msg
    
    def test_invalid_schemes(self):
        """Test that non-HTTP(S) schemes are rejected."""
        invalid_urls = [
            'ftp://example.com/photo.jpg',
            'file:///local/photo.jpg',
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
            'javascript:alert("xss")',
            'mailto:user@example.com'
        ]
        
        for url in invalid_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be invalid"
            assert 'HTTP o HTTPS' in error_msg
    
    def test_suspicious_content_patterns(self):
        """Test that URLs with suspicious patterns are rejected."""
        suspicious_urls = [
            'https://example.com/<script>alert("xss")</script>.jpg',
            'https://example.com/<iframe src="evil"></iframe>.png',
            'https://example.com/<object data="evil"></object>.gif',
            'https://example.com/<embed src="evil"></embed>.jpg'
        ]
        
        for url in suspicious_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be rejected for suspicious content"
            assert 'contenido no permitido' in error_msg
    
    def test_localhost_urls_blocked(self):
        """Test that localhost and local IPs are blocked."""
        local_urls = [
            'http://localhost/photo.jpg',
            'https://127.0.0.1/image.png',
            'http://0.0.0.0/photo.gif',
            'https://LOCALHOST/image.jpg'  # case insensitive
        ]
        
        for url in local_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be blocked (localhost/local IP)"
            assert 'contenido no permitido' in error_msg
    
    def test_javascript_urls_blocked(self):
        """Test that javascript: URLs are blocked."""
        js_urls = [
            'javascript:alert("xss")',
            'JAVASCRIPT:void(0)',
            'https://example.com/javascript:alert.jpg'
        ]
        
        for url in js_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be blocked (javascript)"
            assert 'contenido no permitido' in error_msg
    
    def test_data_urls_blocked(self):
        """Test that data: URLs are blocked."""
        data_urls = [
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABA',
            'DATA:text/html,<script>alert("xss")</script>',
            'https://example.com/data:evil.jpg'
        ]
        
        for url in data_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be blocked (data URL)"
            assert 'contenido no permitido' in error_msg
    
    def test_invalid_file_extensions(self):
        """Test that non-image file extensions are rejected."""
        invalid_urls = [
            'https://example.com/document.pdf',
            'https://example.com/script.js',
            'https://example.com/style.css',
            'https://example.com/data.json',
            'https://example.com/executable.exe',
            'https://example.com/noextension'
        ]
        
        for url in invalid_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be rejected (invalid extension)"
            assert 'archivo de imagen válido' in error_msg
    
    def test_malformed_urls(self):
        """Test that malformed URLs are rejected."""
        malformed_urls = [
            'not-a-url',
            'http://',
            'https://',
            '://example.com/photo.jpg',
            'http//example.com/photo.jpg',  # missing colon
            'https:example.com/photo.jpg'   # missing slashes
        ]
        
        for url in malformed_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert not is_valid, f"URL {url} should be rejected (malformed)"
            # Should either be invalid format or invalid scheme
            assert 'inválido' in error_msg or 'HTTP o HTTPS' in error_msg
    
    def test_valid_cdn_urls(self):
        """Test that common CDN URLs are accepted."""
        cdn_urls = [
            'https://cloudinary.com/demo/image/upload/sample.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_crop/sample.jpg',
            'https://images.unsplash.com/photo-1234567890/test.jpg',
            'https://cdn.amazonaws.com/bucket/image.png',
            'https://storage.googleapis.com/bucket/photo.webp',
            'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/image.jpg'
        ]
        
        for url in cdn_urls:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"CDN URL {url} should be valid, but got error: {error_msg}"
    
    def test_url_with_query_parameters(self):
        """Test that URLs with query parameters are handled correctly."""
        urls_with_params = [
            'https://example.com/photo.jpg?width=400&height=400',
            'https://cdn.example.com/image.png?v=1.2.3&format=webp',
            'https://storage.com/photo.gif?token=abc123&expires=1234567890'
        ]
        
        for url in urls_with_params:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"URL with parameters {url} should be valid"
    
    def test_url_with_fragments(self):
        """Test that URLs with fragments are handled correctly."""
        urls_with_fragments = [
            'https://example.com/photo.jpg#section1',
            'https://gallery.com/image.png#zoom'
        ]
        
        for url in urls_with_fragments:
            is_valid, error_msg = validate_photo_url(url)
            assert is_valid, f"URL with fragment {url} should be valid"


if __name__ == '__main__':
    pytest.main([__file__])