import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Generate filename for export based on job data
export const generateExportFileName = (job) => {
  const schoolName = job.schoolName || "Unknown School";
  const seasonType = job.seasonType || job.sportName || "Unknown Season";

  // Format date as MM-DD-YY
  const date = job.shootDate?.toDate
    ? job.shootDate.toDate()
    : new Date(job.shootDate);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  const dateStr = `${month}-${day}-${year}`;

  return `${schoolName} ${seasonType} ${dateStr}`;
};

// Convert string to ArrayBuffer for Excel export
export const stringToArrayBuffer = (s) => {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
};

// Transform roster data for export (mapping field names)
export const transformRosterForExport = (rosterData) => {
  return rosterData.map((entry) => ({
    Name: entry.lastName || "",
    "Subject ID": entry.firstName || "",
    Special: entry.teacher || "",
    "Sport/Team": entry.group || "",
    Email: entry.email || "",
    Phone: entry.phone || "",
    Images: entry.imageNumbers || "",
    Notes: entry.notes || "",
  }));
};

// Transform groups data for export
export const transformGroupsForExport = (groupsData) => {
  return groupsData.map((group) => ({
    Description: group.description || "",
    "Image Numbers": group.imageNumbers || "",
    Notes: group.notes || "",
  }));
};

// Export to Excel format
export const exportToExcel = async (
  job,
  rosterData = [],
  groupsData = [],
  options = { roster: true, groups: true }
) => {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add roster sheet if selected and data exists
    if (options.roster && rosterData.length > 0) {
      const transformedRoster = transformRosterForExport(rosterData);
      const rosterWs = XLSX.utils.json_to_sheet(transformedRoster);
      XLSX.utils.book_append_sheet(wb, rosterWs, "Athletes Roster");
    }

    // Add groups sheet if selected and data exists
    if (options.groups && groupsData.length > 0) {
      const transformedGroups = transformGroupsForExport(groupsData);
      const groupsWs = XLSX.utils.json_to_sheet(transformedGroups);
      XLSX.utils.book_append_sheet(wb, groupsWs, "Group Images");
    }

    // Generate filename and export
    const fileName = generateExportFileName(job);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });

    saveAs(
      new Blob([stringToArrayBuffer(wbout)], {
        type: "application/octet-stream",
      }),
      `${fileName}.xlsx`
    );

    return { success: true, fileName: `${fileName}.xlsx` };
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    throw new Error(`Failed to export Excel file: ${error.message}`);
  }
};

// Export to CSV format
export const exportToCSV = async (
  job,
  rosterData = [],
  groupsData = [],
  options = { roster: true, groups: true }
) => {
  try {
    const fileName = generateExportFileName(job);
    const exportedFiles = [];

    // Export roster as CSV if selected and data exists
    if (options.roster && rosterData.length > 0) {
      const transformedRoster = transformRosterForExport(rosterData);
      const rosterWs = XLSX.utils.json_to_sheet(transformedRoster);
      const rosterCsv = XLSX.utils.sheet_to_csv(rosterWs);

      const rosterFileName = `${fileName}-roster.csv`;
      saveAs(
        new Blob([rosterCsv], { type: "text/csv;charset=utf-8" }),
        rosterFileName
      );
      exportedFiles.push(rosterFileName);
    }

    // Export groups as CSV if selected and data exists
    if (options.groups && groupsData.length > 0) {
      const transformedGroups = transformGroupsForExport(groupsData);
      const groupsWs = XLSX.utils.json_to_sheet(transformedGroups);
      const groupsCsv = XLSX.utils.sheet_to_csv(groupsWs);

      const groupsFileName = `${fileName}-groups.csv`;
      saveAs(
        new Blob([groupsCsv], { type: "text/csv;charset=utf-8" }),
        groupsFileName
      );
      exportedFiles.push(groupsFileName);
    }

    return { success: true, fileNames: exportedFiles };
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    throw new Error(`Failed to export CSV files: ${error.message}`);
  }
};

// Validate export options
export const validateExportOptions = (options, rosterData, groupsData) => {
  const errors = [];

  // Check if at least one option is selected
  if (!options.roster && !options.groups) {
    errors.push("Please select at least one data type to export");
  }

  // Check if selected data exists
  if (options.roster && (!rosterData || rosterData.length === 0)) {
    errors.push("No roster data available to export");
  }

  if (options.groups && (!groupsData || groupsData.length === 0)) {
    errors.push("No group data available to export");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Get export summary
export const getExportSummary = (options, rosterData, groupsData) => {
  const summary = {
    totalItems: 0,
    includedData: [],
  };

  if (options.roster && rosterData && rosterData.length > 0) {
    summary.totalItems += rosterData.length;
    summary.includedData.push(`${rosterData.length} athletes`);
  }

  if (options.groups && groupsData && groupsData.length > 0) {
    summary.totalItems += groupsData.length;
    summary.includedData.push(`${groupsData.length} groups`);
  }

  return summary;
};

// Export preview data (for showing user what will be exported)
export const generateExportPreview = (job, rosterData, groupsData, options) => {
  const preview = {
    fileName: generateExportFileName(job),
    sheets: [],
  };

  if (options.roster && rosterData && rosterData.length > 0) {
    const sampleData = rosterData.slice(0, 3).map((entry) => ({
      Name: entry.lastName || "",
      "Subject ID": entry.firstName || "",
      Special: entry.teacher || "",
      "Sport/Team": entry.group || "",
      Email: entry.email || "",
      Phone: entry.phone || "",
      Images: entry.imageNumbers || "",
      Notes: entry.notes || "",
    }));

    preview.sheets.push({
      name: "Athletes Roster",
      rowCount: rosterData.length,
      sampleData,
      hasMore: rosterData.length > 3,
    });
  }

  if (options.groups && groupsData && groupsData.length > 0) {
    const sampleData = groupsData.slice(0, 3).map((group) => ({
      Description: group.description || "",
      "Image Numbers": group.imageNumbers || "",
      Notes: group.notes || "",
    }));

    preview.sheets.push({
      name: "Group Images",
      rowCount: groupsData.length,
      sampleData,
      hasMore: groupsData.length > 3,
    });
  }

  return preview;
};
