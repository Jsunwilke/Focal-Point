// src/components/proofing/search/SearchControls.jsx
import React, { useState } from "react";
import { Search, X } from "lucide-react";

const SearchControls = ({ searchState, setSearchState }) => {
  const [searchInput, setSearchInput] = useState("");

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    
    // Update search state
    if (value.trim()) {
      setSearchState({
        isActive: true,
        query: value.trim(),
      });
    } else {
      setSearchState({
        isActive: false,
        query: "",
      });
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchState({
      isActive: false,
      query: "",
    });
  };

  return (
    <div
      className="search-controls"
      style={{ position: "relative", zIndex: 1 }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div
          className="search-input-wrapper"
          style={{ flex: 1, position: "relative" }}
        >
          <Search
            className="search-icon"
            size={16}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <input
            type="text"
            className="search-input"
            style={{
              width: "100%",
              padding: "0.5rem 2.5rem 0.5rem 2.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              position: "relative",
              zIndex: 0,
            }}
            placeholder="Search galleries by name, school, or status..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              className="search-clear"
              onClick={handleClearSearch}
              style={{
                position: "absolute",
                right: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                padding: "0.25rem",
                borderRadius: "0.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchControls;