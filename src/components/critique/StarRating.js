// src/components/critique/StarRating.js
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

const StarRating = ({ 
  rating = 0, 
  onRatingChange, 
  readonly = false, 
  size = 'medium',
  showLabel = false,
  className = '' 
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = (starIndex) => {
    if (!readonly) {
      setHoverRating(starIndex);
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
      setIsHovering(false);
    }
  };

  const handleClick = (starIndex) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starIndex);
    }
  };

  const displayRating = isHovering ? hoverRating : rating;

  const getRatingLabel = (rating) => {
    if (rating === 0) return '';
    if (rating <= 1) return 'Needs Improvement';
    if (rating <= 2) return 'Fair';
    if (rating <= 3) return 'Good';
    if (rating <= 4) return 'Very Good';
    return 'Excellent';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'star-rating--small';
      case 'large': return 'star-rating--large';
      default: return 'star-rating--medium';
    }
  };

  return (
    <div className={`star-rating ${getSizeClass()} ${readonly ? 'star-rating--readonly' : ''} ${className}`}>
      <div className="star-rating__stars">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const filled = starIndex <= displayRating;
          const halfFilled = !Number.isInteger(displayRating) && 
                           starIndex === Math.ceil(displayRating) && 
                           starIndex - 0.5 <= displayRating;

          return (
            <button
              key={starIndex}
              type="button"
              className={`star-rating__star ${filled ? 'star-rating__star--filled' : ''} ${halfFilled ? 'star-rating__star--half' : ''}`}
              onMouseEnter={() => handleMouseEnter(starIndex)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(starIndex)}
              disabled={readonly}
              aria-label={`Rate ${starIndex} star${starIndex !== 1 ? 's' : ''}`}
            >
              <Star 
                size={size === 'small' ? 16 : size === 'large' ? 28 : 20}
                fill={filled || halfFilled ? 'currentColor' : 'none'}
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
      
      {showLabel && (
        <div className="star-rating__label">
          {displayRating > 0 && (
            <>
              <span className="star-rating__value">{displayRating.toFixed(1)}</span>
              <span className="star-rating__text">{getRatingLabel(displayRating)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StarRating;