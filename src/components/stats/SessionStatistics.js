// src/components/stats/SessionStatistics.js
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Users,
  BarChart3,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserSessionStats,
  formatDuration
} from '../../firebase/firestore';
import './SessionStatistics.css';

const SessionStatistics = ({ dateRange = 'month', userId = null }) => {
  const { user, organization } = useAuth();
  const [sessionStats, setSessionStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.uid;

  useEffect(() => {
    const loadSessionStats = async () => {
      if (!targetUserId || !organization) return;

      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(dateRange);
        const stats = await getUserSessionStats(targetUserId, organization.id, startDate, endDate);
        setSessionStats(stats);
      } catch (error) {
        console.error('Error loading session stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessionStats();
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: '2-digit'
    });
  };

  const getRangeName = (range) => {
    switch (range) {
      case 'week': return 'Past Week';
      case 'month': return 'Past Month';
      case 'quarter': return 'Past Quarter';
      default: return 'Past Month';
    }
  };

  if (loading) {
    return (
      <div className="session-statistics loading">
        <div className="loading-spinner"></div>
        <p>Loading session statistics...</p>
      </div>
    );
  }

  if (!sessionStats || sessionStats.totalSessions === 0) {
    return (
      <div className="session-statistics empty">
        <Activity size={48} />
        <h3>No Session Data</h3>
        <p>No time entries found for sessions in the selected period.</p>
      </div>
    );
  }

  const averageHoursPerSession = sessionStats.totalHours / sessionStats.totalSessions;

  return (
    <div className="session-statistics">
      <div className="stats-header">
        <div className="stats-title">
          <BarChart3 size={24} />
          <div>
            <h3>Session Statistics</h3>
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
            <div className="summary-value">{formatDuration(sessionStats.totalHours)}</div>
            <div className="summary-label">Total Hours</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Calendar size={20} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{sessionStats.totalSessions}</div>
            <div className="summary-label">Sessions Worked</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <TrendingUp size={20} />
          </div>
          <div className="summary-content">
            <div className="summary-value">{formatDuration(averageHoursPerSession)}</div>
            <div className="summary-label">Avg per Session</div>
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="session-details">
        <h4>Session Breakdown</h4>
        <div className="session-list">
          {sessionStats.sessionStats.map((session, index) => (
            <div key={session.sessionId} className="session-item">
              <div className="session-rank">#{index + 1}</div>
              
              <div className="session-info">
                <div className="session-header">
                  <div className="session-name">
                    {session.sessionData ? (
                      <>
                        <MapPin size={14} />
                        <span>{session.sessionData.schoolName}</span>
                      </>
                    ) : (
                      <span>Unknown Session</span>
                    )}
                  </div>
                  <div className="session-hours">
                    {formatDuration(session.hours)}
                  </div>
                </div>
                
                {session.sessionData && (
                  <div className="session-meta">
                    <span className="session-type">{session.sessionData.sessionType}</span>
                    <span className="session-date">{formatDate(session.sessionData.date)}</span>
                    <span className="session-time">
                      {session.sessionData.startTime} - {session.sessionData.endTime}
                    </span>
                  </div>
                )}
                
                <div className="session-entries">
                  <Users size={12} />
                  <span>{session.entries.length} time entries</span>
                </div>
              </div>

              <div className="session-progress">
                <div 
                  className="progress-bar"
                  style={{
                    width: `${(session.hours / sessionStats.sessionStats[0].hours) * 100}%`
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Insights */}
      <div className="stats-insights">
        <h4>Quick Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-label">Most Worked Session</div>
            <div className="insight-value">
              {sessionStats.sessionStats[0]?.sessionData?.schoolName || 'N/A'}
            </div>
            <div className="insight-detail">
              {formatDuration(sessionStats.sessionStats[0]?.hours || 0)}
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-label">Longest Single Entry</div>
            <div className="insight-value">
              {(() => {
                let longestEntry = 0;
                sessionStats.sessionStats.forEach(session => {
                  session.entries.forEach(entry => {
                    const entryHours = (entry.clockOutTime?.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime)).getTime() - 
                                     (entry.clockInTime?.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime)).getTime();
                    longestEntry = Math.max(longestEntry, entryHours / (1000 * 60 * 60));
                  });
                });
                return formatDuration(longestEntry);
              })()}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-label">Session Efficiency</div>
            <div className="insight-value">
              {sessionStats.totalSessions > 0 ? 
                `${(sessionStats.totalHours / sessionStats.totalSessions * 10).toFixed(1)}/10` : 
                'N/A'
              }
            </div>
            <div className="insight-detail">Hours per session ratio</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionStatistics;