// src/components/layout/Layout.js
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ToastProvider } from "../../contexts/ToastContext";
import { useTask } from "../../contexts/TaskContext";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TaskPanel from "../tasks/TaskPanel";
import CreateTaskModal from "../tasks/CreateTaskModal";
import "./Layout.css";

const Layout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const location = useLocation();
  const { isPanelOpen, openPanel, closePanel } = useTask();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Close menu when switching to desktop
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse sidebar on workflow pages
  useEffect(() => {
    const isWorkflowPage = location.pathname.startsWith('/workflows');
    if (isWorkflowPage && !isMobile) {
      setIsSidebarCollapsed(true);
    } else if (!isMobile) {
      setIsSidebarCollapsed(false);
    }
  }, [location.pathname, isMobile]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    // Ctrl+K: Open new task modal
    'ctrl+k': () => {
      setIsCreateTaskModalOpen(true);
    },
    // Ctrl+/: Toggle task panel
    'ctrl+/': () => {
      if (isPanelOpen) {
        closePanel();
      } else {
        openPanel();
      }
    }
  });

  return (
    <ToastProvider>
      <div className={`layout ${!isMobile && isSidebarCollapsed ? 'layout--sidebar-collapsed' : ''}`}>
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          isMobile={isMobile}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        {isMobile && isMobileMenuOpen && (
          <div
            className="layout__backdrop"
            onClick={closeMobileMenu}
          />
        )}
        <div className="layout__main">
          <Header
            onMenuToggle={toggleMobileMenu}
            isMobile={isMobile}
          />
          <main className={`layout__content ${location.pathname === '/schedule' ? 'layout__content--schedule' : ''} ${location.pathname === '/chat' ? 'layout__content--chat' : ''} ${isPanelOpen ? 'layout__content--panel-open' : ''}`}>{children}</main>
        </div>
        <TaskPanel />
        <CreateTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
        />
      </div>
    </ToastProvider>
  );
};

export default Layout;
