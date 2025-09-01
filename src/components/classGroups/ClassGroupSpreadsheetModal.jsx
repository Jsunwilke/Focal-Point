// src/components/classGroups/ClassGroupSpreadsheetModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Plus,
  Trash2,
  Save,
  School,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { useClassGroups } from "../../contexts/ClassGroupsContext";
import { useToast } from "../../contexts/ToastContext";

const ClassGroupSpreadsheetModal = ({ job, onClose }) => {
  const { updateClassGroupJob } = useClassGroups();
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    if (job && job.classGroups) {
      // Create a deep copy of the groups with IDs
      setGroups(
        job.classGroups.map((g) => ({
          ...g,
          id: g.id || crypto.randomUUID(),
        })),
      );
    }
  }, [job]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCellEdit = (groupId, field, value) => {
    setGroups(
      groups.map((g) => (g.id === groupId ? { ...g, [field]: value } : g)),
    );
    setHasChanges(true);
  };

  const addNewGroup = () => {
    const newGroup = {
      id: crypto.randomUUID(),
      grade: "",
      teacher: "",
      imageNumbers: "",
      notes: "",
    };
    setGroups([...groups, newGroup]);
    setHasChanges(true);
  };

  const removeGroup = (groupId) => {
    setGroups(groups.filter((g) => g.id !== groupId));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);

    const validGroups = groups.filter(
      (g) => g.grade || g.teacher || g.imageNumbers,
    );

    if (validGroups.length === 0) {
      showToast("Please add at least one group with data", "error");
      setSaving(false);
      return;
    }

    const success = await updateClassGroupJob(job.id, {
      classGroups: validGroups,
    });

    if (success) {
      showToast("Class groups updated successfully", "success");
      onClose();
    }

    setSaving(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (
        window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // If clicking the same field, toggle direction or clear sort
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        // Clear sort on third click
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort groups based on current sort settings
  const sortedGroups = useMemo(() => {
    if (!sortField) return groups;

    const sorted = [...groups].sort((a, b) => {
      let aVal = a[sortField] || "";
      let bVal = b[sortField] || "";

      // Special handling for grade field (natural sort)
      if (sortField === "grade") {
        // Define grade order
        const gradeOrder = {
          "pre-k": 0,
          prek: 0,
          "pre k": 0,
          preschool: 0,
          kindergarten: 1,
          k: 1,
          first: 2,
          "1st": 2,
          1: 2,
          second: 3,
          "2nd": 3,
          2: 3,
          third: 4,
          "3rd": 4,
          3: 4,
          fourth: 5,
          "4th": 5,
          4: 5,
          fifth: 6,
          "5th": 6,
          5: 6,
          sixth: 7,
          "6th": 7,
          6: 7,
          seventh: 8,
          "7th": 8,
          7: 8,
          eighth: 9,
          "8th": 9,
          8: 9,
          ninth: 10,
          "9th": 10,
          9: 10,
          tenth: 11,
          "10th": 11,
          10: 11,
          eleventh: 12,
          "11th": 12,
          11: 12,
          twelfth: 13,
          "12th": 13,
          12: 13,
        };

        const aGrade = aVal.toLowerCase().replace(" grade", "").trim();
        const bGrade = bVal.toLowerCase().replace(" grade", "").trim();

        const aOrder = gradeOrder[aGrade] ?? 999;
        const bOrder = gradeOrder[bGrade] ?? 999;

        if (aOrder !== bOrder) {
          return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
        }
      }

      // Special handling for image numbers (sort by first number)
      if (sortField === "imageNumbers") {
        const aMatch = aVal.match(/\d+/);
        const bMatch = bVal.match(/\d+/);
        const aNum = aMatch ? parseInt(aMatch[0]) : 999999;
        const bNum = bMatch ? parseInt(bMatch[0]) : 999999;
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Default string comparison
      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return sorted;
  }, [groups, sortField, sortDirection]);

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <span className="sort-icon inactive">
          <ArrowUpDown size={14} />
        </span>
      );
    }
    if (sortDirection === "asc") {
      return (
        <span className="sort-icon active">
          <ArrowUp size={14} />
        </span>
      );
    }
    return (
      <span className="sort-icon active">
        <ArrowDown size={14} />
      </span>
    );
  };

  const modalContent = (
    <div
      className="modal-overlay spreadsheet-modal-overlay"
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
      }}
    >
      <div
        className="spreadsheet-modal"
        style={{
          position: "relative",
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "1200px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="spreadsheet-header">
          <div className="spreadsheet-title">
            <School size={20} />
            <div>
              <h2>{job.schoolName || "Unknown School"}</h2>
              <p>
                <Calendar size={14} />
                <span>{formatDate(job.sessionDate)}</span>
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Spreadsheet */}
        <div className="spreadsheet-container">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="col-number">#</th>
                <th
                  className={`col-grade sortable ${sortField === "grade" ? "sorted" : ""}`}
                  onClick={() => handleSort("grade")}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Grade {getSortIcon("grade")}</span>
                </th>
                <th
                  className={`col-teacher sortable ${sortField === "teacher" ? "sorted" : ""}`}
                  onClick={() => handleSort("teacher")}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Teacher {getSortIcon("teacher")}</span>
                </th>
                <th
                  className={`col-images sortable ${sortField === "imageNumbers" ? "sorted" : ""}`}
                  onClick={() => handleSort("imageNumbers")}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Image Numbers {getSortIcon("imageNumbers")}</span>
                </th>
                <th
                  className={`col-notes sortable ${sortField === "notes" ? "sorted" : ""}`}
                  onClick={() => handleSort("notes")}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Notes {getSortIcon("notes")}</span>
                </th>
                <th className="col-actions">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((group, index) => (
                <tr key={group.id}>
                  <td className="col-number">{index + 1}</td>
                  <td className="col-grade">
                    <input
                      type="text"
                      value={group.grade || ""}
                      onChange={(e) =>
                        handleCellEdit(group.id, "grade", e.target.value)
                      }
                      placeholder="e.g., Kindergarten"
                      className="cell-input"
                    />
                  </td>
                  <td className="col-teacher">
                    <input
                      type="text"
                      value={group.teacher || ""}
                      onChange={(e) =>
                        handleCellEdit(group.id, "teacher", e.target.value)
                      }
                      placeholder="Teacher name"
                      className="cell-input"
                    />
                  </td>
                  <td className="col-images">
                    <input
                      type="text"
                      value={group.imageNumbers || ""}
                      onChange={(e) =>
                        handleCellEdit(group.id, "imageNumbers", e.target.value)
                      }
                      placeholder="e.g., 4949-53"
                      className="cell-input"
                    />
                  </td>
                  <td className="col-notes">
                    <input
                      type="text"
                      value={group.notes || ""}
                      onChange={(e) =>
                        handleCellEdit(group.id, "notes", e.target.value)
                      }
                      placeholder="Notes"
                      className="cell-input"
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      className="btn-icon-small danger"
                      onClick={() => removeGroup(group.id)}
                      title="Remove group"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Add new row */}
              <tr className="add-row">
                <td colSpan="6">
                  <button className="btn-add-row" onClick={addNewGroup}>
                    <Plus size={16} />
                    Add Group
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="spreadsheet-footer">
          <div className="footer-info">
            {groups.length} group{groups.length !== 1 ? "s" : ""}
            {hasChanges && (
              <span className="unsaved-indicator">• Unsaved changes</span>
            )}
          </div>
          <div className="footer-actions">
            <button className="btn btn-outline-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ClassGroupSpreadsheetModal;
