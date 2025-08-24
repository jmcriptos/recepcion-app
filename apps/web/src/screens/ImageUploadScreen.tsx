/**
 * Image Upload Screen
 * Drag & drop interface with OCR processing for weight extraction
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRegistrationStore } from '../stores/registration-store';
import { useAuthStore } from '../stores/auth-store';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: {
    weight: number;
    supplier: string;
    cut_type: string;
  };
  error?: string;
}

export const ImageUploadScreen: React.FC = () => {
  const { createRegistration, suppliers } = useRegistrationStore();
  const { user } = useAuthStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Handle file selection
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Por favor selecciona solo archivos de imagen (JPG, PNG, etc.)');
      return;
    }

    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'pending'
    }));

    setImages(prev => [...prev, ...newImages]);
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // File input handler
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  }, [processFiles]);

  // Mock OCR processing
  const processImageOCR = useCallback(async (image: UploadedImage): Promise<void> => {
    // Simulate OCR processing delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Mock extracted data with some randomness
    const mockWeights = [15.2, 18.7, 22.1, 25.8, 19.3, 16.9, 23.4, 20.1];
    const mockCutTypes = ['jamón', 'chuleta'];
    const mockSuppliers = suppliers.length > 0 ? suppliers : ['Proveedor A', 'Proveedor B', 'Proveedor C'];

    // Simulate 85% success rate
    const isSuccess = Math.random() > 0.15;

    setImages(prev => prev.map(img => {
      if (img.id === image.id) {
        if (isSuccess) {
          return {
            ...img,
            status: 'completed',
            extractedData: {
              weight: mockWeights[Math.floor(Math.random() * mockWeights.length)],
              supplier: mockSuppliers[Math.floor(Math.random() * mockSuppliers.length)],
              cut_type: mockCutTypes[Math.floor(Math.random() * mockCutTypes.length)]
            }
          };
        } else {
          return {
            ...img,
            status: 'error',
            error: 'No se pudo extraer información de la imagen'
          };
        }
      }
      return img;
    }));
  }, [suppliers]);

  // Process all pending images
  const handleProcessImages = useCallback(async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) return;

    setIsProcessing(true);

    // Mark all as processing
    setImages(prev => prev.map(img => 
      img.status === 'pending' ? { ...img, status: 'processing' } : img
    ));

    // Process each image
    const promises = pendingImages.map(processImageOCR);
    await Promise.all(promises);

    setIsProcessing(false);
  }, [images, processImageOCR]);

  // Create registrations from completed images
  const handleCreateRegistrations = useCallback(async () => {
    const completedImages = images.filter(img => 
      img.status === 'completed' && 
      img.extractedData &&
      selectedImages.has(img.id)
    );

    if (completedImages.length === 0) {
      alert('No hay imágenes completadas seleccionadas para crear registros');
      return;
    }

    try {
      const promises = completedImages.map(img => {
        if (!img.extractedData || !user) return Promise.resolve();
        
        return createRegistration({
          weight: img.extractedData.weight,
          supplier: img.extractedData.supplier,
          cut_type: img.extractedData.cut_type as 'jamón' | 'chuleta',
          registered_by: user.name
        });
      });

      await Promise.all(promises);

      // Remove processed images
      setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
      setSelectedImages(new Set());

      alert(`${completedImages.length} registro(s) creado(s) exitosamente`);
    } catch (error) {
      alert('Error al crear los registros');
    }
  }, [images, selectedImages, createRegistration, user]);

  // Toggle image selection
  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);

  // Select all completed images
  const selectAllCompleted = useCallback(() => {
    const completedIds = images
      .filter(img => img.status === 'completed')
      .map(img => img.id);
    setSelectedImages(new Set(completedIds));
  }, [images]);

  // Clear all images
  const clearAllImages = useCallback(() => {
    images.forEach(img => {
      URL.revokeObjectURL(img.preview);
    });
    setImages([]);
    setSelectedImages(new Set());
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => {
        URL.revokeObjectURL(img.preview);
      });
    };
  }, []);

  const completedCount = images.filter(img => img.status === 'completed').length;
  const processingCount = images.filter(img => img.status === 'processing').length;
  const errorCount = images.filter(img => img.status === 'error').length;
  const selectedCount = selectedImages.size;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 8px 0'
        }}>
          Subir Imágenes para OCR
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Arrastra imágenes aquí o haz clic para seleccionar archivos
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          backgroundColor: isDragOver ? '#eff6ff' : 'white',
          border: isDragOver ? '2px dashed #2563eb' : '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '48px 24px',
          textAlign: 'center',
          marginBottom: '32px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <span style={{ 
          fontSize: '48px', 
          display: 'block', 
          marginBottom: '16px',
          filter: isDragOver ? 'none' : 'grayscale(0.3)'
        }}>
          📸
        </span>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: isDragOver ? '#2563eb' : '#111827',
          margin: '0 0 8px 0'
        }}>
          {isDragOver ? '¡Suelta las imágenes aquí!' : 'Arrastra imágenes aquí'}
        </h3>
        <p style={{ 
          color: '#6b7280', 
          margin: '0 0 16px 0',
          fontSize: '14px'
        }}>
          Soporta JPG, PNG, WebP y otros formatos de imagen
        </p>
        <button
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
          onClick={(e) => {
            e.stopPropagation();
            document.getElementById('file-input')?.click();
          }}
        >
          Seleccionar Archivos
        </button>
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {/* Images Grid */}
      {images.length > 0 && (
        <div>
          {/* Action Bar */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '16px 24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>
                  Total: <strong>{images.length}</strong>
                </p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                  <span style={{ color: '#059669' }}>✓ {completedCount} completadas</span>
                  <span style={{ color: '#d97706' }}>⏳ {processingCount} procesando</span>
                  <span style={{ color: '#dc2626' }}>✗ {errorCount} errores</span>
                </div>
              </div>
              {completedCount > 0 && (
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>
                    Seleccionadas: <strong>{selectedCount}</strong>
                  </p>
                  <button
                    onClick={selectAllCompleted}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#2563eb',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textDecoration: 'underline'
                    }}
                  >
                    Seleccionar todas las completadas
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {images.some(img => img.status === 'pending') && (
                <button
                  onClick={handleProcessImages}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: isProcessing ? '#9ca3af' : '#059669',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isProcessing ? 'Procesando...' : 'Procesar con OCR'}
                </button>
              )}
              
              {selectedCount > 0 && (
                <button
                  onClick={handleCreateRegistrations}
                  style={{
                    backgroundColor: '#2563eb',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Crear {selectedCount} Registro(s)
                </button>
              )}

              <button
                onClick={clearAllImages}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Limpiar Todo
              </button>
            </div>
          </div>

          {/* Images Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {images.map((image) => (
              <div
                key={image.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: `2px solid ${
                    selectedImages.has(image.id) ? '#2563eb' : 
                    image.status === 'completed' ? '#059669' :
                    image.status === 'error' ? '#dc2626' :
                    image.status === 'processing' ? '#d97706' : '#e5e7eb'
                  }`,
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  cursor: image.status === 'completed' ? 'pointer' : 'default'
                }}
                onClick={() => image.status === 'completed' && toggleImageSelection(image.id)}
              >
                {/* Image Preview */}
                <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                  <img
                    src={image.preview}
                    alt="Preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  
                  {/* Status Overlay */}
                  {image.status === 'processing' && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          border: '3px solid rgba(255,255,255,0.3)',
                          borderTop: '3px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 8px'
                        }} />
                        <p style={{ fontSize: '14px', margin: 0 }}>Procesando...</p>
                      </div>
                      <style>
                        {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                      </style>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {image.status === 'completed' && selectedImages.has(image.id) && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}
                </div>

                {/* Image Info */}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                      {image.file.name}
                    </p>
                    <span style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 
                        image.status === 'completed' ? '#dcfce7' :
                        image.status === 'processing' ? '#fef3c7' :
                        image.status === 'error' ? '#fee2e2' : '#f3f4f6',
                      color: 
                        image.status === 'completed' ? '#166534' :
                        image.status === 'processing' ? '#92400e' :
                        image.status === 'error' ? '#991b1b' : '#6b7280'
                    }}>
                      {image.status === 'completed' ? 'Completado' :
                       image.status === 'processing' ? 'Procesando' :
                       image.status === 'error' ? 'Error' : 'Pendiente'}
                    </span>
                  </div>

                  {image.extractedData && (
                    <div style={{ 
                      backgroundColor: '#f0fdf4',
                      borderRadius: '6px',
                      padding: '12px',
                      marginTop: '8px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Peso:</span>
                          <p style={{ color: '#111827', fontWeight: '600', margin: 0 }}>
                            {image.extractedData.weight} kg
                          </p>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Tipo:</span>
                          <p style={{ color: '#111827', fontWeight: '600', margin: 0 }}>
                            {image.extractedData.cut_type}
                          </p>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#6b7280' }}>Proveedor:</span>
                          <p style={{ color: '#111827', fontWeight: '600', margin: 0 }}>
                            {image.extractedData.supplier}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {image.error && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      borderRadius: '6px',
                      padding: '12px',
                      marginTop: '8px'
                    }}>
                      <p style={{ color: '#991b1b', fontSize: '12px', margin: 0 }}>
                        {image.error}
                      </p>
                    </div>
                  )}

                  <p style={{ color: '#6b7280', fontSize: '11px', margin: '8px 0 0 0' }}>
                    {(image.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
          padding: '64px 24px',
          color: '#6b7280'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📷</span>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            color: '#374151'
          }}>
            No hay imágenes cargadas
          </h3>
          <p style={{ margin: '0 0 16px 0' }}>
            Las imágenes aparecerán aquí una vez que las subas
          </p>
          <p style={{ fontSize: '12px', margin: 0 }}>
            💡 <strong>Tip:</strong> Puedes arrastrar múltiples imágenes a la vez para procesarlas en lote
          </p>
        </div>
      )}
    </div>
  );
};