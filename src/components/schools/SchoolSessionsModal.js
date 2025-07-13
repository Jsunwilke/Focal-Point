// src/components/schools/SchoolSessionsModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Search, School } from 'lucide-react';
import { getSessionsForSchool, getTeamMembers } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import SchoolSessionsList from './SchoolSessionsList';
import '../shared/Modal.css';
import './SchoolSessionsModal.css';

const SchoolSessionsModal = ({ school, onClose }) => {
  const { organization } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!school || !organization?.id) return;

      try {
        setLoading(true);
        setError('');

        // Load sessions and team members in parallel
        const [sessionsData, teamData] = await Promise.all([
          getSessionsForSchool(school.id, organization.id),
          getTeamMembers(organization.id)
        ]);

        setSessions(sessionsData);
        setTeamMembers(teamData);
      } catch (err) {
        console.error('Error loading school sessions:', err);
        setError('Failed to load sessions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [school, organization]);

  // Filter sessions based on search term
  const filteredSessions = sessions.filter(session => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase();
    const sessionDate = session.date?.toLowerCase() || '';
    const sessionTypes = session.sessionTypes?.join(' ').toLowerCase() || '';
    const customType = session.customSessionType?.toLowerCase() || '';
    const photographerNames = session.photographers?.map(p => {
      const member = teamMembers.find(m => m.id === p.id);
      return member ? (member.displayName || `${member.firstName} ${member.lastName}`).toLowerCase() : '';
    }).join(' ') || '';

    return sessionDate.includes(term) || 
           sessionTypes.includes(term) || 
           customType.includes(term) ||
           photographerNames.includes(term);
  });

  const getSessionStats = () => {
    const total = sessions.length;
    const upcoming = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return sessionDate >= today && session.status !== 'completed';
    }).length;
    const completed = sessions.filter(session => session.status === 'completed').length;

    return { total, upcoming, completed };
  };

  const stats = getSessionStats();

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px',
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
          position: 'relative',
          margin: '0',
          transform: 'none',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">
              <School size={20} />
              {school?.value || school?.name || 'School'} Sessions
            </h2>
            <p className="modal__subtitle">
              View all scheduled sessions for this school
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {/* Session Stats */}
        <div className="school-sessions-stats">
          <div className="school-sessions-stat">
            <span className="school-sessions-stat__number">{stats.total}</span>
            <span className="school-sessions-stat__label">Total Sessions</span>
          </div>
          <div className="school-sessions-stat">
            <span className="school-sessions-stat__number">{stats.upcoming}</span>
            <span className="school-sessions-stat__label">Upcoming</span>
          </div>
          <div className="school-sessions-stat">
            <span className="school-sessions-stat__number">{stats.completed}</span>
            <span className="school-sessions-stat__label">Completed</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="school-sessions-search">
          <div className="school-sessions-search__input-wrapper">
            <Search size={16} className="school-sessions-search__icon" />
            <input
              type="text"
              placeholder="Search sessions by date, type, or photographer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="school-sessions-search__input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="school-sessions-search__clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="modal__content" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="school-sessions-loading">
              <Calendar size={48} />
              <p>Loading sessions...</p>
            </div>
          ) : error ? (
            <div className="school-sessions-error">
              <p>{error}</p>
            </div>
          ) : (
            <>
              {searchTerm && (
                <div className="school-sessions-search-results">
                  <p>
                    {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
                    {searchTerm && ` for "${searchTerm}"`}
                  </p>
                </div>
              )}
              <SchoolSessionsList
                sessions={filteredSessions}
                organization={organization}
                teamMembers={teamMembers}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SchoolSessionsModal;