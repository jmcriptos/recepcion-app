/**
 * Camera Scan Screen
 * Live camera interface for scanning weight labels on mobile web
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRegistrationStore } from '../stores/registration-store';
import { useAuthStore } from '../stores/auth-store';

interface DetectedLabel {
  weight: number;
  text: string;
  confidence: number;
  timestamp: number;
}

export const CameraScanScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { createRegistration, suppliers } = useRegistrationStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [detectedLabels, setDetectedLabels] = useState<DetectedLabel[]>([]);
  const [selectedWeight, setSelectedWeight] = useState<DetectedLabel | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedCutType, setSelectedCutType] = useState<'jamón' | 'chuleta' | ''>('');

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setHasPermission(true);
      setIsScanning(true);
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Capture frame and process for OCR
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for OCR processing
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    processImageForWeight(imageData);
  }, [isScanning]);

  // Mock OCR processing for weight detection
  const processImageForWeight = useCallback(async (_imageData: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock weight detection with some randomness
      const mockWeights = [15.2, 18.7, 22.1, 25.8, 19.3, 16.9, 23.4, 20.1, 14.5, 27.3];
      const detectedWeight = mockWeights[Math.floor(Math.random() * mockWeights.length)];
      
      // Only detect weight sometimes (simulate real-world conditions)
      if (Math.random() > 0.3) {
        const newLabel: DetectedLabel = {
          weight: detectedWeight,
          text: `${detectedWeight} KG`,
          confidence: 0.8 + Math.random() * 0.2,
          timestamp: Date.now()
        };

        setDetectedLabels(prev => {
          // Remove old detections (keep only last 3)
          const filtered = prev.filter(label => 
            Date.now() - label.timestamp < 5000 && 
            Math.abs(label.weight - newLabel.weight) > 0.5 // Avoid duplicates
          );
          return [newLabel, ...filtered].slice(0, 3);
        });
      }
    } catch (error) {
      console.error('OCR processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  // Auto-scan frames periodically
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(captureFrame, 2000); // Scan every 2 seconds
    return () => clearInterval(interval);
  }, [isScanning, captureFrame]);

  // Create registration from selected weight
  const handleCreateRegistration = useCallback(async () => {
    if (!selectedWeight || !selectedSupplier || !selectedCutType || !user) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      await createRegistration({
        weight: selectedWeight.weight,
        supplier: selectedSupplier,
        cut_type: selectedCutType,
        registered_by: user.name
      });

      // Clear selections
      setSelectedWeight(null);
      setSelectedSupplier('');
      setSelectedCutType('');
      setDetectedLabels([]);
      
      alert(`✅ Registro creado: ${selectedWeight.weight} kg`);
    } catch (error) {
      alert('❌ Error al crear el registro');
    }
  }, [selectedWeight, selectedSupplier, selectedCutType, user, createRegistration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000' }}>
      {/* Page Header */}
      <div style={{
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '16px 20px',
        position: 'relative',
        zIndex: 10
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          margin: '0 0 4px 0'
        }}>
          📱 Escaneo de Etiquetas
        </h2>
        <p style={{ fontSize: '14px', margin: 0, opacity: 0.8 }}>
          Apunta la cámara hacia la etiqueta de peso
        </p>
      </div>

      {/* Camera Permission */}
      {hasPermission === null && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '20px',
          textAlign: 'center',
          color: 'white'
        }}>
          <span style={{ fontSize: '64px', marginBottom: '20px' }}>📷</span>
          <h3 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 'bold' }}>
            Activar Cámara
          </h3>
          <p style={{ marginBottom: '24px', opacity: 0.8, lineHeight: '1.5' }}>
            Necesitamos acceso a tu cámara para escanear las etiquetas de peso
          </p>
          <button
            onClick={startCamera}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '14px 28px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🚀 Activar Cámara
          </button>
        </div>
      )}

      {/* Camera Access Denied */}
      {hasPermission === false && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '20px',
          textAlign: 'center',
          color: 'white'
        }}>
          <span style={{ fontSize: '64px', marginBottom: '20px' }}>🚫</span>
          <h3 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 'bold' }}>
            Acceso Denegado
          </h3>
          <p style={{ marginBottom: '24px', opacity: 0.8, lineHeight: '1.5' }}>
            No se pudo acceder a la cámara. Por favor verifica los permisos en tu navegador.
          </p>
          <button
            onClick={startCamera}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              padding: '14px 28px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 Intentar de Nuevo
          </button>
        </div>
      )}

      {/* Camera View */}
      {isScanning && (
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Video Element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '50vh',
              objectFit: 'cover'
            }}
            playsInline
            muted
            autoPlay
          />

          {/* Scanning Overlay */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '280px',
            height: '120px',
            border: '3px solid #22c55e',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
            zIndex: 5
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(34, 197, 94, 0.9)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              🔍 Zona de Escaneo
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Procesando...
              <style>
                {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
              </style>
            </div>
          )}

          {/* Canvas for image capture (hidden) */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          {/* Stop Camera Button */}
          <button
            onClick={stopCamera}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              backgroundColor: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              padding: '12px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ❌
          </button>
        </div>
      )}

      {/* Detected Weights */}
      {detectedLabels.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          margin: '0',
          padding: '20px',
          minHeight: '50vh'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            🎯 Pesos Detectados
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {detectedLabels.map((label) => (
              <div
                key={label.timestamp}
                onClick={() => setSelectedWeight(label)}
                style={{
                  padding: '16px',
                  backgroundColor: selectedWeight?.timestamp === label.timestamp ? '#eff6ff' : '#f9fafb',
                  border: selectedWeight?.timestamp === label.timestamp ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 4px 0' }}>
                      {label.weight} kg
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                      Confianza: {Math.round(label.confidence * 100)}%
                    </p>
                  </div>
                  {selectedWeight?.timestamp === label.timestamp && (
                    <div style={{
                      backgroundColor: '#22c55e',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      ✓ Seleccionado
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Registration Form */}
          {selectedWeight && (
            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: '0 0 16px 0'
              }}>
                📝 Completar Registro
              </h4>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Proveedor *
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>{supplier}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Tipo de Corte *
                </label>
                <select
                  value={selectedCutType}
                  onChange={(e) => setSelectedCutType(e.target.value as 'jamón' | 'chuleta')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="jamón">Jamón</option>
                  <option value="chuleta">Chuleta</option>
                </select>
              </div>

              <button
                onClick={handleCreateRegistration}
                disabled={!selectedSupplier || !selectedCutType}
                style={{
                  width: '100%',
                  backgroundColor: selectedSupplier && selectedCutType ? '#2563eb' : '#9ca3af',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: selectedSupplier && selectedCutType ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                ✅ Crear Registro ({selectedWeight.weight} kg)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {isScanning && detectedLabels.length === 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔍</span>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            color: '#374151'
          }}>
            Buscando Etiquetas...
          </h3>
          <p style={{ margin: '0 0 16px 0', lineHeight: '1.5' }}>
            Coloca la etiqueta de peso dentro de la zona de escaneo verde
          </p>
          <div style={{
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '300px',
            margin: '0 auto'
          }}>
            <p style={{ fontSize: '12px', margin: 0, color: '#166534' }}>
              💡 <strong>Tip:</strong> Asegúrate de que la etiqueta esté bien iluminada y enfocada
            </p>
          </div>
        </div>
      )}
    </div>
  );
};