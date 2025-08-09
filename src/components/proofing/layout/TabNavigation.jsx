// src/components/proofing/layout/TabNavigation.jsx
import React from "react";
import { Image, Archive } from "lucide-react";

const TabNavigation = ({ activeTab, onTabChange, activeCount, archivedCount }) => {
  const tabs = [
    {
      id: "active",
      label: "Active Galleries",
      icon: Image,
      description: "Current proofing galleries",
      count: activeCount,
    },
    {
      id: "archived",
      label: "Archived Galleries",
      icon: Archive,
      description: "Completed proofing galleries",
      count: archivedCount,
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