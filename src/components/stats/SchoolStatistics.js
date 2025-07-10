// src/components/stats/SchoolStatistics.js
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  BookOpen,
  TrendingUp,
  PieChart,
  Calendar,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserSchoolStats,
  formatDuration
} from '../../firebase/firestore';
import './SchoolStatistics.css';

const SchoolStatistics = ({ dateRange = 'month', userId = null }) => {
  const { user, organization } = useAuth();
  const [schoolStats, setSchoolStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.uid;

  useEffect(() => {
    const loadSchoolStats = async () => {
      if (!targetUserId || !organization) return;

      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(dateRange);
        const stats = await getUserSchoolStats(targetUserId, organization.id, startDate, endDate);
        setSchoolStats(stats);
      } catch (error) {
        console.error('Error loading school stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSchoolStats();
  }, [targetUserId, organization, dateRange]);

  const getDateRange = (range) => {
    const today = new Date();
    let startDate, endDate;

    switch (range) {
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        endDate = today;
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = today;
        break;
      case 'quarter':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
        endDate = today;
        break;
      default:
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = today;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const getRangeName = (range) => {
    switch (range) {
      case 'week': return 'Past Week';
      case 'month': return 'Past Month';
      case 'quarter': return 'Past Quarter';
      default: return 'Past Month';
    }
  };

  const getSchoolColors = () => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    return colors;
  };

  if (loading) {
    return (
      <div className="school-statistics loading">
        <div className="loading-spinner"></div>
        <p>Loading school statistics...</p>
      </div>
    );
  }

  if (!schoolStats || schoolStats.totalSchools === 0) {
    return (
      <div className="school-statistics empty">
        <BookOpen size={48} />
        <h3>No School Data</h3>
        <p>No time entries found for schools in the selected period.</p>
      </div>
    );
  }

  const averageHoursPerSchool = schoolStats.totalHours / schoolStats.totalSchools;
  const colors = getSchoolColors();

  return (
    <div className="school-statistics">
      <div className="stats-header">
        <div className="stats-title">
          <PieChart size={24} />
          <div>
            <h3>School Statistics</h3>
            <p>{getRangeName(dateRange)}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <Clock size={20} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{formatDuration(schoolStats.totalHours)}</div>
            <div className="summary-label">Total Hours</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <BookOpen size={20} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{schoolStats.totalSchools}</div>
            <div className="summary-label">Schools Worked</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <TrendingUp size={20} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{formatDuration(averageHoursPerSchool)}</div>
            <div className="summary-label">Avg per School</div>
          </div>
        </div>
      </div>

      {/* School Breakdown */}
      <div className="school-breakdown">
        <h4>School Breakdown</h4>
        <div className="school-list">
          {schoolStats.schoolStats.map((school, index) => (
            <div key={school.schoolId} className="school-item">
              <div 
                className="school-indicator"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              
              <div className="school-info">
                <div className="school-header">
                  <div className="school-name">
                    <MapPin size={14} />
                    <span>{school.schoolName}</span>
                  </div>
                  <div className="school-hours">
                    {formatDuration(school.hours)}
                  </div>
                </div>
                
                <div className="school-meta">
                  <span className="session-count">
                    <Calendar size={12} />
                    {school.sessionCount} sessions
                  </span>
                  <span className="entry-count">
                    <Activity size={12} />
                    {school.entries.length} time entries
                  </span>
                </div>
              </div>

              <div className="school-progress">
                <div 
                  className="progress-bar"
                  style={{
                    width: `${(school.hours / schoolStats.schoolStats[0].hours) * 100}%`,
                    backgroundColor: colors[index % colors.length]
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* School Distribution Chart */}
      <div className="school-distribution">
        <h4>Hours Distribution</h4>
        <div className="distribution-chart">
          {schoolStats.schoolStats.map((school, index) => {
            const percentage = (school.hours / schoolStats.totalHours) * 100;
            return (
              <div key={school.schoolId} className="distribution-item">
                <div className="distribution-bar-container">
                  <div 
                    className="distribution-bar"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: colors[index % colors.length]
                    }}
                  ></div>
                </div>
                <div className="distribution-info">
                  <span className="school-name">{school.schoolName}</span>
                  <span className="percentage">{percentage.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Insights */}
      <div className="stats-insights">
        <h4>Quick Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-label">Top School</div>
            <div className="insight-value">
              {schoolStats.schoolStats[0]?.schoolName || 'N/A'}
            </div>
            <div className="insight-detail">
              {formatDuration(schoolStats.schoolStats[0]?.hours || 0)} worked
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-label">Most Sessions</div>
            <div className="insight-value">
              {(() => {
                const schoolWithMostSessions = schoolStats.schoolStats.reduce((max, school) => 
                  school.sessionCount > max.sessionCount ? school : max, 
                  schoolStats.schoolStats[0] || {}
                );
                return schoolWithMostSessions.schoolName || 'N/A';
              })()}
            </div>
            <div className="insight-detail">
              {(() => {
                const schoolWithMostSessions = schoolStats.schoolStats.reduce((max, school) => 
                  school.sessionCount > max.sessionCount ? school : max, 
                  schoolStats.schoolStats[0] || {}
                );
                return schoolWithMostSessions.sessionCount || 0;
              })()} sessions
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-label">Efficiency Score</div>
            <div className="insight-value">
              {schoolStats.totalSchools > 0 ? 
                `${(averageHoursPerSchool * 2).toFixed(1)}/10` : 
                'N/A'
              }
            </div>
            <div className="insight-detail">Based on hours per school</div>
          </div>

          <div className="insight-card">
            <div className="insight-label">School Coverage</div>
            <div className="insight-value">
              {((schoolStats.totalSchools / Math.max(schoolStats.totalSchools, 5)) * 100).toFixed(0)}%
            </div>
            <div className="insight-detail">
              {schoolStats.totalSchools} of estimated schools
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolStatistics;