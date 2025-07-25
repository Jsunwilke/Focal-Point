import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Button, Form, Row, Col } from "react-bootstrap";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useToast } from "../../../contexts/ToastContext";
import { formatDate } from "../../../utils/dateHelpers";

const ExportModal = ({ show, onHide, job, rosterData, groupsData }) => {
  const { showToast } = useToast();
  const [exportOptions, setExportOptions] = useState({
    roster: true,
    groups: true,
    format: "xlsx",
  });
  const [loading, setLoading] = useState(false);

  const handleOptionChange = (e) => {
    const { name, type, checked, value } = e.target;
    setExportOptions((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const s2ab = (s) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xff;
    }
    return buf;
  };

  const handleExport = async () => {
    if (!exportOptions.roster && !exportOptions.groups) {
      showToast(
        "Error",
        "Please select at least one data type to export",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add roster sheet if selected
      if (exportOptions.roster && rosterData.length > 0) {
        const rosterWs = XLSX.utils.json_to_sheet(
          rosterData.map((entry) => ({
            Name: entry.lastName || "",
            "Subject ID": entry.firstName || "",
            Special: entry.teacher || "",
            "Sport/Team": entry.group || "",
            Email: entry.email || "",
            Phone: entry.phone || "",
            Images: entry.imageNumbers || "",
            Notes: entry.notes || "",
          }))
        );

        XLSX.utils.book_append_sheet(wb, rosterWs, "Athletes Roster");
      }

      // Add groups sheet if selected
      if (exportOptions.groups && groupsData.length > 0) {
        const groupsWs = XLSX.utils.json_to_sheet(
          groupsData.map((group) => ({
            Description: group.description || "",
            "Image Numbers": group.imageNumbers || "",
            Notes: group.notes || "",
          }))
        );

        XLSX.utils.book_append_sheet(wb, groupsWs, "Group Images");
      }

      // Generate filename
      const schoolName = job.schoolName || "";
      const seasonType = job.seasonType || job.sportName || "";
      const date = job.shootDate?.toDate
        ? job.shootDate.toDate()
        : new Date(job.shootDate);
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const year = date.getFullYear().toString().slice(-2);
      const dateStr = `${month}-${day}-${year}`;
      const fileName = `${schoolName} ${seasonType} ${dateStr}`;

      // Export based on format
      if (exportOptions.format === "xlsx") {
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });
        saveAs(
          new Blob([s2ab(wbout)], { type: "application/octet-stream" }),
          `${fileName}.xlsx`
        );
      } else {
        // Export as CSV
        if (exportOptions.roster && rosterData.length > 0) {
          const rosterCsv = XLSX.utils.sheet_to_csv(
            wb.Sheets["Athletes Roster"]
          );
          saveAs(
            new Blob([rosterCsv], { type: "text/csv" }),
            `${fileName}-roster.csv`
          );
        }

        if (exportOptions.groups && groupsData.length > 0) {
          const groupsCsv = XLSX.utils.sheet_to_csv(wb.Sheets["Group Images"]);
          saveAs(
            new Blob([groupsCsv], { type: "text/csv" }),
            `${fileName}-groups.csv`
          );
        }
      }

      showToast("Success", "Data exported successfully");
      onHide();
    } catch (error) {
      console.error("Error exporting data:", error);
      showToast("Error", `Error exporting data: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onHide();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          margin: "0",
          transform: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #dee2e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h5 style={{ margin: 0 }}>Export Data</h5>
          <button
            onClick={onHide}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "1.5rem",
            overflow: "auto",
            flex: 1,
          }}
        >
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">What to Export</Form.Label>
              <div>
                <Form.Check
                  type="checkbox"
                  id="exportRoster"
                  name="roster"
                  label="Athletes Roster"
                  checked={exportOptions.roster}
                  onChange={handleOptionChange}
                />
                <Form.Check
                  type="checkbox"
                  id="exportGroups"
                  name="groups"
                  label="Group Images"
                  checked={exportOptions.groups}
                  onChange={handleOptionChange}
                />
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Format</Form.Label>
              <Form.Select
                name="format"
                value={exportOptions.format}
                onChange={handleOptionChange}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </Form.Select>
            </Form.Group>
          </Form>

          <div className="alert alert-info">
            <small>
              <strong>File Mapping:</strong>
              <br />
              • Last Name → Name
              <br />
              • First Name → Subject ID
              <br />
              • Teacher → Special
              <br />
              • Group → Sport/Team
              <br />• Images column contains photographer data
            </small>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleExport} disabled={loading}>
            {loading && (
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              ></span>
            )}
            <i className="bi bi-download"></i> Export Data
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ExportModal;
