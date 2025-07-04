import React from "react";
import { calculateJobStats } from "../../../utils/calculations";

const JobStats = ({ job }) => {
  const stats = calculateJobStats(job.roster);

  if (job.seasonType === "League") {
    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">League Shoot Statistics</h6>
              <div className="row">
                <div className="col-md-4">
                  <strong>Total Athletes:</strong> {stats.totalAthletes}
                </div>
                <div className="col-md-4">
                  <strong>Photographed:</strong> {stats.totalPhotographed}
                </div>
                <div className="col-md-4">
                  <strong>Progress:</strong> {stats.overallPercentage}%
                </div>
              </div>
              <div className="progress mt-3" style={{ height: "25px" }}>
                <div
                  className={`progress-bar ${
                    stats.overallPercentage === 100
                      ? "bg-success"
                      : stats.overallPercentage >= 50
                      ? "bg-info"
                      : "bg-warning"
                  }`}
                  role="progressbar"
                  style={{ width: `${stats.overallPercentage}%` }}
                  aria-valuenow={stats.overallPercentage}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {stats.overallPercentage}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For Fall, Winter, Spring sports, show breakdown by sport
  const sortedSports = Object.keys(stats.sportStats).sort();

  if (sortedSports.length === 0) {
    return (
      <div className="col-12">
        <div className="alert alert-info">
          No sports data available for this shoot.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row">
        {sortedSports.map((sport) => {
          const sportStat = stats.sportStats[sport];
          const percentage =
            sportStat.total > 0
              ? Math.round((sportStat.photographed / sportStat.total) * 100)
              : 0;
          const progressClass =
            percentage === 100
              ? "bg-success"
              : percentage >= 50
              ? "bg-info"
              : "bg-warning";

          return (
            <div key={sport} className="col-md-6 mb-3">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">{sport || "No Sport Assigned"}</h6>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Athletes: {sportStat.total}</span>
                    <span>Photographed: {sportStat.photographed}</span>
                  </div>
                  <div className="progress" style={{ height: "20px" }}>
                    <div
                      className={`progress-bar ${progressClass}`}
                      role="progressbar"
                      style={{ width: `${percentage}%` }}
                      aria-valuenow={percentage}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      {percentage}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Summary */}
      <div className="row mt-3">
        <div className="col-12">
          <div className="card bg-light">
            <div className="card-body">
              <h6 className="card-title">Shoot Summary</h6>
              <div className="row">
                <div className="col-md-3">
                  <strong>Total Sports:</strong> {stats.totalSports}
                </div>
                <div className="col-md-3">
                  <strong>Total Athletes:</strong> {stats.totalAthletes}
                </div>
                <div className="col-md-3">
                  <strong>Photographed:</strong> {stats.totalPhotographed}
                </div>
                <div className="col-md-3">
                  <strong>Overall Progress:</strong> {stats.overallPercentage}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default JobStats;
