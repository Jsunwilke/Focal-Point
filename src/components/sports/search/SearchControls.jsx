// src/components/sports/search/SearchControls.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { firestore } from "../../../firebase/config";

const SearchControls = ({ searchState, setSearchState, activeTab }) => {
  const { allJobs } = useJobs();
  const { organization } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Helper function to calculate string similarity (regular function, not hook)
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match gets highest score
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    // Levenshtein distance for similarity
    const levenshteinDistance = (a, b) => {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = (maxLength - distance) / maxLength;

    return similarity;
  };

  // Helper function to check if names are similar (regular function, not hook)
  const isNameSimilar = (searchTerm, playerName, threshold = 0.7) => {
    if (!playerName) return false;

    const playerNameLower = playerName.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    // Direct substring match (existing behavior)
    if (playerNameLower.includes(searchLower)) return true;

    // Split full name into parts and check each part
    const nameParts = playerNameLower.split(/\s+/);

    for (const part of nameParts) {
      // Check if any name part is similar to search term
      const similarity = calculateSimilarity(part, searchLower);
      if (similarity >= threshold) {
        return true;
      }

      // Also check if search term is similar to any part
      if (part.length >= 3 && searchLower.length >= 3) {
        const partSimilarity = calculateSimilarity(searchLower, part);
        if (partSimilarity >= threshold) {
          return true;
        }
      }
    }

    return false;
  };

  // Clear search when changing tabs
  useEffect(() => {
    if (searchState.isActive) {
      handleClearSearch();
    }
  }, [activeTab]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Perform search with debouncing (regular async function)
  const performSearch = async (searchQuery, type) => {
    if (!searchQuery.trim()) {
      setSearchState((prev) => ({ ...prev, isActive: false, results: [] }));
      return;
    }

    const searchTerm = searchQuery.toLowerCase();
    let results = [];

    if (type === "players") {
      try {
        // Search through playerSearchIndex collection
        if (!organization?.id) {
          console.error("No organization ID available for search");
          return;
        }

        console.log(
          "Searching for:",
          searchTerm,
          "in organization:",
          organization.id
        );

        // Since your lastName contains full names and we need partial matching,
        // we'll use a "get all" approach and filter client-side
        const getAllQuery = firestoreQuery(
          collection(firestore, "playerSearchIndex"),
          where("organizationID", "==", organization.id),
          limit(500) // Increase limit to get more results
        );

        console.log("Fetching all players for client-side filtering...");
        const allPlayersSnapshot = await getDocs(getAllQuery);
        console.log("Retrieved", allPlayersSnapshot.size, "player documents");

        const exactMatches = new Map();
        const similarMatches = new Map();

        allPlayersSnapshot.forEach((doc) => {
          const playerData = doc.data();

          // Check for exact matches first
          const searchableFields = [
            playerData.firstName,
            playerData.lastName,
            playerData.fullName,
            playerData.group,
            playerData.teacher,
            playerData.schoolName,
            playerData.email,
            playerData.phone,
            playerData.notes,
            playerData.imageNumbers,
          ];

          // Check for exact substring matches
          const hasExactMatch = searchableFields.some((field) => {
            if (!field) return false;
            const fieldLower = String(field).toLowerCase();
            const termLower = searchTerm.toLowerCase();

            // For multi-word searches, check if the field contains the entire search phrase
            if (termLower.includes(" ")) {
              return fieldLower.includes(termLower);
            }

            // For single word searches, check for exact word matches or very close prefix matches
            const words = fieldLower.split(/\s+/);
            return words.some((word) => {
              // Exact word match
              if (word === termLower) return true;

              // For prefix matches, use stricter criteria based on search term length
              if (word.startsWith(termLower)) {
                const percentageMatch = termLower.length / word.length;

                // Shorter search terms need higher percentage match to be "exact"
                if (termLower.length <= 3) {
                  return percentageMatch >= 0.95; // 95% for very short terms
                } else if (termLower.length <= 5) {
                  return percentageMatch >= 0.9; // 90% for short terms
                } else {
                  return percentageMatch >= 0.85; // 85% for longer terms
                }
              }

              return false;
            });
          });

          // Check for similar name matches (fuzzy matching)
          const hasSimilarMatch =
            !hasExactMatch &&
            (isNameSimilar(searchTerm, playerData.lastName, 0.75) ||
              isNameSimilar(searchTerm, playerData.fullName, 0.75) ||
              isNameSimilar(searchTerm, playerData.firstName, 0.75));

          if (hasExactMatch || hasSimilarMatch) {
            const playerId = playerData.playerId || playerData.id || doc.id;
            const playerResult = {
              jobId: playerData.jobId,
              schoolName: playerData.schoolName,
              seasonType: playerData.seasonType,
              sportName: playerData.sportName,
              shootDate: playerData.shootDate,
              isArchived: playerData.isArchived,
              player: {
                id: playerId,
                firstName: playerData.firstName,
                lastName: playerData.lastName,
                group: playerData.group,
                teacher: playerData.teacher,
                email: playerData.email,
                phone: playerData.phone,
                imageNumbers: playerData.imageNumbers,
                notes: playerData.notes,
              },
            };

            if (hasExactMatch) {
              console.log(
                "Found exact match:",
                playerData.lastName,
                "contains",
                searchTerm
              );
              exactMatches.set(playerId, {
                ...playerResult,
                matchType: "exact", // Add match type indicator
              });
            } else {
              console.log(
                "Found similar match:",
                playerData.lastName,
                "similar to",
                searchTerm
              );
              similarMatches.set(playerId, {
                ...playerResult,
                matchType: "similar", // Add match type indicator
              });
            }
          }
        });

        // Combine results with exact matches first, then similar matches
        results = [
          ...Array.from(exactMatches.values()),
          ...Array.from(similarMatches.values()),
        ];

        console.log(
          "Final results count:",
          results.length,
          "(",
          exactMatches.size,
          "exact,",
          similarMatches.size,
          "similar )"
        );

        results.sort((a, b) => {
          const dateA = a.shootDate?.toDate
            ? a.shootDate.toDate()
            : new Date(a.shootDate);
          const dateB = b.shootDate?.toDate
            ? b.shootDate.toDate()
            : new Date(b.shootDate);
          return dateB - dateA;
        });
      } catch (error) {
        console.error("Error searching players:", error);
        // Don't fallback - just return empty results
        results = [];
      }
    } else if (type === "jobs") {
      // Job search functionality (keep existing logic)
      const filteredJobs = allJobs.filter((job) => {
        return (
          (job.schoolName || "").toLowerCase().includes(searchTerm) ||
          (job.seasonType || "").toLowerCase().includes(searchTerm) ||
          (job.sportName || "").toLowerCase().includes(searchTerm) ||
          (job.location || "").toLowerCase().includes(searchTerm) ||
          (job.photographer || "").toLowerCase().includes(searchTerm) ||
          (job.additionalNotes || "").toLowerCase().includes(searchTerm)
        );
      });

      results = filteredJobs.map((job) => ({
        type: "job",
        job: job,
      }));
    }

    setSearchState((prev) => ({
      ...prev,
      isActive: true,
      query: searchQuery,
      results,
    }));
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const newTimeout = setTimeout(async () => {
      await performSearch(value, searchState.type);
    }, 300);

    setSearchTimeout(newTimeout);
  };

  const handleDropdownToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Dropdown toggle clicked, current state:", showDropdown);
    setShowDropdown(!showDropdown);
  };

  const handleSearchTypeChange = (newType) => {
    console.log("Changing search type to:", newType);
    setSearchState((prev) => ({ ...prev, type: newType }));
    setShowDropdown(false);

    // Re-perform search with new type if there's a query
    if (searchInput.trim()) {
      performSearch(searchInput, newType);
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchState({
      isActive: false,
      type: searchState.type, // Keep the current search type
      query: "",
      results: [],
    });

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  };

  const handleKeyPress = async (e) => {
    if (e.key === "Enter") {
      await performSearch(searchInput, searchState.type);
    }
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
            placeholder={
              searchState.type === "jobs"
                ? "Search jobs by school, season, location..."
                : "Search players by name, sport, teacher..."
            }
            value={searchInput}
            onChange={handleSearchInputChange}
            onKeyPress={handleKeyPress}
          />
          {searchState.isActive && (
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
                zIndex: 2,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div
          className="dropdown"
          style={{ position: "relative", zIndex: 100 }}
          ref={dropdownRef}
        >
          <button
            onClick={handleDropdownToggle}
            className="dropdown-button"
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#f9fafb";
              e.target.style.borderColor = "#3b82f6";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "white";
              e.target.style.borderColor = "#d1d5db";
            }}
          >
            <span>
              {searchState.type === "jobs" ? "Search Jobs" : "Search Players"}
            </span>
            <ChevronDown
              size={16}
              style={{
                transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: "0",
                minWidth: "180px",
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                zIndex: 999999,
                overflow: "hidden",
              }}
            >
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Jobs option clicked");
                  handleSearchTypeChange("jobs");
                }}
                style={{
                  padding: "12px 16px",
                  backgroundColor:
                    searchState.type === "jobs" ? "#dbeafe" : "white",
                  color: searchState.type === "jobs" ? "#1e40af" : "#374151",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: searchState.type === "jobs" ? "500" : "normal",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f3f4f6",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (searchState.type !== "jobs") {
                    e.target.style.backgroundColor = "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (searchState.type !== "jobs") {
                    e.target.style.backgroundColor = "white";
                  }
                }}
              >
                <span>Search Jobs</span>
                {searchState.type === "jobs" && (
                  <span style={{ color: "#3b82f6", fontSize: "12px" }}>✓</span>
                )}
              </div>
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Players option clicked");
                  handleSearchTypeChange("players");
                }}
                style={{
                  padding: "12px 16px",
                  backgroundColor:
                    searchState.type === "players" ? "#dbeafe" : "white",
                  color: searchState.type === "players" ? "#1e40af" : "#374151",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: searchState.type === "players" ? "500" : "normal",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (searchState.type !== "players") {
                    e.target.style.backgroundColor = "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (searchState.type !== "players") {
                    e.target.style.backgroundColor = "white";
                  }
                }}
              >
                <span>Search Players</span>
                {searchState.type === "players" && (
                  <span style={{ color: "#3b82f6", fontSize: "12px" }}>✓</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchControls;
