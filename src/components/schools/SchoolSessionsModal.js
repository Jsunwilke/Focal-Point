// src/components/schools/SchoolSessionsModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Search, School } from 'lucide-react';
import { getSessionsForSchool, getTeamMembers, createSession } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import SchoolSessionsList from './SchoolSessionsList';
import SessionDetailsModal from '../sessions/SessionDetailsModal';
import '../shared/Modal.css';
import './SchoolSessionsModal.css';

const SchoolSessionsModal = ({ school, onClose }) => {
  const { organization, userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

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

  // Handle session click to show details
  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  // Close session details modal
  const handleCloseSessionDetails = () => {
    setShowSessionDetails(false);
    setSelectedSession(null);
  };

  // Handle duplicate to next year
  const handleRescheduleToNextYear = async (sessionData) => {
    try {
      setLoading(true);
      
      // Create a new session for next year (excluding the id and timestamps)
      const { id, createdAt, updatedAt, ...sessionDataWithoutId } = sessionData;
      
      const newSessionData = {
        ...sessionDataWithoutId,
        // Remove photographer assignments as requested
        photographers: [],
        photographerId: null,
        photographer: null,
        // Add a note about the duplication
        notes: sessionData.notes ? 
          `${sessionData.notes}\n\nDuplicated from previous year on ${new Date().toLocaleDateString()}` : 
          `Duplicated from previous year on ${new Date().toLocaleDateString()}`
      };
      
      // Create the new session
      await createSession(organization.id, newSessionData);

      // Reload sessions to show the updated data
      const sessionsData = await getSessionsForSchool(school.id, organization.id);
      setSessions(sessionsData);
      
      // Show success message
      setModalMessage('Session successfully duplicated to next year!');
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Error duplicating session:', error);
      setModalMessage('Failed to duplicate session. Please try again.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

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
                onSessionClick={handleSessionClick}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Success Modal
  const successModal = showSuccessModal && (
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
        zIndex: 10003,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSuccessModal(false);
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          width: '48px', 
          height: '48px', 
          backgroundColor: '#d4edda', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 16px',
          color: '#155724',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          ✓
        </div>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#155724' }}>
          Success!
        </h3>
        <p style={{ margin: '0 0 24px 0', lineHeight: '1.5', color: '#6c757d' }}>
          {modalMessage}
        </p>
        <button
          type="button"
          onClick={() => setShowSuccessModal(false)}
          style={{
            padding: '8px 24px',
            border: 'none',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );

  // Error Modal
  const errorModal = showErrorModal && (
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
        zIndex: 10003,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowErrorModal(false);
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          width: '48px', 
          height: '48px', 
          backgroundColor: '#f8d7da', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 16px',
          color: '#721c24',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          ✕
        </div>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#721c24' }}>
          Error
        </h3>
        <p style={{ margin: '0 0 24px 0', lineHeight: '1.5', color: '#6c757d' }}>
          {modalMessage}
        </p>
        <button
          type="button"
          onClick={() => setShowErrorModal(false)}
          style={{
            padding: '8px 24px',
            border: 'none',
            backgroundColor: '#dc3545',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      
      {/* Session Details Modal */}
      {showSessionDetails && selectedSession && (
        <SessionDetailsModal
          isOpen={showSessionDetails}
          onClose={handleCloseSessionDetails}
          session={selectedSession}
          teamMembers={teamMembers}
          userProfile={userProfile}
          organization={organization}
          onEditSession={() => {
            // For now, just close the modal - edit functionality can be added later
            handleCloseSessionDetails();
          }}
          // Pass reschedule handler for school context
          onRescheduleToNextYear={handleRescheduleToNextYear}
          // Flag to show this is in school management context
          showRescheduleOption={true}
        />
      )}

      {/* Success and Error Modals */}
      {successModal && ReactDOM.createPortal(successModal, document.body)}
      {errorModal && ReactDOM.createPortal(errorModal, document.body)}
    </>
  );
};

export default SchoolSessionsModal;