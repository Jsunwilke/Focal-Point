// src/components/sports/layout/TabNavigation.jsx
import React from "react";
import { Play, CheckCircle, BarChart } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";

const TabNavigation = ({ activeTab, onTabChange }) => {
  const { getJobsByStatus } = useJobs();

  // Get job counts
  const activeJobsCount = getJobsByStatus(false).length;
  const completedJobsCount = getJobsByStatus(true).length;

  const tabs = [
    {
      id: "active",
      label: "Active Jobs",
      icon: Play,
      description: "Current sports photography sessions",
      count: activeJobsCount,
    },
    {
      id: "completed",
      label: "Completed Jobs",
      icon: CheckCircle,
      description: "Finished photography sessions",
      count: completedJobsCount,
    },
    {
      id: "stats",
      label: "Sports Stats",
      icon: BarChart,
      description: "Analytics and performance metrics",
      count: null, // No count for stats tab
    },
  ];

  return (
    <div className="tab-navigation">
      <nav role="tablist">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              title={tab.description}
            >
              <IconComponent size={16} />
              <span>
                {tab.label}
                {tab.count !== null && (
                  <span className="tab-count">({tab.count})</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default TabNavigation;
