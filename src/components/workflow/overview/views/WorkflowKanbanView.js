// src/components/workflow/overview/views/WorkflowKanbanView.js
import React, { useState } from 'react';
import { 
  Calendar, 
  School, 
  User,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { updateWorkflowStepProgress } from '../../../../firebase/firestore';
import { useToast } from '../../../../contexts/ToastContext';
import { 
  getWorkflowGroups, 
  getGroupProgress, 
  groupStepsByGroup 
} from '../../../../utils/workflowTemplates';

const WorkflowKanbanView = ({ workflows, sessionData, workflowTemplates }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const { showToast } = useToast();

  const workflowGroups = getWorkflowGroups();

  // Get current group for a workflow
  const getCurrentGroup = (workflow) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return null;
    
    // Find the first incomplete step and return its group
    const currentStep = template.steps.find(step => {
      const stepProgress = workflow.stepProgress[step.id];
      return !stepProgress || stepProgress.status !== 'completed';
    });
    
    return currentStep?.group || null;
  };

  // Group workflows by their current workflow group
  const getWorkflowsByGroup = (groupId) => {
    return workflows.filter(workflow => {
      const currentGroup = getCurrentGroup(workflow);
      return currentGroup === groupId;
    });
  };

  // Get completed workflows
  const completedWorkflows = workflows.filter(workflow => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return false;
    
    const allCompleted = template.steps.every(step => 
      workflow.stepProgress[step.id]?.status === 'completed'
    );
    
    return allCompleted;
  });

  // Handle drag start
  const handleDragStart = (e, workflow) => {
    setDraggedItem({ workflow });
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = async (e, toGroupId) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const { workflow } = draggedItem;
    const template = workflowTemplates[workflow.templateId];
    if (!template) return;
    
    // Find the first step in the target group that's not completed
    const targetGroupSteps = template.steps.filter(step => step.group === toGroupId);
    if (targetGroupSteps.length === 0) return;
    
    const targetStep = targetGroupSteps.find(step => {
      const stepProgress = workflow.stepProgress[step.id];
      return !stepProgress || stepProgress.status !== 'completed';
    }) || targetGroupSteps[0]; // Fallback to first step in group
    
    try {
      // Update the target step to in progress
      await updateWorkflowStepProgress(
        workflow.id,
        targetStep.id,
        {
          status: 'in_progress',
          startTime: new Date()
        }
      );
      
      // Mark previous steps as completed if moving forward
      const targetIndex = template.steps.findIndex(s => s.id === targetStep.id);
      for (let i = 0; i < targetIndex; i++) {
        const step = template.steps[i];
        if (!workflow.stepProgress[step.id] || workflow.stepProgress[step.id].status !== 'completed') {
          await updateWorkflowStepProgress(
            workflow.id,
            step.id,
            {
              status: 'completed',
              completedAt: new Date()
            }
          );
        }
      }
      
      const groupName = workflowGroups.find(g => g.id === toGroupId)?.name || toGroupId;
      showToast('Workflow Updated', `Moved to ${groupName}`, 'success');
    } catch (error) {
      showToast('Error', 'Failed to update workflow', 'error');
    }
    
    setDraggedItem(null);
  };

  // Get status icon
  const getStatusIcon = (workflow) => {
    const hasOverdue = Object.values(workflow.stepProgress).some(
      step => step.status === 'overdue'
    );
    
    if (hasOverdue) return { icon: AlertCircle, color: '#ef4444' };
    if (workflow.status === 'active') return { icon: Clock, color: '#f59e0b' };
    return { icon: CheckCircle, color: '#10b981' };
  };

  // Render workflow card
  const WorkflowCard = ({ workflow }) => {
    const session = sessionData[workflow.sessionId];
    const statusInfo = getStatusIcon(workflow);
    const StatusIcon = statusInfo.icon;
    
    return (
      <div 
        className="kanban-card"
        draggable
        onDragStart={(e) => handleDragStart(e, workflow)}
      >
        <div className="kanban-card-header">
          <h4>{session?.schoolName || 'Unknown School'}</h4>
          <StatusIcon size={16} style={{ color: statusInfo.color }} />
        </div>
        
        <div className="kanban-card-content">
          <div className="kanban-card-type">
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
          
          <div className="kanban-card-details">
            <div className="detail-item">
              <Calendar size={14} />
              {session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}
            </div>
            
            <div className="detail-item">
              <User size={14} />
              {session?.clientName || 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="kanban-card-footer">
          <div className="progress-mini">
            <div 
              className="progress-mini-fill" 
              style={{ 
                width: `${calculateProgress(workflow)}%`,
                backgroundColor: statusInfo.color 
              }}
            />
          </div>
          
          <div className="workflow-group-indicator">
            <div 
              className="group-color-dot"
              style={{ 
                backgroundColor: getCurrentGroupColor(workflow)
              }}
            />
          </div>
          
          <button className="card-menu-button">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Calculate progress
  const calculateProgress = (workflow) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return 0;
    
    const completed = template.steps.filter(step => 
      workflow.stepProgress[step.id]?.status === 'completed'
    ).length;
    
    return (completed / template.steps.length) * 100;
  };

  // Get current group color
  const getCurrentGroupColor = (workflow) => {
    const groupId = getCurrentGroup(workflow);
    const group = workflowGroups.find(g => g.id === groupId);
    return group?.color || '#6b7280';
  };

  return (
    <div className="workflow-kanban-view">
      <div className="kanban-board">
        {workflowGroups.map((group) => {
          const groupWorkflows = getWorkflowsByGroup(group.id);
          
          return (
            <div key={group.id} className="kanban-column">
              <div 
                className="kanban-column-header"
                style={{ borderTop: `3px solid ${group.color}` }}
              >
                <div className="column-header-content">
                  <div className="column-title">
                    <div 
                      className="group-color-indicator"
                      style={{ backgroundColor: group.color }}
                    />
                    <h3>{group.name}</h3>
                  </div>
                  <span className="column-count">{groupWorkflows.length}</span>
                </div>
                <p className="column-description">{group.description}</p>
              </div>
              
              <div 
                className="kanban-column-content"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, group.id)}
              >
                {groupWorkflows.map(workflow => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
                
                {groupWorkflows.length === 0 && (
                  <div className="empty-column">
                    <div 
                      className="empty-column-icon"
                      style={{ backgroundColor: group.color + '20' }}
                    >
                      <div 
                        className="empty-icon-dot"
                        style={{ backgroundColor: group.color }}
                      />
                    </div>
                    <p>Drop workflows here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Completed Column */}
        <div className="kanban-column completed-column">
          <div 
            className="kanban-column-header"
            style={{ borderTop: '3px solid #10b981' }}
          >
            <div className="column-header-content">
              <div className="column-title">
                <div 
                  className="group-color-indicator"
                  style={{ backgroundColor: '#10b981' }}
                />
                <h3>Completed</h3>
              </div>
              <span className="column-count">{completedWorkflows.length}</span>
            </div>
            <p className="column-description">All workflow steps finished</p>
          </div>
          
          <div className="kanban-column-content">
            {completedWorkflows.map(workflow => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
            
            {completedWorkflows.length === 0 && (
              <div className="empty-column">
                <div 
                  className="empty-column-icon"
                  style={{ backgroundColor: '#10b98120' }}
                >
                  <div 
                    className="empty-icon-dot"
                    style={{ backgroundColor: '#10b981' }}
                  />
                </div>
                <p>No completed workflows</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowKanbanView;