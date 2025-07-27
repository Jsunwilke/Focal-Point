// src/components/timeoff/TimeOffRequestModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, AlertCircle, Clock, Users } from 'lucide-react';
import { createTimeOffRequest, checkTimeOffConflicts } from '../../firebase/timeOffRequests';
import { checkDateIsBlocked } from '../../firebase/blockedDates';
import { getPTOBalance, reservePTOHours } from '../../services/ptoService';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffRequestModal.css';

const TimeOffRequestModal = ({ isOpen, onClose, userProfile, organization }) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
    isPartialDay: false,
    startTime: '09:00',
    endTime: '17:00',
    isPaidTimeOff: false,
    ptoHoursRequested: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState(null);
  const [showHighPriority, setShowHighPriority] = useState(false);
  const [highPriorityReason, setHighPriorityReason] = useState('');
  const [ptoBalance, setPtoBalance] = useState(null);
  const [loadingPTO, setLoadingPTO] = useState(false);
  const [ptoEnabled, setPtoEnabled] = useState(false);

  // Load PTO balance when modal opens
  useEffect(() => {
    const loadPTOData = async () => {
      if (isOpen && userProfile && organization) {
        setPtoEnabled(organization.ptoSettings?.enabled || false);
        
        if (organization.ptoSettings?.enabled) {
          setLoadingPTO(true);
          try {
            const balance = await getPTOBalance(userProfile.id, organization.id);
            setPtoBalance(balance);
          } catch (error) {
            console.error('Error loading PTO balance:', error);
          } finally {
            setLoadingPTO(false);
          }
        }
      }
    };

    loadPTOData();
  }, [isOpen, userProfile, organization]);

  // Calculate total days and maximum PTO hours
  const calculateDaysRequested = () => {
    if (!formData.startDate) return 0;
    
    if (formData.isPartialDay) return 1;
    
    if (!formData.endDate) return 0;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    return daysDiff;
  };

  const maxPTOHours = calculateDaysRequested() * 8; // Max 8 hours per day

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  // Extracted function to check for conflicts and blocked dates
  const checkForConflictsAndBlockedDates = async (startDateValue, endDateValue) => {
    if (!startDateValue || !endDateValue) return;
    
    setCheckingConflicts(true);
    try {
      const start = new Date(startDateValue + 'T12:00:00');
      const end = new Date(endDateValue + 'T12:00:00');
      
      // Check for session conflicts
      const conflictingSessions = await checkTimeOffConflicts(
        organization.id,
        userProfile.id,
        start,
        end
      );
      setConflicts(conflictingSessions);
      
      // Check for blocked dates
      const blockedResult = await checkDateIsBlocked(
        organization.id,
        start,
        end
      );
      
      if (blockedResult.isBlocked) {
        setBlockedInfo(blockedResult);
        if (blockedResult.canOverride) {
          setShowHighPriority(true);
        }
      } else {
        setBlockedInfo(null);
        setShowHighPriority(false);
        setHighPriorityReason('');
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleDateChange = async (e) => {
    handleInputChange(e);
    
    const startDateValue = e.target.name === 'startDate' ? e.target.value : formData.startDate;
    const endDateValue = e.target.name === 'endDate' ? e.target.value : formData.endDate;
    
    // For partial day requests, check with the same date for start and end
    if (formData.isPartialDay && startDateValue) {
      await checkForConflictsAndBlockedDates(startDateValue, startDateValue);
    }
    // For regular requests, check when we have both dates
    else if (startDateValue && endDateValue) {
      await checkForConflictsAndBlockedDates(startDateValue, endDateValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.startDate) {
      setError('Please select a start date');
      return;
    }
    
    if (!formData.isPartialDay && !formData.endDate) {
      setError('Please select an end date');
      return;
    }
    
    if (!formData.reason.trim()) {
      setError('Please provide a reason for your time off request');
      return;
    }
    
    const startDate = new Date(formData.startDate + 'T12:00:00');
    const endDate = formData.isPartialDay ? new Date(formData.startDate + 'T12:00:00') : new Date(formData.endDate + 'T12:00:00');
    
    if (!formData.isPartialDay && startDate > endDate) {
      setError('End date must be after start date');
      return;
    }
    
    if (startDate < new Date().setHours(0, 0, 0, 0)) {
      setError('Start date cannot be in the past');
      return;
    }
    
    // Check for blocked dates without override
    if (blockedInfo && blockedInfo.isBlocked && !blockedInfo.canOverride) {
      setError('The selected dates are not available for time off requests');
      return;
    }
    
    // Check for high priority validation
    if (blockedInfo && blockedInfo.isBlocked && blockedInfo.canOverride && showHighPriority) {
      if (!highPriorityReason.trim()) {
        setError('Please provide a reason for the high priority request');
        return;
      }
    }
    
    // Validate times for partial day requests
    if (formData.isPartialDay) {
      if (!formData.startTime || !formData.endTime) {
        setError('Please specify both start and end times');
        return;
      }
      
      const startTimeDate = new Date(`2000-01-01T${formData.startTime}`);
      const endTimeDate = new Date(`2000-01-01T${formData.endTime}`);
      
      if (startTimeDate >= endTimeDate) {
        setError('End time must be after start time');
        return;
      }
    }

    // Validate PTO hours if using paid time off
    if (formData.isPaidTimeOff && ptoEnabled) {
      if (formData.ptoHoursRequested <= 0) {
        setError('Please specify PTO hours to use');
        return;
      }
      
      if (formData.ptoHoursRequested > maxPTOHours) {
        setError(`Maximum ${maxPTOHours} PTO hours allowed for this request`);
        return;
      }
      
      if (ptoBalance && formData.ptoHoursRequested > ptoBalance.currentBalance) {
        setError(`Insufficient PTO balance. You have ${ptoBalance.currentBalance} hours available`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const requestData = {
        organizationID: organization.id,
        photographerId: userProfile.id,
        photographerName: `${userProfile.firstName} ${userProfile.lastName}`,
        photographerEmail: userProfile.email,
        startDate: startDate,
        endDate: endDate,
        reason: formData.reason.trim(),
        notes: formData.notes.trim(),
        isPartialDay: formData.isPartialDay,
        ...(formData.isPartialDay && {
          startTime: formData.startTime,
          endTime: formData.endTime
        }),
        // Add PTO fields
        isPaidTimeOff: formData.isPaidTimeOff && ptoEnabled,
        ptoHoursRequested: formData.isPaidTimeOff && ptoEnabled ? formData.ptoHoursRequested : 0,
        // Add priority fields if request overlaps with blocked dates
        priority: (blockedInfo && blockedInfo.isBlocked && showHighPriority) ? 'high' : 'normal',
        ...(blockedInfo && blockedInfo.isBlocked && showHighPriority && {
          priorityReason: highPriorityReason.trim(),
          bypassedBlockedDates: true,
          blockedDatesAcknowledged: true
        })
      };

      await createTimeOffRequest(requestData);
      
      // Reset form and close modal
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        notes: '',
        isPartialDay: false,
        startTime: '09:00',
        endTime: '17:00',
        isPaidTimeOff: false,
        ptoHoursRequested: 0
      });
      setConflicts([]);
      setBlockedInfo(null);
      setShowHighPriority(false);
      setHighPriorityReason('');
      onClose();
    } catch (error) {
      console.error('Error creating time off request:', error);
      setError('Failed to submit time off request. Please try again.');
    } finally {
      setLoading(false);
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
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxWidth: "500px",
          width: "90%",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
          borderBottom: "1px solid #e9ecef",
          backgroundColor: "#f8f9fa",
          flexShrink: 0
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Request Time Off</h2>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              color: "#6c757d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "0.75rem", flex: "1 1 auto" }}>
          <form onSubmit={handleSubmit} style={{ margin: 0 }}>
            {/* Partial Day Toggle - moved to top */}
            <div style={{ backgroundColor: '#f8f9fa', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e9ecef', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                <input
                  type="checkbox"
                  name="isPartialDay"
                  checked={formData.isPartialDay}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    handleInputChange(e);
                    
                    // Set end date same as start date for partial day
                    if (isChecked && formData.startDate) {
                      setFormData(prev => ({
                        ...prev,
                        endDate: prev.startDate,
                        isPartialDay: true
                      }));
                      // Check for blocked dates when toggling partial day on
                      // Use the current startDate value that's already in state
                      await checkForConflictsAndBlockedDates(formData.startDate, formData.startDate);
                    } else if (!isChecked && formData.startDate && formData.endDate) {
                      // When unchecking partial day, recheck with the date range
                      await checkForConflictsAndBlockedDates(formData.startDate, formData.endDate);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <span style={{
                  width: '44px',
                  height: '24px',
                  backgroundColor: formData.isPartialDay ? '#007bff' : '#ccc',
                  borderRadius: '12px',
                  position: 'relative',
                  transition: 'background-color 0.3s',
                  flexShrink: 0,
                  display: 'inline-block',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: formData.isPartialDay ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}></span>
                </span>
                Partial day only (specify time range)
              </label>
            </div>

            {/* Date Fields */}
            {!formData.isPartialDay ? (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="startDate" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} />
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleDateChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="endDate" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} />
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleDateChange}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    required
                    style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="startDate" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} />
                    Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleDateChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  />
                </div>
              </div>
            )}

            {/* Time Range for Partial Day */}
            {formData.isPartialDay && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="startTime" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    Start Time
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="endTime" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    End Time
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <label htmlFor="reason" style={{ fontSize: '13px', fontWeight: '500' }}>Reason *</label>
              <select
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
                style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px' }}
              >
                <option value="">Select a reason</option>
                <option value="Vacation">Vacation</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Personal Day">Personal Day</option>
                <option value="Family Emergency">Family Emergency</option>
                <option value="Medical Appointment">Medical Appointment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <label htmlFor="notes" style={{ fontSize: '13px', fontWeight: '500' }}>Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={2}
                placeholder="Any additional information..."
                style={{ padding: '6px 8px', fontSize: '13px', border: '1px solid #dee2e6', borderRadius: '4px', resize: 'vertical', minHeight: '50px' }}
              />
            </div>

            {/* PTO Section */}
            {ptoEnabled && (
              <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Users size={16} style={{ color: '#6c757d' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#495057' }}>Paid Time Off (PTO)</span>
                </div>
                
                {loadingPTO ? (
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Loading PTO balance...</div>
                ) : ptoBalance ? (
                  <>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px' }}>
                      Available PTO: <strong>{ptoBalance.currentBalance} hours</strong>
                      {ptoBalance.pendingBalance > 0 && (
                        <span> ({ptoBalance.pendingBalance} hours pending)</span>
                      )}
                    </div>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '8px' }}>
                      <input
                        type="checkbox"
                        name="isPaidTimeOff"
                        checked={formData.isPaidTimeOff}
                        onChange={handleInputChange}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        width: '32px',
                        height: '16px',
                        backgroundColor: formData.isPaidTimeOff ? '#007bff' : '#ccc',
                        borderRadius: '8px',
                        position: 'relative',
                        transition: 'background-color 0.3s',
                        flexShrink: 0,
                        display: 'inline-block'
                      }}>
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: formData.isPaidTimeOff ? '16px' : '2px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: 'left 0.3s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                        }}></span>
                      </span>
                      Use PTO for this request
                    </label>
                    
                    {formData.isPaidTimeOff && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label htmlFor="ptoHoursRequested" style={{ fontSize: '12px', fontWeight: '500' }}>
                          PTO Hours to Use (max {maxPTOHours} for this request)
                        </label>
                        <input
                          type="number"
                          id="ptoHoursRequested"
                          name="ptoHoursRequested"
                          value={formData.ptoHoursRequested}
                          onChange={handleInputChange}
                          min="1"
                          max={Math.min(maxPTOHours, ptoBalance.currentBalance)}
                          step="0.5"
                          placeholder="Enter hours"
                          style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #dee2e6', borderRadius: '4px', width: '120px' }}
                        />
                        <div style={{ fontSize: '11px', color: '#6c757d' }}>
                          You can use up to {Math.min(maxPTOHours, ptoBalance.currentBalance)} hours
                          {maxPTOHours < ptoBalance.currentBalance && ' (limited by request duration)'}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>PTO balance unavailable</div>
                )}
              </div>
            )}

            {/* Blocked Dates Warning */}
            {blockedInfo && blockedInfo.isBlocked && (
              <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} style={{ color: '#6c757d', flexShrink: 0 }} />
                    <strong style={{ fontSize: '12px', color: '#495057' }}>Note: Selected dates include blocked periods</strong>
                  </div>
                  <div style={{ marginLeft: '22px' }}>
                    {blockedInfo.blockedRanges.map((range, index) => (
                      <div key={index} style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px' }}>
                        {range.reason}
                      </div>
                    ))}
                  </div>
                  {blockedInfo.canOverride ? (
                    <div style={{ marginLeft: '22px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', padding: '4px 0' }}>
                        <input
                          type="checkbox"
                          checked={showHighPriority}
                          onChange={(e) => setShowHighPriority(e.target.checked)}
                          style={{ display: 'none' }}
                        />
                        <span style={{
                          width: '40px',
                          height: '20px',
                          backgroundColor: showHighPriority ? '#007bff' : '#ccc',
                          borderRadius: '10px',
                          position: 'relative',
                          transition: 'background-color 0.3s',
                          flexShrink: 0,
                          display: 'inline-block'
                        }}>
                          <span style={{
                            position: 'absolute',
                            top: '2px',
                            left: showHighPriority ? '20px' : '2px',
                            width: '16px',
                            height: '16px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: 'left 0.3s',
                            boxShadow: '0 2px 3px rgba(0,0,0,0.2)'
                          }}></span>
                        </span>
                        Mark as high priority
                      </label>
                      {showHighPriority && (
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label htmlFor="priorityReason" style={{ fontSize: '12px', fontWeight: '500' }}>Priority Reason *</label>
                          <textarea
                            id="priorityReason"
                            value={highPriorityReason}
                            onChange={(e) => setHighPriorityReason(e.target.value)}
                            rows={2}
                            placeholder="Please explain why this is high priority..."
                            required
                            style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #dee2e6', borderRadius: '4px', resize: 'vertical', minHeight: '40px' }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginLeft: '22px', fontSize: '11px', color: '#dc3545' }}>
                      These dates are unavailable for time off requests.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session Conflict Warning */}
            {conflicts.length > 0 && (
              <div style={{ backgroundColor: '#fff4e5', border: '1px solid #ffa500', borderRadius: '4px', padding: '8px', marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ color: '#ff8c00', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '12px', color: '#cc6600', display: 'block', marginBottom: '2px' }}>Warning: You have {conflicts.length} scheduled session{conflicts.length > 1 ? 's' : ''} during this period.</strong>
                  <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>Your manager will need to reassign these sessions if your request is approved.</p>
                </div>
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: '#fee', border: '1px solid #fcc', color: '#c00', padding: '8px 10px', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}
          </form>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
          padding: "0.75rem",
          borderTop: "1px solid #e9ecef",
          backgroundColor: "#f8f9fa",
          flexShrink: 0
        }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || checkingConflicts || (blockedInfo && blockedInfo.isBlocked && !blockedInfo.canOverride)}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TimeOffRequestModal;