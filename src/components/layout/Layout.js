// src/components/layout/Layout.js
import React, { useState, useEffect } from "react";
import { ToastProvider } from "../../contexts/ToastContext";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./Layout.css";

const Layout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={closeMobileMenu}
          isMobile={isMobile}
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
          <main className="layout__content">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default Layout;
