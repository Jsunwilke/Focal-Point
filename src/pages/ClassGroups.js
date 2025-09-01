// src/pages/ClassGroups.js
import React from "react";
import { ClassGroupsProvider } from "../contexts/ClassGroupsContext";
import ClassGroupsMainApp from "../components/classGroups/ClassGroupsMainApp";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/classGroups.css";

const ClassGroups = () => {
  return (
    <div className="class-groups-page">
      <ClassGroupsProvider>
        <ClassGroupsMainApp />
      </ClassGroupsProvider>
    </div>
  );
};

export default ClassGroups;