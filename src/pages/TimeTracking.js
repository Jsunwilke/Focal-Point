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
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDataCache } from '../contexts/DataCacheContext';
import {
  getCurrentTimeEntry,
  clockIn,
  clockOut,
  getTimeEntries,
  getAllTimeEntries,
  getTodayTimeEntries,
  calculateTotalHours,
  formatDuration,
  deleteTimeEntry
} from '../firebase/firestore';
import { getSessions } from '../firebase/firestore';
import SessionStatistics from '../components/stats/SessionStatistics';
import SchoolStatistics from '../components/stats/SchoolStatistics';
import ManualTimeEntryModal from '../components/shared/ManualTimeEntryModal';
import EditTimeEntryModal from '../components/shared/EditTimeEntryModal';
import PayPeriodSelector from '../components/payroll/PayPeriodSelector';
import './TimeTracking.css';

const TimeTracking = () => {
  const { user, organization, userProfile } = useAuth();
  const { addToast } = useToast();
  const { users } = useDataCache();
  
  const [currentEntry, setCurrentEntry] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [sessions, setSessions] = useState([]);
  // Team members now come from DataCacheContext
  const teamMembers = users || [];
  const [selectedSession, setSelectedSession] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dateRange, setDateRange] = useState('today');
  const [selectedUser, setSelectedUser] = useState('');
  const [view, setView] = useState('personal'); // personal or team
  const [statsView, setStatsView] = useState('none'); // none, sessions, schools
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState(null);
  const [customDates, setCustomDates] = useState(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  // Load data on component mount
  useEffect(() => {
    if (user && organization) {
      loadTimeData();
      loadSessions();
      // Team members are now loaded automatically by DataCacheContext
    }
  }, [user, organization, dateRange, selectedUser, view, selectedPayPeriod, customDates]);

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
      let startDate, endDate;

      // Handle special case for "today" selection
      if (dateRange === 'today' && !selectedPayPeriod) {
        const today = new Date();
        startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        endDate = startDate;
      } else if (selectedPayPeriod) {
        // Use pay period dates
        if (selectedPayPeriod.value === 'custom') {
          if (!customDates || !customDates.startDate || !customDates.endDate) {
            return; // Don't load if custom dates are incomplete
          }
          startDate = customDates.startDate;
          endDate = customDates.endDate;
        } else {
          startDate = selectedPayPeriod.startDate;
          endDate = selectedPayPeriod.endDate;
        }
      } else {
        // Fallback to old date range logic
        startDate = getDateRangeStart();
        endDate = getDateRangeEnd();
      }

      if (view === 'personal') {
        if (dateRange === 'today' && !selectedPayPeriod) {
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
      // Load all sessions to ensure we can display session info for any date
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  // Team members loading is now handled by DataCacheContext

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
        // Use local timezone to get today's date
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
      case 'month':
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      default:
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
  };

  const getDateRangeEnd = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        // Use local timezone to get today's date
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      case 'week':
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        return `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`;
      case 'month':
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
      default:
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
  };

  const handleManualEntrySuccess = () => {
    // Reload time data after successful manual entry
    loadTimeData();
  };

  const canEditEntry = (entry) => {
    // Can only edit own completed entries within 30 days
    if (entry.userId !== user.uid || entry.status !== 'clocked-out') {
      return false;
    }
    
    // Check if entry is within 30 days
    const entryDate = new Date(entry.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return entryDate >= thirtyDaysAgo;
  };

  const canDeleteEntry = (entry) => {
    // Can only delete own entries
    return entry.userId === user.uid;
  };

  const handleEditEntry = (entry) => {
    if (!canEditEntry(entry)) {
      if (entry.userId !== user.uid) {
        addToast('You can only edit your own time entries', 'error');
      } else if (entry.status !== 'clocked-out') {
        addToast('You can only edit completed time entries', 'error');
      } else {
        addToast('You can only edit time entries from the last 30 days', 'error');
      }
      return;
    }
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleDeleteEntry = async (entry) => {
    if (!canDeleteEntry(entry)) {
      addToast('You can only delete your own time entries', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      await deleteTimeEntry(entry.id);
      addToast('Time entry deleted successfully!', 'success');
      loadTimeData();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      addToast(error.message || 'Failed to delete time entry', 'error');
    }
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setEditingEntry(null);
    loadTimeData();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    // Parse date string in local timezone to avoid UTC offset issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getSessionName = (sessionId) => {
    if (!sessionId) return 'No session';
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return 'Session not found';
    }
    
    // Include date if it's not today
    const sessionDate = new Date(session.date);
    const today = new Date();
    const isToday = sessionDate.toDateString() === today.toDateString();
    
    // Build session display string
    let sessionDisplay = session.schoolName || 'Unknown School';
    
    // Add session type if it exists
    if (session.sessionType) {
      sessionDisplay += ` - ${session.sessionType}`;
    }
    
    // Add date if not today
    if (!isToday) {
      sessionDisplay += ` (${sessionDate.toLocaleDateString()})`;
    }
    
    return sessionDisplay;
  };

  const getUserName = (userId) => {
    const member = teamMembers.find(m => m.id === userId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown User';
  };

  const getTotalHours = () => {
    const completedEntries = timeEntries.filter(entry => entry.status === 'clocked-out');
    const activeEntries = timeEntries.filter(entry => entry.status === 'clocked-in');
    
    // Calculate completed hours
    const completedHours = calculateTotalHours(completedEntries);
    
    // Calculate active hours
    let activeHours = 0;
    activeEntries.forEach(entry => {
      if (entry.clockInTime) {
        const clockInTime = entry.clockInTime.toDate 
          ? entry.clockInTime.toDate() 
          : new Date(entry.clockInTime);
        const now = new Date();
        const elapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60); // hours
        activeHours += elapsed;
      }
    });
    
    return completedHours + activeHours;
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

  const handlePayPeriodChange = (period) => {
    setSelectedPayPeriod(period);
    if (period && period.value !== 'today') {
      setDateRange(''); // Clear simple date range when using pay periods
    }
  };

  const handleCustomDateChange = (dates) => {
    setCustomDates(dates);
  };

  const handleTodayClick = () => {
    setDateRange('today');
    setSelectedPayPeriod(null);
    setCustomDates(null);
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
              <div className="stat-value">{formatDuration(getTotalHours())}</div>
              <div className="stat-label">Total Hours ({selectedPayPeriod ? selectedPayPeriod.label : dateRange === 'today' ? 'Today' : 'Period'})</div>
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
            
            <div className="filters-content">
              {/* Today Quick Filter */}
              <div className="quick-filters">
                <button 
                  className={`quick-filter-btn ${dateRange === 'today' && !selectedPayPeriod ? 'active' : ''}`}
                  onClick={handleTodayClick}
                >
                  <Calendar size={16} />
                  Today
                </button>
              </div>
              
              {/* Pay Period Selector */}
              <div className="pay-period-wrapper">
                <PayPeriodSelector
                  payPeriodSettings={organization?.payPeriodSettings}
                  selectedPeriod={selectedPayPeriod}
                  onPeriodChange={handlePayPeriodChange}
                  onCustomDateChange={handleCustomDateChange}
                  disabled={loading}
                />
              </div>
              
              {/* Team Member Filter for Team View */}
              {view === 'team' && isAdmin && (
                <div className="filter-group team-member-filter">
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
                  {view === 'personal' && <div className="col-actions">Actions</div>}
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
                            <span> - {formatTime(entry.clockOutTime)}</span>
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
                        {getSessionName(entry.sessionId)}
                      </div>
                      <div className="col-status">
                        <span className={`status-badge ${entry.status}`}>
                          {entry.status === 'clocked-in' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      {view === 'personal' && (
                        <div className="col-actions">
                          <div className="action-buttons">
                            {canEditEntry(entry) && (
                              <button
                                className="action-btn edit-btn"
                                onClick={() => handleEditEntry(entry)}
                                title="Edit entry"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {canDeleteEntry(entry) && (
                              <button
                                className="action-btn delete-btn"
                                onClick={() => handleDeleteEntry(entry)}
                                title="Delete entry"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
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

      {/* Edit Time Entry Modal */}
      <EditTimeEntryModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        timeEntry={editingEntry}
      />
    </div>
  );
};

export default TimeTracking;