import React, { useState, useRef } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import * as XLSX from "xlsx";
import DOMPurify from "dompurify";
import { generateUniqueId } from "../../../utils/calculations";
import { useToast } from "../../../contexts/ToastContext";

const FileUploadPreview = ({ rosterData, setRosterData }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const findColumnIndex = (headers, possibleNames) => {
    const normalizedHeaders = headers.map((h) =>
      String(h || "")
        .toLowerCase()
        .trim()
    );

    for (const name of possibleNames) {
      const index = normalizedHeaders.indexOf(name);
      if (index !== -1) return index;

      // Try partial match
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (normalizedHeaders[i].includes(name)) return i;
      }
    }

    return -1;
  };

  const processRosterData = (jsonData) => {
    if (!jsonData || jsonData.length < 2) {
      throw new Error(
        "File must contain at least a header row and one data row"
      );
    }

    // Get headers from first row
    const headers = jsonData[0];
    if (!headers || headers.length === 0) {
      throw new Error("No column headers found in the first row");
    }

    // Identify relevant columns
    const lastNameIndex = findColumnIndex(headers, [
      "last name",
      "last",
      "lastname",
      "surname",
      "family name",
      "name",
    ]);
    const firstNameIndex = findColumnIndex(headers, [
      "first name",
      "first",
      "firstname",
      "name",
      "given name",
      "subject id",
    ]);
    const teacherIndex = findColumnIndex(headers, [
      "teacher",
      "special",
      "instructor",
    ]);
    const groupIndex = findColumnIndex(headers, [
      "group",
      "sport/team",
      "team",
      "sport",
    ]);
    const emailIndex = findColumnIndex(headers, [
      "email",
      "e-mail",
      "email address",
    ]);
    const phoneIndex = findColumnIndex(headers, [
      "phone",
      "telephone",
      "phone number",
      "cell",
    ]);
    const imagesIndex = findColumnIndex(headers, [
      "images",
      "image",
      "image numbers",
      "image number",
      "photo numbers",
      "photo number",
    ]);

    // Process data rows
    const processedData = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];

      // Skip completely empty rows
      if (
        !row ||
        row.length === 0 ||
        row.every((cell) => !cell || String(cell).trim() === "")
      ) {
        continue;
      }

      const entry = {
        id: generateUniqueId(),
        lastName:
          lastNameIndex >= 0 ? String(row[lastNameIndex] || "").trim() : "",
        firstName:
          firstNameIndex >= 0 ? String(row[firstNameIndex] || "").trim() : "",
        teacher:
          teacherIndex >= 0 ? String(row[teacherIndex] || "").trim() : "",
        group: groupIndex >= 0 ? String(row[groupIndex] || "").trim() : "",
        email: emailIndex >= 0 ? String(row[emailIndex] || "").trim() : "",
        phone: phoneIndex >= 0 ? String(row[phoneIndex] || "").trim() : "",
        imageNumbers:
          imagesIndex >= 0 ? String(row[imagesIndex] || "").trim() : "",
        notes: "",
      };

      processedData.push(entry);
    }

    if (processedData.length === 0) {
      throw new Error(
        "No valid data rows found. Please check that your file contains athlete information."
      );
    }

    return {
      processedData,
      columnMapping: {
        lastNameIndex,
        firstNameIndex,
        teacherIndex,
        groupIndex,
        emailIndex,
        phoneIndex,
        imagesIndex,
      },
      headers,
      previewRows: jsonData.slice(0, 6), // First 5 data rows + header
    };
  };

  const createPreviewTable = (headers, previewRows, columnMapping) => {
    const {
      lastNameIndex,
      firstNameIndex,
      teacherIndex,
      groupIndex,
      emailIndex,
      phoneIndex,
      imagesIndex,
    } = columnMapping;

    let html = '<table class="preview-table"><thead><tr>';

    // Add headers with mapping indicators
    for (let i = 0; i < headers.length; i++) {
      const isLastName = i === lastNameIndex;
      const isFirstName = i === firstNameIndex;
      const isTeacher = i === teacherIndex;
      const isGroup = i === groupIndex;
      const isEmail = i === emailIndex;
      const isPhone = i === phoneIndex;
      const isImages = i === imagesIndex;

      let headerText = String(headers[i] || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      
      if (isLastName) headerText += " (Name)";
      if (isFirstName) headerText += " (Subject ID)";
      if (isTeacher) headerText += " (Special)";
      if (isGroup) headerText += " (Sport/Team)";
      if (isImages) headerText += " (Image Numbers)";

      const headerClass =
        isLastName ||
        isFirstName ||
        isTeacher ||
        isGroup ||
        isEmail ||
        isPhone ||
        isImages
          ? "text-primary fw-bold"
          : "";

      html += `<th class="${headerClass}">${headerText}</th>`;
    }

    html += "</tr></thead><tbody>";

    // Add data rows (skip header row)
    for (let i = 1; i < Math.min(previewRows.length, 6); i++) {
      const row = previewRows[i];
      html += "<tr>";

      for (let j = 0; j < headers.length; j++) {
        const isHighlighted =
          j === lastNameIndex ||
          j === firstNameIndex ||
          j === teacherIndex ||
          j === groupIndex ||
          j === emailIndex ||
          j === phoneIndex ||
          j === imagesIndex;
        const cellClass = isHighlighted ? "text-primary fw-bold" : "";

        const cellContent = String(row[j] || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        html += `<td class="${cellClass}">${cellContent}</td>`;
      }

      html += "</tr>";
    }

    html += "</tbody></table>";

    if (previewRows.length > 6) {
      html += `<p class="text-muted">...and ${
        previewRows.length - 6
      } more rows</p>`;
    }

    // Sanitize the final HTML with DOMPurify as an additional security layer
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'p'],
      ALLOWED_ATTR: ['class'],
      KEEP_CONTENT: true
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setPreviewData(null);
      setRosterData([]);
      return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast(
        "Error",
        "File is too large. Please select a file smaller than 10MB.",
        "error"
      );
      fileInputRef.current.value = "";
      return;
    }

    // Additional security: Check for suspicious file names
    const suspiciousPatterns = /[<>:"|?*\x00-\x1f]|^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (suspiciousPatterns.test(file.name)) {
      showToast(
        "Error",
        "Invalid file name. Please rename your file and try again.",
        "error"
      );
      fileInputRef.current.value = "";
      return;
    }

    // Check file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
      "application/csv",
    ];

    if (
      !allowedTypes.includes(file.type) &&
      !file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/)
    ) {
      showToast(
        "Error",
        "Please select a valid Excel (.xlsx, .xls) or CSV file.",
        "error"
      );
      fileInputRef.current.value = "";
      return;
    }

    setProcessing(true);

    try {
      const data = await readFileAsArrayBuffer(file);
      const workbook = XLSX.read(data, {
        type: "array",
        cellStyles: false,
        cellFormulas: false,
        sheetStubs: false,
        bookVBA: false, // Disable VBA macros
        cellNF: false, // Disable number formats
        cellDates: false, // Disable date parsing
        password: "", // Ensure no password processing
        WTF: false // Disable "What The Format" parsing
      });

      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("No worksheets found in the file");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error("Unable to read the worksheet");
      }

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      // Process the data
      const result = processRosterData(jsonData);

      // Set roster data
      setRosterData(result.processedData);

      // Create preview
      const previewHtml = createPreviewTable(
        result.headers,
        result.previewRows,
        result.columnMapping
      );

      // Count valid athletes
      const validAthleteCount = result.processedData.filter(
        (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
      ).length;

      const blankCount = result.processedData.length - validAthleteCount;

      setPreviewData({
        html: previewHtml,
        stats: {
          total: result.processedData.length,
          valid: validAthleteCount,
          blank: blankCount,
        },
      });

      showToast(
        "Success",
        `Successfully processed ${result.processedData.length} entries`
      );
    } catch (error) {
      console.error("Error processing file:", error);

      let errorMessage = "Failed to process file: " + error.message;

      if (error.message.includes("zip")) {
        errorMessage =
          "The file appears to be corrupted or is not a valid Excel file. Please try saving it again.";
      } else if (error.message.includes("password")) {
        errorMessage =
          "This file appears to be password protected. Please remove the password and try again.";
      } else if (error.message.includes("format")) {
        errorMessage =
          "Unsupported file format. Please save as .xlsx, .xls, or .csv format.";
      }

      showToast("Error", errorMessage, "error");
      fileInputRef.current.value = "";
      setPreviewData(null);
      setRosterData([]);
    } finally {
      setProcessing(false);
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(new Uint8Array(e.target.result));
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const handleRefreshPreview = () => {
    if (fileInputRef.current && fileInputRef.current.files[0]) {
      handleFileSelect({ target: fileInputRef.current });
    }
  };

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Upload Roster (Excel or CSV)</Form.Label>
        <Form.Control
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".xlsx,.xls,.csv"
          disabled={processing}
        />
        <Form.Text className="text-muted">
          Excel file should include columns for: Last Name, First Name, Teacher,
          Group, Email, Phone.
          <br />
          Column headers will be automatically detected and mapped
          appropriately.
        </Form.Text>
      </Form.Group>

      {processing && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Processing...</span>
          </div>
          <h6>Processing your roster file...</h6>
          <p className="text-muted mb-0">
            This may take a moment for larger files.
          </p>
        </div>
      )}

      {previewData && !processing && (
        <div className="my-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6>Roster Preview:</h6>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleRefreshPreview}
            >
              <i className="bi bi-arrow-clockwise"></i> Refresh Preview
            </Button>
          </div>

          <div
            className="table-responsive border rounded p-2 mb-2"
            dangerouslySetInnerHTML={{ __html: previewData.html }}
          />

          <div className="text-muted small">
            <strong>Total athletes:</strong> {previewData.stats.valid}
            {previewData.stats.blank > 0 && (
              <span className="text-warning">
                {" "}
                ({previewData.stats.blank} entries without names will be
                included as placeholders)
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FileUploadPreview;
