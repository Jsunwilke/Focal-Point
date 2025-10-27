// src/components/workflow/ShootDetailsModal.js
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, MapPin, User, FileText } from 'lucide-react';
import { getSession, getSchools } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import './ShootDetailsModal.css';

// Helper function to format date to MM-DD-YYYY
function formatDateToMMDDYYYY(dateString) {
  if (!dateString) return '';
  // Convert YYYY-MM-DD to MM-DD-YYYY
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[1]}-${parts[2]}-${parts[0]}`;
  }
  return dateString;
}

const ShootDetailsModal = ({
  workflow,
  session,
  template,
  school,
  onClose
}) => {
  const { userProfile, organization } = useAuth();
  const { dailyJobReports: cachedDailyReports, loading } = useDataCache();
  const [fullSessionData, setFullSessionData] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);

  // Get session info based on workflow type
  const getSessionInfo = () => {
    if (workflow.workflowType === 'tracking') {
      return {
        schoolName: workflow.schoolName || schoolDetails?.name || school?.name || 'Unknown',
        date: workflow.trackingStartDate || 'N/A',
        clientName: 'N/A',
        sessionTypes: []
      };
    } else {
      // Session-based workflow - use fullSessionData
      return {
        schoolName: fullSessionData?.schoolName || workflow.schoolName || schoolDetails?.name || 'Unknown',
        date: fullSessionData?.date || workflow.sessionDate || 'N/A',
        clientName: fullSessionData?.clientName || 'N/A',
        sessionTypes: fullSessionData?.sessionTypes || []
      };
    }
  };

  const sessionInfo = getSessionInfo();

  // Filter cached daily job reports by school and date
  const dailyReports = useMemo(() => {
    if (!workflow || !cachedDailyReports || cachedDailyReports.length === 0) {
      console.log('Skipping filter - no workflow or no cached data');
      return [];
    }

    // Get school name and date based on workflow type
    let schoolName, date;

    if (workflow.workflowType === 'tracking') {
      schoolName = workflow.schoolName || school?.name;
      date = workflow.trackingStartDate;
    } else {
      // Session-based workflow - use fullSessionData if available
      schoolName = fullSessionData?.schoolName || workflow.schoolName || school?.name;
      date = fullSessionData?.date || workflow.sessionDate;
    }

    if (!schoolName || !date) {
      console.log('Missing school name or date for filtering:', { schoolName, date });
      return [];
    }

    const targetDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
    const normalizedSchoolName = schoolName.toLowerCase().trim();

    console.log('Filtering cached reports for:', { schoolName, date, sessionId: workflow.sessionId, totalCachedReports: cachedDailyReports.length });

    // Filter cached reports
    const filtered = cachedDailyReports.filter(report => {
      // Priority 1: Match by sessionId if available (most accurate)
      if (workflow.sessionId && report.sessionId === workflow.sessionId) {
        return true;
      }

      // Priority 2: Match by school name and date
      const reportSchool = report.schoolOrDestination || report.customFields?.schoolOrDestination || '';

      // Handle date - could be string, Timestamp, or Date object
      let reportDate = '';
      if (report.date) {
        if (typeof report.date === 'string') {
          reportDate = report.date.split('T')[0];
        } else if (report.date.toDate && typeof report.date.toDate === 'function') {
          // Firestore Timestamp
          reportDate = report.date.toDate().toISOString().split('T')[0];
        } else if (report.date instanceof Date) {
          reportDate = report.date.toISOString().split('T')[0];
        }
      }

      const normalizedReportSchool = reportSchool.toLowerCase().trim();
      const schoolMatch = normalizedReportSchool.includes(normalizedSchoolName) || normalizedSchoolName.includes(normalizedReportSchool);
      const dateMatch = reportDate === targetDate;

      return schoolMatch && dateMatch;
    });

    console.log('Filtered reports:', filtered.length, 'matches found');
    return filtered;
  }, [workflow, school, fullSessionData, cachedDailyReports]);

  // Fetch full session data and school details
  useEffect(() => {
    const loadSessionData = async () => {
      if (!workflow) {
        setSessionLoading(false);
        return;
      }

      try {
        setSessionLoading(true);

        // For session-based workflows, fetch the full session data
        if (workflow.sessionId) {
          console.log('Fetching full session data for sessionId:', workflow.sessionId);
          const fullSession = await getSession(workflow.sessionId);
          console.log('Full session data fetched:', fullSession);
          setFullSessionData(fullSession);

          // Load school details using schoolId
          if (fullSession?.schoolId && organization?.id) {
            const schools = await getSchools(organization.id);
            const schoolDetail = schools.find(s => s.id === fullSession.schoolId);
            console.log('School details found:', schoolDetail);
            setSchoolDetails(schoolDetail);
          }
        } else {
          // For tracking workflows, use workflow data
          console.log('Tracking workflow, using workflow data');
          setFullSessionData(null);
          setSchoolDetails(school); // Use the school prop if provided
        }
      } catch (error) {
        console.error('Error loading session data:', error);
        setFullSessionData(session); // Fallback to prop
        setSchoolDetails(school);
      } finally {
        setSessionLoading(false);
      }
    };

    loadSessionData();
  }, [workflow, session, school, organization?.id]);

  // Fetch team members for photographer name resolution
  useEffect(() => {
    if (organization?.teamMembers) {
      setTeamMembers(organization.teamMembers);
    }
  }, [organization]);

  const modalContent = (
    <div
      className="shoot-details-overlay"
      onClick={onClose}
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
        padding: '20px'
      }}
    >
      <div
        className="shoot-details-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          margin: 0,
          transform: 'none'
        }}
      >
        {/* Header */}
        <div className="shoot-details-header">
          <h2>{sessionInfo.schoolName}</h2>
          <button onClick={onClose} className="shoot-details-close">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="shoot-details-content">
          {/* Session Info */}
          <section className="shoot-details-section">
            <h3>Session Information</h3>
            <div className="shoot-details-grid">
              <div className="shoot-details-item">
                <Calendar size={18} />
                <div>
                  <label>Date</label>
                  <p>{formatDateToMMDDYYYY(sessionInfo.date)}</p>
                </div>
              </div>
              <div className="shoot-details-item">
                <MapPin size={18} />
                <div>
                  <label>School</label>
                  <p>{sessionInfo.schoolName}</p>
                </div>
              </div>
              <div className="shoot-details-item">
                <User size={18} />
                <div>
                  <label>Client</label>
                  <p>{sessionInfo.clientName}</p>
                </div>
              </div>
              {sessionInfo.sessionTypes && sessionInfo.sessionTypes.length > 0 && (
                <div className="shoot-details-item">
                  <FileText size={18} />
                  <div>
                    <label>Type</label>
                    <p>{sessionInfo.sessionTypes.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* School Details */}
          {schoolDetails && (
            <section className="shoot-details-section">
              <h3>School Information</h3>
              <div className="shoot-details-grid">
                {schoolDetails.address && (
                  <div className="shoot-details-item">
                    <MapPin size={18} />
                    <div>
                      <label>Address</label>
                      <p>{schoolDetails.address}</p>
                    </div>
                  </div>
                )}
                {schoolDetails.contactName && (
                  <div className="shoot-details-item">
                    <User size={18} />
                    <div>
                      <label>Contact</label>
                      <p>{schoolDetails.contactName}</p>
                    </div>
                  </div>
                )}
                {schoolDetails.phone && (
                  <div className="shoot-details-item">
                    <FileText size={18} />
                    <div>
                      <label>Phone</label>
                      <p>{schoolDetails.phone}</p>
                    </div>
                  </div>
                )}
                {schoolDetails.email && (
                  <div className="shoot-details-item">
                    <FileText size={18} />
                    <div>
                      <label>Email</label>
                      <p>{schoolDetails.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Photographer Assignments */}
          <section className="shoot-details-section">
            <h3>Photographer Assignments</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(() => {
                // Get photographers from fullSessionData
                let photographers = [];
                if (fullSessionData?.photographers && fullSessionData.photographers.length > 0) {
                  photographers = fullSessionData.photographers;
                } else if (fullSessionData?.photographerId || fullSessionData?.photographerName) {
                  photographers = [{
                    id: fullSessionData.photographerId,
                    name: fullSessionData.photographerName
                  }];
                }

                if (photographers.length === 0) {
                  return <p style={{ color: '#6b7280', fontSize: '14px' }}>No photographers assigned</p>;
                }

                return photographers.map((photographer, index) => {
                  const isCurrentUser = photographer.id === userProfile?.id;
                  // Get current name from teamMembers, fallback to stored name
                  const currentMember = teamMembers.find(m => m.id === photographer.id);
                  const displayName = currentMember?.displayName ||
                                     `${currentMember?.firstName || ''} ${currentMember?.lastName || ''}`.trim() ||
                                     photographer.name ||
                                     'Unknown';

                  return (
                    <span
                      key={index}
                      style={{
                        backgroundColor: isCurrentUser ? '#e3f2fd' : '#f1f3f4',
                        border: isCurrentUser ? '2px solid #007bff' : '1px solid #dee2e6',
                        color: isCurrentUser ? '#007bff' : '#495057',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: isCurrentUser ? '600' : '500',
                      }}
                    >
                      {displayName}
                      {isCurrentUser && ' (You)'}
                    </span>
                  );
                });
              })()}
            </div>
          </section>

          {/* Session Notes */}
          {fullSessionData?.notes && (
            <section className="shoot-details-section">
              <h3>Session Notes (Shared)</h3>
              <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.875rem',
                color: '#495057',
                whiteSpace: 'pre-wrap'
              }}>
                {fullSessionData.notes}
              </div>
            </section>
          )}

          {/* Photographer Notes */}
          {fullSessionData?.photographerNotes && (
            <section className="shoot-details-section">
              <h3>Photographer Notes</h3>
              <div style={{
                backgroundColor: '#fff8e1',
                border: '1px solid #ffe082',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.875rem',
                color: '#495057',
                whiteSpace: 'pre-wrap'
              }}>
                {fullSessionData.photographerNotes}
              </div>
            </section>
          )}

          {/* Daily Job Reports */}
          <section className="shoot-details-section">
            <h3>Daily Job Reports ({dailyReports.length})</h3>
            {loading?.dailyJobReports ? (
              <p className="shoot-details-loading">Loading reports...</p>
            ) : dailyReports.length > 0 ? (
              <div className="shoot-details-reports">
                {dailyReports.map(report => {
                  // Handle date - could be string, Timestamp, or Date object
                  let dateStr = '';
                  if (report.date) {
                    if (typeof report.date === 'string') {
                      dateStr = report.date.split('T')[0];
                    } else if (report.date.toDate && typeof report.date.toDate === 'function') {
                      dateStr = report.date.toDate().toISOString().split('T')[0];
                    } else if (report.date instanceof Date) {
                      dateStr = report.date.toISOString().split('T')[0];
                    }
                  }

                  return (
                    <div key={report.id} className="shoot-details-report">
                      <div className="shoot-details-report-header">
                        <span className="shoot-details-report-date">
                          {formatDateToMMDDYYYY(dateStr)}
                        </span>
                        <span className="shoot-details-report-author">
                          {report.yourName || report.customFields?.yourName || 'Unknown'}
                        </span>
                      </div>
                    {(report.photoshootNoteText || report.customFields?.notes) && (
                      <div className="shoot-details-report-notes">
                        <label>Notes:</label>
                        <p>{report.photoshootNoteText || report.customFields?.notes}</p>
                      </div>
                    )}
                    {(report.jobDescriptionText || report.customFields?.jobDescriptionText) && (
                      <div className="shoot-details-report-notes">
                        <label>Job Description:</label>
                        <p>{report.jobDescriptionText || report.customFields?.jobDescriptionText}</p>
                      </div>
                    )}
                    {(report.schoolOrDestination || report.customFields?.schoolOrDestination) && (
                      <div className="shoot-details-report-school">
                        <label>Location:</label>
                        <p>{report.schoolOrDestination || report.customFields?.schoolOrDestination}</p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="shoot-details-empty">No daily job reports found for this shoot.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ShootDetailsModal;
