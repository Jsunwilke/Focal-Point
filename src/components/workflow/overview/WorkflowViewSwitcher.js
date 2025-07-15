// src/components/workflow/overview/WorkflowViewSwitcher.js
import React, { useEffect } from 'react';

const WorkflowViewSwitcher = ({ views, currentView, onViewChange }) => {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle if no input is focused
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Number keys 1-6
      if (e.key >= '1' && e.key <= '6') {
        const viewIndex = parseInt(e.key) - 1;
        if (viewIndex < views.length) {
          onViewChange(views[viewIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [views, onViewChange]);

  return (
    <div className="workflow-view-switcher">
      <span className="view-label">View:</span>
      <div className="view-buttons">
        {views.map((view, index) => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              className={`view-button ${currentView === view.id ? 'active' : ''}`}
              onClick={() => onViewChange(view.id)}
              title={`${view.name} (Press ${index + 1})\n${view.description}`}
            >
              <Icon size={18} />
              <span className="view-button-text">{view.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowViewSwitcher;