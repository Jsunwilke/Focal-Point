// src/pages/Dashboard.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import TimeTrackingWidget from "../components/dashboard/TimeTrackingWidget";
import PTOBalanceWidget from "../components/dashboard/PTOBalanceWidget";
import HoursTrackingWidget from "../components/dashboard/HoursTrackingWidget";
import UpcomingSessionsWidget from "../components/dashboard/UpcomingSessionsWidget";
import ReadCounterWidget from "../components/dashboard/ReadCounterWidget";
import SessionDetailsModal from "../components/sessions/SessionDetailsModal";
import EditSessionModal from "../components/sessions/EditSessionModal";
import { getTeamMembers } from "../firebase/firestore";
import "./Dashboard.css";

const Dashboard = () => {
  const { userProfile, organization } = useAuth();
  
  // Session modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  // Load team members for the session modal
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (organization?.id) {
        try {
          const members = await getTeamMembers(organization.id);
          setTeamMembers(members);
        } catch (error) {
          console.error('Error loading team members:', error);
        }
      }
    };

    loadTeamMembers();
  }, [organization?.id]);

  // Handle session click to open details modal
  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setShowDetailsModal(true);
  };

  // Handle edit session
  const handleEditSession = () => {
    setShowDetailsModal(false);
    setShowEditModal(true);
  };

  // Handle session update (from edit modal)
  const handleUpdateSession = () => {
    setShowEditModal(false);
    setSelectedSession(null);
    // Note: No need to refresh data as widgets handle their own data loading
  };

  // Widget configuration - organized by columns
  const defaultWidgets = {
    column1: [
      { id: 'time-tracking', component: TimeTrackingWidget, props: {} },
      { id: 'pto-balance', component: PTOBalanceWidget, props: {} },
      { id: 'read-counter', component: ReadCounterWidget, props: {} }
    ],
    column2: [
      { id: 'hours-tracking', component: HoursTrackingWidget, props: {} },
      { id: 'upcoming-sessions', component: UpcomingSessionsWidget, props: { onSessionClick: handleSessionClick } },
      { id: 'placeholder-1', component: null, props: {} }
    ]
  };

  // Migration helper for old localStorage format
  const migrateOldFormat = (oldData) => {
    if (Array.isArray(oldData)) {
      // Old format was array - convert to column structure
      console.log('Migrating old widget format to column structure');
      return {
        column1: [
          defaultWidgets.column1[0], // time-tracking
          defaultWidgets.column1[1], // pto-balance
          defaultWidgets.column1[2]  // read-counter
        ],
        column2: [
          defaultWidgets.column2[0], // hours-tracking
          defaultWidgets.column2[1], // upcoming-sessions
          defaultWidgets.column2[2]  // placeholder-1
        ]
      };
    }
    // If migrating from old column structure - add read-counter if missing
    if (oldData.column1 && oldData.column2) {
      const filteredColumn1 = oldData.column1.filter(w => w.id !== 'placeholder-2');
      const filteredColumn2 = oldData.column2.filter(w => w.id !== 'placeholder-2');
      
      // Add read-counter widget if not present
      if (!filteredColumn1.find(w => w.id === 'read-counter')) {
        filteredColumn1.push(defaultWidgets.column1[2]); // Add read-counter
      }
      
      // Keep only one placeholder in column2
      if (!filteredColumn2.find(w => w.id === 'placeholder-1')) {
        filteredColumn2.push(defaultWidgets.column2[2]); // Add placeholder-1
      }
      
      return {
        column1: filteredColumn1,
        column2: filteredColumn2
      };
    }
    return oldData;
  };

  // Resolve widget component references
  const resolveWidget = (widget) => {
    const allDefaultWidgets = [...defaultWidgets.column1, ...defaultWidgets.column2];
    const defaultWidget = allDefaultWidgets.find(w => w.id === widget.id);
    
    return {
      ...widget,
      component: widget.component || defaultWidget?.component || null,
      props: widget.id === 'upcoming-sessions' 
        ? { onSessionClick: handleSessionClick }
        : (widget.props || defaultWidget?.props || {})
    };
  };

  // Widget state and drag & drop (column-based)
  const [widgets, setWidgets] = useState(() => {
    const savedOrder = localStorage.getItem('dashboard-widget-order');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        const migratedOrder = migrateOldFormat(parsedOrder);
        
        // Ensure we have column structure and resolve widget components
        if (migratedOrder && typeof migratedOrder === 'object' && !Array.isArray(migratedOrder)) {
          const resolvedOrder = {
            column1: (migratedOrder.column1 || defaultWidgets.column1).map(resolveWidget),
            column2: (migratedOrder.column2 || defaultWidgets.column2).map(resolveWidget)
          };
          
          // Verify all widgets have valid components or are placeholders
          const isValidColumn = (column) => column.every(widget => 
            widget.component !== undefined && (widget.component === null || typeof widget.component === 'function')
          );
          
          if (isValidColumn(resolvedOrder.column1) && isValidColumn(resolvedOrder.column2)) {
            return resolvedOrder;
          } else {
            console.warn('Invalid widget configuration found, resetting to defaults');
          }
        }
      } catch (error) {
        console.error('Error parsing saved widget order:', error);
        // Clear invalid localStorage
        localStorage.removeItem('dashboard-widget-order');
      }
    }
    return defaultWidgets;
  });

  const [draggedWidget, setDraggedWidget] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Update widget order in localStorage
  const saveWidgetOrder = (newWidgets) => {
    try {
      localStorage.setItem('dashboard-widget-order', JSON.stringify(newWidgets));
    } catch (error) {
      console.error('Error saving widget order:', error);
    }
  };

  // Drag and drop handlers (intelligent positioning)
  const handleDragStart = (e, widget, columnId, index) => {
    setDraggedWidget({ widget, columnId, index });
    e.dataTransfer.effectAllowed = "move";
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedWidget(null);
    setDragOver(null);
  };

  // Calculate drop position based on mouse position within widget
  const calculateDropPosition = (e, columnId, widgetIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const widgetCenter = rect.top + rect.height / 2;
    
    // If mouse is in upper half, insert before current widget
    // If mouse is in lower half, insert after current widget
    const insertIndex = mouseY < widgetCenter ? widgetIndex : widgetIndex + 1;
    
    return { columnId, index: insertIndex };
  };

  const handleWidgetDragOver = (e, columnId, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    const dropPosition = calculateDropPosition(e, columnId, index);
    setDragOver(dropPosition);
  };

  // Drop zone specific handlers
  const handleDropZoneDragOver = (e, columnId, insertIndex) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOver({ columnId, index: insertIndex, isDropZone: true });
  };

  const handleDropZoneDrop = (e, columnId, insertIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedWidget) {
      setDragOver(null);
      return;
    }

    const { columnId: sourceColumnId, index: sourceIndex } = draggedWidget;
    
    // Calculate actual insert position accounting for removal
    let actualInsertIndex = insertIndex;
    if (sourceColumnId === columnId && sourceIndex < insertIndex) {
      actualInsertIndex = insertIndex - 1;
    }

    const newWidgets = { ...widgets };
    
    // Remove from source column
    const [draggedItem] = newWidgets[sourceColumnId].splice(sourceIndex, 1);
    
    // Insert at specific position in target column
    newWidgets[columnId].splice(actualInsertIndex, 0, draggedItem);
    
    setWidgets(newWidgets);
    saveWidgetOrder(newWidgets);
    setDragOver(null);
  };

  const handleDragLeave = (e) => {
    // Only clear drag over if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  };

  // Handle drop on widget (intelligent positioning)
  const handleWidgetDrop = (e, dropColumnId, dropIndex) => {
    e.preventDefault();
    
    if (!draggedWidget) {
      setDragOver(null);
      return;
    }

    const { columnId: sourceColumnId, index: sourceIndex } = draggedWidget;
    const dropPosition = calculateDropPosition(e, dropColumnId, dropIndex);
    const actualDropIndex = dropPosition.index;
    
    // If dropping in same position, do nothing
    if (sourceColumnId === dropColumnId && sourceIndex === actualDropIndex) {
      setDragOver(null);
      return;
    }

    const newWidgets = { ...widgets };
    
    // Remove from source column
    const [draggedItem] = newWidgets[sourceColumnId].splice(sourceIndex, 1);
    
    // Calculate adjusted insert position if moving within same column
    let adjustedInsertIndex = actualDropIndex;
    if (sourceColumnId === dropColumnId && sourceIndex < actualDropIndex) {
      adjustedInsertIndex = actualDropIndex - 1;
    }
    
    // Add to target column
    newWidgets[dropColumnId].splice(adjustedInsertIndex, 0, draggedItem);
    
    setWidgets(newWidgets);
    saveWidgetOrder(newWidgets);
    setDragOver(null);
  };

  // Column-level drag handlers for empty columns
  const handleColumnDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Only set drag over for empty columns or between widgets
    const columnWidgets = widgets[columnId];
    if (columnWidgets.length === 0) {
      setDragOver({ columnId, index: 0 });
    }
  };

  const handleColumnDrop = (e, columnId) => {
    e.preventDefault();
    
    if (!draggedWidget) {
      setDragOver(null);
      return;
    }

    const { columnId: sourceColumnId, index: sourceIndex } = draggedWidget;
    const targetColumn = widgets[columnId];
    
    // If dropping on empty column, add to end
    if (targetColumn.length === 0) {
      const newWidgets = { ...widgets };
      
      // Remove from source column
      const [draggedItem] = newWidgets[sourceColumnId].splice(sourceIndex, 1);
      
      // Add to target column
      newWidgets[columnId].push(draggedItem);
      
      setWidgets(newWidgets);
      saveWidgetOrder(newWidgets);
    }
    
    setDragOver(null);
  };

  // Render widget component
  const renderWidget = (widget) => {
    if (!widget.component) {
      // Render placeholder
      return (
        <div className="dashboard__placeholder">
          <div className="placeholder-content">
            <h3>Coming Soon</h3>
            <p>More dashboard widgets coming soon!</p>
          </div>
        </div>
      );
    }

    const Component = widget.component;
    return <Component {...widget.props} />;
  };

  // Render visual drop indicator
  const renderDropIndicator = (columnId, insertIndex) => {
    const isActive = draggedWidget && dragOver?.columnId === columnId && 
                    dragOver?.index === insertIndex;
    
    if (!isActive) return null;
    
    return (
      <div
        key={`indicator-${columnId}-${insertIndex}`}
        style={{
          height: '3px',
          margin: '4px 0',
          background: 'var(--primary-color, #2563eb)',
          borderRadius: '2px',
          transition: 'all 0.2s ease',
          opacity: 0.8
        }}
      />
    );
  };

  // Render column with widgets
  const renderColumn = (columnId, columnWidgets) => {
    const isEmptyColumn = columnWidgets.length === 0;
    const isColumnDragOver = dragOver?.columnId === columnId && isEmptyColumn;
    
    if (isEmptyColumn) {
      return (
        <div 
          className={`dashboard__column ${isColumnDragOver ? 'column-drag-over' : ''}`}
          onDragOver={(e) => handleColumnDragOver(e, columnId)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleColumnDrop(e, columnId)}
          style={{
            minHeight: '200px',
            border: isColumnDragOver ? '2px dashed var(--primary-color, #2563eb)' : '2px solid transparent',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            padding: 'var(--spacing-md)'
          }}
        >
          <div className="empty-column-drop-zone">
            <div className="drop-zone-content">
              <span>Drop widgets here</span>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="dashboard__column">
        {/* Drop indicator before first widget */}
        {renderDropIndicator(columnId, 0)}
        
        {columnWidgets.map((widget, index) => {
          const isDragged = draggedWidget?.columnId === columnId && draggedWidget?.index === index;
          
          return (
            <div key={`widget-container-${widget.id}`}>
              {/* Widget container with intelligent drop zones */}
              <div
                className={`dashboard__widget-container ${isDragged ? 'dragging' : ''}`}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, widget, columnId, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleWidgetDragOver(e, columnId, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleWidgetDrop(e, columnId, index)}
                style={{
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  opacity: isDragged ? 0.5 : 1,
                  border: '2px solid transparent',
                  borderRadius: '8px',
                  cursor: 'grab'
                }}
              >
                {renderWidget(widget)}
              </div>
              
              {/* Drop indicator after this widget */}
              {renderDropIndicator(columnId, index + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard__content">
        {/* Two independent columns with drag & drop */}
        {renderColumn('column1', widgets.column1)}
        {renderColumn('column2', widgets.column2)}
      </div>

      {/* Session Details Modal */}
      {showDetailsModal && selectedSession && (
        <SessionDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSession(null);
          }}
          session={selectedSession}
          teamMembers={teamMembers}
          userProfile={userProfile}
          organization={organization}
          onEditSession={handleEditSession}
          hideEditButton={true}
        />
      )}

      {/* Edit Session Modal */}
      {showEditModal && selectedSession && (
        <EditSessionModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSession(null);
          }}
          onSubmit={handleUpdateSession}
          existingSession={selectedSession}
          teamMembers={teamMembers}
          userProfile={userProfile}
          organization={organization}
        />
      )}
    </div>
  );
};

export default Dashboard;
