// src/components/sports/SportsMainApp.jsx
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useJobs } from "../../contexts/JobsContext";
import TabNavigation from "./layout/TabNavigation";
import JobList from "./jobs/JobList";
import SearchControls from "./search/SearchControls";
import PlayerSearchResults from "./search/PlayerSearchResults";
import SportsStats from "./stats/SportsStats";
import CreateJobModal from "./jobs/CreateJobModal";
import ViewJobModal from "./jobs/ViewJobModal";
import LoadingSpinner from "./common/LoadingSpinner";

const SportsMainApp = () => {
  const { userProfile, organization } = useAuth();
  const { loading } = useJobs();
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [highlightPlayerId, setHighlightPlayerId] = useState(null);

  const [searchState, setSearchState] = useState({
    isActive: false,
    type: "jobs",
    query: "",
    results: [],
  });

  // Show loading spinner while data is loading
  if (loading) {
    return (
      <div className="empty-state">
        <LoadingSpinner text="Loading Sports Shoot Manager..." />
      </div>
    );
  }

  const handleViewJob = (jobId, playerId = null) => {
    setSelectedJobId(jobId);
    setHighlightPlayerId(playerId);
    setShowViewModal(true);
  };

  const handleCreateJob = () => {
    setShowCreateModal(true);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Reset search when changing tabs
    if (searchState.isActive) {
      setSearchState({
        isActive: false,
        type: "jobs",
        query: "",
        results: [],
      });
    }
  };

  return (
    <div className="sports-container">
      {/* Header */}
      <div className="sports-header">
        <div>
          <h1>Sports Shoot Manager</h1>
          <p>
            Managing sports for{" "}
            <span style={{ fontWeight: 600 }}>{organization?.name}</span>
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleCreateJob}>
            <Plus size={16} />
            Create New Job
          </button>
        </div>
      </div>

      <SearchControls
        searchState={searchState}
        setSearchState={setSearchState}
        activeTab={activeTab}
      />

      {searchState.isActive && searchState.type === "players" && (
        <PlayerSearchResults
          results={searchState.results}
          query={searchState.query}
          onViewJob={handleViewJob}
          onClose={() =>
            setSearchState((prev) => ({ ...prev, isActive: false }))
          }
        />
      )}

      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="tab-content">
        <div
          className={`tab-pane ${activeTab === "active" ? "show active" : ""}`}
        >
          <JobList
            isArchived={false}
            viewMode="flat"
            searchState={searchState}
            onViewJob={handleViewJob}
          />
        </div>

        <div
          className={`tab-pane ${
            activeTab === "completed" ? "show active" : ""
          }`}
        >
          <JobList
            isArchived={true}
            viewMode="folders"
            searchState={searchState}
            onViewJob={handleViewJob}
          />
        </div>

        <div
          className={`tab-pane ${activeTab === "stats" ? "show active" : ""}`}
        >
          <SportsStats />
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateJobModal
          show={showCreateModal}
          onHide={() => setShowCreateModal(false)}
        />
      )}

      {showViewModal && (
        <ViewJobModal
          show={showViewModal}
          onHide={() => {
            setShowViewModal(false);
            setSelectedJobId(null);
            setHighlightPlayerId(null);
          }}
          jobId={selectedJobId}
          highlightPlayerId={highlightPlayerId}
        />
      )}
    </div>
  );
};

export default SportsMainApp;
