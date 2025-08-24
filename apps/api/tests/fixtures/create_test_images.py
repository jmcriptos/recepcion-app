"""Script to create test images for OCR testing."""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np


def create_test_images():
    """Create various test images for OCR testing."""
    
    # Base directory for test images
    base_dir = os.path.dirname(__file__)
    images_dir = os.path.join(base_dir, 'test_images')
    
    # Ensure directory exists
    os.makedirs(images_dir, exist_ok=True)
    
    # Image dimensions
    width, height = 400, 200
    
    # Try to use a built-in font, fallback to default if not available
    try:
        font = ImageFont.truetype("Arial.ttf", 24)
        small_font = ImageFont.truetype("Arial.ttf", 16)
    except:
        try:
            font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        except:
            font = None
            small_font = None
    
    # 1. Clear, high-quality label image
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple label border
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    
    # Add weight text
    draw.text((50, 50), "PESO:", fill='black', font=font)
    draw.text((120, 50), "2.5 kg", fill='black', font=font)
    
    # Add additional label info
    draw.text((50, 90), "Jamón Ibérico", fill='black', font=small_font)
    draw.text((50, 110), "Fecha: 2025-08-21", fill='black', font=small_font)
    draw.text((50, 130), "Proveedor: Test Farm", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'clear_label.jpg'), 'JPEG', quality=95)
    print("Created clear_label.jpg")
    
    # 2. Blurry label image
    img_blurry = img.copy()
    img_blurry = img_blurry.filter(ImageFilter.GaussianBlur(radius=1.5))
    img_blurry.save(os.path.join(images_dir, 'blurry_label.jpg'), 'JPEG', quality=85)
    print("Created blurry_label.jpg")
    
    # 3. Rotated label image
    img_rotated = img.rotate(5, expand=True, fillcolor='white')
    img_rotated.save(os.path.join(images_dir, 'rotated_label.jpg'), 'JPEG', quality=90)
    print("Created rotated_label.jpg")
    
    # 4. Low contrast label image
    img = Image.new('RGB', (width, height), (240, 240, 240))  # Light gray background
    draw = ImageDraw.Draw(img)
    
    # Draw with low contrast (dark gray on light gray)
    draw.rectangle([20, 20, width-20, height-20], outline=(180, 180, 180), width=2)
    draw.text((50, 50), "PESO:", fill=(100, 100, 100), font=font)
    draw.text((120, 50), "1.8 kg", fill=(100, 100, 100), font=font)
    draw.text((50, 90), "Chuleta de Cerdo", fill=(120, 120, 120), font=small_font)
    draw.text((50, 110), "Fecha: 2025-08-21", fill=(120, 120, 120), font=small_font)
    
    img.save(os.path.join(images_dir, 'low_contrast_label.jpg'), 'JPEG', quality=90)
    print("Created low_contrast_label.jpg")
    
    # 5. High contrast but noisy image
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    # Add noise first
    img_array = np.array(img)
    noise = np.random.randint(0, 30, img_array.shape, dtype=np.uint8)
    img_array = np.clip(img_array.astype(int) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_array)
    draw = ImageDraw.Draw(img)
    
    # Draw high contrast text
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=3)
    draw.text((50, 50), "WEIGHT:", fill='black', font=font)
    draw.text((140, 50), "3.2 kg", fill='black', font=font)
    draw.text((50, 90), "Premium Cut", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'noisy_label.jpg'), 'JPEG', quality=85)
    print("Created noisy_label.jpg")
    
    # 6. Label with grams (should convert to kg)
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    draw.text((50, 50), "PESO:", fill='black', font=font)
    draw.text((120, 50), "2500 g", fill='black', font=font)  # 2.5 kg in grams
    draw.text((50, 90), "Bacon Premium", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'grams_label.jpg'), 'JPEG', quality=95)
    print("Created grams_label.jpg")
    
    # 7. Label with Spanish peso format
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    draw.text((50, 50), "peso: 4.1 kg", fill='black', font=font)
    draw.text((50, 90), "Costillas de Cerdo", fill='black', font=small_font)
    draw.text((50, 110), "Calidad Premium", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'spanish_peso_label.jpg'), 'JPEG', quality=95)
    print("Created spanish_peso_label.jpg")
    
    # 8. Label with English weight format
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    draw.text((50, 50), "Net Weight: 1.2 kg", fill='black', font=font)
    draw.text((50, 90), "Pork Shoulder", fill='black', font=small_font)
    draw.text((50, 110), "Premium Grade", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'english_weight_label.jpg'), 'JPEG', quality=95)
    print("Created english_weight_label.jpg")
    
    # 9. Label with comma decimal separator
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    draw.text((50, 50), "PESO:", fill='black', font=font)
    draw.text((120, 50), "2,7 kg", fill='black', font=font)  # European format
    draw.text((50, 90), "Jamón Serrano", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'comma_decimal_label.jpg'), 'JPEG', quality=95)
    print("Created comma_decimal_label.jpg")
    
    # 10. Invalid/no weight label (should return None)
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([20, 20, width-20, height-20], outline='black', width=2)
    draw.text((50, 50), "PRODUCT INFO", fill='black', font=font)
    draw.text((50, 90), "Fresh Meat", fill='black', font=small_font)
    draw.text((50, 110), "Date: 2025-08-21", fill='black', font=small_font)
    draw.text((50, 130), "No weight specified", fill='black', font=small_font)
    
    img.save(os.path.join(images_dir, 'no_weight_label.jpg'), 'JPEG', quality=95)
    print("Created no_weight_label.jpg")


if __name__ == "__main__":
    create_test_images()
    print("\nAll test images created successfully!")
    print("Images saved in: tests/fixtures/test_images/")