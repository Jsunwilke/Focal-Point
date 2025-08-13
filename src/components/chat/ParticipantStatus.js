import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Circle, Users, Clock } from 'lucide-react';
import presenceService from '../../services/presenceService';
import UserAvatar from '../shared/UserAvatar';
import './ParticipantStatus.css';

const ParticipantStatus = ({ conversationId }) => {
  const { activeConversation, organizationUsers } = useChat();
  const { userProfile } = useAuth();
  const [participantPresence, setParticipantPresence] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!activeConversation?.participants) return;
    
    const presenceUnsubscribes = [];
    
    activeConversation.participants.forEach(participantId => {
      const unsubscribe = presenceService.subscribeToUserPresence(
        participantId,
        (presence) => {
          setParticipantPresence(prev => ({
            ...prev,
            [participantId]: presence
          }));
        }
      );
      presenceUnsubscribes.push(unsubscribe);
    });
    
    return () => {
      presenceUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [activeConversation?.participants]);

  const getParticipantData = (participantId) => {
    // Check if it's the current user
    if (participantId === userProfile?.id && userProfile) {
      return {
        id: userProfile.id,
        firstName: userProfile.firstName || 'Unknown',
        lastName: userProfile.lastName || 'User',
        email: userProfile.email || '',
        profilePhotoUrl: userProfile.profilePhotoUrl || null
      };
    }
    
    // Otherwise look in organization users
    return organizationUsers?.find(user => user.id === participantId) || {
      id: participantId,
      firstName: 'Unknown',
      lastName: 'User',
      email: '',
      profilePhotoUrl: null
    };
  };

  const getStatusIcon = (presence) => {
    if (!presence) return <Circle size={10} fill="#9ca3af" color="#9ca3af" />;
    
    if (presence.online) {
      return <Circle size={10} fill="#10b981" color="#10b981" />;
    }
    
    const status = presenceService.getPresenceStatus(presence.lastSeen);
    switch (status) {
      case 'away':
        return <Circle size={10} fill="#fbbf24" color="#fbbf24" />;
      default:
        return <Circle size={10} fill="#9ca3af" color="#9ca3af" />;
    }
  };

  const getStatusText = (presence) => {
    if (!presence) return 'Offline';
    
    if (presence.online) return 'Active now';
    
    if (presence.customStatus) {
      return `${presence.statusEmoji || ''} ${presence.customStatus}`.trim();
    }
    
    return presenceService.formatLastSeen(presence.lastSeen);
  };

  if (!activeConversation) return null;

  const participants = activeConversation.participants || [];
  const onlineCount = participants.filter(id => 
    id !== userProfile?.id && participantPresence[id]?.online
  ).length;

  return (
    <div className="participant-status">
      <button 
        className="participant-status__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Users size={16} />
        <span>Participants ({participants.length})</span>
        {onlineCount > 0 && (
          <span className="participant-status__online-count">
            {onlineCount} online
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="participant-status__list">
          {participants.map(participantId => {
            const participant = getParticipantData(participantId);
            const presence = participantPresence[participantId];
            const isCurrentUser = participantId === userProfile?.id;
            
            return (
              <div key={participantId} className="participant-status__item">
                <div className="participant-status__avatar">
                  <UserAvatar user={participant} size="small" />
                  <span className="participant-status__indicator">
                    {getStatusIcon(presence)}
                  </span>
                </div>
                
                <div className="participant-status__info">
                  <div className="participant-status__name">
                    {participant.firstName} {participant.lastName}
                    {isCurrentUser && ' (You)'}
                  </div>
                  <div className="participant-status__status">
                    {getStatusText(presence)}
                  </div>
                </div>
                
                {presence?.lastSeen && !presence.online && (
                  <Clock size={14} className="participant-status__time-icon" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParticipantStatus;