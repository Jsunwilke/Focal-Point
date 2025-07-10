// src/pages/TimeTracking.js
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Square, 
  Calendar,
  Filter,
  Download,
  Users,
  BarChart3,
  User,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getCurrentTimeEntry,
  clockIn,
  clockOut,
  getTimeEntries,
  getAllTimeEntries,
  getTodayTimeEntries,
  calculateTotalHours,
  formatDuration
} from '../firebase/firestore';
import { getSessions, getTeamMembers } from '../firebase/firestore';
import SessionStatistics from '../components/stats/SessionStatistics';
import SchoolStatistics from '../components/stats/SchoolStatistics';
import ManualTimeEntryModal from '../components/shared/ManualTimeEntryModal';
import './TimeTracking.css';

const TimeTracking = () => {
  const { user, organization, userProfile } = useAuth();
  const { addToast } = useToast();
  
  const [currentEntry, setCurrentEntry] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dateRange, setDateRange] = useState('today');
  const [selectedUser, setSelectedUser] = useState('');
  const [view, setView] = useState('personal'); // personal or team
  const [statsView, setStatsView] = useState('none'); // none, sessions, schools
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  // Load data on component mount
  useEffect(() => {
    if (user && organization) {
      loadTimeData();
      loadSessions();
      if (isAdmin) {
        loadTeamMembers();
      }
    }
  }, [user, organization, dateRange, selectedUser, view]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    let interval;
    
    if (currentEntry && currentEntry.clockInTime) {
      interval = setInterval(() => {
        const clockInTime = currentEntry.clockInTime.toDate 
          ? currentEntry.clockInTime.toDate() 
          : new Date(currentEntry.clockInTime);
        const now = new Date();
        const elapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentEntry]);

  const loadTimeData = async () => {
    try {
      // Get current active entry (only for personal view)
      if (view === 'personal') {
        const activeEntry = await getCurrentTimeEntry(user.uid, organization.id);
        setCurrentEntry(activeEntry);
      } else {
        setCurrentEntry(null);
      }

      // Get time entries based on view and filters
      let entries = [];
      const startDate = getDateRangeStart();
      const endDate = getDateRangeEnd();

      if (view === 'personal') {
        if (dateRange === 'today') {
          entries = await getTodayTimeEntries(user.uid, organization.id);
        } else {
          entries = await getTimeEntries(user.uid, organization.id, startDate, endDate);
        }
      } else if (view === 'team' && isAdmin) {
        entries = await getAllTimeEntries(organization.id, startDate, endDate);
        
        // Filter by selected user if specified
        if (selectedUser) {
          entries = entries.filter(entry => entry.userId === selectedUser);
        }
      }
      
      setTimeEntries(entries);
    } catch (error) {
      console.error('Error loading time data:', error);
      addToast('Failed to load time data', 'error');
    }
  };

  const loadSessions = async () => {
    try {
      const sessionsData = await getSessions(organization.id);
      // Filter sessions for today and where current user is assigned as photographer
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessionsData.filter(session => {
        // Must be today's session
        if (session.date !== today) return false;
        
        // Check if user is assigned to this session
        if (session.photographers && Array.isArray(session.photographers)) {
          // Multiple photographers format
          return session.photographers.some(photographer => photographer.id === user.uid);
        } else if (session.photographer) {
          // Legacy single photographer format
          return session.photographer.id === user.uid;
        }
        
        return false;
      });
      setSessions(todaySessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const members = await getTeamMembers(organization.id);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await clockIn(user.uid, organization.id, selectedSession || null, notes || null);
      
      // Reload data
      await loadTimeData();
      setSelectedSession('');
      setNotes('');
      
      addToast('Clocked in successfully!', 'success');
    } catch (error) {
      console.error('Error clocking in:', error);
      addToast(error.message || 'Failed to clock in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await clockOut(user.uid, organization.id, notes || null);
      
      // Reload data
      await loadTimeData();
      setNotes('');
      
      addToast('Clocked out successfully!', 'success');
    } catch (error) {
      console.error('Error clocking out:', error);
      addToast(error.message || 'Failed to clock out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeStart = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return startOfWeek.toISOString().split('T')[0];
      case 'month':
        return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      default:
        return today.toISOString().split('T')[0];
    }
  };

  const getDateRangeEnd = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'week':
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        return endOfWeek.toISOString().split('T')[0];
      case 'month':
        return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      default:
        return today.toISOString().split('T')[0];
    }
  };

  const handleManualEntrySuccess = () => {
    // Reload time data after successful manual entry
    loadTimeData();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getSessionName = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    return session ? `${session.schoolName} - ${session.sessionType}` : 'Unknown Session';
  };

  const getUserName = (userId) => {
    const member = teamMembers.find(m => m.id === userId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown User';
  };

  const getTotalHours = () => {
    const completedEntries = timeEntries.filter(entry => entry.status === 'clocked-out');
    const hours = calculateTotalHours(completedEntries);
    const currentHours = currentEntry && view === 'personal' ? elapsedTime : 0;
    return hours + currentHours;
  };

  const getStatistics = () => {
    const completedEntries = timeEntries.filter(entry => entry.status === 'clocked-out');
    const totalHours = calculateTotalHours(completedEntries);
    const averagePerDay = completedEntries.length > 0 ? totalHours / completedEntries.length : 0;
    
    return {
      totalHours,
      totalEntries: timeEntries.length,
      completedEntries: completedEntries.length,
      activeEntries: timeEntries.filter(entry => entry.status === 'clocked-in').length,
      averagePerDay
    };
  };

  const isOnBreak = currentEntry && currentEntry.status === 'clocked-in';
  const stats = getStatistics();

  return (
    <div className="time-tracking-page">
      <div className="page-header">
        <h1 className="page-title">
          <Clock size={32} />
          Time Tracking
        </h1>
        
        {/* View Toggle */}
        {isAdmin && (
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${view === 'personal' ? 'active' : ''}`}
              onClick={() => setView('personal')}
            >
              <User size={16} />
              Personal
            </button>
            <button 
              className={`toggle-btn ${view === 'team' ? 'active' : ''}`}
              onClick={() => setView('team')}
            >
              <Users size={16} />
              Team
            </button>
          </div>
        )}
      </div>

      <div className="page-content">
        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatDuration(stats.totalHours)}</div>
              <div className="stat-label">Total Hours ({dateRange})</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalEntries}</div>
              <div className="stat-label">Total Entries</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <BarChart3 size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatDuration(stats.averagePerDay)}</div>
              <div className="stat-label">Average Per Entry</div>
            </div>
          </div>
          
          {view === 'personal' && (
            <div className="stat-card">
              <div className="stat-icon">
                <div className={`status-dot ${isOnBreak ? 'active' : ''}`}></div>
              </div>
              <div className="stat-content">
                <div className="stat-value">{isOnBreak ? 'Clocked In' : 'Clocked Out'}</div>
                <div className="stat-label">Current Status</div>
              </div>
            </div>
          )}
        </div>

        {/* Clock In/Out Section (Personal View Only) */}
        {view === 'personal' && (
          <div className="clock-section">
            <div className="clock-card">
              <h3>Clock In/Out</h3>
              
              {isOnBreak && (
                <div className="current-session">
                  <div className="elapsed-time">{formatDuration(elapsedTime)}</div>
                  <div className="elapsed-label">Current Session</div>
                </div>
              )}

              {!isOnBreak && (
                <div className="clock-in-form">
                  <div className="form-group">
                    <label>Session (Optional)</label>
                    <select 
                      value={selectedSession} 
                      onChange={(e) => setSelectedSession(e.target.value)}
                    >
                      <option value="">No specific session</option>
                      {sessions.map(session => (
                        <option key={session.id} value={session.id}>
                          {session.schoolName} - {session.sessionType} ({session.startTime} - {session.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this work session..."
                  rows={2}
                />
              </div>

              <div className="clock-actions">
                {!isOnBreak ? (
                  <button
                    className="clock-btn clock-in-btn"
                    onClick={handleClockIn}
                    disabled={loading}
                  >
                    <Play size={18} />
                    {loading ? 'Clocking In...' : 'Clock In'}
                  </button>
                ) : (
                  <button
                    className="clock-btn clock-out-btn"
                    onClick={handleClockOut}
                    disabled={loading}
                  >
                    <Square size={18} />
                    {loading ? 'Clocking Out...' : 'Clock Out'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="filters-section">
          <div className="filters-card">
            <h3>
              <Filter size={20} />
              Filters
            </h3>
            
            <div className="filters-grid">
              <div className="filter-group">
                <label>Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
              
              {view === 'team' && isAdmin && (
                <div className="filter-group">
                  <label>Team Member</label>
                  <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                    <option value="">All Members</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Time Entries List */}
        <div className="entries-section">
          <div className="entries-card">
            <div className="entries-header">
              <h3>Time Entries</h3>
              <div className="entries-actions">
                {view === 'personal' && (
                  <button 
                    className="manual-entry-btn"
                    onClick={() => setShowManualEntryModal(true)}
                  >
                    <Plus size={16} />
                    Manual Entry
                  </button>
                )}
                <button className="export-btn">
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
            
            {timeEntries.length === 0 ? (
              <div className="no-entries">
                <Clock size={48} />
                <p>No time entries found for the selected period</p>
              </div>
            ) : (
              <div className="entries-table">
                <div className={`table-header ${view === 'team' ? 'team-view' : ''}`}>
                  <div className="col-date">Date</div>
                  {view === 'team' && <div className="col-user">User</div>}
                  <div className="col-time">Time</div>
                  <div className="col-duration">Duration</div>
                  <div className="col-session">Session</div>
                  <div className="col-status">Status</div>
                </div>
                
                <div className="table-body">
                  {timeEntries.map(entry => (
                    <div key={entry.id} className={`table-row ${view === 'team' ? 'team-view' : ''}`}>
                      <div className="col-date">{formatDate(entry.date)}</div>
                      {view === 'team' && (
                        <div className="col-user">{getUserName(entry.userId)}</div>
                      )}
                      <div className="col-time">
                        <div className="time-range">
                          <span>{formatTime(entry.clockInTime)}</span>
                          {entry.clockOutTime && (
                            <span>- {formatTime(entry.clockOutTime)}</span>
                          )}
                        </div>
                      </div>
                      <div className="col-duration">
                        {entry.status === 'clocked-out' ? (
                          formatDuration(calculateTotalHours([entry]))
                        ) : (
                          <span className="in-progress">In Progress</span>
                        )}
                      </div>
                      <div className="col-session">
                        {entry.sessionId ? getSessionName(entry.sessionId) : '-'}
                      </div>
                      <div className="col-status">
                        <span className={`status-badge ${entry.status}`}>
                          {entry.status === 'clocked-in' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        {view === 'personal' && (
          <div className="statistics-section">
            <div className="statistics-header">
              <h3>Work Statistics</h3>
              <div className="stats-toggle">
                <button 
                  className={`stats-btn ${statsView === 'none' ? 'active' : ''}`}
                  onClick={() => setStatsView('none')}
                >
                  Hide Stats
                </button>
                <button 
                  className={`stats-btn ${statsView === 'sessions' ? 'active' : ''}`}
                  onClick={() => setStatsView('sessions')}
                >
                  Sessions
                </button>
                <button 
                  className={`stats-btn ${statsView === 'schools' ? 'active' : ''}`}
                  onClick={() => setStatsView('schools')}
                >
                  Schools
                </button>
              </div>
            </div>

            {statsView === 'sessions' && (
              <div className="statistics-content">
                <SessionStatistics 
                  dateRange={dateRange === 'today' ? 'week' : dateRange} 
                  userId={user.uid}
                />
              </div>
            )}

            {statsView === 'schools' && (
              <div className="statistics-content">
                <SchoolStatistics 
                  dateRange={dateRange === 'today' ? 'week' : dateRange} 
                  userId={user.uid}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Time Entry Modal */}
      <ManualTimeEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        onSuccess={handleManualEntrySuccess}
      />
    </div>
  );
};

export default TimeTracking;