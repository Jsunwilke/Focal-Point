// src/components/workflow/overview/views/WorkflowMatrixView.js
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Check, Clock, EyeOff, Eye, PlayCircle, Lock, CheckCircle2, AlertCircle, Trash2, RefreshCw, Inbox, FileQuestion } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import DataGrid from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { firestore } from '../../../../firebase/config';
import { updateWorkflowStep, getSchools } from '../../../../firebase/firestore';
import { getWorkflowStepTasksBatch } from '../../../../firebase/tasks';
import { useAuth } from '../../../../contexts/AuthContext';
import { useWorkflow } from '../../../../contexts/WorkflowContext';
import { useTask } from '../../../../contexts/TaskContext';
import { readCounter } from '../../../../services/readCounter';
import workflowCacheService from '../../../../services/workflowCacheService';
import { secureLogger } from '../../../../services/secureLogger';
import { getStepGroupColor } from '../../../../utils/workflowTemplates';
import ShootDetailsModal from '../../ShootDetailsModal';
import TaskButton from '../../TaskButton';
import VideoPlayerModal from '../../VideoPlayerModal';
import './WorkflowMatrixView.css';
import './WorkflowMatrixView-rdg.css';

// Helper functions
function nowISO() {
  return new Date().toISOString();
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateToMMDDYYYY(dateString) {
  if (!dateString) return '';
  // Convert YYYY-MM-DD to MM-DD-YYYY
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[1]}-${parts[2]}-${parts[0]}`;
  }
  return dateString;
}

// Template color palette (avoiding light blue which is reserved for completed status)
const TEMPLATE_COLORS = {
  'preshoot': { main: '#9333ea', light: '#f3e8ff', hover: '#ede9fe' },      // Purple
  'production': { main: '#16a34a', light: '#dcfce7', hover: '#bbf7d0' },     // Green
  'proofing': { main: '#ea580c', light: '#ffedd5', hover: '#fed7aa' },       // Orange
  'post-production': { main: '#0d9488', light: '#ccfbf1', hover: '#99f6e4' }, // Teal
  'postproduction': { main: '#0d9488', light: '#ccfbf1', hover: '#99f6e4' },  // Teal (alternate spelling)
  'delivery': { main: '#4f46e5', light: '#e0e7ff', hover: '#c7d2fe' },        // Indigo
  'default': { main: '#6b7280', light: '#f3f4f6', hover: '#e5e7eb' }          // Gray
};

// Get colors for a template based on its name
function getTemplateColors(templateName) {
  if (!templateName) return TEMPLATE_COLORS.default;

  // Normalize template name to lowercase and remove spaces/hyphens
  const normalized = templateName.toLowerCase().replace(/[\s-]/g, '');

  // Check for exact match
  if (TEMPLATE_COLORS[normalized]) {
    return TEMPLATE_COLORS[normalized];
  }

  // Check for partial match (e.g., "Pre-Shoot Planning" matches "preshoot")
  for (const key in TEMPLATE_COLORS) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return TEMPLATE_COLORS[key];
    }
  }

  return TEMPLATE_COLORS.default;
}

// Row height for virtual scrolling
const ROW_HEIGHT = 90;

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

// Check if all microsteps are completed (for validating initials input)
function areAllMicrosCompleted(normalizedMicros) {
  // If no microsteps exist, input should be enabled
  if (!normalizedMicros || normalizedMicros.length === 0) {
    return true;
  }

  // Check if ALL microsteps have done === true
  return normalizedMicros.every(micro => micro.done === true);
}

// Cell status badge component
const CellBadge = React.memo(({ done }) => {
  return (
    <span className={`matrix-cell-badge ${done ? 'matrix-cell-badge--done' : 'matrix-cell-badge--pending'}`}>
      {done ? <Check className="matrix-cell-badge__icon" /> : <Clock className="matrix-cell-badge__icon" />}
      {done ? 'Done' : 'Pending'}
    </span>
  );
});

// Progress bar component
const ProgressBar = React.memo(({ pct }) => {
  return (
    <div className="matrix-progress-bar">
      <div className="matrix-progress-bar__fill" style={{ width: `${pct}%` }}></div>
    </div>
  );
});

// Micro-step meter component with hover preview and portal checklist
const MicroMeter = React.memo(({ label, templateMicros, normalizedMicros, onToggle }) => {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [checklistPosition, setChecklistPosition] = React.useState({ top: 0, left: 0 });
  const buttonRef = React.useRef(null);
  const lastMousePos = React.useRef({ x: 0, y: 0 });

  if (!normalizedMicros || normalizedMicros.length === 0) return null;

  const total = normalizedMicros.length;
  const done = normalizedMicros.filter(m => m.done).length;
  const pct = Math.round((done / Math.max(1, total)) * 100);

  // Update checklist position based on button location
  const updateChecklistPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      // Close if button is scrolled out of view
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        secureLogger.debug('Button out of view, closing checklist');
        setOpen(false);
        return;
      }

      const newPos = {
        top: rect.bottom + 4,
        left: rect.left + (rect.width / 2)
      };
      secureLogger.debug('Updating checklist position', { top: newPos.top, left: newPos.left });
      setChecklistPosition(newPos);
    }
  };

  // Calculate checklist position when opening
  const handleToggle = () => {
    if (!open) {
      secureLogger.debug('Opening checklist');
      updateChecklistPosition();
    }
    setOpen(v => !v);
  };

  // Calculate distance from point to rectangle
  const getDistanceToRect = (mouseX, mouseY, rect) => {
    const dx = Math.max(rect.left - mouseX, 0, mouseX - rect.right);
    const dy = Math.max(rect.top - mouseY, 0, mouseY - rect.bottom);
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle mouse movement, scroll, and click outside when checklist is open
  React.useEffect(() => {
    if (!open) return;

    // Close checklist when clicking outside
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        const checklist = document.querySelector('.micro-meter-checklist-portal');
        if (!checklist || !checklist.contains(e.target)) {
          setOpen(false);
        }
      }
    };

    // Close checklist if cursor moves 50px+ away
    const handleMouseMove = (e) => {
      // Track mouse position for distance checks after scroll
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const checklist = document.querySelector('.micro-meter-checklist-portal');
      if (checklist) {
        const rect = checklist.getBoundingClientRect();
        const distance = getDistanceToRect(e.clientX, e.clientY, rect);
        if (distance > 50) {
          setOpen(false);
        }
      }
    };

    // Update checklist position on scroll
    const handleScroll = (e) => {
      secureLogger.debug('Scroll event fired', { target: e.target.className || e.target.tagName });
      updateChecklistPosition();

      // Check distance after scroll using last known mouse position
      const checklist = document.querySelector('.micro-meter-checklist-portal');
      if (checklist && lastMousePos.current) {
        const rect = checklist.getBoundingClientRect();
        const distance = getDistanceToRect(lastMousePos.current.x, lastMousePos.current.y, rect);
        if (distance > 50) {
          secureLogger.debug('Too far after scroll, closing checklist');
          setOpen(false);
        }
      }
    };

    // Try multiple strategies to find the scrollable element
    const dataGrid = document.querySelector('.workflow-matrix__data-grid');
    const rdg = dataGrid?.querySelector('.rdg');
    const rdgViewport = dataGrid?.querySelector('[role="grid"]')?.parentElement;
    const anyScrollable = dataGrid?.querySelector('[class*="viewport"], [class*="scroll"]');

    secureLogger.debug('Scrollable elements check', {
      dataGrid: !!dataGrid,
      rdg: !!rdg,
      rdgViewport: !!rdgViewport,
      anyScrollable: !!anyScrollable
    });

    // Build array of candidates - try all possibilities
    const scrollableElements = [
      rdgViewport,
      rdg,
      dataGrid,
      anyScrollable,
      window
    ].filter(Boolean);

    secureLogger.debug('Attaching scroll listeners', {
      count: scrollableElements.length,
      elements: scrollableElements.map((el, i) =>
        el === window ? 'window' : el.className || el.tagName
      )
    });

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousemove', handleMouseMove);

    // Attach scroll listener to all scrollable elements
    scrollableElements.forEach(element => {
      if (element) {
        element.addEventListener('scroll', handleScroll);
      }
    });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);

      // Remove scroll listeners
      scrollableElements.forEach(element => {
        if (element) {
          element.removeEventListener('scroll', handleScroll);
        }
      });
    };
  }, [open]);

  return (
    <div
      className="micro-meter-container"
      onMouseLeave={() => { setHover(false); }}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          ref={buttonRef}
          type="button"
          tabIndex={-1}
          title={`${done}/${total} micro-steps complete`}
          className="micro-meter-button"
          onClick={handleToggle}
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

      {/* Checklist rendered as portal at document.body */}
      {open && ReactDOM.createPortal(
        <div
          className="micro-meter-checklist micro-meter-checklist-portal"
          style={{
            position: 'fixed',
            top: `${checklistPosition.top}px`,
            left: `${checklistPosition.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 10000
          }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
});

