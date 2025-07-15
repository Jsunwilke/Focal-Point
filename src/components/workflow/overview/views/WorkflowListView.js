// src/components/workflow/overview/views/WorkflowListView.js
import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown,
  Calendar,
  User,
  School,
  CheckCircle,
  Clock,
  AlertCircle,
  Circle,
  Edit2,
  Eye
} from 'lucide-react';
import WorkflowProgressBar from '../../WorkflowProgressBar';
import WorkflowStepModal from '../../WorkflowStepModal';
import { useAuth } from '../../../../contexts/AuthContext';

const WorkflowListView = ({ workflows, sessionData, workflowTemplates, getWorkflowWithTemplate }) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set());
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [groupBy, setGroupBy] = useState('sessionType'); // status, school, photographer, type, sessionType
  
  const { userProfile, organization } = useAuth();

  // Group workflows
  const groupedWorkflows = workflows.reduce((groups, workflow) => {
    let groupKey;
    
    switch (groupBy) {
      case 'status':
        groupKey = workflow.status;
        break;
      case 'school':
        groupKey = sessionData[workflow.sessionId]?.schoolName || 'Unknown School';
        break;
      case 'photographer':
        // Find photographer from step assignments
        const photographers = new Set();
        Object.values(workflow.stepProgress).forEach(step => {
          if (step.assignedTo) photographers.add(step.assignedTo);
        });
        groupKey = photographers.size > 0 ? Array.from(photographers).join(', ') : 'Unassigned';
        break;
      case 'type':
        groupKey = workflow.templateName;
        break;
      case 'sessionType':
        groupKey = workflow.sessionType || workflow.templateName || 'Unknown Type';
        break;
      default:
        groupKey = 'Other';
    }
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(workflow);
    return groups;
  }, {});

  // Sort groups
  const sortedGroups = Object.keys(groupedWorkflows).sort((a, b) => {
    if (groupBy === 'status') {
      const statusOrder = ['active', 'on_hold', 'completed', 'cancelled'];
      return statusOrder.indexOf(a) - statusOrder.indexOf(b);
    }
    if (groupBy === 'sessionType') {
      // Put 'Unknown Type' at the end
      if (a === 'Unknown Type') return 1;
      if (b === 'Unknown Type') return -1;
    }
    return a.localeCompare(b);
  });

  // Toggle group expansion
  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  // Toggle workflow expansion
  const toggleWorkflow = (workflowId) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedWorkflows(newExpanded);
  };

  // Handle step click
  const handleStepClick = (workflow, stepId) => {
    const workflowData = getWorkflowWithTemplate(workflow.id);
    if (workflowData) {
      setSelectedStep({
        workflow: workflowData.workflow,
        template: workflowData.template,
        stepId
      });
      setShowStepModal(true);
    }
  };

  // Get step icon
  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: '#10b981' };
      case 'in_progress':
        return { icon: Clock, color: '#f59e0b' };
      case 'overdue':
        return { icon: AlertCircle, color: '#ef4444' };
      default:
        return { icon: Circle, color: '#9ca3af' };
    }
  };

  // Get group icon
  const getGroupIcon = (groupKey) => {
    if (groupBy === 'status') {
      switch (groupKey) {
        case 'active':
          return { icon: Clock, color: '#3b82f6' };
        case 'completed':
          return { icon: CheckCircle, color: '#10b981' };
        case 'on_hold':
          return { icon: AlertCircle, color: '#f59e0b' };
        case 'cancelled':
          return { icon: Circle, color: '#6b7280' };
      }
    }
    return { icon: ChevronRight, color: '#6b7280' };
  };

  return (
    <div className="workflow-list-view">
      {/* Controls */}
      <div className="list-controls">
        <div className="group-by-control">
          <label>Group by:</label>
          <select 
            value={groupBy} 
            onChange={(e) => setGroupBy(e.target.value)}
            className="group-select"
          >
            <option value="sessionType">Session Type</option>
            <option value="status">Status</option>
            <option value="school">School</option>
            <option value="photographer">Photographer</option>
            <option value="type">Workflow Template</option>
          </select>
        </div>
        
        <div className="list-actions">
          <button 
            onClick={() => setExpandedGroups(new Set(sortedGroups))}
            className="expand-all-button"
          >
            Expand All
          </button>
          <button 
            onClick={() => setExpandedGroups(new Set())}
            className="collapse-all-button"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* List Content */}
      <div className="workflow-list">
        {sortedGroups.map(groupKey => {
          const groupWorkflows = groupedWorkflows[groupKey];
          const isExpanded = expandedGroups.has(groupKey);
          const groupIcon = getGroupIcon(groupKey);
          const GroupIcon = groupIcon.icon;
          
          return (
            <div key={groupKey} className="workflow-group">
              {/* Enhanced header section for this workflow type */}
              <div 
                className="group-header workflow-type-group-header"
                onClick={() => toggleGroup(groupKey)}
                style={{
                  backgroundColor: '#f8fafc',
                  borderLeft: '4px solid #3b82f6',
                  borderBottom: '2px solid #e5e7eb',
                  padding: '1.5rem',
                  marginBottom: '1rem',
                  marginTop: sortedGroups.indexOf(groupKey) > 0 ? '2.5rem' : '0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="group-toggle" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: 'white',
                      transition: 'all 0.2s'
                    }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    
                    <GroupIcon size={20} style={{ color: groupIcon.color }} />
                    
                    <div>
                      <h3 className="group-title" style={{
                        margin: '0 0 0.25rem 0',
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: '#1e293b',
                        textTransform: 'capitalize'
                      }}>
                        {groupKey.charAt(0).toUpperCase() + groupKey.slice(1).replace('_', ' ')} Workflows
                      </h3>
                      <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: '#64748b'
                      }}>
                        {groupWorkflows.length} workflow{groupWorkflows.length !== 1 ? 's' : ''} in this category
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>
                    {groupWorkflows.length}
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="group-content">
                  {groupWorkflows.map(workflow => {
                    const session = sessionData[workflow.sessionId];
                    const workflowData = getWorkflowWithTemplate(workflow.id);
                    const isWorkflowExpanded = expandedWorkflows.has(workflow.id);
                    
                    return (
                      <div key={workflow.id} className="workflow-item">
                        <div className="workflow-header">
                          <button 
                            className="workflow-toggle"
                            onClick={() => toggleWorkflow(workflow.id)}
                          >
                            {isWorkflowExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          
                          <div className="workflow-info">
                            <h4>{session?.schoolName || 'Unknown School'}</h4>
                            <div className="workflow-meta">
                              <span className="meta-item">
                                <Calendar size={12} />
                                {session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}
                              </span>
                              <span className="meta-item">
                                <User size={12} />
                                {session?.clientName || 'N/A'}
                              </span>
                              <span className="meta-item type-badge">
                                {workflow.templateName}
                                {workflow.sessionType && (
                                  <span style={{
                                    marginLeft: '0.5rem',
                                    padding: '0.125rem 0.375rem',
                                    backgroundColor: '#e5e7eb',
                                    color: '#374151',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.7rem',
                                    textTransform: 'capitalize'
                                  }}>
                                    {workflow.sessionType}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          <div className="workflow-progress">
                            <WorkflowProgressBar
                              workflow={workflow}
                              template={workflowData?.template}
                              sessionData={session}
                              size="small"
                              showSteps={false}
                            />
                          </div>
                        </div>
                        
                        {isWorkflowExpanded && workflowData && (
                          <div className="workflow-steps">
                            {workflowData.template.steps.map(step => {
                              const stepProgress = workflow.stepProgress[step.id];
                              const status = stepProgress?.status || 'pending';
                              const statusIcon = getStepIcon(status);
                              const StatusIcon = statusIcon.icon;
                              
                              return (
                                <div 
                                  key={step.id} 
                                  className={`step-item ${status}`}
                                  onClick={() => handleStepClick(workflow, step.id)}
                                >
                                  <StatusIcon size={16} style={{ color: statusIcon.color }} />
                                  
                                  <div className="step-content">
                                    <div className="step-title">{step.title}</div>
                                    {stepProgress?.assignedTo && (
                                      <div className="step-assigned">
                                        Assigned to: {stepProgress.assignedTo}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="step-actions">
                                    {step.estimatedHours && (
                                      <span className="step-hours">{step.estimatedHours}h</span>
                                    )}
                                    <button className="step-action-button">
                                      <Edit2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Modal */}
      {showStepModal && selectedStep && (
        <WorkflowStepModal
          isOpen={showStepModal}
          onClose={() => {
            setShowStepModal(false);
            setSelectedStep(null);
          }}
          workflow={selectedStep.workflow}
          template={selectedStep.template}
          stepId={selectedStep.stepId}
          currentUser={userProfile}
          organizationID={organization?.id}
          onStepUpdated={() => {
            // Refresh handled by context
            setShowStepModal(false);
            setSelectedStep(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkflowListView;