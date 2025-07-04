// src/components/shared/ImageCropModal.js
import React, { useState, useRef, useEffect } from "react";
import { X, RotateCcw, ZoomIn, ZoomOut, Move, Check } from "lucide-react";
import Button from "./Button";
import "./ImageCropModal.css";

const ImageCropModal = ({
  isOpen,
  imageFile,
  existingCropSettings,
  originalImageURL,
  onCrop,
  onCancel,
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState(300);

  useEffect(() => {
    if (isOpen && imageFile) {
      loadImage();
    }
  }, [isOpen, imageFile]);

  useEffect(() => {
    if (imageRef.current) {
      drawPreview();
    }
  }, [scale, position, imageSize]);

  const loadImage = () => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;

      // Calculate initial scale to fit the image in the container
      const containerSize = 300;
      const scale = Math.max(
        containerSize / img.width,
        containerSize / img.height
      );

      setImageSize({ width: img.width, height: img.height });
      setScale(scale);
      setPosition({ x: 0, y: 0 });

      setTimeout(() => drawPreview(), 100);
    };
    img.src = URL.createObjectURL(imageFile);
  };

  const drawPreview = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // Set canvas size
    canvas.width = containerSize;
    canvas.height = containerSize;

    // Clear canvas
    ctx.clearRect(0, 0, containerSize, containerSize);

    // Calculate scaled image dimensions
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Calculate position to center the image
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const imageX = centerX - scaledWidth / 2 + position.x;
    const imageY = centerY - scaledHeight / 2 + position.y;

    // Draw image
    ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);

    // Draw circular crop overlay
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(centerX, centerY, containerSize / 2, 0, 2 * Math.PI);
    ctx.fill();

    // Reset composite operation
    ctx.globalCompositeOperation = "source-over";
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newPosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };

    setPosition(newPosition);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.01 : 0.01; // Changed to 1% increments
    setScale((prev) => Math.max(0.1, Math.min(1.5, prev + delta))); // Max 150%
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(1.5, prev + 0.05)); // 5% increments for buttons
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.1, prev - 0.05)); // 5% increments for buttons
  };

  const handleReset = () => {
    const img = imageRef.current;
    if (!img) return;

    const scale = Math.max(
      containerSize / img.width,
      containerSize / img.height
    );

    setScale(scale);
    setPosition({ x: 0, y: 0 });
  };

  const handleCrop = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    const cropSettings = {
      scale,
      position,
      containerSize,
    };

    if (imageFile) {
      // New image upload - create cropped file
      const outputCanvas = document.createElement("canvas");
      const outputCtx = outputCanvas.getContext("2d");
      const outputSize = 300;

      outputCanvas.width = outputSize;
      outputCanvas.height = outputSize;

      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const centerX = containerSize / 2;
      const centerY = containerSize / 2;
      const imageX = centerX - scaledWidth / 2 + position.x;
      const imageY = centerY - scaledHeight / 2 + position.y;

      outputCtx.drawImage(
        img,
        imageX * (outputSize / containerSize),
        imageY * (outputSize / containerSize),
        scaledWidth * (outputSize / containerSize),
        scaledHeight * (outputSize / containerSize)
      );

      outputCtx.globalCompositeOperation = "destination-in";
      outputCtx.beginPath();
      outputCtx.arc(
        outputSize / 2,
        outputSize / 2,
        outputSize / 2,
        0,
        2 * Math.PI
      );
      outputCtx.fill();

      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], imageFile.name, {
              type: imageFile.type,
              lastModified: Date.now(),
            });
            onCrop(croppedFile, cropSettings);
          }
        },
        imageFile.type,
        0.9
      );
    } else {
      // Re-cropping existing image - just pass the crop settings
      onCrop(null, cropSettings);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal--medium">
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Crop Profile Photo</h2>
            <p className="modal__subtitle">
              Adjust your photo to fit the circular frame
            </p>
          </div>
          <button className="modal__close" onClick={onCancel} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__content">
          <div className="crop-container">
            <div
              ref={containerRef}
              className="crop-preview"
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
            >
              <canvas
                ref={canvasRef}
                className="crop-canvas"
                style={{
                  cursor: isDragging ? "grabbing" : "grab",
                  width: `${containerSize}px`,
                  height: `${containerSize}px`,
                }}
              />
              <div className="crop-overlay">
                <div className="crop-circle"></div>
              </div>
            </div>

            <div className="crop-controls">
              <div className="crop-control-group">
                <label className="crop-control-label">
                  <ZoomOut size={16} />
                  Zoom
                  <ZoomIn size={16} />
                </label>
                <div className="crop-slider-container">
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.01"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="crop-slider"
                  />
                  <div className="crop-slider-marks">
                    <span className="crop-slider-mark crop-slider-mark--start">
                      10%
                    </span>
                    <span className="crop-slider-mark crop-slider-mark--middle">
                      100%
                    </span>
                    <span className="crop-slider-mark crop-slider-mark--end">
                      150%
                    </span>
                  </div>
                </div>
                <span className="crop-value">{Math.round(scale * 100)}%</span>
              </div>

              <div className="crop-buttons">
                <button
                  type="button"
                  className="crop-button"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  className="crop-button"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className="crop-button"
                  onClick={handleReset}
                  title="Reset"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            <div className="crop-instructions">
              <div className="crop-instruction">
                <Move size={16} />
                <span>Drag to reposition</span>
              </div>
              <div className="crop-instruction">
                <span>🖱️ Scroll for precise zoom (1%)</span>
              </div>
              <div className="crop-instruction">
                <span>🎯 Slider for fine control</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal__actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleCrop}
            className="crop-save-btn"
          >
            <Check size={16} />
            Use This Crop
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
