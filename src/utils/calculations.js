// Helper function to count valid athletes (those with last names)
export const countValidAthletes = (roster) => {
  if (!roster || !Array.isArray(roster)) return 0;
  return roster.filter(
    (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
  ).length;
};

// Helper function to count photographed athletes (those with image numbers)
export const countPhotographedAthletes = (roster) => {
  if (!roster || !Array.isArray(roster)) return 0;
  return roster.filter(
    (athlete) => athlete.imageNumbers && athlete.imageNumbers.trim() !== ""
  ).length;
};

// Generate unique ID for new entries
export const generateUniqueId = () => {
  return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
};

// Calculate job statistics
export const calculateJobStats = (roster) => {
  const stats = {
    sportStats: {},
    totalSports: 0,
    totalAthletes: 0,
    totalPhotographed: 0,
    overallPercentage: 0,
  };

  if (!roster || !Array.isArray(roster)) return stats;

  roster.forEach((athlete) => {
    // Only count athletes with last names (valid athletes)
    if (!athlete.lastName || athlete.lastName.trim() === "") return;

    const sport = athlete.group || "No Sport Assigned";

    if (!stats.sportStats[sport]) {
      stats.sportStats[sport] = {
        total: 0,
        photographed: 0,
      };
    }

    stats.sportStats[sport].total++;
    stats.totalAthletes++;

    if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
      stats.sportStats[sport].photographed++;
      stats.totalPhotographed++;
    }
  });

  stats.totalSports = Object.keys(stats.sportStats).length;
  stats.overallPercentage =
    stats.totalAthletes > 0
      ? Math.round((stats.totalPhotographed / stats.totalAthletes) * 100)
      : 0;

  return stats;
};

// Calculate organization-wide statistics
export const calculateOrganizationStats = (allJobs) => {
  const stats = {
    sportStats: {},
    seasonStats: {
      "Fall Sports": { total: 0, photographed: 0 },
      "Winter Sports": { total: 0, photographed: 0 },
      "Spring Sports": { total: 0, photographed: 0 },
    },
    totalSchools: new Set(),
    totalSports: 0,
    totalAthletes: 0,
    totalPhotographed: 0,
    totalShoots: 0,
    overallPercentage: 0,
  };

  if (!allJobs || !Array.isArray(allJobs)) return stats;

  // Track unique job IDs for shoot counting
  const processedJobs = new Set();

  allJobs.forEach((job) => {
    // Skip League jobs for organization stats
    if (job.seasonType === "League") return;

    // Only include Fall, Winter, and Spring Sports
    if (
      !["Fall Sports", "Winter Sports", "Spring Sports"].includes(
        job.seasonType
      )
    )
      return;

    // Count this job as a shoot
    if (job.id && !processedJobs.has(job.id)) {
      processedJobs.add(job.id);
      stats.totalShoots++;
    }

    // Track schools
    if (job.schoolName) {
      stats.totalSchools.add(job.schoolName);
    }

    // Process roster
    if (job.roster && Array.isArray(job.roster)) {
      job.roster.forEach((athlete) => {
        // Only count athletes with last names
        if (!athlete.lastName || athlete.lastName.trim() === "") return;

        // Exclude league sports based on common patterns
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

        const sportName = athlete.group || "No Sport Assigned";

        if (!stats.sportStats[sportName]) {
          stats.sportStats[sportName] = {
            total: 0,
            photographed: 0,
            shoots: new Set(),
            shootCount: 0,
            averagePhotographedPerShoot: 0,
          };
        }

        // Track which jobs this sport appears in
        if (job.id) {
          stats.sportStats[sportName].shoots.add(job.id);
        }

        stats.sportStats[sportName].total++;
        stats.totalAthletes++;

        if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
          stats.sportStats[sportName].photographed++;
          stats.totalPhotographed++;
        }

        // Track by season type
        if (job.seasonType && stats.seasonStats[job.seasonType]) {
          stats.seasonStats[job.seasonType].total++;
          if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
            stats.seasonStats[job.seasonType].photographed++;
          }
        }
      });
    }
  });

  // Process sport stats to calculate shoot counts and averages
  Object.keys(stats.sportStats).forEach((sport) => {
    const sportData = stats.sportStats[sport];
    sportData.shootCount = sportData.shoots.size;
    sportData.averagePhotographedPerShoot =
      sportData.shootCount > 0
        ? Math.round(sportData.photographed / sportData.shootCount)
        : 0;

    // Clean up the Set (not needed in final stats)
    delete sportData.shoots;
  });

  // Convert school Set to count
  stats.totalSchools = stats.totalSchools.size;
  stats.totalSports = Object.keys(stats.sportStats).length;

  // Calculate overall percentage
  stats.overallPercentage =
    stats.totalAthletes > 0
      ? Math.round((stats.totalPhotographed / stats.totalAthletes) * 100)
      : 0;

  return stats;
};

// Generate colors for charts
export const generateColors = (count) => {
  const colors = [
    "#ff6384",
    "#36a2eb",
    "#ffce56",
    "#4bc0c0",
    "#9966ff",
    "#ff9f40",
    "#ff6384",
    "#c9cbcf",
    "#4bc0c0",
    "#ff6384",
  ];
  return colors.slice(0, count);
};
