// src/components/workflow/WorkflowDashboard.js
import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Calendar,
  Filter,
  Plus,
  Eye
} from 'lucide-react';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useAuth } from '../../contexts/AuthContext';
import WorkflowProgressBar from './WorkflowProgressBar';
import WorkflowStepModal from './WorkflowStepModal';
import WorkflowTemplateGallery from './WorkflowTemplateGallery';
import WorkflowTemplateBuilder from './WorkflowTemplateBuilder';

const WorkflowDashboard = () => {
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const {
    userWorkflows,
    organizationWorkflows,
    sessionData,
    getWorkflowWithTemplate,
    getUserPendingTasks,
    getWorkflowStats,
    refreshWorkflows,
    loading
  } = useWorkflow();
  
  const { userProfile, organization } = useAuth();

  const stats = getWorkflowStats();
  const pendingTasks = getUserPendingTasks();
  
  // Filter workflows based on status
  const filteredWorkflows = userWorkflows.filter(workflow => {
    if (statusFilter === 'all') return true;
    return workflow.status === statusFilter;
  });

  const handleStepClick = (workflowId, stepId) => {
    const workflowData = getWorkflowWithTemplate(workflowId);
    if (workflowData) {
      setSelectedStep({
        workflow: workflowData.workflow,
        template: workflowData.template,
        stepId
      });
      setShowStepModal(true);
    }
  };

  const handleStepUpdated = () => {
    refreshWorkflows();
    setShowStepModal(false);
    setSelectedStep(null);
  };

  const StatCard = ({ icon, title, value, color = '#3b82f6', subtitle = null }) => (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          backgroundColor: color + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#111827' }}>
            {value}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const TaskCard = ({ task, onClick }) => (
    <div 
      style={{
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onClick={() => onClick(task.workflowId, task.stepId)}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: task.stepProgress.status === 'overdue' ? '#ef4444' : 
                          task.stepProgress.status === 'in_progress' ? '#f59e0b' : '#6b7280'
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
            {task.step.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {task.workflow.templateName} • {task.step.estimatedHours || 0}h estimated
          </div>
        </div>
        <div style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '12px',
          fontSize: '0.625rem',
          fontWeight: '500',
          textTransform: 'uppercase',
          backgroundColor: task.stepProgress.status === 'overdue' ? '#fee2e2' : 
                          task.stepProgress.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
          color: task.stepProgress.status === 'overdue' ? '#991b1b' : 
                 task.stepProgress.status === 'in_progress' ? '#92400e' : '#374151'
        }}>
          {task.stepProgress.status.replace('_', ' ')}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        color: '#6b7280'
      }}>
        Loading workflows...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.875rem', fontWeight: '700' }}>
            Workflow Dashboard
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Track your tasks and monitor workflow progress
          </p>
        </div>
        
        {userProfile?.role === 'admin' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowTemplateBuilder(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus size={16} />
              Create Custom
            </button>
            <button
              onClick={() => setShowTemplateGallery(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Eye size={16} />
              Browse Templates
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatCard
          icon={<Clock size={24} />}
          title="Pending Tasks"
          value={stats.pendingTasks}
          color="#f59e0b"
        />
        <StatCard
          icon={<AlertCircle size={24} />}
          title="Overdue Tasks"
          value={stats.overdueTasks}
          color="#ef4444"
        />
        <StatCard
          icon={<CheckCircle size={24} />}
          title="Completed This Week"
          value={stats.completedThisWeek}
          color="#10b981"
        />
        <StatCard
          icon={<Users size={24} />}
          title="Active Workflows"
          value={stats.totalActiveWorkflows}
          color="#3b82f6"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Pending Tasks */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
              Your Tasks ({pendingTasks.length})
            </h2>
          </div>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.75rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {pendingTasks.length > 0 ? (
              pendingTasks.map(task => (
                <TaskCard
                  key={`${task.workflowId}-${task.stepId}`}
                  task={task}
                  onClick={handleStepClick}
                />
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <CheckCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  No pending tasks. Great job!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active Workflows */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
              Active Workflows ({filteredWorkflows.length})
            </h2>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.75rem'
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {filteredWorkflows.length > 0 ? (
              filteredWorkflows.map(workflow => {
                const workflowData = getWorkflowWithTemplate(workflow.id);
                return workflowData ? (
                  <WorkflowProgressBar
                    key={workflow.id}
                    workflow={workflowData.workflow}
                    template={workflowData.template}
                    sessionData={sessionData[workflow.sessionId]}
                    size="medium"
                    onClick={() => {
                      // Find current step and open it
                      const currentStep = workflowData.template.steps.find(step => 
                        workflowData.workflow.stepProgress[step.id]?.status !== 'completed'
                      );
                      if (currentStep) {
                        handleStepClick(workflow.id, currentStep.id);
                      }
                    }}
                  />
                ) : null;
              })
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  No active workflows found.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStepModal && selectedStep && (
        <WorkflowStepModal
          isOpen={showStepModal}
          onClose={() => setShowStepModal(false)}
          workflow={selectedStep.workflow}
          template={selectedStep.template}
          stepId={selectedStep.stepId}
          currentUser={userProfile}
          organizationID={organization?.id}
          onStepUpdated={handleStepUpdated}
        />
      )}

      {showTemplateGallery && (
        <WorkflowTemplateGallery
          isOpen={showTemplateGallery}
          onClose={() => setShowTemplateGallery(false)}
          organizationID={organization?.id}
          onTemplateCreated={() => {
            setShowTemplateGallery(false);
            refreshWorkflows();
          }}
        />
      )}

      {showTemplateBuilder && (
        <WorkflowTemplateBuilder
          isOpen={showTemplateBuilder}
          onClose={() => setShowTemplateBuilder(false)}
          organizationID={organization?.id}
          onTemplateCreated={() => {
            setShowTemplateBuilder(false);
            refreshWorkflows();
          }}
        />
      )}
    </div>
  );
};

export default WorkflowDashboard;