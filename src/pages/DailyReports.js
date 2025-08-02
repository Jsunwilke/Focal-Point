// src/pages/DailyReports.js
import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Search,
  X,
  Calendar,
  User,
  Camera,
  FileText,
  Download,
  Eye,
  Edit3,
  Save,
  XCircle,
  ChevronDown,
  ArrowUpDown,
  Image as ImageIcon,
  Filter,
  CalendarDays,
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useDataCache } from "../contexts/DataCacheContext";
import {
  subscribeToDailyJobReports,
  subscribeToNewDailyJobReports,
  updateDailyJobReport,
  deleteDailyJobReport,
  deleteDailyJobReportsBatch,
  getSchools,
  getTeamMembers,
} from "../firebase/firestore";
import { dailyJobReportsCacheService } from "../services/dailyJobReportsCacheService";
import { readCounter } from "../services/readCounter";
import Button from "../components/shared/Button";
import CreateReportModal from "../components/reports/CreateReportModal";
import ConfirmationModal from "../components/shared/ConfirmationModal";
import "./DailyReports.css";

// Global listener management to prevent duplicates across component instances
let globalListener = null;
let globalListenerOrgId = null;
let globalComponentInstances = new Set();

// Utility function to parse various date formats
const parseDateField = (dateField) => {
  if (!dateField) return null;
  
  let date;
  
  // Firebase Timestamp with seconds property
  if (dateField.seconds) {
    date = new Date(dateField.seconds * 1000);
  }
  // Firebase Timestamp with toDate method
  else if (typeof dateField.toDate === "function") {
    date = dateField.toDate();
  }
  // String date (YYYY-MM-DD or ISO format)
  else if (typeof dateField === 'string') {
    // For YYYY-MM-DD format, ensure proper parsing
    if (dateField.match(/^\d{4}-\d{2}-\d{2}$/)) {
      date = new Date(dateField + 'T00:00:00');
    } else {
      date = new Date(dateField);
    }
  }
  // Already a Date object
  else if (dateField instanceof Date) {
    date = dateField;
  }
  // Unknown format
  else {
    return null;
  }
  
  return isNaN(date.getTime()) ? null : date;
};

