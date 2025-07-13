// src/components/schools/SchoolSessionsList.js
import React from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  User,
  CheckCircle,
  AlertCircle,
  Circle
} from 'lucide-react';
import { getSessionTypeColors, getSessionTypeNames } from '../../utils/sessionTypes';
import './SchoolSessionsList.css';

const SchoolSessionsList = ({ sessions, organization, teamMembers = [], onSessionClick }) => {
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="session-status-icon session-status-icon--completed" />;
      case 'in-progress':
        return <AlertCircle size={14} className="session-status-icon session-status-icon--in-progress" />;
      case 'scheduled':
      default:
        return <Circle size={14} className="session-status-icon session-status-icon--scheduled" />;
    }
  };

  const getPhotographerNames = (photographers) => {
    if (!photographers || photographers.length === 0) return 'No photographers assigned';
    
    return photographers.map(photographer => {
      const member = teamMembers.find(m => m.id === photographer.id);
      return member ? (member.displayName || `${member.firstName} ${member.lastName}`) : photographer.name || 'Unknown';
    }).join(', ');
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="school-sessions-empty">
        <Calendar size={24} className="school-sessions-empty__icon" />
        <p className="school-sessions-empty__text">No sessions scheduled</p>
      </div>
    );
  }

  return (
    <div className="school-sessions-list">
      {sessions.map((session) => (
        <div 
          key={session.id} 
          className="school-session-item"
          onClick={() => onSessionClick && onSessionClick(session)}
        >
          <div className="school-session-item__header">
            <div className="school-session-item__date">
              <Calendar size={16} />
              <span>{formatDate(session.date)}</span>
            </div>
            <div className="school-session-item__status">
              {getStatusIcon(session.status)}
            </div>
          </div>

          <div className="school-session-item__details">
            <div className="school-session-item__time">
              <Clock size={14} />
              <span>
                {formatTime(session.startTime)} - {formatTime(session.endTime)}
              </span>
            </div>

            {session.sessionTypes && session.sessionTypes.length > 0 && (
              <div className="school-session-item__types">
                {getSessionTypeNames(session.sessionTypes, organization).map((typeName, index) => {
                  const colors = getSessionTypeColors(session.sessionTypes, organization);
                  return (
                    <span 
                      key={index} 
                      className="school-session-type-tag"
                      style={{ backgroundColor: colors[index] || '#6c757d' }}
                    >
                      {typeName}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="school-session-item__photographers">
              {session.photographers && session.photographers.length > 1 ? (
                <Users size={14} />
              ) : (
                <User size={14} />
              )}
              <span className="school-session-photographers-text">
                {getPhotographerNames(session.photographers)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SchoolSessionsList;