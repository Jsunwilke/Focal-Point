// src/components/workflow/overview/views/WorkflowMatrixView.js
import React, { useState, useMemo } from 'react';
import { Check, Clock } from 'lucide-react';
import { updateWorkflowStep } from '../../../../firebase/firestore';
import { useAuth } from '../../../../contexts/AuthContext';
import './WorkflowMatrixView.css';

// Helper functions
function nowISO() {
  return new Date().toISOString();
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Cell status badge component
function CellBadge({ done }) {
  return (
    <span className={`matrix-cell-badge ${done ? 'matrix-cell-badge--done' : 'matrix-cell-badge--pending'}`}>
      {done ? <Check className="matrix-cell-badge__icon" /> : <Clock className="matrix-cell-badge__icon" />}
      {done ? 'Done' : 'Pending'}
    </span>
  );
}

// Progress bar component
function ProgressBar({ pct }) {
  return (
    <div className="matrix-progress-bar">
      <div className="matrix-progress-bar__fill" style={{ width: `${pct}%` }}></div>
    </div>
  );
}

const WorkflowMatrixView = ({ workflows, sessionData, workflowTemplates }) => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(null);
  const [showDates, setShowDates] = useState(false);
  const [editingCells, setEditingCells] = useState({}); // Track which cells are being edited

  // Get unique templates from workflows and create tabs
  const tabs = useMemo(() => {
    const templateMap = new Map();

    workflows.forEach(workflow => {
      const template = workflowTemplates[workflow.templateId];
      if (template && !templateMap.has(workflow.templateId)) {
        templateMap.set(workflow.templateId, {
          id: workflow.templateId,
          name: template.name,
          steps: template.steps || []
        });
      }
    });

    return Array.from(templateMap.values());
  }, [workflows, workflowTemplates]);

  // Set initial active tab
  React.useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Get active template
  const activeTemplate = useMemo(() => {
    return tabs.find(tab => tab.id === activeTab);
  }, [tabs, activeTab]);

  // Filter workflows by active template
  const filteredWorkflows = useMemo(() => {
    if (!activeTab) return [];
    return workflows.filter(w => w.templateId === activeTab);
  }, [workflows, activeTab]);

  // Calculate progress for a workflow
  const calculateProgress = (workflow) => {
    if (!activeTemplate) return 0;
    const totalSteps = activeTemplate.steps.length;
    if (totalSteps === 0) return 0;

    const completedSteps = activeTemplate.steps.reduce((count, step) => {
      const progress = workflow.stepProgress?.[step.id];
      return count + (progress?.status === 'completed' ? 1 : 0);
    }, 0);

    return Math.round((completedSteps / totalSteps) * 100);
  };

  // Get last completed step index
  const getLastCompletedIndex = (workflow) => {
    if (!activeTemplate) return -1;
    let lastIndex = -1;

    activeTemplate.steps.forEach((step, index) => {
      const progress = workflow.stepProgress?.[step.id];
      if (progress?.status === 'completed') {
        lastIndex = index;
      }
    });

    return lastIndex;
  };

  // Handle cell input change (initials)
  const handleInitialsChange = async (workflowId, stepId, value) => {
    const trimmed = value.trim().toUpperCase();

    // Validate initials (2-4 characters, letters only)
    if (trimmed && !/^[A-Z]{2,4}$/.test(trimmed)) {
      return; // Invalid format - don't update
    }

    // Create optimistic update key
    const cellKey = `${workflowId}-${stepId}`;
    setEditingCells(prev => ({ ...prev, [cellKey]: true }));

    try {
      if (trimmed) {
        // Mark as completed with initials
        await updateWorkflowStep(workflowId, stepId, {
          initials: trimmed,
          status: 'completed',
          completedBy: userProfile.id,
          completedDate: todayYMD()
        });
      } else {
        // Clear completion
        await updateWorkflowStep(workflowId, stepId, {
          initials: '',
          status: 'pending',
          completedBy: null,
          completedDate: null
        });
      }
    } catch (error) {
      console.error('Error updating step:', error);
    } finally {
      setEditingCells(prev => {
        const next = { ...prev };
        delete next[cellKey];
        return next;
      });
    }
  };

  // Handle date change
  const handleDateChange = async (workflowId, stepId, currentInitials, value) => {
    const cellKey = `${workflowId}-${stepId}`;
    setEditingCells(prev => ({ ...prev, [cellKey]: true }));

    try {
      const updateData = {
        completedDate: value || null
      };

      // If date is set but no initials, mark as done with placeholder
      if (value && !currentInitials) {
        updateData.initials = '—';
        updateData.status = 'completed';
        updateData.completedBy = userProfile.id;
      }

      await updateWorkflowStep(workflowId, stepId, updateData);
    } catch (error) {
      console.error('Error updating date:', error);
    } finally {
      setEditingCells(prev => {
        const next = { ...prev };
        delete next[cellKey];
        return next;
      });
    }
  };

  // Get session info for workflow
  const getWorkflowInfo = (workflow) => {
    if (workflow.workflowType === 'tracking') {
      return {
        jobId: workflow.id,
        school: workflow.schoolName || 'Unknown',
        date: workflow.trackingStartDate || ''
      };
    } else {
      const session = sessionData[workflow.sessionId];
      return {
        jobId: workflow.id,
        school: session?.schoolName || 'Unknown',
        date: session?.date || ''
      };
    }
  };

  if (!activeTemplate) {
    return (
      <div className="workflow-matrix-empty">
        <p>No workflow templates found. Create workflows to see them here.</p>
      </div>
    );
  }

  return (
    <div className="workflow-matrix">
      {/* Tabs */}
      <div className="workflow-matrix__tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`workflow-matrix__tab ${activeTab === tab.id ? 'workflow-matrix__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="workflow-matrix__controls">
        <label className="workflow-matrix__checkbox">
          <input
            type="checkbox"
            checked={showDates}
            onChange={(e) => setShowDates(e.target.checked)}
          />
          Show editable dates
        </label>
      </div>

      {/* Grid */}
      <div className="workflow-matrix__grid-container">
        <table className="workflow-matrix__grid">
          <thead>
            <tr className="workflow-matrix__header-row">
              <th className="workflow-matrix__header-cell workflow-matrix__header-cell--job">Job</th>
              <th className="workflow-matrix__header-cell workflow-matrix__header-cell--school">School</th>
              <th className="workflow-matrix__header-cell workflow-matrix__header-cell--progress">Progress</th>
              {activeTemplate.steps.map(step => (
                <th
                  key={step.id}
                  className="workflow-matrix__header-cell workflow-matrix__header-cell--task"
                  title={step.title}
                >
                  {step.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredWorkflows.map((workflow, rowIndex) => {
              const info = getWorkflowInfo(workflow);
              const lastCompletedIdx = getLastCompletedIndex(workflow);
              const progress = calculateProgress(workflow);

              return (
                <tr key={workflow.id} className="workflow-matrix__row">
                  <td className="workflow-matrix__cell workflow-matrix__cell--job">
                    {info.jobId.substring(0, 8)}
                  </td>
                  <td className="workflow-matrix__cell workflow-matrix__cell--school">
                    {info.school}
                  </td>
                  <td className="workflow-matrix__cell workflow-matrix__cell--progress">
                    <ProgressBar pct={progress} />
                  </td>
                  {activeTemplate.steps.map((step, colIndex) => {
                    const stepProgress = workflow.stepProgress?.[step.id] || {};
                    const isCompleted = colIndex <= lastCompletedIdx;
                    const isCurrent = colIndex === lastCompletedIdx + 1 && stepProgress.status !== 'completed';
                    const isDone = stepProgress.status === 'completed';
                    const cellKey = `${workflow.id}-${step.id}`;
                    const isEditing = editingCells[cellKey];

                    return (
                      <td
                        key={step.id}
                        className={`workflow-matrix__cell workflow-matrix__cell--task ${
                          isCompleted ? 'workflow-matrix__cell--completed' : ''
                        } ${isCurrent ? 'workflow-matrix__cell--current' : ''}`}
                      >
                        <div className="workflow-matrix__cell-content">
                          <div className="workflow-matrix__cell-row">
                            <input
                              type="text"
                              className="workflow-matrix__initials-input"
                              placeholder="Init"
                              maxLength={4}
                              value={stepProgress.initials || ''}
                              onChange={(e) => handleInitialsChange(workflow.id, step.id, e.target.value)}
                              disabled={isEditing}
                              aria-label={`${step.title} — ${info.jobId}`}
                            />
                            <CellBadge done={isDone} />
                          </div>
                          {showDates && (
                            <input
                              type="date"
                              className="workflow-matrix__date-input"
                              value={stepProgress.completedDate || ''}
                              onChange={(e) => handleDateChange(workflow.id, step.id, stepProgress.initials, e.target.value)}
                              disabled={isEditing}
                              tabIndex={-1}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="workflow-matrix__empty-state">
          <p>No workflows found for {activeTemplate.name}</p>
        </div>
      )}
    </div>
  );
};

export default WorkflowMatrixView;
