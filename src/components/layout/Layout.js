// src/components/layout/Layout.js
import React from "react";
import { ToastProvider } from "../../contexts/ToastContext";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./Layout.css";

const Layout = ({ children }) => {
  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar />
        <div className="layout__main">
          <Header />
          <main className="layout__content">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default Layout;
