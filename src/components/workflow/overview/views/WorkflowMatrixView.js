// src/components/workflow/overview/views/WorkflowMatrixView.js
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Check, Clock } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../../firebase/config';
import { updateWorkflowStep } from '../../../../firebase/firestore';
import { useAuth } from '../../../../contexts/AuthContext';
import { readCounter } from '../../../../services/readCounter';
import './WorkflowMatrixView.css';

// Helper functions
function nowISO() {
  return new Date().toISOString();
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize micro-steps: merge template definition with workflow progress
function normalizeMicros(templateStep, stepProgress) {
  // If template step doesn't define micros, return undefined
  if (!templateStep.micros || templateStep.micros.length === 0) {
    return undefined;
  }

  // Get existing micro progress (if any)
  const existingMicros = stepProgress?.micro || [];
  const microsByKey = new Map(existingMicros.map(m => [m.key, m]));

  // Create normalized array with all template micros
  return templateStep.micros.map(templateMicro => {
    const existing = microsByKey.get(templateMicro.key);
    return {
      key: templateMicro.key,
      done: existing?.done || false
    };
  });
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

// Micro-step meter component with hover preview and inline checklist
function MicroMeter({ label, templateMicros, normalizedMicros, onToggle }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  if (!normalizedMicros || normalizedMicros.length === 0) return null;

  const total = normalizedMicros.length;
  const done = normalizedMicros.filter(m => m.done).length;
  const pct = Math.round((done / Math.max(1, total)) * 100);

  return (
    <div
      className="micro-meter-container"
      onMouseLeave={() => { setHover(false); setOpen(false); }}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          tabIndex={-1}
          title={`${done}/${total} micro-steps complete`}
          className="micro-meter-button"
          onClick={() => setOpen(v => !v)}
        >
          <div className="micro-meter-bar">
            <div className="micro-meter-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="micro-meter-text">{done}/{total}</div>
        </button>

        {/* Hover tooltip - read-only preview */}
        {hover && !open && (
          <div className="micro-meter-tooltip">
            <div className="micro-meter-tooltip-title">{label}</div>
            <ul className="micro-meter-tooltip-list">
              {normalizedMicros.map(m => {
                const templateMicro = templateMicros.find(tm => tm.key === m.key);
                return (
                  <li key={m.key} className="micro-meter-tooltip-item">
                    <span className={`micro-meter-dot ${m.done ? 'micro-meter-dot--done' : ''}`} />
                    <span>{templateMicro?.label || m.key}</span>
                  </li>
                );
              })}
            </ul>
            <div className="micro-meter-tooltip-footer">{done}/{total} complete</div>
          </div>
        )}
      </div>

      {/* Inline checklist - editable */}
      {open && (
        <div className="micro-meter-checklist">
          {normalizedMicros.map(m => {
            const templateMicro = templateMicros.find(tm => tm.key === m.key);
            return (
              <label key={m.key} className="micro-meter-checklist-item">
                <input
                  type="checkbox"
                  tabIndex={-1}
                  checked={m.done}
                  onChange={() => onToggle(m.key)}
                />
                <span>{templateMicro?.label || m.key}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const WorkflowMatrixView = ({ workflows, sessionData, workflowTemplates }) => {
  const { userProfile, organization } = useAuth();
  const [activeTab, setActiveTab] = useState(null);
  const [showDates, setShowDates] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState({}); // Local state for immediate UI feedback
  const [realtimeWorkflows, setRealtimeWorkflows] = useState(null); // Tab-scoped real-time updates

  // Debounce timers for Firebase writes (immediate UI, delayed save)
  const debounceTimersRef = useRef({});
  const listenerUnsubscribeRef = useRef(null);

  // Column width state
  const [columnWidths, setColumnWidths] = useState({
    job: 100,
    school: 150,
    progress: 120,
    taskDefault: 100
  });
  const [taskColumnWidths, setTaskColumnWidths] = useState({}); // Specific widths for each task column

  // Resize tracking state
  const [resizing, setResizing] = useState(null); // { columnKey, startX, startWidth }

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
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Tab-scoped real-time listener - only listen to workflows for active template
  // This dramatically reduces Firebase reads (10-20 workflows instead of 100+)
  useEffect(() => {
    if (!activeTab || !organization?.id) return;

    // Clean up previous listener when tab changes
    if (listenerUnsubscribeRef.current) {
      console.log('Cleaning up previous tab listener');
      listenerUnsubscribeRef.current();
      listenerUnsubscribeRef.current = null;
    }

    console.log('Setting up tab-scoped listener for template:', activeTab);

    // Query only workflows for the active template
    const tabWorkflowsQuery = query(
      collection(firestore, 'workflows'),
      where('organizationID', '==', organization.id),
      where('templateId', '==', activeTab),
      where('status', '==', 'active')
    );

    // Set up listener with incremental updates
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      tabWorkflowsQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          console.log('Snapshot from cache, ignoring');
          return;
        }

        // CRITICAL: Use docChanges() to process only changed documents
        // This is the key to reducing Firebase reads from 243 to 1 per update
        const changes = snapshot.docChanges();

        if (isInitialLoad) {
          // Initial load: Build full array from snapshot
          const workflowCount = snapshot.docs.length;
          console.log(`[Initial] Tab listener loaded ${workflowCount} workflows for template ${activeTab}`);

          readCounter.recordRead('onSnapshot-initial', 'workflows', 'WorkflowMatrixView', workflowCount);

          const tabWorkflows = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          setRealtimeWorkflows(tabWorkflows);
          isInitialLoad = false;

        } else if (changes.length > 0) {
          // Subsequent updates: Process only changed documents
          console.log(`[Update] Processing ${changes.length} changed workflows for template ${activeTab}`);

          readCounter.recordRead('onSnapshot-update', 'workflows', 'WorkflowMatrixView', changes.length);

          // Incrementally update state with only changed documents
          setRealtimeWorkflows(prev => {
            if (!prev) return prev; // Safety check

            let updated = [...prev];

            changes.forEach(change => {
              const workflow = { id: change.doc.id, ...change.doc.data() };

              if (change.type === 'added') {
                updated.push(workflow);
              } else if (change.type === 'modified') {
                const index = updated.findIndex(w => w.id === workflow.id);
                if (index !== -1) {
                  updated[index] = workflow;
                }
              } else if (change.type === 'removed') {
                updated = updated.filter(w => w.id !== workflow.id);
              }
            });

            return updated;
          });
        }
      },
      (error) => {
        console.error('Tab listener error:', error);
      }
    );

    listenerUnsubscribeRef.current = unsubscribe;

    // Cleanup on unmount or tab change
    return () => {
      if (listenerUnsubscribeRef.current) {
        console.log('Tab change: cleaning up listener');
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null;
      }
    };
  }, [activeTab, organization?.id]);

  // Get active template
  const activeTemplate = useMemo(() => {
    return tabs.find(tab => tab.id === activeTab);
  }, [tabs, activeTab]);

  // Filter workflows by active template
  // Use real-time workflows when available (tab-scoped listener), otherwise use props
  const filteredWorkflows = useMemo(() => {
    if (!activeTab) return [];

    // Prefer real-time workflows from tab-scoped listener (fresher data)
    const sourceWorkflows = realtimeWorkflows || workflows;

    return sourceWorkflows.filter(w => w.templateId === activeTab);
  }, [workflows, activeTab, realtimeWorkflows]);

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

  // Handle cell input change (initials) with debouncing
  const handleInitialsChange = useCallback((workflowId, stepId, value, normalizedMicros) => {
    const trimmed = value.trim().toUpperCase();

    // Validate initials (1-4 characters, letters only - allow partial input)
    if (trimmed && !/^[A-Z]{1,4}$/.test(trimmed)) {
      console.log('Invalid initials format, rejecting:', trimmed);
      return; // Invalid format - don't update
    }

    const cellKey = `${workflowId}-${stepId}`;

    console.log('Initials change:', { cellKey, value, trimmed });

    // IMMEDIATE: Update optimistic state for instant UI feedback
    setOptimisticUpdates(prev => ({
      ...prev,
      [cellKey]: {
        initials: trimmed,
        micro: normalizedMicros
      }
    }));

    // DEBOUNCED: Save to Firebase after 500ms of no typing
    if (debounceTimersRef.current[cellKey]) {
      clearTimeout(debounceTimersRef.current[cellKey]);
    }

    debounceTimersRef.current[cellKey] = setTimeout(async () => {
      console.log('Saving initials to Firebase:', { cellKey, trimmed });

      try {
        const updateData = {};

        if (trimmed) {
          // Mark as completed with initials
          updateData.initials = trimmed;
          updateData.status = 'completed';
          updateData.completedBy = userProfile.id;
          updateData.completedDate = todayYMD();
        } else {
          // Clear completion
          updateData.initials = '';
          updateData.status = 'pending';
          updateData.completedBy = null;
          updateData.completedDate = null;
        }

        // Include normalized micros if they exist (syncs template changes)
        if (normalizedMicros !== undefined) {
          updateData.micro = normalizedMicros;
        }

        await updateWorkflowStep(workflowId, stepId, updateData);

        console.log('Firebase save complete:', cellKey);
        readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);

        // Don't clear optimistic update - let the listener update confirm the change
        // This prevents flickering if listener is delayed

      } catch (error) {
        console.error('Error updating step:', error);
        // Revert optimistic update on error
        setOptimisticUpdates(prev => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      }
    }, 500); // 500ms debounce
  }, [userProfile?.id]);

  // Handle date change (no debouncing needed - single action)
  const handleDateChange = useCallback(async (workflowId, stepId, currentInitials, value, normalizedMicros) => {
    const cellKey = `${workflowId}-${stepId}`;

    console.log('Date change:', { cellKey, value });

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

      // Include normalized micros if they exist (syncs template changes)
      if (normalizedMicros !== undefined) {
        updateData.micro = normalizedMicros;
      }

      await updateWorkflowStep(workflowId, stepId, updateData);

      console.log('Date save complete:', cellKey);
      readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);
    } catch (error) {
      console.error('Error updating date:', error);
    }
  }, [userProfile?.id]);

  // Handle micro-step toggle (optimistic update, immediate save - single action)
  const handleMicroToggle = useCallback(async (workflowId, stepId, microKey, normalizedMicros, currentInitials) => {
    const cellKey = `${workflowId}-${stepId}`;

    // Toggle the specific micro's done state
    const updatedMicros = normalizedMicros.map(m =>
      m.key === microKey ? { ...m, done: !m.done } : m
    );

    console.log('Micro toggle:', { cellKey, microKey, updatedMicros });

    // IMMEDIATE: Optimistic update - Show change immediately in UI
    setOptimisticUpdates(prev => ({
      ...prev,
      [cellKey]: {
        initials: currentInitials,
        micro: updatedMicros
      }
    }));

    try {
      // Check if all micros are now done
      const allMicrosDone = updatedMicros.every(m => m.done);

      // Task is done if: (initials present) OR (all micros checked)
      const isDone = !!currentInitials || allMicrosDone;

      const updateData = {
        micro: updatedMicros,
        status: isDone ? 'completed' : 'pending'
      };

      // If becoming done for the first time, set completion metadata
      if (isDone && !currentInitials) {
        updateData.completedDate = todayYMD();
        updateData.completedBy = userProfile.id;
        // Set placeholder initials if all micros done but no initials entered
        if (allMicrosDone) {
          updateData.initials = '—';
        }
      }

      await updateWorkflowStep(workflowId, stepId, updateData);

      console.log('Micro toggle save complete:', cellKey);
      readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);

      // Don't clear optimistic update - let listener confirm the change

    } catch (error) {
      console.error('Error toggling micro-step:', error);
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const next = { ...prev };
        delete next[cellKey];
        return next;
      });
    }
  }, [userProfile?.id]);

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

  // Column resize handlers
  const handleResizeStart = (columnKey, startX, startWidth) => {
    setResizing({ columnKey, startX, startWidth });
  };

  const handleResizeMove = React.useCallback((e) => {
    if (!resizing) return;

    const delta = e.clientX - resizing.startX;
    const newWidth = Math.max(60, resizing.startWidth + delta); // Minimum 60px

    const { columnKey } = resizing;

    if (columnKey.startsWith('task-')) {
      // Task column
      setTaskColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    } else {
      // Metadata column
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    }
  }, [resizing]);

  const handleResizeEnd = React.useCallback(() => {
    setResizing(null);
  }, []);

  // Add/remove mouse event listeners for resize
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

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
              <th
                className="workflow-matrix__header-cell workflow-matrix__header-cell--job"
                style={{ width: `${columnWidths.job}px` }}
              >
                <div className="workflow-matrix__header-content">
                  Job
                  <div
                    className="workflow-matrix__resize-handle"
                    onMouseDown={(e) => handleResizeStart('job', e.clientX, columnWidths.job)}
                  />
                </div>
              </th>
              <th
                className="workflow-matrix__header-cell workflow-matrix__header-cell--school"
                style={{ width: `${columnWidths.school}px` }}
              >
                <div className="workflow-matrix__header-content">
                  School
                  <div
                    className="workflow-matrix__resize-handle"
                    onMouseDown={(e) => handleResizeStart('school', e.clientX, columnWidths.school)}
                  />
                </div>
              </th>
              <th
                className="workflow-matrix__header-cell workflow-matrix__header-cell--progress"
                style={{ width: `${columnWidths.progress}px` }}
              >
                <div className="workflow-matrix__header-content">
                  Progress
                  <div
                    className="workflow-matrix__resize-handle"
                    onMouseDown={(e) => handleResizeStart('progress', e.clientX, columnWidths.progress)}
                  />
                </div>
              </th>
              {activeTemplate.steps.map(step => {
                const columnKey = `task-${step.id}`;
                const width = taskColumnWidths[columnKey] || columnWidths.taskDefault;
                return (
                  <th
                    key={step.id}
                    className="workflow-matrix__header-cell workflow-matrix__header-cell--task"
                    title={step.title}
                    style={{ width: `${width}px` }}
                  >
                    <div className="workflow-matrix__header-content">
                      {step.title}
                      <div
                        className="workflow-matrix__resize-handle"
                        onMouseDown={(e) => handleResizeStart(columnKey, e.clientX, width)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredWorkflows.map((workflow, rowIndex) => {
              const info = getWorkflowInfo(workflow);
              const lastCompletedIdx = getLastCompletedIndex(workflow);
              const progress = calculateProgress(workflow);

              return (
                <tr key={workflow.id} className="workflow-matrix__row">
                  <td
                    className="workflow-matrix__cell workflow-matrix__cell--job"
                    style={{ width: `${columnWidths.job}px` }}
                  >
                    {info.jobId.substring(0, 8)}
                  </td>
                  <td
                    className="workflow-matrix__cell workflow-matrix__cell--school"
                    style={{ width: `${columnWidths.school}px` }}
                  >
                    {info.school}
                  </td>
                  <td
                    className="workflow-matrix__cell workflow-matrix__cell--progress"
                    style={{ width: `${columnWidths.progress}px` }}
                  >
                    <ProgressBar pct={progress} />
                  </td>
                  {activeTemplate.steps.map((step, colIndex) => {
                    const columnKey = `task-${step.id}`;
                    const width = taskColumnWidths[columnKey] || columnWidths.taskDefault;
                    const stepProgress = workflow.stepProgress?.[step.id] || {};
                    const isCompleted = colIndex <= lastCompletedIdx;
                    const isCurrent = colIndex === lastCompletedIdx + 1 && stepProgress.status !== 'completed';
                    const isDone = stepProgress.status === 'completed';
                    const cellKey = `${workflow.id}-${step.id}`;

                    // Normalize micros: sync template definition with workflow progress
                    const normalizedMicros = normalizeMicros(step, stepProgress);

                    // Use optimistic value if available, otherwise use actual data
                    const optimistic = optimisticUpdates[cellKey];
                    const displayInitials = optimistic?.initials ?? stepProgress.initials ?? '';
                    const displayMicros = optimistic?.micro ?? normalizedMicros;

                    return (
                      <td
                        key={step.id}
                        className={`workflow-matrix__cell workflow-matrix__cell--task ${
                          isCompleted ? 'workflow-matrix__cell--completed' : ''
                        } ${isCurrent ? 'workflow-matrix__cell--current' : ''}`}
                        style={{ width: `${width}px` }}
                      >
                        <div className="workflow-matrix__cell-content">
                          <div className="workflow-matrix__cell-row">
                            <input
                              type="text"
                              className="workflow-matrix__initials-input"
                              placeholder="Init"
                              maxLength={4}
                              value={displayInitials}
                              onChange={(e) => handleInitialsChange(workflow.id, step.id, e.target.value, normalizedMicros)}
                              aria-label={`${step.title} — ${info.jobId}`}
                            />
                            <CellBadge done={isDone} />
                          </div>
                          {displayMicros && displayMicros.length > 0 && (
                            <MicroMeter
                              label={step.title}
                              templateMicros={step.micros}
                              normalizedMicros={displayMicros}
                              onToggle={(microKey) => handleMicroToggle(workflow.id, step.id, microKey, displayMicros, displayInitials)}
                            />
                          )}
                          {showDates && (
                            <input
                              type="date"
                              className="workflow-matrix__date-input"
                              value={stepProgress.completedDate || ''}
                              onChange={(e) => handleDateChange(workflow.id, step.id, displayInitials, e.target.value, normalizedMicros)}
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
