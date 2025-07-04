import React from "react";

const LoadingSpinner = ({
  text = "Loading...",
  size = "default",
  className = "",
}) => {
  const getSpinnerSize = () => {
    switch (size) {
      case "small":
        return "spinner-border-sm";
      case "large":
        return "";
      default:
        return "";
    }
  };

  return (
    <div className={`text-center py-3 ${className}`}>
      <div
        className={`spinner-border text-primary ${getSpinnerSize()}`}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && <p className="mt-2 mb-0">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
