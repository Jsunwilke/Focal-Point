// src/pages/Dashboard.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import TimeTrackingWidget from "../components/dashboard/TimeTrackingWidget";
import PTOBalanceWidget from "../components/dashboard/PTOBalanceWidget";
import HoursTrackingWidget from "../components/dashboard/HoursTrackingWidget";
import UpcomingSessionsWidget from "../components/dashboard/UpcomingSessionsWidget";
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

  // Widget configuration
  const defaultWidgets = [
    { id: 'time-tracking', component: TimeTrackingWidget, props: {} },
    { id: 'pto-balance', component: PTOBalanceWidget, props: {} },
    { id: 'hours-tracking', component: HoursTrackingWidget, props: {} },
    { id: 'upcoming-sessions', component: UpcomingSessionsWidget, props: { onSessionClick: handleSessionClick } },
    { id: 'placeholder-1', component: null, props: {} },
    { id: 'placeholder-2', component: null, props: {} }
  ];

  // Widget state and drag & drop
  const [widgets, setWidgets] = useState(() => {
    const savedOrder = localStorage.getItem('dashboard-widget-order');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Ensure we have all widgets and update props for upcoming-sessions
        const orderedWidgets = parsedOrder.map(savedWidget => {
          const defaultWidget = defaultWidgets.find(w => w.id === savedWidget.id);
          if (savedWidget.id === 'upcoming-sessions') {
            return { ...savedWidget, props: { onSessionClick: handleSessionClick } };
          }
          return defaultWidget || savedWidget;
        });
        
        // Add any new widgets that weren't in saved order
        defaultWidgets.forEach(defaultWidget => {
          if (!orderedWidgets.find(w => w.id === defaultWidget.id)) {
            orderedWidgets.push(defaultWidget);
          }
        });
        
        return orderedWidgets;
      } catch (error) {
        console.error('Error parsing saved widget order:', error);
        return defaultWidgets;
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

  // Drag and drop handlers
  const handleDragStart = (e, widget, index) => {
    setDraggedWidget({ widget, index });
    e.dataTransfer.effectAllowed = "move";
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedWidget(null);
    setDragOver(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  };

  const handleDragLeave = (e) => {
    // Only clear drag over if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedWidget || draggedWidget.index === dropIndex) {
      setDragOver(null);
      return;
    }

    const newWidgets = [...widgets];
    const [draggedItem] = newWidgets.splice(draggedWidget.index, 1);
    newWidgets.splice(dropIndex, 0, draggedItem);
    
    setWidgets(newWidgets);
    saveWidgetOrder(newWidgets);
    setDragOver(null);
  };

  // Render widget component
  const renderWidget = (widget, index) => {
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

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1 className="dashboard__title">
          Welcome back, {userProfile?.firstName}
        </h1>
        <p className="dashboard__subtitle">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      <div className="dashboard__content">
        {/* Dynamic widget rows with drag & drop */}
        {Array.from({ length: Math.ceil(widgets.length / 2) }, (_, rowIndex) => (
          <div key={rowIndex} className="dashboard__row">
            {widgets.slice(rowIndex * 2, rowIndex * 2 + 2).map((widget, colIndex) => {
              const widgetIndex = rowIndex * 2 + colIndex;
              const isDragOver = dragOver === widgetIndex;
              const isDragged = draggedWidget?.index === widgetIndex;
              
              return (
                <div
                  key={widget.id}
                  className={`dashboard__widget-container ${isDragOver ? 'drag-over' : ''} ${isDragged ? 'dragging' : ''}`}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, widget, widgetIndex)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, widgetIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widgetIndex)}
                  style={{
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    opacity: isDragged ? 0.5 : 1,
                    transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                    border: isDragOver ? '2px dashed var(--primary-color, #2563eb)' : '2px solid transparent',
                    borderRadius: '8px',
                    cursor: 'grab'
                  }}
                >
                  {renderWidget(widget, widgetIndex)}
                </div>
              );
            })}
          </div>
        ))}
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