const DailyReports = () => {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();
  const { dailyJobReports: cachedReports, loading: { dailyJobReports: cacheLoading } } = useDataCache();
  
  // Component instance tracking
  const componentId = useMemo(() => `DailyReports-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  console.log(`[${componentId}] Component mounted/rendered`);
  
  // Make cache inspection available globally for debugging
  useEffect(() => {
    if (organization?.id) {
      window.inspectDailyReportsCache = () => {
        console.log(`[${componentId}] Manual cache inspection requested`);
        return dailyJobReportsCacheService.inspectCache(organization.id);
      };
      window.clearDailyReportsCache = () => {
        console.log(`[${componentId}] Manual cache clear requested`);
        dailyJobReportsCacheService.clearAllReportsCache(organization.id);
        console.log(`[${componentId}] Cache cleared`);
      };
    }
  }, [componentId, organization?.id]);
  
  // Register this component instance
  useEffect(() => {
    globalComponentInstances.add(componentId);
    console.log(`[${componentId}] Component registered. Total instances: ${globalComponentInstances.size}`);
    
    return () => {
      globalComponentInstances.delete(componentId);
      console.log(`[${componentId}] Component unregistered. Remaining instances: ${globalComponentInstances.size}`);
      
      // Use setTimeout to handle React Strict Mode cleanup gracefully
      // If no instances remain after a brief delay, clean up the listener
      setTimeout(() => {
        if (globalComponentInstances.size === 0 && globalListener) {
          console.log(`[${componentId}] No instances remaining after delay - cleaning up global listener`);
          globalListener();
          globalListener = null;
          globalListenerOrgId = null;
        }
      }, 100); // Small delay to allow for React Strict Mode remounting
    };
  }, [componentId]);
  
  const [reports, setReports] = useState([]);
  const [schools, setSchools] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState("database"); // 'card' or 'database'
  const [selectedReport, setSelectedReport] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImage, setCurrentImage] = useState("");
  const [editingReport, setEditingReport] = useState(null);
  const [loading, setLoading] = useState(false); // Local loading for component-specific operations
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState(null);
  
  // Use reports from DataCacheContext instead of managing our own
  const allReports = cachedReports || [];
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Date filtering state
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'week', 'month', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Advanced filters state
  const [selectedPhotographer, setSelectedPhotographer] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [reportsPerPage, setReportsPerPage] = useState(50);
  const [showPagination, setShowPagination] = useState(true);
  
  // Bulk selection state
  const [selectedReports, setSelectedReports] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Create report modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Report type filter state
  const [reportTypeFilter, setReportTypeFilter] = useState("all"); // 'all', 'template', 'legacy'
  
  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    reportToDelete: null,
    isBulkDelete: false,
    deleteCount: 0
  });
  
  // Real-time listener is now managed by DataCacheContext

  // Job description options (from your original app)
  const JOB_DESCRIPTION_OPTIONS = [
    "Fall Original Day",
    "Fall Makeup Day",
    "Classroom Groups",
    "Fall Sports",
    "Winter Sports",
    "Spring Sports",
    "Spring Photos",
    "Homecoming",
    "Prom",
    "Graduation",
    "Yearbook Candid's",
    "Yearbook Groups and Clubs",
    "Sports League",
    "District Office Photos",
    "Banner Photos",
    "In Studio Photos",
    "School Board Photos",
    "Dr. Office Head Shots",
    "Dr. Office Cards",
    "Dr. Office Candid's",
    "Deliveries",
    "NONE",
  ];

  const EXTRA_ITEMS_OPTIONS = [
    "Underclass Makeup",
    "Staff Makeup",
    "ID card Images",
    "Sports Makeup",
    "Class Groups",
    "Yearbook Groups and Clubs",
    "Class Candids",
    "Students from other schools",
    "Siblings",
    "Office Staff Photos",
    "Deliveries",
    "NONE",
  ];

  const RADIO_OPTIONS_YES_NO_NA = ["Yes", "No", "N/A"];
  const RADIO_OPTIONS_YES_NO = ["Yes", "No"];

  // Sort options
  const sortOptions = [
    { value: "date", label: "Date" },
    { value: "yourName", label: "Photographer" },
    { value: "schoolOrDestination", label: "School/Destination" },
    { value: "timestamp", label: "Submitted" },
  ];
  
  // Date filter options
  const dateFilterOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  // Table columns for database view
  const tableColumns = [
    { key: "select", label: "" }, // Checkbox column
    { key: "date", label: "Date" },
    { key: "yourName", label: "Photographer" },
    { key: "schoolOrDestination", label: "School/Destination" },
    { key: "jobDescriptions", label: "Job Descriptions" },
    { key: "extraItems", label: "Extra Items" },
    { key: "jobBoxAndCameraCards", label: "Job Box/Cards" },
    { key: "sportsBackgroundShot", label: "Sports BG Shot" },
    { key: "cardsScannedChoice", label: "Cards Scanned" },
    { key: "photoURLs", label: "Photo" },
    { key: "photoshootNoteText", label: "Photoshoot Notes" },
    { key: "jobDescriptionText", label: "Extra Notes" },
    { key: "actions", label: "Actions" }, // Quick actions column
  ];

  // Load data effect
  useEffect(() => {
    if (!organization?.id) return;
    
    const loadInitialData = async () => {
      try {
        setLoading(true);

        // Load schools and photographers
        const [schoolsData, photographersData] = await Promise.all([
          getSchools(organization.id),
          getTeamMembers(organization.id),
        ]);

        setSchools(schoolsData.map((s) => s.value || s.name));
        setPhotographers(
          photographersData.map((p) => p.firstName).filter(Boolean)
        );

        // Load all reports with cache-first approach
        await loadAllReports();
      } catch (err) {
        setError("Failed to load data");
        console.error("Error loading data:", err);
        setLoading(false);
      }
    };

    loadInitialData();
  }, [organization?.id]);

  // Function to load all reports (now just sets loading state since data comes from context)
  const loadAllReports = useCallback(async () => {
    if (!organization?.id) return;
    
    // Data is now managed by DataCacheContext, so we just need to handle loading state
    setLoading(false);
    setIsInitialLoad(false);
    
    // Clean up any existing global listeners since DataCacheContext handles this now
    if (globalListener) {
      console.log(`[DailyReports] Cleaning up legacy global listener`);
      globalListener();
      globalListener = null;
      globalListenerOrgId = null;
    }
  }, [organization?.id]);

  // Helper functions for template-based reports
  const isTemplateBased = (report) => {
    return report.templateId && report.customFields;
  };

  const getReportDisplayData = (report) => {
    if (isTemplateBased(report)) {
      // Template-based report
      return {
        photographer: report.yourName,
        school: report.customFields?.schools?.join?.(", ") || 
                report.customFields?.school || 
                report.schoolOrDestination ||
                "Unknown",
        templateName: report.templateName,
        customFields: report.customFields,
        isTemplate: true
      };
    } else {
      // Legacy report
      return {
        photographer: report.yourName,
        school: report.schoolOrDestination,
        jobDescriptions: report.jobDescriptions,
        extraItems: report.extraItems,
        isTemplate: false
      };
    }
  };

  // Helper function to check if a date falls within the selected range
  const isDateInRange = useCallback((reportDate) => {
    if (!reportDate || dateFilter === "all") return true;
    
    // Convert various date formats to Date object
    let date;
    if (reportDate.seconds) {
      // Firebase Timestamp with seconds property
      date = new Date(reportDate.seconds * 1000);
    } else if (typeof reportDate.toDate === 'function') {
      // Firebase Timestamp with toDate method
      date = reportDate.toDate();
    } else if (typeof reportDate === 'string') {
      // String date (YYYY-MM-DD or ISO format)
      // For YYYY-MM-DD format, ensure proper parsing by adding time
      if (reportDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(reportDate + 'T00:00:00');
      } else {
        date = new Date(reportDate);
      }
    } else if (reportDate instanceof Date) {
      // Already a Date object
      date = reportDate;
    } else {
      // Unknown format
      return true;
    }
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date in report:', reportDate);
      return true;
    }
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case "today":
        return date >= startOfToday;
      case "week":
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return date >= startOfWeek;
      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= startOfMonth;
      case "quarter":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
        return date >= startOfQuarter;
      case "year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return date >= startOfYear;
      case "custom":
        if (!customDateRange.start || !customDateRange.end) return true;
        const startDate = new Date(customDateRange.start);
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return date >= startDate && date <= endDate;
      default:
        return true;
    }
  }, [dateFilter, customDateRange]);

  // Client-side filtering, sorting, and pagination
  const filteredAndSortedReports = useMemo(() => {
    let filtered = allReports;

    // Filter by date range
    filtered = filtered.filter((report) => isDateInRange(report.date));
    
    // Filter by report type (template vs legacy)
    if (reportTypeFilter === "template") {
      filtered = filtered.filter((report) => isTemplateBased(report));
    } else if (reportTypeFilter === "legacy") {
      filtered = filtered.filter((report) => !isTemplateBased(report));
    }
    
    // Filter by photographer
    if (selectedPhotographer) {
      filtered = filtered.filter((report) => report.yourName === selectedPhotographer);
    }
    
    // Filter by school
    if (selectedSchool) {
      filtered = filtered.filter((report) => {
        const displayData = getReportDisplayData(report);
        return displayData.school?.includes(selectedSchool) || report.schoolOrDestination === selectedSchool;
      });
    }
    
    // Filter by job type
    if (selectedJobType) {
      filtered = filtered.filter((report) => {
        if (isTemplateBased(report)) {
          // For template-based reports, search in customFields
          const customFields = report.customFields || {};
          return Object.values(customFields).some(value => {
            if (Array.isArray(value)) {
              return value.includes(selectedJobType);
            }
            return String(value).includes(selectedJobType);
          });
        } else {
          // Legacy report filtering
          const jobTypes = Array.isArray(report.jobDescriptions) ? report.jobDescriptions : [];
          return jobTypes.includes(selectedJobType);
        }
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((report) => {
        const searchableFields = [
          report.yourName,
          report.schoolOrDestination,
          Array.isArray(report.jobDescriptions)
            ? report.jobDescriptions.join(" ")
            : "",
          Array.isArray(report.extraItems) ? report.extraItems.join(" ") : "",
          report.photoshootNoteText,
          report.jobDescriptionText,
          report.jobBoxAndCameraCards,
          report.sportsBackgroundShot,
          report.cardsScannedChoice,
        ];

        return searchableFields.some(
          (field) => field && String(field).toLowerCase().includes(term)
        );
      });
    }

    // Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle date fields
      if (sortField === "date" || sortField === "timestamp") {
        // Convert various date formats to timestamps for sorting
        const getDateValue = (dateField) => {
          if (!dateField) return 0;
          
          // Firebase Timestamp with seconds property
          if (dateField.seconds) {
            return dateField.seconds * 1000;
          }
          
          // Firebase Timestamp with toDate method
          if (typeof dateField.toDate === 'function') {
            return dateField.toDate().getTime();
          }
          
          // String date (YYYY-MM-DD or ISO format)
          if (typeof dateField === 'string') {
            const parsed = new Date(dateField);
            return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
          }
          
          // Already a Date object
          if (dateField instanceof Date) {
            return dateField.getTime();
          }
          
          return 0;
        };
        
        aValue = getDateValue(a[sortField]);
        bValue = getDateValue(b[sortField]);
      } else {
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return sorted;
  }, [allReports, searchTerm, sortField, sortDirection, isDateInRange, selectedPhotographer, selectedSchool, selectedJobType, reportTypeFilter, isTemplateBased, getReportDisplayData]);
  
  // Client-side pagination
  const paginatedReports = useMemo(() => {
    if (!showPagination) return filteredAndSortedReports;
    
    const startIndex = (currentPage - 1) * reportsPerPage;
    const endIndex = startIndex + reportsPerPage;
    return filteredAndSortedReports.slice(startIndex, endIndex);
  }, [filteredAndSortedReports, currentPage, reportsPerPage, showPagination]);
  
  const totalPages = Math.ceil(filteredAndSortedReports.length / reportsPerPage);
  
  // Update pagination metadata
  const paginationData = useMemo(() => ({
    currentPage,
    totalPages,
    totalReports: filteredAndSortedReports.length,
    reportsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  }), [currentPage, totalPages, filteredAndSortedReports.length, reportsPerPage]);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, selectedPhotographer, selectedSchool, selectedJobType, customDateRange, reportTypeFilter]);
  
  // Real-time listener is now managed by DataCacheContext, no cleanup needed here

  // Setup column resizing after table renders - simplified
  useEffect(() => {
    const timer = setTimeout(() => {
      const table = document.querySelector(".report-table");
      if (!table) return;

      // Fix column widths
      const cols = table.querySelectorAll("col");
      const ths = table.querySelectorAll("th");
      ths.forEach((th, index) => {
        const computedWidth = window.getComputedStyle(th).width;
        if (cols[index]) {
          cols[index].style.width = computedWidth;
        }
      });

      // Enable column resize
      const minWidth = 50;
      ths.forEach((th, index) => {
        const resizer = th.querySelector(".resizer");
        if (!resizer) return;

        // Remove existing event listeners to prevent duplicates
        resizer.removeEventListener("mousedown", resizer._resizeHandler);

        const resizeHandler = (e) => {
          e.preventDefault();
          let startX = e.clientX;
          const colCurrent = cols[index];
          const colNext = cols[index + 1];
          if (!colNext) return;

          const startWidthCurrent = colCurrent.offsetWidth;
          const startWidthNext = colNext.offsetWidth;

          const resizeColumn = (e) => {
            const delta = e.clientX - startX;
            let newWidthCurrent = startWidthCurrent + delta;
            let newWidthNext = startWidthNext - delta;

            if (newWidthCurrent < minWidth) {
              newWidthCurrent = minWidth;
              newWidthNext = startWidthCurrent + startWidthNext - minWidth;
            } else if (newWidthNext < minWidth) {
              newWidthNext = minWidth;
              newWidthCurrent = startWidthCurrent + startWidthNext - minWidth;
            }

            colCurrent.style.width = newWidthCurrent + "px";
            colNext.style.width = newWidthNext + "px";
          };

          const stopResize = () => {
            window.removeEventListener("mousemove", resizeColumn);
            window.removeEventListener("mouseup", stopResize);
          };

          window.addEventListener("mousemove", resizeColumn);
          window.addEventListener("mouseup", stopResize);
        };

        // Store the handler reference for cleanup
        resizer._resizeHandler = resizeHandler;
        resizer.addEventListener("mousedown", resizeHandler);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [reports]); // Only depend on reports, not the filtered/sorted data

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDateFilter("all");
    setCustomDateRange({ start: "", end: "" });
    setSelectedPhotographer("");
    setSelectedSchool("");
    setSelectedJobType("");
    // This will trigger the useEffect that switches back to browse mode
  }, []);

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setShowSortMenu(false);
    },
    [sortField, sortDirection]
  );

  const getCurrentSortLabel = useCallback(() => {
    const option = sortOptions.find((opt) => opt.value === sortField);
    const direction = sortDirection === "asc" ? "A-Z" : "Z-A";
    return `${option?.label || "Date"} (${direction})`;
  }, [sortField, sortDirection]);

  const formatDate = useCallback((dateField) => {
    const date = parseDateField(dateField);
    return date ? date.toLocaleDateString() : "N/A";
  }, []);

  const openImageModal = useCallback((imageSrc) => {
    setCurrentImage(imageSrc);
    setShowImageModal(true);
  }, []);

  const openReportModal = useCallback((report) => {
    setSelectedReport(report);
  }, []);

  const closeReportModal = useCallback(() => {
    setSelectedReport(null);
    setEditingReport(null);
  }, []);

  const startEditing = useCallback((report) => {
    setEditingReport({ ...report });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingReport || !editingReport.id) return;
    
    try {
      const { id, ...reportData } = editingReport;
      await updateDailyJobReport(id, reportData);
      setEditingReport(null);
      setSelectedReport(null);
    } catch (error) {
      console.error("Error saving report:", error);
      showToast('Save Failed', 'Failed to save changes. Please try again.', 'error');
    }
  }, [editingReport]);

  const cancelEdit = useCallback(() => {
    setEditingReport(null);
  }, []);
  
  // Date filter handlers
  const handleDateFilterChange = useCallback((filterType) => {
    setDateFilter(filterType);
    if (filterType !== "custom") {
      setCustomDateRange({ start: "", end: "" });
    }
    setShowDatePicker(false);
  }, []);
  
  const handleCustomDateChange = useCallback((field, value) => {
    setCustomDateRange(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const clearAllFilters = useCallback(() => {
    setDateFilter("all");
    setCustomDateRange({ start: "", end: "" });
    setSelectedPhotographer("");
    setSelectedSchool("");
    setSelectedJobType("");
    setReportTypeFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
    // This will trigger the useEffect that switches back to browse mode
  }, []);
  
  // Pagination handlers
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    // Scroll to top of reports list
    const reportsElement = document.querySelector('.reports-list');
    if (reportsElement) {
      reportsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  
  const handleReportsPerPageChange = useCallback((newPerPage) => {
    setReportsPerPage(Number(newPerPage));
    setCurrentPage(1);
  }, []);
  
  const togglePagination = useCallback(() => {
    setShowPagination(!showPagination);
    setCurrentPage(1);
  }, [showPagination]);
  
  // Bulk selection handlers
  const handleSelectReport = useCallback((reportId, checked) => {
    setSelectedReports(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(reportId);
      } else {
        newSet.delete(reportId);
      }
      return newSet;
    });
  }, []);
  
  const handleSelectAll = useCallback((checked) => {
    if (checked) {
      const currentReports = showPagination ? paginatedReports : filteredAndSortedReports;
      setSelectedReports(new Set(currentReports.map(r => r.id)));
    } else {
      setSelectedReports(new Set());
    }
  }, [showPagination, paginatedReports, filteredAndSortedReports]);
  
  const clearSelection = useCallback(() => {
    setSelectedReports(new Set());
    setShowBulkActions(false);
  }, []);
  
  const bulkExportSelected = useCallback(() => {
    const selectedReportsData = filteredAndSortedReports.filter(report => 
      selectedReports.has(report.id)
    );
    
    if (selectedReportsData.length === 0) {
      showToast('No Selection', 'No reports selected for export', 'warning');
      return;
    }
    
    // Use the same export logic but with selected reports
    const headers = [
      'Date', 'Photographer', 'School/Destination', 'Job Descriptions',
      'Extra Items', 'Job Box/Cards', 'Sports BG Shot', 'Cards Scanned',
      'Photo Count', 'Photoshoot Notes', 'Extra Notes', 'Submitted Date'
    ];
    
    const csvRows = selectedReportsData.map(report => {
      const formatDateForCSV = (dateField) => {
        const date = parseDateField(dateField);
        return date ? date.toLocaleDateString() : '';
      };
      
      return [
        formatDateForCSV(report.date),
        report.yourName || '',
        report.schoolOrDestination || '',
        Array.isArray(report.jobDescriptions) ? report.jobDescriptions.join('; ') : '',
        Array.isArray(report.extraItems) ? report.extraItems.join('; ') : '',
        report.jobBoxAndCameraCards || '',
        report.sportsBackgroundShot || '',
        report.cardsScannedChoice || '',
        report.photoURLs ? report.photoURLs.length : 0,
        report.photoshootNoteText || '',
        report.jobDescriptionText || '',
        formatDateForCSV(report.timestamp)
      ].map(field => `"${String(field).replace(/"/g, '""')}"`); // Escape quotes
    });
    
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `selected-reports-${dateStr}-${selectedReportsData.length}items.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    clearSelection();
  }, [selectedReports, reports, clearSelection]);
  
  const bulkDeleteSelected = useCallback(() => {
    if (selectedReports.size === 0) {
      showToast('No Selection', 'No reports selected for deletion', 'warning');
      return;
    }
    
    // Open confirmation modal for bulk delete
    setDeleteModal({
      isOpen: true,
      reportToDelete: null,
      isBulkDelete: true,
      deleteCount: selectedReports.size
    });
  }, [selectedReports, showToast]);
  
  // Clear search cache when needed
  const clearSearchCache = useCallback(() => {
    // Clear any legacy search cache if needed
    // No longer needed since we use client-side operations
  }, []);
  
  // Quick action handlers
  const handleQuickEdit = useCallback((report, e) => {
    e.stopPropagation();
    startEditing(report);
  }, [startEditing]);
  
  const handleQuickView = useCallback((report, e) => {
    e.stopPropagation();
    openReportModal(report);
  }, [openReportModal]);
  
  const handleQuickDelete = useCallback((report, e) => {
    e.stopPropagation();
    
    // Open confirmation modal
    setDeleteModal({
      isOpen: true,
      reportToDelete: report,
      isBulkDelete: false,
      deleteCount: 1
    });
  }, []);
  
  const handleConfirmDelete = useCallback(async () => {
    const { reportToDelete, isBulkDelete } = deleteModal;
    
    try {
      if (isBulkDelete) {
        // Handle bulk delete
        const reportIds = Array.from(selectedReports);
        console.log('[DailyReports] Attempting bulk delete of reports:', reportIds);
        
        // Delete from Firestore using batch operation
        const result = await deleteDailyJobReportsBatch(reportIds);
        
        console.log('[DailyReports] Bulk delete result:', result);
        
        if (result.success) {
          // Remove each report from cache
          reportIds.forEach(reportId => {
            dailyJobReportsCacheService.removeReportFromCache(organization.id, reportId);
          });
          
          // Update local state to immediately reflect the deletion
          setAllReports(prevReports => 
            prevReports.filter(report => !reportIds.includes(report.id))
          );
          
          // Clear selection
          setSelectedReports(new Set());
          setShowBulkActions(false);
          
          showToast('Reports Deleted', `Successfully deleted ${result.deletedCount} reports`, 'success');
          console.log(`[DailyReports] Successfully bulk deleted ${result.deletedCount} reports`);
        } else {
          throw new Error(result.error || 'Failed to delete reports');
        }
      } else {
        // Handle single delete
        console.log('[DailyReports] Attempting to delete report:', reportToDelete.id);
        
        // Delete from Firestore
        const result = await deleteDailyJobReport(reportToDelete.id);
        
        console.log('[DailyReports] Delete result:', result);
        
        if (result.success) {
          // Remove from cache
          dailyJobReportsCacheService.removeReportFromCache(organization.id, reportToDelete.id);
          
          // Update local state to immediately reflect the deletion
          setAllReports(prevReports => prevReports.filter(r => r.id !== reportToDelete.id));
          
          // Clear from selection if it was selected
          setSelectedReports(prev => {
            const newSet = new Set(prev);
            newSet.delete(reportToDelete.id);
            return newSet;
          });
          
          showToast('Report Deleted', 'Report has been successfully deleted', 'success');
          console.log(`[DailyReports] Successfully deleted report ${reportToDelete.id}`);
        } else {
          console.error('[DailyReports] Delete failed:', result.error);
          throw new Error(result.error || 'Failed to delete report');
        }
      }
      
      // Close modal
      setDeleteModal({
        isOpen: false,
        reportToDelete: null,
        isBulkDelete: false,
        deleteCount: 0
      });
    } catch (error) {
      console.error('[DailyReports] Error deleting report(s):', error);
      console.error('[DailyReports] Error details:', error.message, error.code);
      showToast('Delete Failed', error.message || 'An error occurred while deleting', 'error');
    }
  }, [deleteModal, selectedReports, organization, showToast]);
  
  const handleQuickExport = useCallback((report, e) => {
    e.stopPropagation();
    
    // Export single report as CSV
    const headers = [
      'Date', 'Photographer', 'School/Destination', 'Job Descriptions',
      'Extra Items', 'Job Box/Cards', 'Sports BG Shot', 'Cards Scanned',
      'Photo Count', 'Photoshoot Notes', 'Extra Notes', 'Submitted Date'
    ];
    
    const formatDateForCSV = (dateField) => {
      const date = parseDateField(dateField);
      return date ? date.toLocaleDateString() : '';
    };
    
    const csvRow = [
      formatDateForCSV(report.date),
      report.yourName || '',
      report.schoolOrDestination || '',
      Array.isArray(report.jobDescriptions) ? report.jobDescriptions.join('; ') : '',
      Array.isArray(report.extraItems) ? report.extraItems.join('; ') : '',
      report.jobBoxAndCameraCards || '',
      report.sportsBackgroundShot || '',
      report.cardsScannedChoice || '',
      report.photoURLs ? report.photoURLs.length : 0,
      report.photoshootNoteText || '',
      report.jobDescriptionText || '',
      formatDateForCSV(report.timestamp)
    ].map(field => `"${String(field).replace(/"/g, '""')}"`); // Escape quotes
    
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      csvRow.join(',')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const dateStr = formatDate(report.date).replace(/\//g, '-');
      const photographer = (report.yourName || 'unknown').replace(/\s+/g, '-');
      const filename = `report-${photographer}-${dateStr}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);
  
  // Check if all current page reports are selected
  const isAllCurrentPageSelected = useMemo(() => {
    const currentReports = paginatedReports;
    return currentReports.length > 0 && currentReports.every(report => selectedReports.has(report.id));
  }, [paginatedReports, selectedReports]);
  
  // Check if some reports are selected
  const isSomeSelected = selectedReports.size > 0;
  
  // Clear selection when filters change
  useEffect(() => {
    if (selectedReports.size > 0) {
      clearSelection();
    }
  }, [searchTerm, dateFilter, selectedPhotographer, selectedSchool, selectedJobType, customDateRange]);
  
  // Export functionality
  const exportToCSV = useCallback(() => {
    if (filteredAndSortedReports.length === 0) {
      showToast('No Data', 'No reports to export', 'warning');
      return;
    }
    
    // Define CSV headers
    const headers = [
      'Date',
      'Photographer',
      'School/Destination',
      'Job Descriptions',
      'Extra Items',
      'Job Box/Cards',
      'Sports BG Shot',
      'Cards Scanned',
      'Photo Count',
      'Photoshoot Notes',
      'Extra Notes',
      'Submitted Date'
    ];
    
    // Convert reports to CSV rows
    const csvRows = filteredAndSortedReports.map(report => {
      const formatDate = (dateField) => {
        if (!dateField) return '';
        if (typeof dateField.toDate === 'function') {
          return dateField.toDate().toLocaleDateString();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
      };
      
      return [
        formatDateForCSV(report.date),
        report.yourName || '',
        report.schoolOrDestination || '',
        Array.isArray(report.jobDescriptions) ? report.jobDescriptions.join('; ') : '',
        Array.isArray(report.extraItems) ? report.extraItems.join('; ') : '',
        report.jobBoxAndCameraCards || '',
        report.sportsBackgroundShot || '',
        report.cardsScannedChoice || '',
        report.photoURLs ? report.photoURLs.length : 0,
        report.photoshootNoteText || '',
        report.jobDescriptionText || '',
        formatDateForCSV(report.timestamp)
      ].map(field => `"${String(field).replace(/"/g, '""')}"`); // Escape quotes
    });
    
    // Create CSV content
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date and filter info
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      let filename = `daily-reports-${dateStr}`;
      
      if (dateFilter !== 'all') {
        filename += `-${dateFilter}`;
      }
      if (selectedPhotographer) {
        filename += `-${selectedPhotographer.replace(/\s+/g, '-')}`;
      }
      if (selectedSchool) {
        filename += `-${selectedSchool.replace(/\s+/g, '-')}`;
      }
      
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [reports, dateFilter, selectedPhotographer, selectedSchool]);
  
  const exportToJSON = useCallback(() => {
    if (filteredAndSortedReports.length === 0) {
      showToast('No Data', 'No reports to export', 'warning');
      return;
    }
    
    // Format data for JSON export
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        totalReports: filteredAndSortedReports.length,
        filters: {
          dateFilter,
          customDateRange: customDateRange.start || customDateRange.end ? customDateRange : null,
          photographer: selectedPhotographer || null,
          school: selectedSchool || null,
          jobType: selectedJobType || null,
          searchTerm: searchTerm || null
        }
      },
      reports: filteredAndSortedReports.map(report => ({
        ...report,
        date: report.date?.toDate ? report.date.toDate().toISOString() : report.date,
        timestamp: report.timestamp?.toDate ? report.timestamp.toDate().toISOString() : report.timestamp
      }))
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      let filename = `daily-reports-${dateStr}`;
      
      if (dateFilter !== 'all') filename += `-${dateFilter}`;
      if (selectedPhotographer) filename += `-${selectedPhotographer.replace(/\s+/g, '-')}`;
      if (selectedSchool) filename += `-${selectedSchool.replace(/\s+/g, '-')}`;
      
      link.setAttribute('download', `${filename}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [reports, dateFilter, customDateRange, selectedPhotographer, selectedSchool, selectedJobType, searchTerm]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts when not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      
      // Don't handle shortcuts when modals are open
      if (selectedReport || editingReport || showImageModal) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Focus search input
            const searchInput = document.querySelector('.reports-search__input');
            if (searchInput) {
              searchInput.focus();
            }
          }
          break;
          
        case 'e':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Export current filtered results
            exportToCSV();
          }
          break;
          
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Select all visible reports
            handleSelectAll(true);
          }
          break;
          
        case 'escape':
          // Clear selection or search
          if (selectedReports.size > 0) {
            clearSelection();
          } else if (searchTerm) {
            clearSearch();
          }
          break;
          
        case 'arrowleft':
          if (showPagination && currentPage > 1) {
            e.preventDefault();
            handlePageChange(currentPage - 1);
          }
          break;
          
        case 'arrowright':
          if (showPagination && currentPage < totalPages) {
            e.preventDefault();
            handlePageChange(currentPage + 1);
          }
          break;
          
        case 'home':
          if (showPagination && currentPage !== 1) {
            e.preventDefault();
            handlePageChange(1);
          }
          break;
          
        case 'end':
          if (showPagination && currentPage !== totalPages) {
            e.preventDefault();
            handlePageChange(totalPages);
          }
          break;
          
        case 'v':
          // Toggle view mode
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setViewMode(viewMode === 'card' ? 'database' : 'card');
          }
          break;
          
        case 'd':
          // Delete selected reports
          if (selectedReports.size > 0 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            bulkDeleteSelected();
          }
          break;
          
        case '?':
          if (e.shiftKey) {
            e.preventDefault();
            // Show keyboard shortcuts help
            setShowKeyboardHelp(true);
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedReport, editingReport, showImageModal, selectedReports, searchTerm, currentPage, totalPages, showPagination, viewMode, exportToCSV, handleSelectAll, clearSelection, clearSearch, handlePageChange, bulkDeleteSelected]);
  
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (dateFilter !== "all") count++;
    if (selectedPhotographer) count++;
    if (selectedSchool) count++;
    if (selectedJobType) count++;
    if (searchTerm) count++;
    return count;
  }, [dateFilter, selectedPhotographer, selectedSchool, selectedJobType, searchTerm]);
  
  const getCurrentDateFilterLabel = useCallback(() => {
    const option = dateFilterOptions.find(opt => opt.value === dateFilter);
    if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
      const start = new Date(customDateRange.start).toLocaleDateString();
      const end = new Date(customDateRange.end).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return option?.label || "All Time";
  }, [dateFilter, customDateRange, dateFilterOptions]);
  
  // Export functionality
  // Render card view
  const renderCardView = () => {
    const reportsToShow = paginatedReports;
    return (
      <div className="reports-cards">
        {reportsToShow.map((report) => {
          const displayData = getReportDisplayData(report);
          
          return (
            <div
              key={report.id}
              className={`report-card ${displayData.isTemplate ? 'report-card--template' : 'report-card--legacy'}`}
              onClick={() => openReportModal(report)}
            >
              <div className="report-header">
                <h2 className="report-title">{displayData.photographer || "Unknown"}</h2>
                <div className="header-footer">
                  <p className="school-name">{displayData.school}</p>
                  <p className="report-date">{formatDate(report.date)}</p>
                  {displayData.isTemplate && (
                    <span className="template-badge">{displayData.templateName}</span>
                  )}
                </div>
              </div>
              <div className="report-content">
                {displayData.isTemplate ? (
                  // Template-based report content
                  <>
                    {displayData.customFields && Object.entries(displayData.customFields).map(([key, value]) => {
                      if (!value || key === 'schools' || key === 'school') return null;
                      
                      let displayValue = value;
                      if (Array.isArray(value)) {
                        displayValue = value.join(", ");
                      } else if (typeof value === 'boolean') {
                        displayValue = value ? "Yes" : "No";
                      }
                      
                      return (
                        <p key={key}>
                          <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {displayValue}
                        </p>
                      );
                    })}
                  </>
                ) : (
                  // Legacy report content
                  <>
                    <p><strong>Job Descriptions:</strong> {(report.jobDescriptions || []).join(", ")}</p>
                    <p><strong>Extra Items:</strong> {(report.extraItems || []).join(", ")}</p>
                    <p><strong>Job Box/Cards:</strong> {report.jobBoxAndCameraCards || "N/A"}</p>
                    <p><strong>Sports BG Shot:</strong> {report.sportsBackgroundShot || "N/A"}</p>
                    <p><strong>Cards Scanned:</strong> {report.cardsScannedChoice || "N/A"}</p>
                    {(report.photoshootNoteText || report.jobDescriptionText) && (
                      <div className="notes-box">
                        {report.photoshootNoteText && (
                          <p><strong>Photoshoot Notes:</strong> {report.photoshootNoteText}</p>
                        )}
                        {report.jobDescriptionText && (
                          <p><strong>Extra Notes:</strong> {report.jobDescriptionText}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Photos section for both types */}
                {report.photoURLs && report.photoURLs.length > 0 && (
                  <div className="card-photos">
                    {report.photoURLs.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt="Daily Job Photo"
                        className="card-photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImageModal(url);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (cacheLoading || loading) {
    return (
      <div className="reports-loading">
        <p>Loading daily reports...</p>
      </div>
    );
  }

  return (
    <div className="daily-reports">
      <div className="reports-header">
        <div className="reports-header__content">
          <div className="reports-header__text">
            <h1 className="reports-title">Daily Reports</h1>
            <p className="reports-subtitle">
              View and manage daily job reports from your photography team
            </p>
          </div>
          <div className="reports-header__actions">
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Report
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="reports-error">{error}</div>}
      
      {/* Data info banner */}
      {!isInitialLoad && (
        <div className="reports-metadata-banner">
          <div className="reports-metadata-info">
            <CalendarDays size={16} />
            <span>
              📄 {allReports.length} total reports • 
              {filteredAndSortedReports.length} filtered • 
              Page {currentPage} of {totalPages} • 
              Live Updates Enabled
            </span>
          </div>
          <div className="reports-metadata-hint">
            <span>
              {searchTerm || dateFilter !== 'all' || selectedPhotographer || selectedSchool || selectedJobType ? (
                <>
                  Filters active • 
                  <button 
                    onClick={clearAllFilters} 
                    style={{marginLeft: '8px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'}}
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                'All reports loaded • Real-time updates enabled • Search instantly filters from cache'
              )}
            </span>
          </div>
        </div>
      )}

      <div className="reports-content">
        {/* Enhanced Analytics Dashboard */}
        <div className="reports-analytics">
          <div className="reports-stats">
            <div className="reports-stat">
              <h3 className="reports-stat__number">{filteredAndSortedReports.length}</h3>
              <p className="reports-stat__label">Filtered Reports</p>
              <span className="reports-stat__trend">
                {allReports.length > 0 && `${Math.round((filteredAndSortedReports.length / allReports.length) * 100)}% of total`}
              </span>
            </div>
            <div className="reports-stat">
              <h3 className="reports-stat__number">
                {
                  filteredAndSortedReports.filter((r) => r.photoURLs && r.photoURLs.length > 0)
                    .length
                }
              </h3>
              <p className="reports-stat__label">With Photos</p>
              <span className="reports-stat__trend">
                {filteredAndSortedReports.length > 0 && 
                  `${Math.round((filteredAndSortedReports.filter((r) => r.photoURLs && r.photoURLs.length > 0).length / filteredAndSortedReports.length) * 100)}% completion`
                }
              </span>
            </div>
            <div className="reports-stat">
              <h3 className="reports-stat__number">
                {new Set(filteredAndSortedReports.map((r) => r.yourName)).size}
              </h3>
              <p className="reports-stat__label">Active Photographers</p>
              <span className="reports-stat__trend">
                {filteredAndSortedReports.length > 0 && 
                  `${(filteredAndSortedReports.length / new Set(filteredAndSortedReports.map((r) => r.yourName)).size).toFixed(1)} avg per person`
                }
              </span>
            </div>
            <div className="reports-stat">
              <h3 className="reports-stat__number">
                {
                  filteredAndSortedReports.reduce((total, report) => {
                    return total + (report.photoURLs ? report.photoURLs.length : 0);
                  }, 0)
                }
              </h3>
              <p className="reports-stat__label">Total Photos</p>
              <span className="reports-stat__trend">
                {filteredAndSortedReports.length > 0 && 
                  `${(filteredAndSortedReports.reduce((total, report) => total + (report.photoURLs ? report.photoURLs.length : 0), 0) / filteredAndSortedReports.length).toFixed(1)} avg per report`
                }
              </span>
            </div>
            <div className="reports-stat">
              <h3 className="reports-stat__number">
                {new Set(filteredAndSortedReports.map((r) => r.schoolOrDestination)).size}
              </h3>
              <p className="reports-stat__label">Schools Covered</p>
              <span className="reports-stat__trend">
                {schools.length > 0 && 
                  `${Math.round((new Set(filteredAndSortedReports.map((r) => r.schoolOrDestination)).size / schools.length) * 100)}% of total schools`
                }
              </span>
            </div>
            <div className="reports-stat reports-stat--highlight">
              <h3 className="reports-stat__number">
                {
                  (() => {
                    const jobTypeCounts = {};
                    reports.forEach(report => {
                      if (Array.isArray(report.jobDescriptions)) {
                        report.jobDescriptions.forEach(job => {
                          jobTypeCounts[job] = (jobTypeCounts[job] || 0) + 1;
                        });
                      }
                    });
                    const mostCommon = Object.entries(jobTypeCounts).sort((a, b) => b[1] - a[1])[0];
                    return mostCommon ? mostCommon[1] : 0;
                  })()
                }
              </h3>
              <p className="reports-stat__label">Most Common Job</p>
              <span className="reports-stat__trend">
                {
                  (() => {
                    const jobTypeCounts = {};
                    reports.forEach(report => {
                      if (Array.isArray(report.jobDescriptions)) {
                        report.jobDescriptions.forEach(job => {
                          jobTypeCounts[job] = (jobTypeCounts[job] || 0) + 1;
                        });
                      }
                    });
                    const mostCommon = Object.entries(jobTypeCounts).sort((a, b) => b[1] - a[1])[0];
                    return mostCommon ? mostCommon[0] : "None";
                  })()
                }
              </span>
            </div>
          </div>
          
          {/* Job Type Distribution Chart */}
          {filteredAndSortedReports.length > 0 && (
            <div className="reports-chart">
              <h3 className="reports-chart__title">Job Type Distribution</h3>
              <div className="job-type-chart">
                {
                  (() => {
                    const jobTypeCounts = {};
                    let totalJobs = 0;
                    
                    reports.forEach(report => {
                      if (Array.isArray(report.jobDescriptions)) {
                        report.jobDescriptions.forEach(job => {
                          jobTypeCounts[job] = (jobTypeCounts[job] || 0) + 1;
                          totalJobs++;
                        });
                      }
                    });
                    
                    const sortedJobTypes = Object.entries(jobTypeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8); // Show top 8 job types
                    
                    return sortedJobTypes.map(([jobType, count]) => {
                      const percentage = totalJobs > 0 ? (count / totalJobs) * 100 : 0;
                      return (
                        <div key={jobType} className="job-type-bar">
                          <div className="job-type-info">
                            <span className="job-type-name">{jobType}</span>
                            <span className="job-type-count">{count} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="job-type-progress">
                            <div 
                              className="job-type-progress-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                }
              </div>
            </div>
          )}
          
          {/* Photographer Performance Chart */}
          {filteredAndSortedReports.length > 0 && (
            <div className="reports-chart">
              <h3 className="reports-chart__title">Photographer Activity</h3>
              <div className="photographer-chart">
                {
                  (() => {
                    const photographerStats = {};
                    
                    reports.forEach(report => {
                      const name = report.yourName || 'Unknown';
                      if (!photographerStats[name]) {
                        photographerStats[name] = {
                          reports: 0,
                          photos: 0,
                          schools: new Set()
                        };
                      }
                      photographerStats[name].reports += 1;
                      photographerStats[name].photos += report.photoURLs ? report.photoURLs.length : 0;
                      if (report.schoolOrDestination) {
                        photographerStats[name].schools.add(report.schoolOrDestination);
                      }
                    });
                    
                    const sortedPhotographers = Object.entries(photographerStats)
                      .map(([name, stats]) => ({
                        name,
                        reports: stats.reports,
                        photos: stats.photos,
                        schools: stats.schools.size
                      }))
                      .sort((a, b) => b.reports - a.reports)
                      .slice(0, 6); // Show top 6 photographers
                    
                    const maxReports = Math.max(...sortedPhotographers.map(p => p.reports));
                    
                    return sortedPhotographers.map((photographer) => {
                      const percentage = maxReports > 0 ? (photographer.reports / maxReports) * 100 : 0;
                      return (
                        <div key={photographer.name} className="photographer-bar">
                          <div className="photographer-info">
                            <span className="photographer-name">{photographer.name}</span>
                            <span className="photographer-stats">
                              {photographer.reports} reports • {photographer.photos} photos • {photographer.schools} schools
                            </span>
                          </div>
                          <div className="photographer-progress">
                            <div 
                              className="photographer-progress-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                }
              </div>
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="reports-controls">
          {/* Search Bar */}
          <div className="reports-search">
            <div className="reports-search__input-wrapper">
              <Search size={16} className="reports-search__icon" />
              <input
                type="text"
                placeholder="Search reports by photographer, school, notes..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="reports-search__input"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="reports-search__clear">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Date Filter */}
          <div className="reports-date-filter">
            <button
              className="reports-date-filter__button"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <CalendarDays size={16} />
              <span>{getCurrentDateFilterLabel()}</span>
              <ChevronDown size={16} />
            </button>

            {showDatePicker && (
              <div className="reports-date-filter__menu">
                {dateFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`reports-date-filter__option ${
                      dateFilter === option.value
                        ? "reports-date-filter__option--active"
                        : ""
                    }`}
                    onClick={() => handleDateFilterChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
                {dateFilter === "custom" && (
                  <div className="custom-date-range">
                    <div className="custom-date-inputs">
                      <input
                        type="date"
                        placeholder="Start date"
                        value={customDateRange.start}
                        onChange={(e) => handleCustomDateChange("start", e.target.value)}
                        className="custom-date-input"
                      />
                      <input
                        type="date"
                        placeholder="End date"
                        value={customDateRange.end}
                        onChange={(e) => handleCustomDateChange("end", e.target.value)}
                        className="custom-date-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Filters Toggle */}
          <div className="reports-advanced-filters">
            <button
              className={`reports-advanced-filters__toggle ${
                showAdvancedFilters ? "reports-advanced-filters__toggle--active" : ""
              }`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter size={16} />
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="filter-count">{getActiveFilterCount()}</span>
              )}
              <ChevronDown size={16} />
            </button>
          </div>
          
          {/* Export Dropdown */}
          <div className="reports-export">
            <div className="dropdown">
              <button
                className="reports-export__button"
                onClick={() => setShowSortMenu(false)} // Close sort menu if open
                disabled={filteredAndSortedReports.length === 0}
              >
                <Download size={16} />
                <span>Export ({filteredAndSortedReports.length})</span>
                <ChevronDown size={16} />
              </button>
              <div className="reports-export__menu">
                <button
                  className="reports-export__option"
                  onClick={exportToCSV}
                  disabled={filteredAndSortedReports.length === 0}
                >
                  <FileSpreadsheet size={16} />
                  <div className="export-option-info">
                    <span className="export-option-title">CSV Format</span>
                    <span className="export-option-desc">Spreadsheet compatible</span>
                  </div>
                </button>
                <button
                  className="reports-export__option"
                  onClick={exportToJSON}
                  disabled={filteredAndSortedReports.length === 0}
                >
                  <FileText size={16} />
                  <div className="export-option-info">
                    <span className="export-option-title">JSON Format</span>
                    <span className="export-option-desc">Full data with metadata</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Report Type Filter */}
          <div className="reports-type-filter">
            <select
              value={reportTypeFilter}
              onChange={(e) => setReportTypeFilter(e.target.value)}
              className="reports-type-filter__select"
            >
              <option value="all">All Reports</option>
              <option value="template">Template-Based</option>
              <option value="legacy">Legacy Reports</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="toggle-switch">
            <label>
              <input
                type="checkbox"
                checked={viewMode === "database"}
                onChange={(e) => setViewMode(e.target.checked ? "database" : "card")}
              />
              Database View
            </label>
          </div>

          {/* Sort Menu */}
          <div className="reports-sort">
            <button
              className="reports-sort__button"
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown size={16} />
              <span>Sort: {getCurrentSortLabel()}</span>
              <ChevronDown size={16} />
            </button>

            {showSortMenu && (
              <div className="reports-sort__menu">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`reports-sort__option ${
                      sortField === option.value
                        ? "reports-sort__option--active"
                        : ""
                    }`}
                    onClick={() => handleSort(option.value)}
                  >
                    <span>{option.label}</span>
                    {sortField === option.value && (
                      <span className="reports-sort__direction">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="reports-advanced-panel">
            <div className="advanced-filters-grid">
              <div className="filter-group">
                <label className="filter-label">Photographer</label>
                <select
                  value={selectedPhotographer}
                  onChange={(e) => setSelectedPhotographer(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Photographers</option>
                  {photographers.map((photographer) => (
                    <option key={photographer} value={photographer}>
                      {photographer}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">School</label>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Schools</option>
                  {schools.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Job Type</label>
                <select
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Job Types</option>
                  {JOB_DESCRIPTION_OPTIONS.map((jobType) => (
                    <option key={jobType} value={jobType}>
                      {jobType}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <Button variant="secondary" onClick={clearAllFilters}>
                  <X size={16} />
                  Clear All Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reports Table/Cards */}
        <div className="reports-list">
          {filteredAndSortedReports.length === 0 ? (
            <div className="reports-empty">
              <FileText size={48} className="reports-empty__icon" />
              {searchTerm ? (
                <>
                  <h3 className="reports-empty__title">No reports found</h3>
                  <p className="reports-empty__description">
                    No reports match your search for "{searchTerm}"
                  </p>
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="reports-empty__title">No daily reports yet</h3>
                  <p className="reports-empty__description">
                    Daily job reports submitted by your team will appear here
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              {isSomeSelected && (
                <div className="bulk-actions-bar">
                  <div className="bulk-actions-info">
                    <span className="bulk-selection-count">
                      {selectedReports.size} report{selectedReports.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  
                  <div className="bulk-actions-buttons">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={bulkExportSelected}
                    >
                      <Download size={14} />
                      Export Selected
                    </Button>
                    
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={bulkDeleteSelected}
                    >
                      <X size={14} />
                      Delete Selected
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Pagination Controls - Top */}
              {pagination && pagination.totalReports > 10 && (
                <div className="pagination-controls pagination-controls--top">
                  <div className="pagination-info">
                    <span className="pagination-summary">
                      Showing {((currentPage - 1) * reportsPerPage + 1)}-
                      {Math.min(currentPage * reportsPerPage, pagination.totalReports)} of {pagination.totalReports} reports
                    </span>
                  </div>
                  
                  <div className="pagination-options">
                    <label className="pagination-option">
                      <input
                        type="checkbox"
                        checked={!showPagination}
                        onChange={togglePagination}
                      />
                      Show all
                    </label>
                    
                    {showPagination && (
                      <label className="pagination-option">
                        Per page:
                        <select
                          value={reportsPerPage}
                          onChange={(e) => handleReportsPerPageChange(e.target.value)}
                          className="pagination-select"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              )}
              
              {/* Reports Display */}
              {viewMode === "card" ? (
                renderCardView()
              ) : (
                <div className="reports-table-container">
                  <table className="report-table">
                    <colgroup>
                      {tableColumns.map((column, index) => (
                        <col key={index} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {tableColumns.map((column) => (
                          <th key={column.key} data-col={column.key}>
                            {column.key === "select" ? (
                              <input
                                type="checkbox"
                                checked={isAllCurrentPageSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="bulk-select-checkbox"
                                title="Select all visible reports"
                              />
                            ) : (
                              <>
                                <span
                                  className="sort-trigger"
                                  onClick={() => handleSort(column.key)}
                                >
                                  {column.label}
                                </span>
                                <span
                                  className="sort-icon"
                                  onClick={() => handleSort(column.key)}
                                >
                                  {sortField === column.key
                                    ? sortDirection === "asc"
                                      ? " ▲"
                                      : " ▼"
                                    : ""}
                                </span>
                                <div className="resizer"></div>
                              </>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedReports.map((report) => (
                        <tr 
                          key={report.id} 
                          className={selectedReports.has(report.id) ? 'row-selected' : ''}
                          onClick={(e) => {
                            // Don't open modal if clicking on checkbox
                            if (e.target.type !== 'checkbox') {
                              openReportModal(report);
                            }
                          }}
                        >
                          {tableColumns.map((column) => (
                            <td key={column.key}>
                              {column.key === "select" ? (
                                <input
                                  type="checkbox"
                                  checked={selectedReports.has(report.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleSelectReport(report.id, e.target.checked);
                                  }}
                                  className="row-select-checkbox"
                                />
                              ) : column.key === "date" ? (
                                formatDate(report[column.key])
                              ) : column.key === "photoURLs" ? (
                                report.photoURLs && report.photoURLs.length > 0 ? (
                                  <img
                                    src={report.photoURLs[0]}
                                    alt="Thumbnail"
                                    className="thumbnail"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImageModal(report.photoURLs[0]);
                                    }}
                                  />
                                ) : null
                              ) : column.key === "actions" ? (
                                <div className="quick-actions">
                                  <button
                                    className="quick-action-btn quick-action-btn--view"
                                    onClick={(e) => handleQuickView(report, e)}
                                    title="View Details"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    className="quick-action-btn quick-action-btn--edit"
                                    onClick={(e) => handleQuickEdit(report, e)}
                                    title="Edit Report"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    className="quick-action-btn quick-action-btn--export"
                                    onClick={(e) => handleQuickExport(report, e)}
                                    title="Export Report"
                                  >
                                    <Download size={14} />
                                  </button>
                                  <button
                                    className="quick-action-btn quick-action-btn--delete"
                                    onClick={(e) => handleQuickDelete(report, e)}
                                    title="Delete Report"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : Array.isArray(report[column.key]) ? (
                                report[column.key].join(", ")
                              ) : (
                                report[column.key] || ""
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Pagination Controls - Bottom */}
              {showPagination && totalPages > 1 && (
                <div className="pagination-controls pagination-controls--bottom">
                  <div className="pagination-nav">
                    <button
                      className="pagination-btn pagination-btn--prev"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    
                    <div className="pagination-pages">
                      {(() => {
                        const pages = [];
                        const maxVisible = 7;
                        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                        
                        if (endPage - startPage + 1 < maxVisible) {
                          startPage = Math.max(1, endPage - maxVisible + 1);
                        }
                        
                        // First page
                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              className="pagination-btn pagination-btn--page"
                              onClick={() => handlePageChange(1)}
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(
                              <span key="ellipsis1" className="pagination-ellipsis">...</span>
                            );
                          }
                        }
                        
                        // Visible pages
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              className={`pagination-btn pagination-btn--page ${
                                i === currentPage ? 'pagination-btn--active' : ''
                              }`}
                              onClick={() => handlePageChange(i)}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Last page
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="ellipsis2" className="pagination-ellipsis">...</span>
                            );
                          }
                          pages.push(
                            <button
                              key={totalPages}
                              className="pagination-btn pagination-btn--page"
                              onClick={() => handlePageChange(totalPages)}
                            >
                              {totalPages}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()
                    }
                    </div>
                    
                    <button
                      className="pagination-btn pagination-btn--next"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlays */}
      {showSortMenu && (
        <div
          className="reports-sort__overlay"
          onClick={() => setShowSortMenu(false)}
        />
      )}
      
      {showDatePicker && (
        <div
          className="reports-date-filter__overlay"
          onClick={() => setShowDatePicker(false)}
        />
      )}
      
      {/* Create Report Modal */}
      {showCreateModal && (
        <CreateReportModal
          onClose={() => setShowCreateModal(false)}
          onReportCreated={(newReport) => {
            setShowCreateModal(false);
            // The report will be added via real-time listener
          }}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, reportToDelete: null, isBulkDelete: false, deleteCount: 0 })}
        onConfirm={handleConfirmDelete}
        title={deleteModal.isBulkDelete ? "Delete Multiple Reports" : "Delete Report"}
        message={
          deleteModal.isBulkDelete
            ? `Are you sure you want to delete ${deleteModal.deleteCount} selected reports? This action cannot be undone.`
            : deleteModal.reportToDelete
            ? `Are you sure you want to delete the report for ${deleteModal.reportToDelete.yourName || 'Unknown'} at ${deleteModal.reportToDelete.schoolOrDestination || 'Unknown location'}? This action cannot be undone.`
            : "Are you sure you want to delete this report?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Image Modal */}
      {showImageModal && ReactDOM.createPortal(
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: "20px",
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div className="image-modal__content">
            <button
              className="image-modal__close"
              onClick={() => setShowImageModal(false)}
            >
              <X size={24} />
            </button>
            <img
              src={currentImage}
              alt="Full size"
              className="image-modal__img"
            />
            <div className="image-modal__actions">
              <a href={currentImage} download className="image-modal__download">
                <Download size={16} />
                Download Image
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          editingReport={editingReport}
          onClose={closeReportModal}
          onStartEdit={startEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          onImageClick={openImageModal}
          jobDescriptionOptions={JOB_DESCRIPTION_OPTIONS}
          extraItemsOptions={EXTRA_ITEMS_OPTIONS}
          radioOptionsYesNoNA={RADIO_OPTIONS_YES_NO_NA}
          radioOptionsYesNo={RADIO_OPTIONS_YES_NO}
          schools={schools}
          photographers={photographers}
        />
      )}

      {/* Create Report Modal */}
      {showCreateModal && (
        <CreateReportModal
          onClose={() => setShowCreateModal(false)}
          onReportCreated={(reportData) => {
            console.log("New report created:", reportData);
            // Refresh current page to show new report
            if (isSearchMode) {
              searchReports(currentPage, true);
            } else {
              // In browse mode, the real-time listener should automatically show new reports
              // But we can also trigger a refresh to be sure
              loadBrowseReports(currentPage);
            }
          }}
        />
      )}
    </div>
  );
};

// Report Detail Modal Component
const ReportDetailModal = ({
  report,
  editingReport,
  onClose,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onImageClick,
  jobDescriptionOptions,
  extraItemsOptions,
  radioOptionsYesNoNA,
  radioOptionsYesNo,
  schools,
  photographers,
}) => {
  const formatDate = (dateField) => {
    const date = parseDateField(dateField);
    return date ? date.toLocaleDateString() : "N/A";
  };

  const handleEditChange = (field, value) => {
    onStartEdit({ ...editingReport, [field]: value });
  };

  const handleCheckboxChange = (field, option, checked) => {
    const currentValues = editingReport[field] || [];
    const newValues = checked
      ? [...currentValues, option]
      : currentValues.filter((v) => v !== option);
    handleEditChange(field, newValues);
  };

  if (editingReport) {
    return ReactDOM.createPortal(
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
            onClose();
          }
        }}
      >
        <div 
          className="modal modal--large"
          style={{
            position: "relative",
            margin: "0",
            transform: "none",
          }}
        >
          <div className="modal__header">
            <h2 className="modal__title">Edit Report</h2>
            <button className="modal__close" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>
          <div className="modal__form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="edit-form-section form-box">
              <label className="form-label">Date:</label>
              <div className="form-value">{formatDate(editingReport.date)}</div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Photographer:</label>
              <select
                className="form-select"
                value={editingReport.yourName || ""}
                onChange={(e) => handleEditChange("yourName", e.target.value)}
              >
                <option value="">--Select--</option>
                {photographers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">School or Destination:</label>
              <select
                className="form-select"
                value={editingReport.schoolOrDestination || ""}
                onChange={(e) => handleEditChange("schoolOrDestination", e.target.value)}
              >
                <option value="">--Select--</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Job Descriptions (select all that apply):</label>
              <div className="checkbox-group">
                {jobDescriptionOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={(editingReport.jobDescriptions || []).includes(option)}
                      onChange={(e) =>
                        handleCheckboxChange("jobDescriptions", option, e.target.checked)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Extra Items Added (select all that apply):</label>
              <div className="checkbox-group">
                {extraItemsOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={(editingReport.extraItems || []).includes(option)}
                      onChange={(e) =>
                        handleCheckboxChange("extraItems", option, e.target.checked)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Job Box and Camera Cards Turned In:</label>
              <div className="radio-group">
                {radioOptionsYesNoNA.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="jobBoxAndCameraCards"
                      value={option}
                      checked={editingReport.jobBoxAndCameraCards === option}
                      onChange={(e) =>
                        handleEditChange("jobBoxAndCameraCards", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Sports BG Shot:</label>
              <div className="radio-group">
                {radioOptionsYesNoNA.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="sportsBackgroundShot"
                      value={option}
                      checked={editingReport.sportsBackgroundShot === option}
                      onChange={(e) =>
                        handleEditChange("sportsBackgroundShot", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Cards Scanned:</label>
              <div className="radio-group">
                {radioOptionsYesNo.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="cardsScannedChoice"
                      value={option}
                      checked={editingReport.cardsScannedChoice === option}
                      onChange={(e) =>
                        handleEditChange("cardsScannedChoice", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Photoshoot Notes:</label>
              <textarea
                className="form-textarea"
                value={editingReport.photoshootNoteText || ""}
                onChange={(e) => handleEditChange("photoshootNoteText", e.target.value)}
              />
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Extra Notes:</label>
              <textarea
                className="form-textarea"
                value={editingReport.jobDescriptionText || ""}
                onChange={(e) => handleEditChange("jobDescriptionText", e.target.value)}
              />
            </div>

            <div className="modal__actions">
              <Button variant="secondary" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button variant="primary" onClick={onSaveEdit}>
                <Save size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
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
          onClose();
        }
      }}
    >
      <div 
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
        }}
      >
        <div className="modal__header">
          <h2 className="modal__title">
            {report.yourName || "Unknown Photographer"}
          </h2>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__form">
          <div className="report-detail__header">
            <div className="report-detail__info">
              <h3>{report.schoolOrDestination || "Unknown Location"}</h3>
              <p className="report-detail__date">{formatDate(report.date)}</p>
            </div>
            <Button variant="outline" onClick={() => onStartEdit(report)}>
              <Edit3 size={16} />
              Edit
            </Button>
          </div>

          <div className="form-section">
            <label className="form-label">Job Descriptions:</label>
            <div className="form-value">
              {Array.isArray(report.jobDescriptions)
                ? report.jobDescriptions.join(", ")
                : "None"}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Extra Items:</label>
            <div className="form-value">
              {Array.isArray(report.extraItems)
                ? report.extraItems.join(", ")
                : "None"}
            </div>
          </div>

          <div className="form-row">
            <div className="form-section">
              <label className="form-label">Job Box/Cards:</label>
              <div className="form-value">
                {report.jobBoxAndCameraCards || "N/A"}
              </div>
            </div>
            <div className="form-section">
              <label className="form-label">Sports BG Shot:</label>
              <div className="form-value">
                {report.sportsBackgroundShot || "N/A"}
              </div>
            </div>
            <div className="form-section">
              <label className="form-label">Cards Scanned:</label>
              <div className="form-value">
                {report.cardsScannedChoice || "N/A"}
              </div>
            </div>
          </div>

          {report.photoshootNoteText && (
            <div className="form-section">
              <label className="form-label">Photoshoot Notes:</label>
              <div className="form-value form-value--notes">
                {report.photoshootNoteText}
              </div>
            </div>
          )}

          {report.jobDescriptionText && (
            <div className="form-section">
              <label className="form-label">Extra Notes:</label>
              <div className="form-value form-value--notes">
                {report.jobDescriptionText}
              </div>
            </div>
          )}

          {report.photoURLs && report.photoURLs.length > 0 && (
            <div className="form-section">
              <label className="form-label">Photos:</label>
              <div className="report-photos">
                {report.photoURLs.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Report photo ${index + 1}`}
                    className="report-photo"
                    onClick={() => onImageClick(url)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>,
    document.body
  );
  
  // Component cleanup tracking
  useEffect(() => {
    return () => {
      console.log(`[${componentId}] Component unmounting`);
    };
  }, [componentId]);
};

export default DailyReports;
