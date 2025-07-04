// src/pages/Sports.js
import React from "react";
import { JobsProvider } from "../contexts/JobsContext";
import { ToastProvider } from "../contexts/ToastContext";
import SportsMainApp from "../components/sports/SportsMainApp";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/sports/tables.css"; // Your exact tables.css file
import "../styles/sports/cards.css"; // Your exact cards.css file
import "./Sports.css";

const Sports = () => {
  return (
    <div className="sports-page">
      <ToastProvider>
        <JobsProvider>
          <SportsMainApp />
        </JobsProvider>
      </ToastProvider>
    </div>
  );
};

export default Sports;
