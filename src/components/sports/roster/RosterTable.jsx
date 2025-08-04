import React, { useState, useEffect, useRef } from "react";
import { Table, Button } from "react-bootstrap";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Edit,
  Trash2,
  Star,
} from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import RosterEntryModal from "./RosterEntryModal";

const RosterTable = ({ roster, jobId, highlightPlayerId }) => {
  const { updateJobRoster } = useJobs();
  const [sortedRoster, setSortedRoster] = useState([]);
  const [sortField, setSortField] = useState("firstName");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingCell, setEditingCell] = useState({ id: null, field: null });
  const [tempValue, setTempValue] = useState("");
  const [fontSize, setFontSize] = useState(14); // Base font size in px
  const [showOnlyFilledBlanks, setShowOnlyFilledBlanks] = useState(false);

  // Column width state - using percentages for responsive design
  const [columnWidths, setColumnWidths] = useState({
    lastName: 11, // 11%
    firstName: 11, // 11%
    teacher: 8, // 8%
    group: 11, // 11%
    email: 14, // 14%
    phone: 11, // 11%
    imageNumbers: 11, // 11%
    notes: 11, // 11%
    actions: 12, // 12% - increased for buttons
    // Total: 100%
  });

  // Refs for resize functionality
  const tableRef = useRef(null);
  const containerRef = useRef(null);
  const resizingColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const adjacentColumn = useRef(null);
  const adjacentStartWidth = useRef(0);

  useEffect(() => {
    let filteredRoster = roster;
    
    // Apply filled blanks filter if enabled
    if (showOnlyFilledBlanks) {
      filteredRoster = roster.filter(entry => entry.isFilledBlank === true);
    }
    
    sortRoster(filteredRoster, sortField, sortDirection);
  }, [roster, sortField, sortDirection, showOnlyFilledBlanks]);

  useEffect(() => {
    if (highlightPlayerId) {
      const timer = setTimeout(() => {
        const playerRow = document.querySelector(
          `[data-player-id="${highlightPlayerId}"]`
        );
        if (playerRow) {
          playerRow.scrollIntoView({ behavior: "smooth", block: "center" });
          playerRow.classList.add("player-highlight");

          setTimeout(() => {
            playerRow.classList.remove("player-highlight");
          }, 5000);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [highlightPlayerId]);

  // Auto-adjust font size based on content and viewport
  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;

      // Calculate approximate character count for longest content
      let maxContentLength = 0;
      roster.forEach((entry) => {
        Object.values(entry).forEach((value) => {
          if (typeof value === "string" && value.length > maxContentLength) {
            maxContentLength = value.length;
          }
        });
      });

      // Adjust font size based on container width and content
      let newFontSize = 14; // Default

      if (containerWidth < 1200) {
        newFontSize = 13;
      }
      if (containerWidth < 1000) {
        newFontSize = 12;
      }
      if (containerWidth < 800) {
        newFontSize = 11;
      }
      if (containerWidth < 600) {
        newFontSize = 10;
      }

      // Further reduce if very long content
      if (maxContentLength > 50) {
        newFontSize -= 1;
      }
      if (maxContentLength > 100) {
        newFontSize -= 1;
      }

      setFontSize(Math.max(9, newFontSize)); // Minimum 9px
    };

    adjustFontSize();
    window.addEventListener("resize", adjustFontSize);

    return () => window.removeEventListener("resize", adjustFontSize);
  }, [roster]);

  const sortRoster = (rosterData, field, direction) => {
    const sorted = [...rosterData].sort((a, b) => {
      const valueA = (a[field] || "").toLowerCase();
      const valueB = (b[field] || "").toLowerCase();

      if (direction === "asc") {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
      }
    });

    setSortedRoster(sorted);
  };

  const handleSort = (field) => {
    const newDirection =
      field === sortField && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(newDirection);
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setShowEntryModal(true);
  };

  const handleDeleteEntry = async (entryId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this athlete? This action cannot be undone."
      )
    ) {
      return;
    }

    const updatedRoster = roster.filter((entry) => entry.id !== entryId);
    await updateJobRoster(jobId, updatedRoster);
  };

  const handleCellClick = (entryId, field, currentValue) => {
    setEditingCell({ id: entryId, field });
    setTempValue(currentValue || "");
  };

  const handleCellChange = (e) => {
    setTempValue(e.target.value);
  };

  const handleCellKeyDown = (e) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      handleCellCancel();
    }
  };

  const handleCellBlur = () => {
    handleCellSave();
  };

  const handleCellSave = async () => {
    if (editingCell.id && editingCell.field) {
      const updatedRoster = roster.map((entry) => {
        if (entry.id === editingCell.id) {
          return {
            ...entry,
            [editingCell.field]: tempValue,
          };
        }
        return entry;
      });

      await updateJobRoster(jobId, updatedRoster);
    }

    setEditingCell({ id: null, field: null });
    setTempValue("");
  };

  const handleCellCancel = () => {
    setEditingCell({ id: null, field: null });
    setTempValue("");
  };

  const getSortIcon = (field) => {
    if (field !== sortField) return <ChevronsUpDown size={14} />;
    return sortDirection === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  // Column resize handlers - now using percentage-based widths
  const handleMouseDown = (e, column, nextColumn) => {
    resizingColumn.current = column;
    adjacentColumn.current = nextColumn;
    startX.current = e.pageX;
    startWidth.current = columnWidths[column];
    adjacentStartWidth.current = nextColumn ? columnWidths[nextColumn] : 0;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection while resizing
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!resizingColumn.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const diff = e.pageX - startX.current;
    const percentDiff = (diff / containerWidth) * 100;

    const newWidth = Math.max(
      3,
      Math.min(30, startWidth.current + percentDiff)
    );
    const widthChange = newWidth - startWidth.current;

    // Adjust adjacent column to maintain total width
    if (adjacentColumn.current && adjacentStartWidth.current > 0) {
      const newAdjacentWidth = Math.max(
        3,
        adjacentStartWidth.current - widthChange
      );

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn.current]: newWidth,
        [adjacentColumn.current]: newAdjacentWidth,
      }));
    }
  };

  const handleMouseUp = () => {
    resizingColumn.current = null;
    adjacentColumn.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const renderEditableCell = (entry, field) => {
    const isEditing =
      editingCell.id === entry.id && editingCell.field === field;
    const value = entry[field] || "";
    const isNameField = field === 'firstName' || field === 'lastName';
    const showFilledBlankIndicator = entry.isFilledBlank && isNameField && value;

    if (isEditing) {
      if (field === "notes") {
        return (
          <textarea
            value={tempValue}
            onChange={handleCellChange}
            onKeyDown={handleCellKeyDown}
            onBlur={handleCellBlur}
            autoFocus
            className="form-control"
            rows={2}
            style={{
              minWidth: "100px",
              fontSize: fontSize + "px",
            }}
          />
        );
      } else {
        return (
          <input
            type="text"
            value={tempValue}
            onChange={handleCellChange}
            onKeyDown={handleCellKeyDown}
            onBlur={handleCellBlur}
            autoFocus
            className="form-control"
            style={{
              minWidth: "100px",
              fontSize: fontSize + "px",
            }}
          />
        );
      }
    }

    return (
      <div
        className="editable-cell"
        onClick={() => handleCellClick(entry.id, field, value)}
        style={{
          padding: "6px 8px",
          borderRadius: "4px",
          wordWrap: "break-word",
          wordBreak: "break-word",
          whiteSpace: "normal",
          overflow: "hidden",
          lineHeight: "1.4",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        title={showFilledBlankIndicator ? "This entry was filled from a blank" : (value || "Click to edit")}
      >
        <span style={{ flex: 1 }}>
          {value || <span className="text-muted">Click to edit</span>}
        </span>
        {showFilledBlankIndicator && (
          <Star 
            size={14} 
            className="filled-blank-indicator" 
            style={{ color: "#ff9800", fill: "#ff9800", flexShrink: 0 }}
          />
        )}
      </div>
    );
  };

  if (!roster || roster.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted mb-3">No athletes in this roster</p>
        <Button variant="primary" onClick={handleAddEntry}>
          Add First Athlete
        </Button>
      </div>
    );
  }

  // Dynamic styles only - static styles are in tables.css
  const dynamicStyles = `
    .roster-table {
      font-size: ${fontSize}px;
    }
    
    .roster-table th {
      font-size: ${fontSize}px;
    }
    
    .editable-cell {
      font-size: ${fontSize}px;
    }
    
    .sort-icon {
      font-size: ${Math.max(10, fontSize - 2)}px;
    }
    
    .field-mapping {
      font-size: ${Math.max(10, fontSize - 2)}px;
    }
    
    .roster-table .btn-sm {
      font-size: ${Math.max(10, fontSize - 2)}px;
    }
    
    @media (max-width: 768px) {
      .roster-table {
        font-size: ${Math.max(9, fontSize - 2)}px;
      }
      
      .field-mapping {
        font-size: ${Math.max(8, fontSize - 3)}px;
      }
    }
  `;

  const columns = [
    "lastName",
    "firstName",
    "teacher",
    "group",
    "email",
    "phone",
    "imageNumbers",
    "notes",
  ];

  return (
    <>
      <style>{dynamicStyles}</style>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">
          <h5 className="mb-0">Athletes Roster ({sortedRoster.length}{roster.length !== sortedRoster.length && ` of ${roster.length}`})</h5>
          {roster.some(entry => entry.isFilledBlank) && (
            <div className="form-check mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="showFilledBlanks"
                checked={showOnlyFilledBlanks}
                onChange={(e) => setShowOnlyFilledBlanks(e.target.checked)}
              />
              <label 
                className="form-check-label d-flex align-items-center gap-1" 
                htmlFor="showFilledBlanks"
                style={{ cursor: "pointer" }}
              >
                <Star size={16} style={{ color: "#ff9800", fill: "#ff9800" }} />
                Show only filled blanks
                <span className="badge bg-warning text-dark ms-1">
                  {roster.filter(entry => entry.isFilledBlank).length}
                </span>
              </label>
            </div>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={handleAddEntry}>
          Add Athlete
        </Button>
      </div>

      <div className="roster-table-container" ref={containerRef}>
        <Table striped bordered hover className="roster-table" ref={tableRef}>
          <thead>
            <tr>
              <th
                style={{
                  width: columnWidths.lastName + "%",
                  position: "relative",
                }}
              >
                <div
                  className="sortable-header"
                  onClick={() => handleSort("lastName")}
                >
                  <div>Last Name</div>
                  <div className="field-mapping">(Name)</div>
                  <div className="sort-icon">{getSortIcon("lastName")}</div>
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(e) =>
                    handleMouseDown(e, "lastName", "firstName")
                  }
                />
              </th>
              <th
                style={{
                  width: columnWidths.firstName + "%",
                  position: "relative",
                }}
              >
                <div
                  className="sortable-header"
                  onClick={() => handleSort("firstName")}
                >
                  <div>First Name</div>
                  <div className="field-mapping">(Subject ID)</div>
                  <div className="sort-icon">{getSortIcon("firstName")}</div>
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(e) =>
                    handleMouseDown(e, "firstName", "teacher")
                  }
                />
              </th>
              <th
                style={{
                  width: columnWidths.teacher + "%",
                  position: "relative",
                }}
              >
                <div
                  className="sortable-header"
                  onClick={() => handleSort("teacher")}
                >
                  <div>Teacher</div>
                  <div className="field-mapping">(Special)</div>
                  <div className="sort-icon">{getSortIcon("teacher")}</div>
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(e) => handleMouseDown(e, "teacher", "group")}
                />
              </th>
              <th
                style={{
                  width: columnWidths.group + "%",
                  position: "relative",
                }}
              >
                <div
                  className="sortable-header"
                  onClick={() => handleSort("group")}
                >
                  <div>Group</div>
                  <div className="field-mapping">(Sport/Team)</div>
                  <div className="sort-icon">{getSortIcon("group")}</div>
                </div>
                <div
                  className="resize-handle"
                  onMouseDown={(e) => handleMouseDown(e, "group", "email")}
                />
              </th>
              <th
                style={{
                  width: columnWidths.email + "%",
                  position: "relative",
                }}
              >
                Email
                <div
                  className="resize-handle"
                  onMouseDown={(e) => handleMouseDown(e, "email", "phone")}
                />
              </th>
              <th
                style={{
                  width: columnWidths.phone + "%",
                  position: "relative",
                }}
              >
                Phone
                <div
                  className="resize-handle"
                  onMouseDown={(e) =>
                    handleMouseDown(e, "phone", "imageNumbers")
                  }
                />
              </th>
              <th
                style={{
                  width: columnWidths.imageNumbers + "%",
                  position: "relative",
                }}
              >
                Images
                <div
                  className="resize-handle"
                  onMouseDown={(e) =>
                    handleMouseDown(e, "imageNumbers", "notes")
                  }
                />
              </th>
              <th
                style={{
                  width: columnWidths.notes + "%",
                  position: "relative",
                }}
              >
                Notes
                <div
                  className="resize-handle"
                  onMouseDown={(e) => handleMouseDown(e, "notes", "actions")}
                />
              </th>
              <th style={{ width: columnWidths.actions + "%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRoster.map((entry) => (
              <tr
                key={entry.id}
                data-player-id={entry.id}
                className={[
                  highlightPlayerId === entry.id ? "table-warning" : "",
                  entry.isFilledBlank ? "roster-row-filled-blank" : ""
                ].filter(Boolean).join(" ")}
              >
                <td style={{ width: columnWidths.lastName + "%" }}>
                  {renderEditableCell(entry, "lastName")}
                </td>
                <td style={{ width: columnWidths.firstName + "%" }}>
                  {renderEditableCell(entry, "firstName")}
                </td>
                <td style={{ width: columnWidths.teacher + "%" }}>
                  {renderEditableCell(entry, "teacher")}
                </td>
                <td style={{ width: columnWidths.group + "%" }}>
                  {renderEditableCell(entry, "group")}
                </td>
                <td style={{ width: columnWidths.email + "%" }}>
                  {renderEditableCell(entry, "email")}
                </td>
                <td style={{ width: columnWidths.phone + "%" }}>
                  {renderEditableCell(entry, "phone")}
                </td>
                <td style={{ width: columnWidths.imageNumbers + "%" }}>
                  {renderEditableCell(entry, "imageNumbers")}
                </td>
                <td style={{ width: columnWidths.notes + "%" }}>
                  {renderEditableCell(entry, "notes")}
                </td>
                <td
                  style={{ width: columnWidths.actions + "%" }}
                  className="actions-cell"
                >
                  <div className="d-flex gap-1 justify-content-center">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleEditEntry(entry)}
                      title="Edit"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteEntry(entry.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <RosterEntryModal
        show={showEntryModal}
        onHide={() => setShowEntryModal(false)}
        jobId={jobId}
        editingEntry={editingEntry}
        roster={roster}
      />
    </>
  );
};

export default RosterTable;
