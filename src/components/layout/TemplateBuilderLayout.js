// Template Builder Layout - Dedicated layout for full-screen template editor
import React from "react";
import "./TemplateBuilderLayout.css";

const TemplateBuilderLayout = ({ children }) => {
  return (
    <div className="tb-layout">
      {children}
    </div>
  );
};

export default TemplateBuilderLayout;