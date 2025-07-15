// src/components/workflow/overview/views/WorkflowCardView.js
import React, { useState } from 'react';
import { 
  Calendar, 
  School, 
  User, 
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import WorkflowProgressBar from '../../WorkflowProgressBar';

const WorkflowCardView = ({ workflows, sessionData, workflowTemplates, getWorkflowWithTemplate }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [gridSize, setGridSize] = useState('medium'); // small, medium, large
  const [groupBySessionType, setGroupBySessionType] = useState(true);

  // Group workflows by session type
  const groupedWorkflows = groupBySessionType 
    ? workflows.reduce((groups, workflow) => {
        const groupKey = workflow.sessionType || workflow.templateName || 'Unknown Type';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(workflow);
        return groups;
      }, {})
    : { 'All Workflows': workflows };

  // Sort groups
  const sortedGroups = Object.keys(groupedWorkflows).sort((a, b) => {
    if (a === 'Unknown Type') return 1;
    if (b === 'Unknown Type') return -1;
    if (a === 'All Workflows') return -1;
    if (b === 'All Workflows') return 1;
    return a.localeCompare(b);
  });

  // Calculate workflow statistics
  const getWorkflowStats = (workflow) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return { completed: 0, total: 0, overdue: 0, current: null };
    
    let completed = 0;
    let overdue = 0;
    let current = null;
    
    template.steps.forEach(step => {
      const stepProgress = workflow.stepProgress[step.id];
      if (stepProgress?.status === 'completed') {
        completed++;
      } else if (stepProgress?.status === 'overdue') {
        overdue++;
      } else if (stepProgress?.status === 'in_progress' && !current) {
        current = step;
      }
    });
    
    return { 
      completed, 
      total: template.steps.length, 
      overdue,
      current: current || template.steps.find(s => !workflow.stepProgress[s.id] || workflow.stepProgress[s.id].status !== 'completed')
    };
  };

  // Get card size class
  const getCardSizeClass = () => {
    switch (gridSize) {
      case 'small':
        return 'card-small';
      case 'large':
        return 'card-large';
      default:
        return 'card-medium';
    }
  };

  // Get status color
  const getStatusColor = (workflow) => {
    const stats = getWorkflowStats(workflow);
    if (stats.overdue > 0) return '#ef4444';
    if (workflow.status === 'completed') return '#10b981';
    if (workflow.status === 'on_hold') return '#f59e0b';
    return '#3b82f6';
  };

  // Render workflow card
  const WorkflowCard = ({ workflow }) => {
    const session = sessionData[workflow.sessionId];
    const stats = getWorkflowStats(workflow);
    const statusColor = getStatusColor(workflow);
    const workflowData = getWorkflowWithTemplate(workflow.id);
    
    return (
      <div 
        className={`workflow-card ${getCardSizeClass()} ${selectedCard === workflow.id ? 'selected' : ''}`}
        onClick={() => setSelectedCard(workflow.id === selectedCard ? null : workflow.id)}
      >
        <div className="card-header">
          <div className="card-status-indicator" style={{ backgroundColor: statusColor }} />
          <h3>{session?.schoolName || 'Unknown School'}</h3>
          <button 
            className="card-menu-button"
            onClick={(e) => {
              e.stopPropagation();
              // Handle menu actions
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>
        
        <div className="card-body">
          <div className="card-type">
            {workflow.templateName}
            {workflow.sessionType && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.125rem 0.375rem',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                textTransform: 'capitalize'
              }}>
                {workflow.sessionType}
              </span>
            )}
          </div>
          
          {gridSize !== 'small' && (
            <>
              <div className="card-details">
                <div className="detail-item">
                  <Calendar size={14} />
                  <span>{session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}</span>
                </div>
                
                <div className="detail-item">
                  <User size={14} />
                  <span>{session?.clientName || 'N/A'}</span>
                </div>
              </div>
              
              <div className="card-progress">
                <WorkflowProgressBar
                  workflow={workflow}
                  template={workflowData?.template}
                  sessionData={session}
                  size="small"
                  showSteps={false}
                />
              </div>
            </>
          )}
          
          <div className="card-stats">
            <div className="stat-item">
              <CheckCircle size={14} style={{ color: '#10b981' }} />
              <span>{stats.completed}/{stats.total}</span>
            </div>
            
            {stats.overdue > 0 && (
              <div className="stat-item">
                <AlertCircle size={14} style={{ color: '#ef4444' }} />
                <span>{stats.overdue} overdue</span>
              </div>
            )}
            
            {stats.current && gridSize === 'large' && (
              <div className="current-step">
                <ChevronRight size={14} />
                <span>{stats.current.title}</span>
              </div>
            )}
          </div>
        </div>
        
        {selectedCard === workflow.id && gridSize !== 'small' && (
          <div className="card-expanded">
            <h4>Workflow Steps:</h4>
            <div className="steps-mini-list">
              {workflowData?.template?.steps.map(step => {
                const stepProgress = workflow.stepProgress[step.id];
                const status = stepProgress?.status || 'pending';
                
                return (
                  <div key={step.id} className={`step-mini-item ${status}`}>
                    <span className="step-mini-indicator" />
                    <span className="step-mini-title">{step.title}</span>
                    <span className="step-mini-status">{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="workflow-card-view">
      <div className="card-view-controls">
        <div className="grid-size-controls">
          <label>Card Size:</label>
          <button 
            className={gridSize === 'small' ? 'active' : ''}
            onClick={() => setGridSize('small')}
          >
            Small
          </button>
          <button 
            className={gridSize === 'medium' ? 'active' : ''}
            onClick={() => setGridSize('medium')}
          >
            Medium
          </button>
          <button 
            className={gridSize === 'large' ? 'active' : ''}
            onClick={() => setGridSize('large')}
          >
            Large
          </button>
        </div>

        <div className="grouping-controls">
          <label>
            <input
              type="checkbox"
              checked={groupBySessionType}
              onChange={(e) => setGroupBySessionType(e.target.checked)}
            />
            Group by Session Type
          </label>
        </div>
        
        <div className="card-count">
          {workflows.length} workflows
        </div>
      </div>
      
      {groupBySessionType ? (
        <div className="workflow-groups">
          {sortedGroups.map((groupKey, index) => {
            const groupWorkflows = groupedWorkflows[groupKey];
            return (
              <div key={groupKey} className="workflow-group-section">
                {/* Distinct header section for this workflow type */}
                <div className="workflow-type-header" style={{
                  backgroundColor: '#f8fafc',
                  borderLeft: '4px solid #3b82f6',
                  borderBottom: '2px solid #e5e7eb',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  marginTop: index > 0 ? '3rem' : '0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ 
                        margin: '0 0 0.5rem 0', 
                        fontSize: '1.5rem', 
                        fontWeight: '700',
                        color: '#1e293b',
                        textTransform: 'capitalize'
                      }}>
                        {groupKey} Workflows
                      </h2>
                      <p style={{ 
                        margin: 0, 
                        color: '#64748b',
                        fontSize: '0.875rem'
                      }}>
                        {groupWorkflows.length} workflow{groupWorkflows.length !== 1 ? 's' : ''} in progress
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '1.125rem',
                      fontWeight: '600'
                    }}>
                      {groupWorkflows.length}
                    </div>
                  </div>
                </div>
                
                {/* Workflow cards for this type */}
                <div className={`workflow-cards-grid grid-${gridSize}`} style={{
                  marginBottom: '2rem'
                }}>
                  {groupWorkflows.map(workflow => (
                    <WorkflowCard key={workflow.id} workflow={workflow} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`workflow-cards-grid grid-${gridSize}`}>
          {workflows.map(workflow => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowCardView;