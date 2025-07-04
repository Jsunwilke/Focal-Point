import React, { useEffect, useState } from "react";

const Toast = ({ id, title, message, type, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show toast animation
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Auto-hide toast after 5 seconds
    const hideTimer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onRemove();
    }, 300); // Wait for fade out animation
  };

  const getToastClass = () => {
    let baseClass = `toast align-items-center border-0 ${
      isVisible ? "show" : ""
    }`;

    switch (type) {
      case "success":
        return `${baseClass} bg-success text-white`;
      case "error":
        return `${baseClass} bg-danger text-white`;
      case "warning":
        return `${baseClass} bg-warning text-dark`;
      case "info":
        return `${baseClass} bg-info text-dark`;
      default:
        return `${baseClass} bg-success text-white`;
    }
  };

  return (
    <div
      className={getToastClass()}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        minWidth: "250px",
        marginBottom: "10px",
        transition: "all 0.3s ease-in-out",
      }}
    >
      <div className="d-flex">
        <div className="toast-body">
          <strong>{title}</strong>: {message}
        </div>
        <button
          type="button"
          className="btn-close btn-close-white me-2 m-auto"
          onClick={handleClose}
          aria-label="Close"
        ></button>
      </div>
    </div>
  );
};

export default Toast;
