// src/components/stats/StatsModal.js
import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Calendar,
  Users,
  Camera,
  Clock,
  MapPin,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";

const StatsModal = ({
  isOpen,
  onClose,
  sessions = [],
  teamMembers = [],
  schools = [],
  userProfile,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedDateRange, setSelectedDateRange] = useState(null);

  // Generate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (selectedPeriod) {
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Start of week
        end = new Date(start);
        end.setDate(start.getDate() + 6); // End of week
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { start, end };
  };

  const dateRange = selectedDateRange || getDateRange();

  // Filter sessions within date range
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      let sessionDate;
      if (typeof session.date === "string") {
        const [year, month, day] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, day);
      } else {
        sessionDate = new Date(session.date);
      }
      
      return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
    });
  }, [sessions, dateRange]);

  // Calculate overview metrics
  const overviewMetrics = useMemo(() => {
    const totalSessions = filteredSessions.length;
    const activePhotographers = new Set(filteredSessions.map(s => s.photographerId)).size;
    const schoolsServed = new Set(filteredSessions.map(s => s.schoolId)).size;
    
    const totalHours = filteredSessions.reduce((sum, session) => {
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60);
        return sum + duration;
      }
      return sum;
    }, 0);

    return { totalSessions, activePhotographers, schoolsServed, totalHours };
  }, [filteredSessions]);

  // Calculate photographer workload
  const photographerStats = useMemo(() => {
    const photographerData = {};
    
    filteredSessions.forEach((session) => {
      const id = session.photographerId;
      if (!photographerData[id]) {
        const photographer = teamMembers.find(m => m.id === id);
        photographerData[id] = {
          id,
          name: photographer ? `${photographer.firstName} ${photographer.lastName}` : 'Unknown',
          sessionCount: 0,
          totalHours: 0,
        };
      }
      
      photographerData[id].sessionCount++;
      
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60);
        photographerData[id].totalHours += duration;
      }
    });

    return Object.values(photographerData).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredSessions, teamMembers]);

  // Calculate school analytics
  const schoolStats = useMemo(() => {
    const schoolData = {};
    
    filteredSessions.forEach((session) => {
      const id = session.schoolId;
      const name = session.schoolName || 'Unknown School';
      
      if (!schoolData[id]) {
        schoolData[id] = {
          id,
          name,
          sessionCount: 0,
          totalHours: 0,
        };
      }
      
      schoolData[id].sessionCount++;
      
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60);
        schoolData[id].totalHours += duration;
      }
    });

    return Object.values(schoolData).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [filteredSessions]);

  // Calculate session type breakdown
  const sessionTypeStats = useMemo(() => {
    const typeData = {};
    
    filteredSessions.forEach((session) => {
      const type = session.sessionType || 'unknown';
      if (!typeData[type]) {
        typeData[type] = { type, count: 0, hours: 0 };
      }
      
      typeData[type].count++;
      
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60);
        typeData[type].hours += duration;
      }
    });

    return Object.values(typeData).sort((a, b) => b.count - a.count);
  }, [filteredSessions]);

  // Calculate busiest days of week
  const dayOfWeekStats = useMemo(() => {
    const dayData = {
      0: { day: 'Sunday', count: 0 },
      1: { day: 'Monday', count: 0 },
      2: { day: 'Tuesday', count: 0 },
      3: { day: 'Wednesday', count: 0 },
      4: { day: 'Thursday', count: 0 },
      5: { day: 'Friday', count: 0 },
      6: { day: 'Saturday', count: 0 },
    };
    
    filteredSessions.forEach((session) => {
      let sessionDate;
      if (typeof session.date === "string") {
        const [year, month, day] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, day);
      } else {
        sessionDate = new Date(session.date);
      }
      
      const dayOfWeek = sessionDate.getDay();
      dayData[dayOfWeek].count++;
    });

    return Object.values(dayData);
  }, [filteredSessions]);

  // Helper functions
  const formatHours = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours % 1) * 60);
    return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
  };

  const getSessionTypeColor = (type) => {
    switch (type) {
      case "sports": return "#8b5cf6";
      case "portrait": return "#10b981";
      case "event": return "#f59e0b";
      case "graduation": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
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
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          width: "95%",
          maxWidth: "1200px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem 2rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f9fafb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <BarChart3 size={28} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700", color: "#111827" }}>
              Analytics Dashboard
            </h2>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                backgroundColor: "white",
              }}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.5rem",
                color: "#6b7280",
                borderRadius: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f3f4f6"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "2rem", overflow: "auto", flex: 1 }}>
          
          {/* Overview Cards */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
            gap: "1.5rem", 
            marginBottom: "2rem" 
          }}>
            <div style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #dbeafe",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <Camera size={20} color="#3b82f6" />
                <span style={{ fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>TOTAL SESSIONS</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
                {overviewMetrics.totalSessions}
              </div>
            </div>

            <div style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #dcfce7",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <Users size={20} color="#10b981" />
                <span style={{ fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>ACTIVE PHOTOGRAPHERS</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
                {overviewMetrics.activePhotographers}
              </div>
            </div>

            <div style={{
              backgroundColor: "#fefbef",
              border: "1px solid #fef3c7",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <MapPin size={20} color="#f59e0b" />
                <span style={{ fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>SCHOOLS SERVED</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
                {overviewMetrics.schoolsServed}
              </div>
            </div>

            <div style={{
              backgroundColor: "#fdf2f8",
              border: "1px solid #fce7f3",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <Clock size={20} color="#ec4899" />
                <span style={{ fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>TOTAL HOURS</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
                {formatHours(overviewMetrics.totalHours)}
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "2rem", 
            marginBottom: "2rem" 
          }}>
            
            {/* Photographer Workload */}
            <div style={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <h3 style={{ 
                margin: "0 0 1rem 0", 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#1f2937",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <Activity size={18} color="#3b82f6" />
                Photographer Workload
              </h3>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {photographerStats.slice(0, 5).map((photographer, index) => (
                  <div key={photographer.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0",
                    borderBottom: index < 4 ? "1px solid #f3f4f6" : "none"
                  }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                      {photographer.name}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#1f2937" }}>
                        {formatHours(photographer.totalHours)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {photographer.sessionCount} sessions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Types */}
            <div style={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <h3 style={{ 
                margin: "0 0 1rem 0", 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#1f2937",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <PieChart size={18} color="#8b5cf6" />
                Session Types
              </h3>
              <div>
                {sessionTypeStats.map((type, index) => {
                  const percentage = overviewMetrics.totalSessions > 0 
                    ? Math.round((type.count / overviewMetrics.totalSessions) * 100) 
                    : 0;
                  
                  return (
                    <div key={type.type} style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "0.75rem"
                    }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: getSessionTypeColor(type.type),
                        borderRadius: "2px",
                        marginRight: "0.75rem"
                      }}></div>
                      <span style={{ 
                        fontSize: "0.875rem", 
                        textTransform: "capitalize",
                        flex: 1
                      }}>
                        {type.type}
                      </span>
                      <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>
                        {type.count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "2rem" 
          }}>
            
            {/* Top Schools */}
            <div style={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <h3 style={{ 
                margin: "0 0 1rem 0", 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#1f2937",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <TrendingUp size={18} color="#10b981" />
                Top Schools
              </h3>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {schoolStats.slice(0, 5).map((school, index) => (
                  <div key={school.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0",
                    borderBottom: index < 4 ? "1px solid #f3f4f6" : "none"
                  }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                      {school.name}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#1f2937" }}>
                        {school.sessionCount} sessions
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {formatHours(school.totalHours)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Busiest Days */}
            <div style={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <h3 style={{ 
                margin: "0 0 1rem 0", 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#1f2937",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <Calendar size={18} color="#f59e0b" />
                Busiest Days
              </h3>
              <div>
                {dayOfWeekStats
                  .sort((a, b) => b.count - a.count)
                  .map((day, index) => {
                    const maxCount = Math.max(...dayOfWeekStats.map(d => d.count));
                    const percentage = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                    
                    return (
                      <div key={day.day} style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "0.75rem"
                      }}>
                        <span style={{ 
                          fontSize: "0.875rem", 
                          fontWeight: "500",
                          minWidth: "80px"
                        }}>
                          {day.day}
                        </span>
                        <div style={{
                          flex: 1,
                          height: "8px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "4px",
                          marginRight: "0.75rem",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            height: "100%",
                            width: `${percentage}%`,
                            backgroundColor: "#f59e0b",
                            borderRadius: "4px",
                            transition: "width 0.3s ease"
                          }}></div>
                        </div>
                        <span style={{ fontSize: "0.875rem", fontWeight: "600", minWidth: "30px" }}>
                          {day.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default StatsModal;