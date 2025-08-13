import React, { useState } from 'react';
import './UserAvatar.css';

const UserAvatar = ({ 
  user, 
  size = 'medium', 
  className = '',
  showStatus = false,
  isOnline = false
}) => {
  const [imageError, setImageError] = useState(false);

  const getUserInitials = () => {
    if (!user) return '?';
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    } else if (user.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Handle both string size names and numeric sizes
  let sizeClass;
  if (typeof size === 'number') {
    // Convert numeric sizes to named sizes
    if (size <= 24) sizeClass = 'user-avatar--xsmall';
    else if (size <= 32) sizeClass = 'user-avatar--small';
    else if (size <= 40) sizeClass = 'user-avatar--medium';
    else if (size <= 48) sizeClass = 'user-avatar--large';
    else sizeClass = 'user-avatar--xlarge';
  } else {
    sizeClass = `user-avatar--${size}`;
  }
  const avatarClasses = `user-avatar ${sizeClass} ${className}`;

  return (
    <div className={avatarClasses}>
      {user?.photoURL && !imageError ? (
        <img
          src={user.photoURL}
          alt={`${user.firstName || 'User'} ${user.lastName || ''}`}
          className="user-avatar__image"
          onError={handleImageError}
        />
      ) : (
        <div className="user-avatar__initials">
          {getUserInitials()}
        </div>
      )}
      
      {showStatus && (
        <div className={`user-avatar__status ${isOnline ? 'user-avatar__status--online' : 'user-avatar__status--offline'}`} />
      )}
    </div>
  );
};

export default UserAvatar;