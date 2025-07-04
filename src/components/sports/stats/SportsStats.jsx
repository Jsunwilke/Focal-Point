import React, { useState, useEffect } from "react";
import { useJobs } from "../../../contexts/JobsContext";
import { calculateOrganizationStats } from "../../../utils/calculations";
import LoadingSpinner from "../common/LoadingSpinner";
import { Button } from "react-bootstrap";

const SportsStats = () => {
  const { allJobs } = useJobs();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateStats();
  }, [allJobs]);

  const calculateStats = () => {
    setLoading(true);

    try {
      // Filter out League jobs for stats calculation
      const nonLeagueJobs = allJobs.filter(
        (job) => job.seasonType !== "League"
      );
      const calculatedStats = calculateOrganizationStats(nonLeagueJobs);
      setStats(calculatedStats);
    } catch (error) {
      console.error("Error calculating stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner text="Calculating organization-wide statistics..." />
    );
  }

  if (!stats) {
    return (
      <div className="alert alert-warning">
        <h6>Unable to calculate statistics</h6>
        <p className="mb-0">
          There was an error calculating organization statistics. Please try
          refreshing.
        </p>
      </div>
    );
  }

  if (stats.totalAthletes === 0) {
    return (
      <div className="alert alert-info">
        <h6>No Statistics Available</h6>
        <p className="mb-0">
          No sports statistics available. This may be because:
        </p>
        <ul className="mb-0 mt-2">
          <li>No athletes have been added to any jobs yet</li>
          <li>
            All jobs are League type (which are excluded from these stats)
          </li>
          <li>No athletes have sport/team assignments</li>
        </ul>
      </div>
    );
  }

  // Sort sports by completion percentage
  const sortedSports = Object.keys(stats.sportStats).sort((a, b) => {
    const statsA = stats.sportStats[a];
    const statsB = stats.sportStats[b];
    const percentageA =
      statsA.total > 0 ? (statsA.photographed / statsA.total) * 100 : 0;
    const percentageB =
      statsB.total > 0 ? (statsB.photographed / statsB.total) * 100 : 0;
    return percentageB - percentageA;
  });

  // Calculate email statistics
  const calculateEmailStats = () => {
    const emailStats = {
      totalWithEmails: 0,
      emailPercentage: 0,
      schoolEmailStats: {},
    };

    // Process all jobs to count emails
    const nonLeagueJobs = allJobs.filter((job) => job.seasonType !== "League");

    nonLeagueJobs.forEach((job) => {
      if (
        !["Fall Sports", "Winter Sports", "Spring Sports"].includes(
          job.seasonType
        )
      ) {
        return;
      }

      const schoolName = job.schoolName || "Unknown School";

      if (!emailStats.schoolEmailStats[schoolName]) {
        emailStats.schoolEmailStats[schoolName] = {
          totalAthletes: 0,
          athletesWithEmails: 0,
          emailPercentage: 0,
        };
      }

      if (job.roster && Array.isArray(job.roster)) {
        job.roster.forEach((athlete) => {
          // Only count athletes with last names (valid athletes)
          if (!athlete.lastName || athlete.lastName.trim() === "") return;

          // Exclude league sports
          const sport = (athlete.group || "").toLowerCase();
          const isLeagueSport =
            sport.includes("coach pitch") ||
            sport.includes("ll boys") ||
            sport.includes("ll girls") ||
            sport.includes("tee ball") ||
            sport.includes("little league") ||
            sport.includes("coach-pitch") ||
            sport.includes("t-ball");

          if (isLeagueSport) return;

          emailStats.schoolEmailStats[schoolName].totalAthletes++;

          if (athlete.email && athlete.email.trim() !== "") {
            emailStats.totalWithEmails++;
            emailStats.schoolEmailStats[schoolName].athletesWithEmails++;
          }
        });
      }
    });

    // Calculate percentages for schools
    Object.keys(emailStats.schoolEmailStats).forEach((school) => {
      const schoolData = emailStats.schoolEmailStats[school];
      if (schoolData.totalAthletes > 0) {
        schoolData.emailPercentage = Math.round(
          (schoolData.athletesWithEmails / schoolData.totalAthletes) * 100
        );
      }
    });

    // Calculate overall email percentage
    if (stats.totalAthletes > 0) {
      emailStats.emailPercentage = Math.round(
        (emailStats.totalWithEmails / stats.totalAthletes) * 100
      );
    }

    return emailStats;
  };

  // Calculate grade level statistics
  const calculateGradeLevelStats = () => {
    const gradeStats = {
      seniors: {
        total: 0,
        photographed: 0,
        percentage: 0,
      },
      eighthGraders: {
        total: 0,
        photographed: 0,
        percentage: 0,
      },
    };

    // Process all jobs to count grade levels
    const nonLeagueJobs = allJobs.filter((job) => job.seasonType !== "League");

    nonLeagueJobs.forEach((job) => {
      if (
        !["Fall Sports", "Winter Sports", "Spring Sports"].includes(
          job.seasonType
        )
      ) {
        return;
      }

      if (job.roster && Array.isArray(job.roster)) {
        job.roster.forEach((athlete) => {
          // Only count athletes with last names (valid athletes)
          if (!athlete.lastName || athlete.lastName.trim() === "") return;

          // Exclude league sports
          const sport = (athlete.group || "").toLowerCase();
          const isLeagueSport =
            sport.includes("coach pitch") ||
            sport.includes("ll boys") ||
            sport.includes("ll girls") ||
            sport.includes("tee ball") ||
            sport.includes("little league") ||
            sport.includes("coach-pitch") ||
            sport.includes("t-ball");

          if (isLeagueSport) return;

          const special = (athlete.teacher || "").toLowerCase().trim();
          const hasImages =
            athlete.imageNumbers && athlete.imageNumbers.trim() !== "";

          // Check for seniors (s)
          if (special === "s") {
            gradeStats.seniors.total++;
            if (hasImages) {
              gradeStats.seniors.photographed++;
            }
          }

          // Check for 8th graders (8)
          if (special === "8") {
            gradeStats.eighthGraders.total++;
            if (hasImages) {
              gradeStats.eighthGraders.photographed++;
            }
          }
        });
      }
    });

    // Calculate percentages
    if (gradeStats.seniors.total > 0) {
      gradeStats.seniors.percentage = Math.round(
        (gradeStats.seniors.photographed / gradeStats.seniors.total) * 100
      );
    }

    if (gradeStats.eighthGraders.total > 0) {
      gradeStats.eighthGraders.percentage = Math.round(
        (gradeStats.eighthGraders.photographed /
          gradeStats.eighthGraders.total) *
          100
      );
    }

    return gradeStats;
  };

  const emailStats = calculateEmailStats();
  const gradeStats = calculateGradeLevelStats();

  const generateTopEmailSchools = () => {
    return Object.entries(emailStats.schoolEmailStats)
      .filter(([school, data]) => data.totalAthletes > 0)
      .sort((a, b) => b[1].athletesWithEmails - a[1].athletesWithEmails)
      .slice(0, 5)
      .map(([school, data], index) => {
        const medalIcon =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";

        return (
          <div
            key={school}
            className="top-sport-item"
            style={{ minHeight: "50px", alignItems: "center" }}
          >
            <span className="sport-rank">{medalIcon}</span>
            <span className="sport-name">{school}</span>
            <span
              className="sport-progress"
              style={{
                minHeight: "50px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
                padding: "0 15px",
              }}
            >
              {data.athletesWithEmails} emails ({data.emailPercentage}%)
            </span>
          </div>
        );
      });
  };

  return (
    <div className="stats-dashboard">
      {/* Header with Key Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="stats-header-card">
            <div className="row text-center">
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">{stats.totalSchools}</div>
                  <div className="metric-label">Schools</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">{stats.totalSports}</div>
                  <div className="metric-label">Sports</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">{stats.totalAthletes}</div>
                  <div className="metric-label">Total Athletes</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">{stats.totalPhotographed}</div>
                  <div className="metric-label">Photographed</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">{stats.totalShoots}</div>
                  <div className="metric-label">Total Shoots</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="metric-card">
                  <div className="metric-number">
                    {stats.overallPercentage}%
                  </div>
                  <div className="metric-label">Completion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card performance-card">
            <div className="card-header">
              <h6 className="mb-0">📧 Schools with Most Emails</h6>
            </div>
            <div className="card-body">
              <div className="top-sports-list">{generateTopEmailSchools()}</div>
              {Object.keys(emailStats.schoolEmailStats).length === 0 && (
                <div className="text-muted text-center">
                  No email data available
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card performance-card">
            <div className="card-header">
              <h6 className="mb-0">📊 Email Statistics</h6>
            </div>
            <div className="card-body">
              <div className="efficiency-metrics">
                <div className="efficiency-item">
                  <div className="efficiency-label">
                    📧 Athletes with Emails
                  </div>
                  <div className="efficiency-value">
                    {emailStats.totalWithEmails}
                  </div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">📈 Email Coverage</div>
                  <div className="efficiency-value">
                    {emailStats.emailPercentage}%
                  </div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">📋 Total Athletes</div>
                  <div className="efficiency-value">{stats.totalAthletes}</div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">🏫 Schools with Emails</div>
                  <div className="efficiency-value">
                    {
                      Object.values(emailStats.schoolEmailStats).filter(
                        (school) => school.athletesWithEmails > 0
                      ).length
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card performance-card">
            <div className="card-header">
              <h6 className="mb-0">🎓 Grade Level Statistics</h6>
            </div>
            <div className="card-body">
              <div className="efficiency-metrics">
                <div className="efficiency-item">
                  <div className="efficiency-label">🎓 Total Seniors</div>
                  <div className="efficiency-value">
                    {gradeStats.seniors.total}
                  </div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">📸 Seniors Shot</div>
                  <div className="efficiency-value">
                    {gradeStats.seniors.percentage}%
                  </div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">🎒 Total 8th Graders</div>
                  <div className="efficiency-value">
                    {gradeStats.eighthGraders.total}
                  </div>
                </div>
                <div className="efficiency-item">
                  <div className="efficiency-label">📸 8th Graders Shot</div>
                  <div className="efficiency-value">
                    {gradeStats.eighthGraders.percentage}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sport Statistics */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">🏆 Detailed Sport Statistics</h6>
              <div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={calculateStats}
                >
                  <i className="bi bi-arrow-clockwise"></i> Refresh
                </Button>
              </div>
            </div>
            <div className="card-body">
              <small className="text-muted mb-3 d-block">
                Statistics for Fall, Winter, and Spring sports only (League
                shoots not included)
              </small>

              <div className="row">
                {sortedSports.map((sport) => {
                  const sportStat = stats.sportStats[sport];
                  const percentage = Math.round(
                    (sportStat.photographed / sportStat.total) * 100
                  );
                  const progressClass =
                    percentage === 100
                      ? "bg-success"
                      : percentage >= 80
                      ? "bg-info"
                      : percentage >= 50
                      ? "bg-warning"
                      : "bg-danger";
                  const completionStatus =
                    percentage === 100 ? "✅" : percentage >= 80 ? "🟡" : "🔴";

                  return (
                    <div key={sport} className="col-lg-6 mb-3">
                      <div className="sport-card">
                        <div className="sport-header">
                          <h6 className="sport-title">
                            {completionStatus} {sport || "No Sport Assigned"}
                          </h6>
                          <span
                            className={`completion-badge badge-${progressClass.replace(
                              "bg-",
                              ""
                            )}`}
                          >
                            {percentage}%
                          </span>
                        </div>
                        <div className="sport-metrics">
                          <div className="metric-row">
                            <div className="metric-item">
                              <span className="metric-value">
                                {sportStat.total}
                              </span>
                              <span className="metric-name">Athletes</span>
                            </div>
                            <div className="metric-item">
                              <span className="metric-value">
                                {sportStat.photographed}
                              </span>
                              <span className="metric-name">Shot</span>
                            </div>
                            <div className="metric-item">
                              <span className="metric-value">
                                {sportStat.shootCount}
                              </span>
                              <span className="metric-name">Shoots</span>
                            </div>
                            <div className="metric-item">
                              <span className="metric-value">
                                {sportStat.averagePhotographedPerShoot}
                              </span>
                              <span className="metric-name">Avg/Shoot</span>
                            </div>
                          </div>
                        </div>
                        <div className="progress-container">
                          <div className="progress sport-progress">
                            <div
                              className={`progress-bar ${progressClass}`}
                              role="progressbar"
                              style={{ width: `${percentage}%` }}
                              aria-valuenow={percentage}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportsStats;
