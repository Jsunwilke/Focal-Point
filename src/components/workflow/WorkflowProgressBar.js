// src/components/workflow/WorkflowProgressBar.js
import React from 'react';
import { CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react';

const WorkflowProgressBar = ({ 
  workflow, 
  template,
  sessionData = null,
  size = 'medium', 
  showSteps = false,
  onClick = null 
}) => {
  if (!workflow || !template) {
    return null;
  }

  const { steps } = template;
  const { stepProgress } = workflow;

  // Calculate progress
  const completedSteps = steps.filter(step => 
    stepProgress[step.id]?.status === 'completed'
  ).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Get current step (first non-completed step)
  const currentStep = steps.find(step => 
    stepProgress[step.id]?.status !== 'completed'
  );

  // Get status color
  const getStatusColor = () => {
    if (workflow.status === 'completed') return '#10b981'; // green
    if (workflow.status === 'on_hold') return '#f59e0b'; // yellow
    if (workflow.status === 'cancelled') return '#ef4444'; // red
    return '#3b82f6'; // blue for active
  };

  // Size configurations
  const sizeConfig = {
    small: {
      height: '6px',
      textSize: '0.75rem',
      iconSize: 14,
      spacing: '0.25rem'
    },
    medium: {
      height: '8px',
      textSize: '0.875rem',
      iconSize: 16,
      spacing: '0.5rem'
    },
    large: {
      height: '12px',
      textSize: '1rem',
      iconSize: 20,
      spacing: '0.75rem'
    }
  };

  const config = sizeConfig[size];

  const getStepIcon = (step) => {
    const stepStatus = stepProgress[step.id]?.status || 'pending';
    const iconProps = { size: config.iconSize };

    switch (stepStatus) {
      case 'completed':
        return <CheckCircle {...iconProps} style={{ color: '#10b981' }} />;
      case 'in_progress':
        return <Clock {...iconProps} style={{ color: '#f59e0b' }} />;
      case 'overdue':
        return <AlertCircle {...iconProps} style={{ color: '#ef4444' }} />;
      default:
        return <Circle {...iconProps} style={{ color: '#9ca3af' }} />;
    }
  };

  const componentStyle = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    padding: config.spacing,
    borderRadius: '4px'
  };

  const progressBarStyle = {
    width: '100%',
    height: config.height,
    backgroundColor: '#e5e7eb',
    borderRadius: config.height,
    overflow: 'hidden',
    position: 'relative'
  };

  const progressFillStyle = {
    height: '100%',
    backgroundColor: getStatusColor(),
    borderRadius: config.height,
    transition: 'width 0.3s ease',
    width: `${progressPercentage}%`
  };

  const textStyle = {
    fontSize: config.textSize,
    color: '#374151',
    marginTop: config.spacing
  };

  return (
    <div 
      style={componentStyle}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => e.target.style.backgroundColor = '#f9fafb' : null}
      onMouseLeave={onClick ? (e) => e.target.style.backgroundColor = 'transparent' : null}
    >
      {/* Progress Bar */}
      <div style={progressBarStyle}>
        <div style={progressFillStyle} />
      </div>

      {/* Progress Text */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...textStyle
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '500' }}>
            {workflow.templateName}
          </div>
          {sessionData && (
            <div style={{ 
              fontSize: config.textSize === '1rem' ? '0.75rem' : '0.625rem',
              color: '#6b7280',
              marginTop: '0.125rem'
            }}>
              {sessionData.schoolName || 'Unknown School'} • {
                new Date(sessionData.date).toLocaleDateString()
              }
            </div>
          )}
        </div>
        <span style={{ 
          fontSize: config.textSize === '1rem' ? '0.875rem' : '0.75rem',
          color: '#6b7280'
        }}>
          {completedSteps}/{totalSteps} steps
        </span>
      </div>

      {/* Current Step Indicator */}
      {currentStep && (
        <div style={{
          fontSize: config.textSize === '1rem' ? '0.875rem' : '0.75rem',
          color: '#6b7280',
          marginTop: '2px'
        }}>
          Current: {currentStep.title}
        </div>
      )}

      {/* Step Details (if enabled) */}
      {showSteps && (
        <div style={{ marginTop: config.spacing }}>
          {steps.map((step, index) => {
            const stepStatus = stepProgress[step.id]?.status || 'pending';
            const assignedTo = stepProgress[step.id]?.assignedTo;
            
            return (
              <div 
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: config.spacing,
                  padding: `${config.spacing} 0`,
                  borderBottom: index < steps.length - 1 ? '1px solid #f3f4f6' : 'none'
                }}
              >
                {getStepIcon(step)}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: config.textSize,
                    fontWeight: stepStatus === 'in_progress' ? '600' : '400',
                    color: stepStatus === 'completed' ? '#10b981' : '#374151'
                  }}>
                    {step.title}
                  </div>
                  {assignedTo && (
                    <div style={{
                      fontSize: config.textSize === '1rem' ? '0.75rem' : '0.625rem',
                      color: '#6b7280'
                    }}>
                      Assigned to: {assignedTo}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: config.textSize === '1rem' ? '0.75rem' : '0.625rem',
                  color: '#9ca3af',
                  textTransform: 'capitalize'
                }}>
                  {stepStatus.replace('_', ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Badge */}
      {workflow.status !== 'active' && (
        <div style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '500',
          textTransform: 'uppercase',
          marginTop: config.spacing,
          backgroundColor: workflow.status === 'completed' ? '#dcfce7' : 
                          workflow.status === 'on_hold' ? '#fef3c7' : '#fee2e2',
          color: workflow.status === 'completed' ? '#166534' : 
                 workflow.status === 'on_hold' ? '#92400e' : '#991b1b'
        }}>
          {workflow.status.replace('_', ' ')}
        </div>
      )}
    </div>
  );
};

export default WorkflowProgressBar;