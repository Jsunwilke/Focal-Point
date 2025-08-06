// src/components/layout/Sidebar.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Navigation,
  School,
  Users,
  BarChart3,
  Settings,
  Trophy,
  FileText,
  Receipt,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Scan,
  MessageCircle,
  Image,
  ShoppingCart,
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ isOpen, onClose, isMobile, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, organization } = useAuth();

  // Check if user has admin/manager permissions
  const isAdminOrManager = userProfile?.role === 'admin' || userProfile?.role === 'manager';
  const isAdminOnly = userProfile?.role === 'admin';
  const isAccountant = userProfile?.isAccountant === true;

  // Navigation items with Lucide icons
  const navigationItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
      enabled: true,
    },
    {
      id: "schedule",
      label: "Schedule",
      icon: Calendar,
      path: "/schedule",
      enabled: true, // Now enabled
    },
    {
      id: "time-tracking",
      label: "Time Tracking",
      icon: Clock,
      path: "/time-tracking",
      enabled: true,
    },
    {
      id: "mileage",
      label: "Mileage",
      icon: Navigation,
      path: "/mileage",
      enabled: true,
    },
    {
      id: "workflows",
      label: "Workflows",
      icon: Workflow,
      path: "/workflows",
      enabled: true,
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageCircle,
      path: "/chat",
      enabled: true,
    },
    {
      id: "payroll",
      label: "Payroll",
      icon: Receipt,
      path: "/payroll-timesheets",
      enabled: true,
      adminOnly: true,
    },
    {
      id: "sports",
      label: "Sports",
      icon: Trophy,
      path: "/sports",
      enabled: true,
    },
    {
      id: "tracking",
      label: "Tracking",
      icon: Scan,
      path: "/tracking",
      enabled: true,
    },
    {
      id: "proofing",
      label: "Proofing",
      icon: Image,
      path: "/proofing",
      enabled: true,
    },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingCart,
      path: "/orders",
      enabled: true,
    },
    {
      id: "stats",
      label: "Stats",
      icon: BarChart3,
      path: "/stats",
      enabled: true,
      adminOnly: true,
    },
    {
      id: "daily-reports",
      label: "Daily Reports",
      icon: FileText,
      path: "/daily-reports",
      enabled: true,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/settings",
      enabled: true,
    },
  ];

  const handleNavigation = (item) => {
    if (item.enabled) {
      navigate(item.path);
      // Close mobile menu after navigation
      if (isMobile && onClose) {
        onClose();
      }
    }
  };

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={`sidebar ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && isOpen ? 'sidebar--open' : ''} ${!isMobile && isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        {organization?.logoURL ? (
          <div className="sidebar__logo-container">
            <img 
              src={organization.logoURL} 
              alt={`${organization.name} logo`}
              className="sidebar__logo-image"
            />
          </div>
        ) : (
          <>
            <h1 className="sidebar__logo">
              {organization?.name || 'iconik'}
            </h1>
            <p className="sidebar__subtitle">
              Studio Management
            </p>
          </>
        )}
        {!isMobile && (
          <button 
            className="sidebar__toggle" 
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar__nav-list">
          {console.log('Sidebar rendering - isAccountant:', userProfile?.isAccountant, 'role:', userProfile?.role)}
          {navigationItems
            .filter(item => {
              // If user is an accountant, only show payroll and settings
              // This takes priority even if they have admin role
              if (userProfile && userProfile.isAccountant === true) {
                return item.id === 'payroll' || item.id === 'settings';
              }
              // Otherwise, use existing logic
              return !item.adminOnly || isAdminOnly || isAdminOrManager;
            })
            .map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.id} className="sidebar__nav-item">
                <button
                  className={`sidebar__nav-link ${
                    isActive(item.path) ? "sidebar__nav-link--active" : ""
                  } ${!item.enabled ? "sidebar__nav-link--disabled" : ""}`}
                  onClick={() => handleNavigation(item)}
                  disabled={!item.enabled}
                  data-tooltip={item.label}
                  title={isCollapsed ? item.label : undefined}
                >
                  <IconComponent className="sidebar__nav-icon" size={20} />
                  <span className="sidebar__nav-label">{item.label}</span>
                  {!item.enabled && (
                    <span className="sidebar__nav-badge">Soon</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
