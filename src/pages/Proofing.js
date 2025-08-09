// src/pages/Proofing.js
import React from "react";
import ProofingMainApp from "../components/proofing/ProofingMainApp";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/sports/tables.css";
import "../styles/sports/cards.css";
import "./Proofing.css";

const Proofing = () => {
  return (
    <div className="proofing-page">
      <ProofingMainApp />
    </div>
  );
};

export default Proofing;