// ============================================================================
// Cell Renderer Components for react-data-grid
// ============================================================================

// Extracted style constants for cell renderers to prevent object recreation
const SCHOOL_CELL_CONTAINER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  height: '100%',
  width: '100%',
  padding: '8px'
};

const SCHOOL_BUTTON_STYLE = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  opacity: 0.7,
  transition: 'opacity 0.2s'
};

const SCHOOL_SPAN_STYLE = {
  flex: 1,
  cursor: 'pointer',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflow: 'visible',
  fontSize: '12px',
  lineHeight: '1.3',
  textAlign: 'center'
};

const DATE_CELL_STYLE = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '8px'
};

const PROGRESS_CELL_STYLE = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '8px'
};

const TASK_CELL_STYLE = {
  width: '100%',
  height: '100%',
  padding: '8px'
};

// Header cell styles
const HEADER_CELL_BASE_STYLE = {
  color: 'white',
  flex: 1,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '8px',
  fontSize: '11px',
  fontWeight: 600
};

const TASK_HEADER_CELL_STYLE = {
  color: 'white',
  flex: 1,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px',
  fontSize: '11px',
  fontWeight: 600,
  wordBreak: 'break-word',
  lineHeight: '1.3',
  gap: '4px'
};

const HEADER_TITLE_SPAN_STYLE = { flex: 1 };

const HEADER_ICON_CONTAINER_STYLE = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
  flexShrink: 0
};

const LOCK_ICON_STYLE = {
  opacity: 0.7,
  flexShrink: 0
};

const VIDEO_ICON_STYLE = {
  flexShrink: 0,
  cursor: 'pointer',
  opacity: 0.8,
  transition: 'opacity 0.15s ease'
};

