// Calculate school year for a given date
export const getSchoolYear = (date) => {
  const shootDate = date && date.toDate ? date.toDate() : new Date(date);
  const month = shootDate.getMonth(); // 0-11
  const day = shootDate.getDate();
  const year = shootDate.getFullYear();

  // School year starts July 15th and ends June 1st
  // If date is July 15th or later, it's the start of the school year
  // If date is before July 15th, it's the end of the previous school year
  if (month > 6 || (month === 6 && day >= 15)) {
    // July 15th or later
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // Before July 15th
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
