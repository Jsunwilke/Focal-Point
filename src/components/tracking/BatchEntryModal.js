import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { addBatchRecords } from '../../services/trackingService';
import { getDocs, collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { firestore } from '../../firebase/config';
import NotificationModal from '../shared/NotificationModal';
import { sanitizeString, validateInput, defaultRateLimiter } from '../../utils/inputSanitizer';
import secureLogger from '../../utils/secureLogger';
import '../shared/Modal.css';
import '../shared/NotificationModal.css';
import './BatchEntryModal.css';

const BatchEntryModal = ({ organizationID, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    shiftId: '',
    schoolId: '',
    schoolName: '',
    jobBoxNumber: '',
    cardNumbers: ''
  });
  const [loading, setLoading] = useState(false);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    loadAvailableShifts();
    loadSchools();
  }, [organizationID]);

  const loadAvailableShifts = async () => {
    setShiftsLoading(true);
    try {
      if (!organizationID) {
        throw new Error('No organization ID provided');
      }

      // Get sessions for today + next 2 weeks
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(now.getDate() + 14);
      
      secureLogger.debug('Loading shifts for organization', { 
        hasOrganizationID: !!organizationID,
        organizationID: organizationID,
        dateRange: `${today.toDateString()} to ${twoWeeksFromNow.toDateString()}`
      });

      // Use single query now that sessions have hasJobBoxAssigned field
      const { getSessions } = await import('../../firebase/firestore');
      const allSessions = await getSessions(organizationID);
      
      secureLogger.debug('Sessions loaded', { 
        sessionsCount: allSessions?.length || 0
      });

      if (!allSessions || allSessions.length === 0) {
        setShifts([]);
        secureLogger.warn('No sessions found in database for organization');
        return;
      }

      // Filter sessions for the next 2 weeks and exclude assigned ones
      const availableShifts = allSessions.filter(session => {
        try {
          // Check if session already has job box assigned using the session field
          if (session.hasJobBoxAssigned === true) {
            secureLogger.debug('Excluding session with existing job box', {
              sessionId: session.id,
              schoolName: session.schoolName,
              jobBoxRecordId: session.jobBoxRecordId
            });
            return false;
          }

          // Handle different date formats with timezone safety
          let sessionDate;
          if (session.date?.toDate) {
            sessionDate = session.date.toDate();
          } else if (session.date) {
            // Parse date in local timezone to avoid UTC offset issues
            if (typeof session.date === 'string') {
              const [year, month, day] = session.date.split('-');
              if (year && month && day) {
                sessionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              } else {
                sessionDate = new Date(session.date);
              }
            } else {
              sessionDate = new Date(session.date);
            }
          } else {
            secureLogger.warn('Session has no date', { sessionId: session.id });
            return false;
          }
          
          // Include today's sessions + future sessions within 2 weeks
          const isFromToday = sessionDate >= today;
          const isWithinTwoWeeks = sessionDate <= twoWeeksFromNow;
          
          secureLogger.debug('Session date check', {
            sessionId: session.id,
            sessionDate: sessionDate.toDateString(),
            isFromToday,
            isWithinTwoWeeks,
            schoolName: session.schoolName,
            hasJobBox: session.hasJobBoxAssigned === true
          });
          
          return isFromToday && isWithinTwoWeeks;
        } catch (error) {
          secureLogger.error('Error processing session date', { 
            sessionId: session.id, 
            error: error.message 
          });
          return false;
        }
      });
      
      setShifts(availableShifts);
      
      const assignedCount = allSessions.filter(s => s.hasJobBoxAssigned === true).length;
      secureLogger.debug('Filtered available shifts', { 
        futureCount: availableShifts.length,
        totalSessions: allSessions.length,
        assignedCount: assignedCount,
        dateExcludedCount: allSessions.length - availableShifts.length - assignedCount,
        sampleShift: availableShifts[0] ? {
          id: availableShifts[0].id,
          schoolName: availableShifts[0].schoolName,
          date: availableShifts[0].date
        } : null
      });

      if (availableShifts.length === 0) {
        const assignedCount = allSessions.filter(s => s.hasJobBoxAssigned === true).length;
        if (allSessions.length === 0) {
          secureLogger.warn('No sessions found in database');
        } else if (assignedCount === allSessions.length) {
          secureLogger.warn('All sessions already have job boxes assigned');
        } else {
          secureLogger.warn('No available sessions found from today through the next 2 weeks');
        }
      }
    } catch (error) {
      secureLogger.error('Error loading available shifts', {
        error: error.message,
        code: error.code,
        organizationID: !!organizationID
      });
      
      const errorMessage = error.code === 'permission-denied'
        ? 'Permission denied. Please check your account permissions.'
        : error.message?.includes('network')
        ? 'Network error. Please check your internet connection.'
        : 'Unable to load available shifts. Please try again.';
      
      setNotificationData({
        type: 'error',
        title: 'Error Loading Shifts',
        message: errorMessage
      });
      setShowNotificationModal(true);
    } finally {
      setShiftsLoading(false);
    }
  };

  const loadSchools = async () => {
    setSchoolsLoading(true);
    try {
      secureLogger.debug('Loading schools for organization', { 
        hasOrganizationID: !!organizationID,
        organizationID: organizationID
      });
      
      if (!organizationID) {
        throw new Error('No organization ID provided');
      }

      // Use the same approach as CreateSessionModal
      const { getSchools } = await import('../../firebase/firestore');
      const schoolsData = await getSchools(organizationID);
      
      secureLogger.debug('Schools data received', { 
        count: schoolsData?.length || 0,
        hasData: !!schoolsData
      });
      
      // Map to match expected format
      const schoolsList = schoolsData?.map(school => ({
        id: school.id,
        name: school.name || school.value,
        value: school.value || school.name,
        ...school
      })) || [];
      
      setSchools(schoolsList);
      secureLogger.debug('Loaded and formatted schools', { count: schoolsList.length });

      if (schoolsList.length === 0) {
        secureLogger.warn('No schools found for organization', { organizationID });
        setNotificationData({
          type: 'warning',
          title: 'No Schools Found',
          message: 'No schools found for your organization. Please add schools first.'
        });
        setShowNotificationModal(true);
      }
    } catch (error) {
      secureLogger.error('Error loading schools', { 
        error: error.message,
        code: error.code,
        organizationID: !!organizationID
      });
      
      const errorMessage = error.code === 'permission-denied' 
        ? 'Permission denied. Please check your account permissions.'
        : error.message?.includes('network')
        ? 'Network error. Please check your internet connection.'
        : 'Unable to load schools. Please check your connection and try again.';
      
      setNotificationData({
        type: 'error',
        title: 'Error Loading Schools',
        message: errorMessage
      });
      setShowNotificationModal(true);
    } finally {
      setSchoolsLoading(false);
    }
  };

  const handleShiftChange = (e) => {
    const shiftId = e.target.value;
    const selectedShift = shifts.find(shift => shift.id === shiftId);
    
    if (selectedShift) {
      // Auto-select the school based on the shift's schoolId
      const school = schools.find(s => s.id === selectedShift.schoolId);
      
      setFormData(prev => ({
        ...prev,
        shiftId: shiftId,
        schoolId: selectedShift.schoolId || '',
        schoolName: school?.name || selectedShift.schoolName || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        shiftId: shiftId,
        schoolId: '',
        schoolName: ''
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: sanitizeString(value)
    }));
  };

  const parseCardNumbers = (cardNumbersText) => {
    if (!cardNumbersText || typeof cardNumbersText !== 'string') {
      return [];
    }
    
    // Split by comma, newline, or spaces and clean up
    const numbers = cardNumbersText
      .split(/[,\n\s]+/)
      .map(num => sanitizeString(num.trim()))
      .filter(num => num.length > 0)
      .filter((num, index, arr) => arr.indexOf(num) === index); // Remove duplicates
    
    return numbers;
  };

  const validateForm = () => {
    if (!formData.shiftId) {
      setNotificationData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a shift.'
      });
      setShowNotificationModal(true);
      return false;
    }

    if (!formData.jobBoxNumber) {
      setNotificationData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please enter a job box number.'
      });
      setShowNotificationModal(true);
      return false;
    }

    if (!validateInput(formData.jobBoxNumber, 'boxNumber')) {
      setNotificationData({
        type: 'error',
        title: 'Validation Error',
        message: 'Job box number contains invalid characters.'
      });
      setShowNotificationModal(true);
      return false;
    }

    const cardNumbers = parseCardNumbers(formData.cardNumbers);
    if (cardNumbers.length === 0) {
      setNotificationData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please enter at least one SD card number.'
      });
      setShowNotificationModal(true);
      return false;
    }

    if (cardNumbers.length > 50) {
      setNotificationData({
        type: 'error',
        title: 'Validation Error',
        message: 'Maximum 50 SD cards can be processed at once.'
      });
      setShowNotificationModal(true);
      return false;
    }

    // Validate each card number
    for (const cardNumber of cardNumbers) {
      if (!validateInput(cardNumber, 'cardNumber')) {
        setNotificationData({
          type: 'error',
          title: 'Validation Error',
          message: `SD card number "${cardNumber}" contains invalid characters.`
        });
        setShowNotificationModal(true);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Rate limiting check
    const rateLimitId = `${userProfile.uid}-batch-${organizationID}`;
    if (!defaultRateLimiter.isAllowed(rateLimitId)) {
      setNotificationData({
        type: 'warning',
        title: 'Rate Limit Exceeded',
        message: 'Too many batch requests. Please wait a moment before trying again.'
      });
      setShowNotificationModal(true);
      return;
    }

    setLoading(true);

    try {
      const cardNumbers = parseCardNumbers(formData.cardNumbers);
      const selectedShift = shifts.find(shift => shift.id === formData.shiftId);
      
      const batchData = {
        jobBoxNumber: formData.jobBoxNumber,
        cardNumbers: cardNumbers,
        userId: userProfile.uid,
        school: formData.schoolName,
        shiftData: selectedShift
      };

      secureLogger.debug('Creating batch records', { 
        jobBoxNumber: !!formData.jobBoxNumber,
        cardCount: cardNumbers.length,
        hasSchool: !!formData.schoolName
      });

      secureLogger.debug('About to call addBatchRecords with organizationID', {
        organizationID: organizationID,
        organizationIDType: typeof organizationID,
        organizationIDTruthy: !!organizationID,
        organizationIDLength: organizationID?.length
      });

      const result = await addBatchRecords(organizationID, batchData);

      if (result.success) {
        setNotificationData({
          type: 'success',
          title: 'Success',
          message: `Created 1 job box and ${cardNumbers.length} SD card records successfully.`,
          autoClose: true
        });
        setShowNotificationModal(true);
        
        // Reset form
        setFormData({
          shiftId: '',
          schoolId: '',
          schoolName: '',
          jobBoxNumber: '',
          cardNumbers: ''
        });
        
        // Close modal and refresh data after a short delay
        setTimeout(() => {
          onSave();
        }, 1500);
      } else {
        setNotificationData({
          type: 'error',
          title: 'Batch Creation Failed',
          message: result.message || 'Unable to create batch records. Please try again.'
        });
        setShowNotificationModal(true);
      }
    } catch (error) {
      secureLogger.error('Error creating batch records', error);
      setNotificationData({
        type: 'error',
        title: 'Error',
        message: 'Unable to create batch records. Please check your connection and try again.'
      });
      setShowNotificationModal(true);
    } finally {
      setLoading(false);
    }
  };

  const formatShiftDisplay = (shift) => {
    try {
      let date;
      
      // Handle different date formats with timezone safety
      if (shift.date?.toDate) {
        // Firestore timestamp
        date = shift.date.toDate();
      } else if (shift.date) {
        if (typeof shift.date === 'string') {
          // Parse string dates in local timezone to avoid UTC offset issues
          const [year, month, day] = shift.date.split('-');
          if (year && month && day) {
            // Create date in local timezone
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            // Fallback for other string formats
            date = new Date(shift.date);
          }
        } else {
          // Direct Date object
          date = new Date(shift.date);
        }
      } else {
        secureLogger.warn('Shift has no date for display', { shiftId: shift.id });
        return `Shift ${shift.id || 'Unknown'} - No date`;
      }

      // Format date using timezone-safe method
      const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      let timeStr = '';
      if (shift.startTime && shift.endTime) {
        timeStr = ` ${shift.startTime}-${shift.endTime}`;
      } else if (shift.startTime) {
        timeStr = ` at ${shift.startTime}`;
      }
      
      const schoolStr = shift.schoolName || 'Unknown School';
      const sessionTypes = Array.isArray(shift.sessionTypes) ? shift.sessionTypes.join(', ') : (shift.sessionType || '');
      
      return `${dateStr}${timeStr} - ${schoolStr}${sessionTypes ? ` (${sessionTypes})` : ''}`.trim();
    } catch (error) {
      secureLogger.error('Error formatting shift display', { 
        shiftId: shift.id,
        dateType: typeof shift.date,
        error: error.message
      });
      return `Shift ${shift.id || 'Unknown'}`;
    }
  };

  const modalContent = (
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
        className="modal modal--medium"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
        }}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Batch Add Records</h2>
            <p className="modal__subtitle">
              Create multiple SD card and job box records at once
            </p>
          </div>
          <button 
            className="modal__close"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__content">
            <div className="form-group">
              <label htmlFor="shiftId" className="form-label">
                Select Shift <span className="required">*</span>
              </label>
              <select
                id="shiftId"
                name="shiftId"
                value={formData.shiftId}
                onChange={handleShiftChange}
                className="form-control"
                required
                disabled={loading || shiftsLoading}
              >
                <option value="">
                  {shiftsLoading ? 'Loading shifts...' : 
                   shifts.length === 0 ? 'No shifts available' : 
                   'Select a shift...'}
                </option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {formatShiftDisplay(shift)}
                  </option>
                ))}
              </select>
              <small className="form-text">
                {shiftsLoading ? 'Loading available shifts...' :
                 shifts.length === 0 ? 'No shifts found for the next 2 weeks. Try creating some sessions first.' :
                 `${shifts.length} shifts available from the next 2 weeks`}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="schoolName" className="form-label">
                School
              </label>
              <input
                type="text"
                id="schoolName"
                name="schoolName"
                value={schoolsLoading ? 'Loading schools...' : formData.schoolName}
                className="form-control"
                disabled={true}
                placeholder={schoolsLoading ? 'Loading...' : 'Auto-selected based on shift'}
              />
              <small className="form-text">
                {schoolsLoading ? 'Loading school information...' : 
                 'Automatically populated when you select a shift'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="jobBoxNumber" className="form-label">
                Job Box Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="jobBoxNumber"
                name="jobBoxNumber"
                value={formData.jobBoxNumber}
                onChange={handleInputChange}
                className="form-control"
                placeholder="e.g., 3001"
                required
                disabled={loading}
              />
              <small className="form-text">
                This will create a job box record with "Packed" status
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="cardNumbers" className="form-label">
                SD Card Numbers <span className="required">*</span>
              </label>
              <textarea
                id="cardNumbers"
                name="cardNumbers"
                value={formData.cardNumbers}
                onChange={handleInputChange}
                className="form-control card-numbers-textarea"
                placeholder="Enter card numbers separated by commas, spaces, or new lines&#10;e.g., 1001, 1002, 1003&#10;or&#10;1001&#10;1002&#10;1003"
                rows={4}
                required
                disabled={loading}
              />
              <small className="form-text">
                Each card will create an SD card record with "Job Box" status
              </small>
            </div>
          </div>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || shiftsLoading || schoolsLoading}
            >
              {loading ? 'Creating Records...' : 'Create Batch Records'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      {modalContent}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        title={notificationData?.title}
        message={notificationData?.message}
        type={notificationData?.type}
        autoClose={notificationData?.autoClose}
      />
    </>,
    document.body
  );
};

export default BatchEntryModal;