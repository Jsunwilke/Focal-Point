import React from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, CheckCircle, XCircle, Info, X } from 'lucide-react';

const NotificationModal = ({ 
  isOpen, 
  onClose, 
  title = "Notification",
  message = "",
  type = "info", // success, error, warning, info
  autoClose = false,
  autoCloseDelay = 3000
}) => {
  React.useEffect(() => {
    if (autoClose && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="text-green-500" />;
      case 'error':
        return <XCircle size={24} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={24} className="text-yellow-500" />;
      default:
        return <Info size={24} className="text-blue-500" />;
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'notification-success';
      case 'error':
        return 'notification-error';
      case 'warning':
        return 'notification-warning';
      default:
        return 'notification-info';
    }
  };

  const modalContent = (
    <div 
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10001
      }}
    >
      <div 
        className={`modal-content notification-modal ${getTypeClass()}`}
        style={{
          position: 'relative',
          margin: 0,
          transform: 'none',
          maxWidth: '400px',
          width: '90%'
        }}
      >
        <div className="modal-header">
          <div className="notification-title">
            {getIcon()}
            <h3>{title}</h3>
          </div>
          <button 
            className="modal-close" 
            onClick={onClose}
            aria-label="Close notification"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>{message}</p>
        </div>

        <div className="modal-actions">
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default NotificationModal;