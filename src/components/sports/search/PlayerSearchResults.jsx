// src/components/sports/search/PlayerSearchResults.jsx
import React, { useMemo } from "react";
import { CheckCircle, Search, Eye } from "lucide-react";
import { formatDate } from "../../../utils/dateHelpers";

const PlayerSearchResults = ({ results, query, onViewJob, onClose }) => {
  // Group results by job for better organization
  const resultsByJob = useMemo(() => {
    const grouped = {};

    results.forEach((result) => {
      if (!grouped[result.jobId]) {
        grouped[result.jobId] = {
          jobId: result.jobId,
          schoolName: result.schoolName,
          seasonType: result.seasonType,
          sportName: result.sportName,
          shootDate: result.shootDate,
          isArchived: result.isArchived,
          exactMatches: [],
          similarMatches: [],
        };
      }

      // Separate exact and similar matches
      if (result.matchType === "exact") {
        grouped[result.jobId].exactMatches.push(result.player);
      } else {
        grouped[result.jobId].similarMatches.push(result.player);
      }
    });

    // Convert to array and sort by date (newest first)
    return Object.values(grouped).sort((a, b) => {
      const dateA = a.shootDate?.toDate
        ? a.shootDate.toDate()
        : new Date(a.shootDate);
      const dateB = b.shootDate?.toDate
        ? b.shootDate.toDate()
        : new Date(b.shootDate);
      return dateB - dateA;
    });
  }, [results]);

  const handleViewJob = (jobId, player) => {
    onViewJob(jobId, player.id);
  };

  // Count total exact and similar matches
  const exactCount = results.filter((r) => r.matchType === "exact").length;
  const similarCount = results.filter((r) => r.matchType === "similar").length;

  if (results.length === 0) {
    return (
      <div className="mt-3">
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Player Search Results</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="card-body">
            <div className="alert alert-info mb-0">
              No players found matching "{query}".
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Player Search Results</h5>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
          ></button>
        </div>
        <div className="card-body">
          <div className="player-search-summary mb-3">
            <p className="mb-1">
              Found {results.length} player(s) matching "{query}" across{" "}
              {resultsByJob.length} job(s).
            </p>
            {similarCount > 0 && (
              <p className="mb-1 text-muted">
                <Search size={14} className="me-1" /> {exactCount} exact
                matches, {similarCount} similar matches
              </p>
            )}
          </div>

          {resultsByJob.map((job) => {
            const seasonTypeDisplay = job.seasonType || job.sportName || "";
            const sportDisplay =
              job.sportName && job.seasonType ? ` - ${job.sportName}` : "";
            const allPlayers = [...job.exactMatches, ...job.similarMatches];

            return (
              <div key={job.jobId} className="job-player-results mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">
                    {job.schoolName} - {seasonTypeDisplay}
                    {sportDisplay}
                  </h6>
                  <span
                    className={`badge ${
                      job.isArchived ? "bg-success" : "bg-primary"
                    }`}
                  >
                    {job.isArchived ? "Completed" : "Active"}
                  </span>
                </div>

                <p className="text-muted mb-2">
                  <Search size={14} className="me-1" />{" "}
                  {formatDate(job.shootDate)}
                </p>

                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Match</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Teacher</th>
                        <th>Group</th>
                        <th>Images</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Exact matches first */}
                      {job.exactMatches.map((player, index) => (
                        <tr
                          key={`exact-${job.jobId}-${index}`}
                          className="table-success"
                        >
                          <td>
                            <span className="badge bg-success d-flex align-items-center gap-1">
                              <CheckCircle size={12} /> Exact
                            </span>
                          </td>
                          <td>{player.lastName || ""}</td>
                          <td>{player.firstName || ""}</td>
                          <td>{player.teacher || ""}</td>
                          <td>{player.group || ""}</td>
                          <td>{player.imageNumbers || ""}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                              onClick={() => handleViewJob(job.jobId, player)}
                            >
                              <Eye size={14} /> View Job
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Similar matches second */}
                      {job.similarMatches.map((player, index) => (
                        <tr
                          key={`similar-${job.jobId}-${index}`}
                          className="table-warning"
                        >
                          <td>
                            <span className="badge bg-warning text-dark d-flex align-items-center gap-1">
                              <Search size={12} /> Similar
                            </span>
                          </td>
                          <td>{player.lastName || ""}</td>
                          <td>{player.firstName || ""}</td>
                          <td>{player.teacher || ""}</td>
                          <td>{player.group || ""}</td>
                          <td>{player.imageNumbers || ""}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                              onClick={() => handleViewJob(job.jobId, player)}
                            >
                              <Eye size={14} /> View Job
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlayerSearchResults;
