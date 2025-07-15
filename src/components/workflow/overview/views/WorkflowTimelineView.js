// src/components/workflow/overview/views/WorkflowTimelineView.js
import React, { useState, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

const WorkflowTimelineView = ({ workflows, sessionData, workflowTemplates }) => {
  const [zoomLevel, setZoomLevel] = useState('week'); // day, week, month
  const [scrollPosition, setScrollPosition] = useState(0);

  // Calculate date range for all workflows
  const dateRange = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    
    workflows.forEach(workflow => {
      const session = sessionData[workflow.sessionId];
      if (session?.date) {
        const sessionDate = new Date(session.date);
        const template = workflowTemplates[workflow.templateId];
        
        if (template) {
          // Calculate workflow start based on pre-session steps
          const earliestStep = template.steps.reduce((earliest, step) => {
            const offset = step.dueOffsetDays || 0;
            return Math.min(earliest, offset);
          }, 0);
          
          const workflowStart = new Date(sessionDate);
          workflowStart.setDate(workflowStart.getDate() + earliestStep);
          
          // Calculate workflow end based on post-session steps
          const latestStep = template.steps.reduce((latest, step) => {
            const offset = step.dueOffsetDays || 0;
            return Math.max(latest, offset);
          }, 0);
          
          const workflowEnd = new Date(sessionDate);
          workflowEnd.setDate(workflowEnd.getDate() + latestStep);
          
          if (workflowStart < minDate) minDate = workflowStart;
          if (workflowEnd > maxDate) maxDate = workflowEnd;
        }
      }
    });
    
    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);
    
    return { minDate, maxDate };
  }, [workflows, sessionData, workflowTemplates]);

  // Generate timeline headers based on zoom level
  const generateTimelineHeaders = () => {
    const headers = [];
    const current = new Date(dateRange.minDate);
    const end = new Date(dateRange.maxDate);
    
    while (current <= end) {
      switch (zoomLevel) {
        case 'day':
          headers.push({
            label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            date: new Date(current),
            width: 100
          });
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          headers.push({
            label: `Week of ${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            date: new Date(current),
            width: 200
          });
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          headers.push({
            label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            date: new Date(current),
            width: 300
          });
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }
    
    return headers;
  };

  const timelineHeaders = generateTimelineHeaders();

  // Calculate position and width for a step
  const calculateStepPosition = (sessionDate, step) => {
    const startDate = new Date(sessionDate);
    startDate.setDate(startDate.getDate() + (step.dueOffsetDays || 0));
    
    const daysDiff = Math.floor((startDate - dateRange.minDate) / (1000 * 60 * 60 * 24));
    const duration = step.estimatedHours ? Math.max(1, Math.ceil(step.estimatedHours / 8)) : 1;
    
    let pixelsPerDay;
    switch (zoomLevel) {
      case 'day':
        pixelsPerDay = 100;
        break;
      case 'week':
        pixelsPerDay = 200 / 7;
        break;
      case 'month':
        pixelsPerDay = 300 / 30;
        break;
    }
    
    return {
      left: daysDiff * pixelsPerDay,
      width: duration * pixelsPerDay
    };
  };

  // Get step color based on status
  const getStepColor = (stepProgress) => {
    if (!stepProgress) return '#e5e7eb';
    
    switch (stepProgress.status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#f59e0b';
      case 'overdue':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Handle zoom
  const handleZoom = (direction) => {
    const levels = ['day', 'week', 'month'];
    const currentIndex = levels.indexOf(zoomLevel);
    
    if (direction === 'in' && currentIndex > 0) {
      setZoomLevel(levels[currentIndex - 1]);
    } else if (direction === 'out' && currentIndex < levels.length - 1) {
      setZoomLevel(levels[currentIndex + 1]);
    }
  };

  // Today line position
  const todayPosition = useMemo(() => {
    const today = new Date();
    const daysDiff = Math.floor((today - dateRange.minDate) / (1000 * 60 * 60 * 24));
    
    let pixelsPerDay;
    switch (zoomLevel) {
      case 'day':
        pixelsPerDay = 100;
        break;
      case 'week':
        pixelsPerDay = 200 / 7;
        break;
      case 'month':
        pixelsPerDay = 300 / 30;
        break;
    }
    
    return daysDiff * pixelsPerDay;
  }, [dateRange, zoomLevel]);

  return (
    <div className="workflow-timeline-view">
      {/* Controls */}
      <div className="timeline-controls">
        <div className="zoom-controls">
          <button 
            onClick={() => handleZoom('in')} 
            disabled={zoomLevel === 'day'}
            className="zoom-button"
          >
            <ZoomIn size={16} />
          </button>
          <span className="zoom-level">{zoomLevel}</span>
          <button 
            onClick={() => handleZoom('out')} 
            disabled={zoomLevel === 'month'}
            className="zoom-button"
          >
            <ZoomOut size={16} />
          </button>
        </div>
        
        <div className="timeline-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }} />
            <span>Completed</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
            <span>In Progress</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
            <span>Overdue</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#6b7280' }} />
            <span>Pending</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline-container">
        <div className="timeline-sidebar">
          {workflows.map(workflow => {
            const session = sessionData[workflow.sessionId];
            return (
              <div key={workflow.id} className="timeline-row-header">
                <div className="workflow-info">
                  <h4>{session?.schoolName || 'Unknown'}</h4>
                  <span>{workflow.templateName}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="timeline-scroll-container">
          <div className="timeline-content">
            {/* Timeline Headers */}
            <div className="timeline-headers">
              {timelineHeaders.map((header, index) => (
                <div 
                  key={index} 
                  className="timeline-header"
                  style={{ width: header.width }}
                >
                  {header.label}
                </div>
              ))}
            </div>

            {/* Today Line */}
            <div 
              className="today-line" 
              style={{ left: todayPosition }}
            >
              <div className="today-label">Today</div>
            </div>

            {/* Workflow Rows */}
            <div className="timeline-rows">
              {workflows.map(workflow => {
                const session = sessionData[workflow.sessionId];
                const template = workflowTemplates[workflow.templateId];
                
                if (!session?.date || !template) return null;
                
                return (
                  <div key={workflow.id} className="timeline-row">
                    {template.steps.map(step => {
                      const position = calculateStepPosition(session.date, step);
                      const stepProgress = workflow.stepProgress[step.id];
                      const color = getStepColor(stepProgress);
                      
                      return (
                        <div
                          key={step.id}
                          className="timeline-step"
                          style={{
                            left: position.left,
                            width: position.width,
                            backgroundColor: color
                          }}
                          title={`${step.title}\nStatus: ${stepProgress?.status || 'pending'}`}
                        >
                          <span className="step-label">{step.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTimelineView;