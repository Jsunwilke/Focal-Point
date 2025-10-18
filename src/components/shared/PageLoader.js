// src/components/shared/PageLoader.js
import React from 'react';
import './PageLoader.css';

const PageLoader = () => {
  return (
    <div className="page-loader">
      <div className="page-loader__spinner"></div>
      <p className="page-loader__text">Loading...</p>
    </div>
  );
};

export default PageLoader;
