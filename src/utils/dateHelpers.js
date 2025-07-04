// Calculate school year for a given date
export const getSchoolYear = (date) => {
  const shootDate = date && date.toDate ? date.toDate() : new Date(date);
  const month = shootDate.getMonth(); // 0-11
  const year = shootDate.getFullYear();

  // School year starts in August (month 7)
  // If month is August-December, it's the start of the school year
  // If month is January-May, it's the end of the previous school year
  if (month >= 7) {
    // August to December
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // January to May
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// Get year for league jobs
export const getLeagueYear = (date) => {
  const shootDate = date && date.toDate ? date.toDate() : new Date(date);
  return shootDate.getFullYear().toString();
};

// Format date for display
export const formatDate = (date) => {
  const d = date && date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString();
};

// Format date for filename (MM-DD-YY)
export const formatDateForFilename = (date) => {
  const d = date && date.toDate ? date.toDate() : new Date(date);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const year = d.getFullYear().toString().slice(-2);
  return `${month}-${day}-${year}`;
};
