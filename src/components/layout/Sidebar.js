// src/components/layout/Sidebar.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useStreamChat } from "../../contexts/StreamChatContext";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Navigation,
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
  Camera,
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ isOpen, onClose, isMobile, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, organization } = useAuth();
  const { totalUnreadCount = 0 } = useStreamChat() || {};

  // Check if user has admin permissions
  const isAdminOnly = userProfile?.role === 'admin';

  // Top-level navigation items (Settings moved to bottom)
  const topLevelItems = [
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
  ];

  // Navigation sections with items (no longer collapsible, just visual grouping)
  const navigationSections = [
    {
      id: "employee",
      label: "Hours & Mileage",
      items: [
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
          id: "daily-reports",
          label: "Daily Reports",
          icon: FileText,
          path: "/daily-reports",
          enabled: true,
        },
      ],
    },
    {
      id: "photography",
      label: "Photography",
      items: [
        {
          id: "sports",
          label: "Sports",
          icon: Trophy,
          path: "/sports",
          enabled: true,
        },
        {
          id: "class-groups",
          label: "Class Groups",
          icon: Users,
          path: "/class-groups",
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
          id: "photo-critique",
          label: "Photo Critique",
          icon: Camera,
          path: "/photo-critique",
          enabled: true,
        },
      ],
    },
    {
      id: "business",
      label: "Business",
      items: [
        {
          id: "orders",
          label: "Orders",
          icon: ShoppingCart,
          path: "/orders",
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
          id: "stats",
          label: "Stats",
          icon: BarChart3,
          path: "/stats",
          enabled: true,
          adminOnly: true,
        },
      ],
    },
  ];

  // Settings item (separated to show at bottom)
  const settingsItem = {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/settings",
    enabled: true,
  };

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
          {/* Top-level items */}
          {topLevelItems
            .filter(item => {
              // If user is an accountant, skip these top items
              if (userProfile && userProfile.isAccountant === true) {
                return false;
              }
              return true;
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
                    {item.id === 'chat' && totalUnreadCount > 0 && (
                      <span className="sidebar__nav-badge sidebar__nav-badge--unread">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}

          {/* Navigation sections with always-visible items */}
          {navigationSections
            .filter(section => {
              // If user is an accountant, only show business section
              if (userProfile && userProfile.isAccountant === true) {
                return section.id === 'business';
              }
              return true;
            })
            .map((section) => {
              return (
                <li key={section.id} className="sidebar__nav-section">
                  <div className="sidebar__nav-section-header">
                    <span className="sidebar__nav-section-label">{section.label}</span>
                  </div>
                  
                  <ul className="sidebar__nav-section-list">
                    {section.items
                      .filter(item => {
                        // Filter admin-only items
                        return !item.adminOnly || isAdminOnly;
                      })
                      .map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <li key={item.id} className="sidebar__nav-section-item">
                            <button
                              className={`sidebar__nav-link sidebar__nav-link--sectioned ${
                                isActive(item.path) ? "sidebar__nav-link--active" : ""
                              } ${!item.enabled ? "sidebar__nav-link--disabled" : ""}`}
                              onClick={() => handleNavigation(item)}
                              disabled={!item.enabled}
                              data-tooltip={item.label}
                              title={isCollapsed ? item.label : undefined}
                            >
                              <IconComponent className="sidebar__nav-icon" size={18} />
                              <span className="sidebar__nav-label">{item.label}</span>
                              {!item.enabled && (
                                <span className="sidebar__nav-badge">Soon</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              );
            })}

          {/* Settings at the bottom with divider */}
          <li className="sidebar__nav-divider"></li>
          <li className="sidebar__nav-item">
            <button
              className={`sidebar__nav-link ${
                isActive(settingsItem.path) ? "sidebar__nav-link--active" : ""
              }`}
              onClick={() => handleNavigation(settingsItem)}
              data-tooltip={settingsItem.label}
              title={isCollapsed ? settingsItem.label : undefined}
            >
              <Settings className="sidebar__nav-icon" size={20} />
              <span className="sidebar__nav-label">{settingsItem.label}</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
