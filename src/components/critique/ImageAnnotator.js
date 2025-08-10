// src/components/critique/ImageAnnotator.js
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import { X, Pen, Eraser, RotateCcw, Check, Undo, Redo } from 'lucide-react';
import Button from '../shared/Button';
import './ImageAnnotator.css';

const ImageAnnotator = ({ isOpen, imageUrl, onSave, onClose }) => {
  const canvasRef = useRef();
  const [strokeColor, setStrokeColor] = useState('#ff0000'); // Default to red
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isErasing, setIsErasing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 800, height: 600 });

  const colors = [
    { name: 'Red', value: '#ff0000' },
    { name: 'Green', value: '#00ff00' },
    { name: 'Blue', value: '#0066ff' },
    { name: 'Yellow', value: '#ffff00' },
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' }
  ];

  const widths = [
    { label: 'Thin', value: 2 },
    { label: 'Medium', value: 3 },
    { label: 'Thick', value: 5 },
    { label: 'Extra Thick', value: 8 }
  ];

  // Load image and calculate dimensions to maintain aspect ratio
  useEffect(() => {
    if (!imageUrl) return;
    
    const img = new Image();
    img.onload = () => {
      // Get natural dimensions
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      // Calculate max dimensions that fit in the modal
      const maxWidth = window.innerWidth * 0.7; // 70% of viewport width
      const maxHeight = window.innerHeight * 0.6; // 60% of viewport height
      
      // Calculate scale to fit
      const scaleX = maxWidth / naturalWidth;
      const scaleY = maxHeight / naturalHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't upscale images
      
      // Set dimensions maintaining aspect ratio
      setImageDimensions({
        width: Math.round(naturalWidth * scale),
        height: Math.round(naturalHeight * scale)
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleColorChange = (color) => {
    setStrokeColor(color);
    setIsErasing(false);
    if (canvasRef.current) {
      canvasRef.current.eraseMode(false);
    }
  };

  const handleEraserToggle = () => {
    setIsErasing(!isErasing);
    if (canvasRef.current) {
      canvasRef.current.eraseMode(!isErasing);
    }
  };

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  const handleUndo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (canvasRef.current) {
      canvasRef.current.redo();
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;
    
    setSaving(true);
    
    try {
      // Export the canvas with the background image
      const data = await canvasRef.current.exportImage('png');
      
      // Convert base64 to blob
      const response = await fetch(data);
      const blob = await response.blob();
      
      // Create a File object
      const file = new File([blob], 'annotated-image.png', { type: 'image/png' });
      
      onSave(file, data);
    } catch (error) {
      console.error('Error saving annotation:', error);
      alert('Failed to save annotation');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)'
      }}
    >
      <div className="image-annotator">
        <div className="annotator-header">
          <h3>Annotate Image</h3>
          <button className="annotator-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="annotator-toolbar">
          <div className="toolbar-section">
            <label>Color:</label>
            <div className="color-picker">
              {colors.map(color => (
                <button
                  key={color.value}
                  className={`color-swatch ${strokeColor === color.value && !isErasing ? 'active' : ''}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleColorChange(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          <div className="toolbar-section">
            <label>Width:</label>
            <div className="width-picker">
              {widths.map(width => (
                <button
                  key={width.value}
                  className={`width-option ${strokeWidth === width.value ? 'active' : ''}`}
                  onClick={() => setStrokeWidth(width.value)}
                >
                  {width.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="toolbar-section toolbar-actions">
            <button
              className={`tool-button ${!isErasing ? 'active' : ''}`}
              onClick={() => {
                setIsErasing(false);
                canvasRef.current?.eraseMode(false);
              }}
              title="Draw"
            >
              <Pen size={18} />
            </button>
            <button
              className={`tool-button ${isErasing ? 'active' : ''}`}
              onClick={handleEraserToggle}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
            <button
              className="tool-button"
              onClick={handleUndo}
              title="Undo"
            >
              <Undo size={18} />
            </button>
            <button
              className="tool-button"
              onClick={handleRedo}
              title="Redo"
            >
              <Redo size={18} />
            </button>
            <button
              className="tool-button"
              onClick={handleClear}
              title="Clear All"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        
        <div className="annotator-canvas">
          <div className="canvas-container" style={{ 
            width: `${imageDimensions.width}px`, 
            height: `${imageDimensions.height}px` 
          }}>
            <ReactSketchCanvas
              ref={canvasRef}
              strokeWidth={strokeWidth}
              strokeColor={strokeColor}
              canvasColor="transparent"
              backgroundImage={imageUrl}
              exportWithBackgroundImage={true}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '8px'
              }}
              width={`${imageDimensions.width}px`}
              height={`${imageDimensions.height}px`}
            />
          </div>
        </div>
        
        <div className="annotator-footer">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            icon={<Check size={18} />}
          >
            Save Annotation
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ImageAnnotator;