// School cell with eye icon and click handler
const SchoolCell = React.memo(({ row, colors, handleSchoolClick, toggleWorkflowHidden, optimisticallyHidden }) => {
  const { workflow, school } = row;
  const isHidden = optimisticallyHidden.hasOwnProperty(workflow.id)
    ? optimisticallyHidden[workflow.id]
    : workflow.hidden;

  return (
    <div style={{
      ...SCHOOL_CELL_CONTAINER_STYLE,
      backgroundColor: colors.light
    }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleWorkflowHidden(workflow.id, isHidden);
        }}
        style={{
          ...SCHOOL_BUTTON_STYLE,
          color: isHidden ? '#ef4444' : '#6b7280'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        title={isHidden ? 'Unhide workflow' : 'Hide workflow'}
      >
        {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <span
        className="workflow-matrix__cell--clickable"
        onClick={() => handleSchoolClick(workflow)}
        style={SCHOOL_SPAN_STYLE}
      >
        {school}
      </span>
    </div>
  );
});

// Date cell - formatted date display
const DateCell = React.memo(({ row, colors }) => {
  const { date } = row;
  return (
    <div style={{
      ...DATE_CELL_STYLE,
      backgroundColor: colors.light
    }}>
      <span>{formatDateToMMDDYYYY(date)}</span>
    </div>
  );
});

// Progress cell - progress bar
const ProgressCell = React.memo(({ row, colors }) => {
  const { progress } = row;
  return (
    <div style={{ ...PROGRESS_CELL_STYLE, backgroundColor: colors.light }}>
      <ProgressBar pct={progress} />
    </div>
  );
});

// Task cell - initials input, badge, micro-meter, date input, task button
const TaskCell = React.memo(({
  row,
  step,
  lastCompletedIdx,
  colIndex,
  showDates,
  handleInitialsChange,
  handleDateChange,
  handleMicroToggle,
  optimisticUpdates,
  colors,
  tasks,
  onTaskClick
}) => {
  const { workflow } = row;
  const stepProgress = workflow.stepProgress?.[step.id] || {};
  const isCompleted = colIndex <= lastCompletedIdx;
  const isCurrent = colIndex === lastCompletedIdx + 1 && stepProgress.status !== 'completed';
  const isDone = stepProgress.status === 'completed';
  const cellKey = `${workflow.id}-${step.id}`;

  const normalizedMicros = normalizeMicros(step, stepProgress);

  const optimistic = optimisticUpdates[cellKey];
  const displayInitials = optimistic?.initials ?? stepProgress.initials ?? '';
  const displayMicros = optimistic?.micro ?? normalizedMicros;

  // Check if all microsteps are completed (controls whether initials can be entered)
  const canEnterInitials = areAllMicrosCompleted(displayMicros);

  // Get tasks for this workflow step
  const stepTasks = tasks || [];

  return (
    <div
      className="workflow-matrix__cell-content"
      style={{
        ...TASK_CELL_STYLE,
        backgroundColor: isCompleted ? undefined : colors.light
      }}
    >
      <div className="workflow-matrix__cell-row">
        <input
          type="text"
          className="workflow-matrix__initials-input"
          placeholder="Init"
          maxLength={4}
          value={displayInitials}
          onChange={(e) => handleInitialsChange(workflow.id, step.id, e.target.value, normalizedMicros)}
          disabled={!canEnterInitials}
          aria-label={`${step.title} — ${workflow.id}`}
        />
        <CellBadge done={isDone} />
      </div>
      {showDates && (
        <input
          type="date"
          className="workflow-matrix__date-input"
          value={stepProgress.completedDate || ''}
          onChange={(e) => handleDateChange(workflow.id, step.id, displayInitials, e.target.value, normalizedMicros)}
          tabIndex={-1}
        />
      )}
      {/* Microsteps and Task Button Row */}
      <div className="workflow-matrix__cell-bottom-row">
        {displayMicros && displayMicros.length > 0 && (
          <MicroMeter
            label={step.title}
            templateMicros={step.micros}
            normalizedMicros={displayMicros}
            onToggle={(microKey) => handleMicroToggle(workflow.id, step.id, microKey, displayMicros, displayInitials)}
          />
        )}
        {/* Task Button */}
        <div className="workflow-matrix__cell-task-button">
          <TaskButton
            workflowId={workflow.id}
            stepId={step.id}
            sessionId={workflow.sessionId}
            tasks={stepTasks}
            onTaskClick={onTaskClick}
            linkedTaskId={stepProgress.linkedTaskId || null}
            linkedTaskStatus={
              stepProgress.linkedTaskId
                ? stepTasks.find(t => t.id === stepProgress.linkedTaskId)?.status || null
                : null
            }
          />
        </div>
      </div>
    </div>
  );
});

const WorkflowMatrixView = ({ workflows, sessionData, workflowTemplates }) => {
  const { userProfile, organization } = useAuth();
  const { deleteWorkflow } = useWorkflow();
  const { myTasks, teamTasks, openPanelWithTask } = useTask();
  const [activeTab, setActiveTab] = useState(null);
  const [showDates, setShowDates] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState({}); // Local state for immediate UI feedback
  const [realtimeWorkflows, setRealtimeWorkflows] = useState(null); // Tab-scoped real-time updates

  // Filter state
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [dateRange, setDateRange] = useState('all'); // 'all', '7', '14', '30', '60'
  const [optimisticallyHidden, setOptimisticallyHidden] = useState({}); // { workflowId: true/false }

  // Task state
  const [workflowStepTasks, setWorkflowStepTasks] = useState({}); // { 'workflowId_stepId': [tasks] }
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modal state
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [schools, setSchools] = useState([]);

  // Video modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentVideoData, setCurrentVideoData] = useState(null);

  // Tab ordering state
  const [savedTabOrder, setSavedTabOrder] = useState([]); // Array of template IDs in saved order
  const savedTabOrderLoadedRef = useRef(false); // Track if saved order has been loaded from Firebase

  // Use refs for drag state to avoid re-renders during drag
  const draggedTabIndexRef = useRef(null);
  const draggedOverIndexRef = useRef(null);

  // Debounce timers for Firebase writes (immediate UI, delayed save)
  const debounceTimersRef = useRef({});
  const listenerUnsubscribeRef = useRef(null);

  // Ref for horizontal scroll support
  const gridContainerRef = useRef(null);

  // Column width state
  const [columnWidths, setColumnWidths] = useState({
    school: 180,
    date: 100,
    progress: 120,
    taskDefault: 100
  });
  const [taskColumnWidths, setTaskColumnWidths] = useState({}); // Specific widths for each task column

  // Get unique templates from workflows and create tabs
  const tabs = useMemo(() => {
    const templateMap = new Map();
    const orphanedWorkflows = [];

    // Only check for orphaned workflows if workflowTemplates is populated
    const hasTemplates = workflowTemplates && Object.keys(workflowTemplates).length > 0;

    workflows.forEach(workflow => {
      const template = workflowTemplates[workflow.templateId];
      if (template && !templateMap.has(workflow.templateId)) {
        templateMap.set(workflow.templateId, {
          id: workflow.templateId,
          name: template.name,
          steps: template.steps || [],
          groups: template.groups || []
        });
      } else if (!template && hasTemplates) {
        // Only mark as orphaned if we have templates loaded and this workflow's template is missing
        // This prevents false positives during initial load
        orphanedWorkflows.push({
          id: workflow.id,
          templateId: workflow.templateId,
          sessionId: workflow.sessionId,
          schoolName: workflow.schoolName || 'Unknown'
        });
      }
    });

    if (orphanedWorkflows.length > 0) {
      secureLogger.warn('Orphaned workflows detected (missing templates)', {
        count: orphanedWorkflows.length,
        workflows: orphanedWorkflows
      });
    }

    const tabsArray = Array.from(templateMap.values());

    // Sort tabs based on saved order
    if (savedTabOrder.length > 0) {
      tabsArray.sort((a, b) => {
        const indexA = savedTabOrder.indexOf(a.id);
        const indexB = savedTabOrder.indexOf(b.id);

        // If both are in saved order, sort by their positions
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // If only A is in saved order, it comes first
        if (indexA !== -1) return -1;
        // If only B is in saved order, it comes first
        if (indexB !== -1) return 1;
        // If neither is in saved order, maintain original order
        return 0;
      });
    }

    return { tabs: tabsArray, orphanedWorkflows };
  }, [workflows, workflowTemplates, savedTabOrder]);

  // Set initial active tab - respects saved tab order
  useEffect(() => {
    if (tabs.tabs.length === 0) return;

    // Always set to first tab if no active tab
    if (!activeTab) {
      setActiveTab(tabs.tabs[0].id);
      return;
    }

    // If savedTabOrder just loaded for the first time, switch to the first tab in sorted order
    if (savedTabOrderLoadedRef.current && activeTab !== tabs.tabs[0].id) {
      setActiveTab(tabs.tabs[0].id);
      savedTabOrderLoadedRef.current = false; // Only do this once
    }
  }, [tabs, activeTab]);

  // Load saved tab order from organization document
  useEffect(() => {
    if (!organization?.id) return;

    const loadTabOrder = async () => {
      try {
        const orgRef = doc(firestore, 'organizations', organization.id);
        const unsubscribe = onSnapshot(
          orgRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const order = data.workflowTabOrder || [];
              secureLogger.info('Loaded workflow tab order', { orderLength: order.length });

              // Set flag to trigger active tab update on first load
              if (!savedTabOrderLoadedRef.current && order.length > 0) {
                savedTabOrderLoadedRef.current = true;
              }

              setSavedTabOrder(order);
            }
          },
          (error) => {
            secureLogger.error('Error loading tab order', { error: error.message });
          }
        );

        return unsubscribe;
      } catch (error) {
        secureLogger.error('Error setting up tab order listener', { error: error.message });
      }
    };

    const unsubscribePromise = loadTabOrder();

    // Cleanup
    return () => {
      if (unsubscribePromise) {
        unsubscribePromise.then(unsub => {
          if (unsub) unsub();
        });
      }
    };
  }, [organization?.id]);

  // Load schools for modal
  useEffect(() => {
    const loadSchoolsData = async () => {
      if (!organization?.id) return;
      try {
        const schoolsData = await getSchools(organization.id);
        setSchools(schoolsData);
      } catch (error) {
        secureLogger.error('Error loading schools', { error: error.message });
      }
    };
    loadSchoolsData();
  }, [organization?.id]);

  // Tab-scoped real-time listener - only listen to workflows for active template
  // This dramatically reduces Firebase reads (10-20 workflows instead of 100+)
  // CACHE-FIRST PATTERN: Load from cache immediately, then listen for updates
  useEffect(() => {
    if (!activeTab || !organization?.id || !userProfile?.uid) return;

    // Clean up previous listener when tab changes
    if (listenerUnsubscribeRef.current) {
      secureLogger.debug('Cleaning up previous tab listener');
      listenerUnsubscribeRef.current();
      listenerUnsubscribeRef.current = null;
    }

    secureLogger.debug('Setting up tab-scoped listener for template', { templateId: activeTab });

    // STEP 1: Try to load from cache first (instant display)
    const cachedWorkflows = workflowCacheService.getCachedWorkflows(
      userProfile.uid,
      organization.id,
      `template_${activeTab}`,
      'WorkflowMatrixView'
    );

    if (cachedWorkflows && cachedWorkflows.length > 0) {
      secureLogger.info('Cache hit - loaded workflows from cache', {
        count: cachedWorkflows.length,
        templateId: activeTab
      });
      setRealtimeWorkflows(cachedWorkflows);
      // Cache hit already recorded by workflowCacheService
    } else {
      secureLogger.debug('Cache miss - no cached workflows', { templateId: activeTab });
      // Cache miss already recorded by workflowCacheService
    }

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
          secureLogger.debug('Snapshot from cache, ignoring');
          return;
        }

        // CRITICAL: Use docChanges() to process only changed documents
        // This is the key to reducing Firebase reads from 243 to 1 per update
        const changes = snapshot.docChanges();

        if (isInitialLoad) {
          // Initial load: Build full array from snapshot
          const workflowCount = snapshot.docs.length;
          secureLogger.info('Tab listener initial load', {
            count: workflowCount,
            templateId: activeTab
          });

          readCounter.recordRead('onSnapshot-initial', 'workflows', 'WorkflowMatrixView', workflowCount);

          const tabWorkflows = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // STEP 2: Update cache with fresh data from Firestore
          workflowCacheService.setCachedWorkflows(
            userProfile.uid,
            organization.id,
            `template_${activeTab}`,
            tabWorkflows
          );

          setRealtimeWorkflows(tabWorkflows);
          isInitialLoad = false;

        } else if (changes.length > 0) {
          // Subsequent updates: Process only changed documents
          secureLogger.info('Tab listener incremental update', {
            changedCount: changes.length,
            templateId: activeTab
          });

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

            // STEP 3: Update cache with incremental changes
            workflowCacheService.setCachedWorkflows(
              userProfile.uid,
              organization.id,
              `template_${activeTab}`,
              updated
            );

            return updated;
          });
        }
      },
      (error) => {
        secureLogger.error('Tab listener error', { error: error.message, templateId: activeTab });
      }
    );

    listenerUnsubscribeRef.current = unsubscribe;

    // Cleanup on unmount or tab change
    return () => {
      if (listenerUnsubscribeRef.current) {
        secureLogger.debug('Tab change - cleaning up listener');
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null;
      }
    };
  }, [activeTab, organization?.id]);

  // Get active template
  const activeTemplate = useMemo(() => {
    return tabs.tabs.find(tab => tab.id === activeTab);
  }, [tabs, activeTab]);

  // Load saved column widths from localStorage when template changes
  useEffect(() => {
    if (!activeTemplate || !activeTemplate.steps) return;

    const storageKey = `workflow-matrix-widths-${activeTemplate.id}`;
    const savedWidths = localStorage.getItem(storageKey);

    if (savedWidths) {
      try {
        const parsed = JSON.parse(savedWidths);
        if (parsed.columnWidths) {
          setColumnWidths(prev => ({ ...prev, ...parsed.columnWidths }));
        }
        if (parsed.taskColumnWidths) {
          setTaskColumnWidths(parsed.taskColumnWidths);
        }
        return; // Use saved widths, skip auto-sizing
      } catch (error) {
        secureLogger.error('Error loading saved column widths', { error: error.message });
      }
    }

    // No saved widths, auto-size columns based on header text
    const newTaskWidths = {};
    activeTemplate.steps.forEach(step => {
      // Calculate width needed: approximately 6px per character + minimal padding
      const headerWidth = step.title.length * 6 + 20;
      // Use minimum of 155px (to fit cell content comfortably) or calculated width
      const columnKey = `task-${step.id}`;
      newTaskWidths[columnKey] = Math.max(155, headerWidth);
    });

    setTaskColumnWidths(newTaskWidths);
  }, [activeTemplate]);

  // Filter workflows by active template
  // Use real-time workflows when available (tab-scoped listener), otherwise use props
  const filteredWorkflows = useMemo(() => {
    if (!activeTab) return [];

    // Prefer real-time workflows from tab-scoped listener (fresher data)
    const sourceWorkflows = realtimeWorkflows || workflows;

    // Step 1: Filter by template
    let filtered = sourceWorkflows.filter(w => w.templateId === activeTab);

    // Step 2: Apply date range filter
    if (dateRange !== 'all') {
      const daysAgo = parseInt(dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      const cutoffStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

      filtered = filtered.filter(w => {
        const workflowDate = w.workflowType === 'tracking'
          ? w.trackingStartDate
          : (w.sessionDate || sessionData[w.sessionId]?.date || '');
        return workflowDate >= cutoffStr;
      });
    }

    // Step 3: Apply hidden filter (with optimistic updates)
    if (showHiddenOnly) {
      // Show ONLY hidden workflows
      filtered = filtered.filter(w => {
        // Check optimistic state first, fallback to actual state
        const isHidden = optimisticallyHidden.hasOwnProperty(w.id)
          ? optimisticallyHidden[w.id]
          : w.hidden;
        return isHidden === true;
      });
    } else {
      // Default: hide hidden workflows
      filtered = filtered.filter(w => {
        // Check optimistic state first, fallback to actual state
        const isHidden = optimisticallyHidden.hasOwnProperty(w.id)
          ? optimisticallyHidden[w.id]
          : w.hidden;
        return !isHidden;
      });
    }

    // Step 4: Apply completion filter
    if (hideCompleted && !showHiddenOnly) {
      // Calculate progress for each workflow and filter out 100% complete
      filtered = filtered.filter(w => {
        const template = workflowTemplates[w.templateId];
        if (!template || !template.steps) return true;

        const totalSteps = template.steps.length;
        if (totalSteps === 0) return true;

        const completedSteps = template.steps.reduce((count, step) => {
          const progress = w.stepProgress?.[step.id];
          return count + (progress?.status === 'completed' ? 1 : 0);
        }, 0);

        const progressPct = Math.round((completedSteps / totalSteps) * 100);
        return progressPct < 100;
      });
    }

    // Step 5: Sort by date chronologically (oldest first)
    return filtered.sort((a, b) => {
      // Get dates for comparison
      const dateA = a.workflowType === 'tracking'
        ? a.trackingStartDate
        : (a.sessionDate || sessionData[a.sessionId]?.date || '');
      const dateB = b.workflowType === 'tracking'
        ? b.trackingStartDate
        : (b.sessionDate || sessionData[b.sessionId]?.date || '');

      // Convert to comparable format (YYYY-MM-DD should sort correctly as strings)
      return dateA.localeCompare(dateB);
    });
  }, [workflows, activeTab, realtimeWorkflows, sessionData, dateRange, showHiddenOnly, hideCompleted, workflowTemplates, optimisticallyHidden]);

  // Load tasks for visible workflow steps
  useEffect(() => {
    if (!activeTemplate || !filteredWorkflows.length || !organization?.id) {
      return;
    }

    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        // Build list of workflow/step pairs to query
        const workflowStepPairs = [];
        filteredWorkflows.forEach(workflow => {
          activeTemplate.steps.forEach(step => {
            workflowStepPairs.push({
              workflowId: workflow.id,
              workflowStepId: step.id
            });
          });
        });

        // Batch query all tasks
        const tasksByStep = await getWorkflowStepTasksBatch(workflowStepPairs, organization.id);
        setWorkflowStepTasks(tasksByStep);
      } catch (error) {
        secureLogger.error('Error loading workflow step tasks', { error: error.message });
      } finally {
        setLoadingTasks(false);
      }
    };

    loadTasks();
  }, [activeTemplate, filteredWorkflows, organization?.id, myTasks.length, teamTasks.length]);

  // Handle task click to open detail panel
  const handleTaskClick = useCallback((taskId) => {
    openPanelWithTask(taskId);
  }, [openPanelWithTask]);

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
      secureLogger.debug('Invalid initials format, rejecting', { value: trimmed });
      return; // Invalid format - don't update
    }

    const cellKey = `${workflowId}-${stepId}`;

    secureLogger.debug('Initials change', { cellKey, value, trimmed });

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
      secureLogger.debug('Saving initials to Firebase', { cellKey, trimmed });

      try {
        const updateData = {};

        if (trimmed) {
          // Check if all microsteps are completed (if they exist)
          const allMicrosComplete = areAllMicrosCompleted(normalizedMicros);

          // Mark as completed ONLY if: initials present AND (no micros OR all micros done)
          const shouldComplete = allMicrosComplete;

          updateData.initials = trimmed;
          updateData.status = shouldComplete ? 'completed' : 'pending';

          if (shouldComplete) {
            updateData.completedBy = userProfile.id;
            updateData.completedDate = todayYMD();
          }
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

        secureLogger.debug('Firebase save complete', { cellKey });
        readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);

        // Don't clear optimistic update - let the listener update confirm the change
        // This prevents flickering if listener is delayed

      } catch (error) {
        secureLogger.error('Error updating step', { error: error.message, cellKey });
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

    secureLogger.debug('Date change', { cellKey, value });

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

      secureLogger.debug('Date save complete', { cellKey });
      readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);
    } catch (error) {
      secureLogger.error('Error updating date', { error: error.message, cellKey });
    }
  }, [userProfile?.id]);

  // Handle micro-step toggle (optimistic update, immediate save - single action)
  const handleMicroToggle = useCallback(async (workflowId, stepId, microKey, normalizedMicros, currentInitials) => {
    const cellKey = `${workflowId}-${stepId}`;

    // Toggle the specific micro's done state
    const updatedMicros = normalizedMicros.map(m =>
      m.key === microKey ? { ...m, done: !m.done } : m
    );

    secureLogger.debug('Micro toggle', { cellKey, microKey });

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

      // Task is done ONLY if: initials present AND (no micros OR all micros checked)
      // This ensures both conditions must be met for steps with microsteps
      const isDone = !!currentInitials && (updatedMicros.length === 0 || allMicrosDone);

      const updateData = {
        micro: updatedMicros,
        status: isDone ? 'completed' : 'pending'
      };

      // If becoming done, set completion metadata (only when initials already present)
      if (isDone && currentInitials) {
        updateData.completedDate = todayYMD();
        updateData.completedBy = userProfile.id;
        updateData.initials = currentInitials;
      }

      await updateWorkflowStep(workflowId, stepId, updateData);

      secureLogger.debug('Micro toggle save complete', { cellKey });
      readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);

      // Don't clear optimistic update - let listener confirm the change

    } catch (error) {
      secureLogger.error('Error toggling micro-step', { error: error.message, cellKey });
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
        school: workflow.schoolName || 'Unknown',
        date: workflow.trackingStartDate || ''
      };
    } else {
      // Session-based workflows: use denormalized data first, fallback to sessionData lookup
      const session = sessionData[workflow.sessionId];
      return {
        school: workflow.schoolName || session?.schoolName || 'Unknown',
        date: workflow.sessionDate || session?.date || ''
      };
    }
  };

  // Handle school cell click to open modal
  const handleSchoolClick = (workflow) => {
    setSelectedWorkflow(workflow);
  };

  // Save tab order to organization document
  const saveTabOrder = useCallback(async (newOrder) => {
    if (!organization?.id) return;

    try {
      const orgRef = doc(firestore, 'organizations', organization.id);
      await updateDoc(orgRef, {
        workflowTabOrder: newOrder
      });
      secureLogger.info('Tab order saved to organization', { orderLength: newOrder.length });
      readCounter.recordRead('updateDoc', 'organizations', 'WorkflowMatrixView', 1);
    } catch (error) {
      secureLogger.error('Error saving tab order', { error: error.message });
    }
  }, [organization?.id]);

  // Drag and drop handlers for tab reordering - using refs to avoid re-renders
  const handleDragStart = useCallback((e, index) => {
    draggedTabIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add visual feedback to the dragged element
    e.currentTarget.style.opacity = '0.5';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Update drag over ref without triggering re-render
    if (draggedTabIndexRef.current !== null) {
      draggedOverIndexRef.current = index;

      // Add visual feedback to drop target
      const tabs = document.querySelectorAll('.workflow-matrix__tab');
      tabs.forEach((tab, i) => {
        if (i === index && i !== draggedTabIndexRef.current) {
          tab.style.borderLeft = '3px solid #3b82f6';
          tab.style.paddingLeft = '9px';
        } else {
          tab.style.borderLeft = '';
          tab.style.paddingLeft = '';
        }
      });
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Remove visual feedback when leaving
    e.currentTarget.style.borderLeft = '';
    e.currentTarget.style.paddingLeft = '';
  }, []);

  const handleDragEnd = useCallback((e) => {
    // Reset opacity
    e.currentTarget.style.opacity = '1';

    // Clear all visual feedback
    const tabs = document.querySelectorAll('.workflow-matrix__tab');
    tabs.forEach(tab => {
      tab.style.borderLeft = '';
      tab.style.paddingLeft = '';
    });

    // Clear refs
    draggedTabIndexRef.current = null;
    draggedOverIndexRef.current = null;
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedIndex = draggedTabIndexRef.current;

    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    // Reorder tabs
    const reorderedTabs = [...tabs];
    const [draggedTab] = reorderedTabs.splice(draggedIndex, 1);
    reorderedTabs.splice(dropIndex, 0, draggedTab);

    // Extract just the IDs for saving
    const newOrder = reorderedTabs.map(tab => tab.id);

    // Update local state for responsive UI
    setSavedTabOrder(newOrder);

    // Save to Firebase
    saveTabOrder(newOrder);
  }, [tabs, saveTabOrder]);

  // Toggle workflow hidden status with optimistic updates
  const toggleWorkflowHidden = useCallback(async (workflowId, currentlyHidden) => {
    const newHiddenState = !currentlyHidden;

    // IMMEDIATE: Update optimistic state for instant UI feedback
    setOptimisticallyHidden(prev => ({
      ...prev,
      [workflowId]: newHiddenState
    }));

    secureLogger.debug('Optimistically toggling workflow hidden status', {
      workflowId,
      hidden: newHiddenState
    });

    try {
      // BACKGROUND: Update Firebase
      const workflowRef = doc(firestore, 'workflows', workflowId);
      await updateDoc(workflowRef, {
        hidden: newHiddenState
      });

      secureLogger.info('Workflow hidden status updated in Firebase', {
        workflowId,
        hidden: newHiddenState
      });
      readCounter.recordRead('updateDoc', 'workflows', 'WorkflowMatrixView', 1);

      // Clear optimistic state after Firebase confirms (listener will have updated)
      setTimeout(() => {
        setOptimisticallyHidden(prev => {
          const next = { ...prev };
          delete next[workflowId];
          return next;
        });
      }, 1000); // Wait 1 second for listener to process

    } catch (error) {
      secureLogger.error('Error toggling workflow hidden status', {
        error: error.message,
        workflowId
      });
      // Revert optimistic update on error
      setOptimisticallyHidden(prev => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
    }
  }, []);

  // ============================================================================
  // Build columns array for react-data-grid
  // ============================================================================
  const columns = useMemo(() => {
    if (!activeTemplate) return [];

    // Don't build columns until taskColumnWidths is populated (prevents thin columns in production)
    if (activeTemplate.steps && activeTemplate.steps.length > 0 && Object.keys(taskColumnWidths).length === 0) {
      return []; // Wait for widths to be calculated by useEffect
    }

    // Default color for non-task columns (School, Date, Progress)
    const defaultColor = '#1e3a8a'; // Dark blue
    const defaultColors = { main: defaultColor, light: '#eff6ff', hover: '#dbeafe' };

    const cols = [];

    // School column (frozen)
    cols.push({
      key: 'school',
      name: 'School',
      frozen: true,
      width: columnWidths.school,
      resizable: true,
      renderHeaderCell: () => (
        <div style={{ ...HEADER_CELL_BASE_STYLE, backgroundColor: defaultColors.main }}>
          School
        </div>
      ),
      renderCell: (props) => (
        <SchoolCell
          row={props.row}
          colors={defaultColors}
          handleSchoolClick={handleSchoolClick}
          toggleWorkflowHidden={toggleWorkflowHidden}
          optimisticallyHidden={optimisticallyHidden}
        />
      ),
      cellClass: 'workflow-matrix__cell workflow-matrix__cell--school'
    });

    // Date column (frozen)
    cols.push({
      key: 'date',
      name: 'Date',
      frozen: true,
      width: columnWidths.date,
      resizable: true,
      renderHeaderCell: () => (
        <div style={{ ...HEADER_CELL_BASE_STYLE, backgroundColor: defaultColors.main }}>
          Date
        </div>
      ),
      renderCell: (props) => <DateCell row={props.row} colors={defaultColors} />,
      cellClass: 'workflow-matrix__cell workflow-matrix__cell--date'
    });

    // Progress column
    cols.push({
      key: 'progress',
      name: 'Progress',
      frozen: false,
      width: columnWidths.progress,
      resizable: true,
      renderHeaderCell: () => (
        <div style={{ ...HEADER_CELL_BASE_STYLE, backgroundColor: defaultColors.main }}>
          Progress
        </div>
      ),
      renderCell: (props) => <ProgressCell row={props.row} colors={defaultColors} />,
      cellClass: 'workflow-matrix__cell workflow-matrix__cell--progress'
    });

    // Task columns (one per template step)
    activeTemplate.steps.forEach((step, colIndex) => {
      const columnKey = `task-${step.id}`;
      const width = taskColumnWidths[columnKey] || columnWidths.taskDefault || 155;

      // Get group color for this step
      const groupColor = getStepGroupColor(step, activeTemplate.groups);

      // Create colors object for this step with light and hover variants
      const stepColors = {
        main: groupColor,
        light: groupColor + '20', // 20% opacity
        hover: groupColor + '30'  // 30% opacity
      };

      cols.push({
        key: columnKey,
        name: step.title,
        frozen: false,
        width: width,
        resizable: true,
        renderHeaderCell: () => {
          const hasVideo = step.tutorialVideoURL || step.tutorialVideoFile;
          const videoUrl = step.tutorialVideoFile || step.tutorialVideoURL;
          const hasDependencies = step.dependencies && step.dependencies.length > 0;
          const taskCreationTrigger = step.taskCreationTrigger;

          // Build dependency tooltip
          let dependencyTooltip = '';
          if (hasDependencies && taskCreationTrigger === 'dependency') {
            const depStepTitles = step.dependencies
              .map(depId => {
                const depStep = activeTemplate?.steps?.find(s => s.id === depId);
                return depStep ? depStep.title : depId;
              })
              .join(', ');
            dependencyTooltip = `Depends on: ${depStepTitles}`;
          }

          return (
            <div style={{ ...TASK_HEADER_CELL_STYLE, backgroundColor: stepColors.main }}>
              <span style={HEADER_TITLE_SPAN_STYLE}>{step.title}</span>
              <div style={HEADER_ICON_CONTAINER_STYLE}>
                {hasDependencies && taskCreationTrigger === 'dependency' && (
                  <Lock
                    size={14}
                    style={LOCK_ICON_STYLE}
                    title={dependencyTooltip}
                  />
                )}
                {hasVideo && (
                  <PlayCircle
                    size={16}
                    style={VIDEO_ICON_STYLE}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentVideoData({
                        url: videoUrl,
                        title: step.title
                      });
                      setVideoModalOpen(true);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                    title="Watch tutorial video"
                  />
                )}
              </div>
            </div>
          );
        },
        renderCell: (props) => {
          const lastCompletedIdx = getLastCompletedIndex(props.row.workflow);
          const taskKey = `${props.row.workflow.id}_${step.id}`;
          const stepTasks = workflowStepTasks[taskKey] || [];

          return (
            <TaskCell
              row={props.row}
              step={step}
              lastCompletedIdx={lastCompletedIdx}
              colIndex={colIndex}
              showDates={showDates}
              handleInitialsChange={handleInitialsChange}
              handleDateChange={handleDateChange}
              handleMicroToggle={handleMicroToggle}
              optimisticUpdates={optimisticUpdates}
              colors={stepColors}
              tasks={stepTasks}
              onTaskClick={handleTaskClick}
            />
          );
        },
        cellClass: (row) => {
          const workflow = row.workflow;
          const lastCompletedIdx = getLastCompletedIndex(workflow);
          const stepProgress = workflow.stepProgress?.[step.id] || {};
          const isCompleted = colIndex <= lastCompletedIdx;
          const isCurrent = colIndex === lastCompletedIdx + 1 && stepProgress.status !== 'completed';

          return `workflow-matrix__cell workflow-matrix__cell--task ${
            isCompleted ? 'workflow-matrix__cell--completed' : ''
          } ${isCurrent ? 'workflow-matrix__cell--current' : ''}`;
        }
      });
    });

    return cols;
  }, [
    activeTemplate,
    columnWidths,
    taskColumnWidths,
    showDates,
    handleInitialsChange,
    handleDateChange,
    handleMicroToggle,
    handleSchoolClick,
    toggleWorkflowHidden,
    optimisticUpdates,
    optimisticallyHidden,
    workflowStepTasks,
    handleTaskClick
  ]);

  // ============================================================================
  // Transform workflows to rows array for react-data-grid
  // ============================================================================
  const rows = useMemo(() => {
    return filteredWorkflows.map(workflow => {
      const info = getWorkflowInfo(workflow);
      const progress = calculateProgress(workflow);

      return {
        id: workflow.id,
        workflow: workflow, // Keep full workflow object for cell access
        school: info.school,
        date: info.date,
        progress: progress
      };
    });
  }, [filteredWorkflows, getWorkflowInfo, calculateProgress]);

  // ============================================================================
  // Handle column resize for react-data-grid
  // ============================================================================
  const handleColumnResize = useCallback((columnKey, newWidth) => {
    if (columnKey.startsWith('task-')) {
      // Task column
      setTaskColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    } else {
      // Metadata column (school, date, progress)
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    }

    // Save to localStorage
    if (activeTemplate) {
      // Use setTimeout to batch rapid resize events
      setTimeout(() => {
        const storageKey = `workflow-matrix-widths-${activeTemplate.id}`;
        const widthsToSave = {
          columnWidths: columnKey.startsWith('task-') ? columnWidths : { ...columnWidths, [columnKey]: newWidth },
          taskColumnWidths: columnKey.startsWith('task-') ? { ...taskColumnWidths, [columnKey]: newWidth } : taskColumnWidths
        };
        localStorage.setItem(storageKey, JSON.stringify(widthsToSave));
      }, 100);
    }
  }, [activeTemplate, columnWidths, taskColumnWidths]);

  // Enhanced wheel handler for macOS trackpad horizontal scrolling
  const handleWheel = useCallback((e) => {
    const container = gridContainerRef.current;
    if (!container) return;

    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

    // Check if we have horizontal overflow
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
    const hasVerticalScroll = container.scrollHeight > container.clientHeight;

    // If there's actual deltaX (mouse wheel with shift, or some trackpads), use it
    if (deltaX !== 0 && hasHorizontalScroll) {
      e.preventDefault();
      container.scrollLeft += deltaX;
      return;
    }

    // macOS trackpad workaround: Shift+vertical scroll = horizontal scroll
    if (e.shiftKey && deltaY !== 0 && hasHorizontalScroll) {
      e.preventDefault();
      container.scrollLeft += deltaY;
      return;
    }

    // Smart detection: If scrolling vertically but at vertical limits,
    // and we have horizontal overflow, convert to horizontal scroll
    if (Math.abs(deltaY) > 0 && hasHorizontalScroll) {
      const atTop = container.scrollTop === 0;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

      // If at vertical limit and trying to scroll that direction, scroll horizontally instead
      if ((atTop && deltaY < 0) || (atBottom && deltaY > 0) || !hasVerticalScroll) {
        e.preventDefault();
        container.scrollLeft += deltaY;
        return;
      }
    }
  }, []);

  // Attach wheel event listener
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

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
        {tabs.tabs.map((tab, index) => {
          const colors = getTemplateColors(tab.name);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              draggable
              className={`workflow-matrix__tab ${isActive ? 'workflow-matrix__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              style={{
                color: isActive ? colors.main : '#6b7280',
                backgroundColor: isActive ? colors.hover : 'transparent',
                borderBottomColor: isActive ? colors.main : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = colors.light;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Orphaned Workflows Alert */}
      {tabs.orphanedWorkflows && tabs.orphanedWorkflows.length > 0 && (
        <div style={{
          margin: '1rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '0.125rem' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: '#991b1b'
            }}>
              {tabs.orphanedWorkflows.length} Orphaned Workflow{tabs.orphanedWorkflows.length !== 1 ? 's' : ''} Found
            </h4>
            <p style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              color: '#7f1d1d',
              lineHeight: '1.5'
            }}>
              The following workflows are linked to deleted templates and cannot function properly:
            </p>
            <ul style={{
              margin: '0 0 1rem 0',
              paddingLeft: '1.25rem',
              fontSize: '0.875rem',
              color: '#7f1d1d'
            }}>
              {tabs.orphanedWorkflows.slice(0, 5).map(wf => (
                <li key={wf.id} style={{ marginBottom: '0.25rem' }}>
                  {wf.schoolName || 'Unknown School'} (Template ID: {wf.templateId || 'Unknown'})
                </li>
              ))}
              {tabs.orphanedWorkflows.length > 5 && (
                <li style={{ fontStyle: 'italic' }}>
                  ...and {tabs.orphanedWorkflows.length - 5} more
                </li>
              )}
            </ul>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ${tabs.orphanedWorkflows.length} orphaned workflow${tabs.orphanedWorkflows.length !== 1 ? 's' : ''}? This action cannot be undone.`)) {
                    tabs.orphanedWorkflows.forEach(wf => {
                      deleteWorkflow(wf.id);
                    });
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <Trash2 size={16} />
                Delete All Orphaned Workflows
              </button>
              <a
                href="https://docs.example.com/orphaned-workflows"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  color: '#991b1b',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Learn more about workflow recovery
              </a>
            </div>
          </div>
        </div>
      )}

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

        <label className="workflow-matrix__checkbox">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed
        </label>

        <label className="workflow-matrix__checkbox">
          <input
            type="checkbox"
            checked={showHiddenOnly}
            onChange={(e) => setShowHiddenOnly(e.target.checked)}
          />
          Show hidden only
        </label>

        <label className="workflow-matrix__checkbox">
          <span style={{ marginRight: '8px' }}>Date range:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
          </select>
        </label>
      </div>

      {/* Grid container with react-data-grid */}
      <div className="workflow-matrix__grid-container" ref={gridContainerRef}>
        {/* react-data-grid with frozen columns */}
        {rows.length > 0 && (
          <DataGrid
            columns={columns}
            rows={rows}
            rowKeyGetter={(row) => row.id}
            rowHeight={showDates ? 140 : 90}
            onColumnResize={(idx, width) => {
              const column = columns[idx];
              handleColumnResize(column.key, width);
            }}
            className="workflow-matrix__data-grid"
          />
        )}
      </div>

      {rows.length === 0 && !loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <Inbox size={64} style={{ color: '#d1d5db', marginBottom: '1.5rem' }} />
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            No Workflows Found
          </h3>
          <p style={{
            margin: '0 0 1.5rem 0',
            fontSize: '0.9375rem',
            color: '#6b7280',
            maxWidth: '400px',
            lineHeight: '1.5'
          }}>
            {activeTemplate ?
              `No workflows have been created for "${activeTemplate.name}" yet. Workflows will appear here once you create them for your sessions.` :
              'Select a workflow template from the tabs above to view its workflows.'
            }
          </p>
          {activeTemplate && (
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: '#374151',
              maxWidth: '500px'
            }}>
              <strong>Tip:</strong> Workflows are automatically created when you start a new session and assign this workflow template to it.
            </div>
          )}
        </div>
      )}


      {/* Shoot Details Modal */}
      {selectedWorkflow && (
        <ShootDetailsModal
          workflow={selectedWorkflow}
          session={sessionData[selectedWorkflow.sessionId]}
          template={activeTemplate}
          school={schools.find(s => s.value === getWorkflowInfo(selectedWorkflow).school)}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setCurrentVideoData(null);
        }}
        videoUrl={currentVideoData?.url}
        title={currentVideoData?.title}
      />
    </div>
  );
};

export default WorkflowMatrixView;
