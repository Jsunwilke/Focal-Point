// src/components/shared/LoadingSpinner.js
import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner = ({
  size = "medium",
  color = "primary",
  className = "",
}) => {
  const spinnerClass = [
    "spinner",
    `spinner--${size}`,
    `spinner--${color}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={spinnerClass}>
      <div className="spinner__circle"></div>
    </div>
  );
};

export default LoadingSpinner;
