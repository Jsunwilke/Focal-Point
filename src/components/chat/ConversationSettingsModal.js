import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { X, Edit2, UserPlus, UserMinus, LogOut } from 'lucide-react';
import EmployeeSelector from './EmployeeSelector';
import '../shared/Modal.css';
import './ConversationSettingsModal.css';

const ConversationSettingsModal = ({ isOpen, onClose, conversation }) => {
  const { 
    updateConversationName, 
    organizationUsers,
    addParticipantsToConversation,
    removeParticipantFromConversation,
    leaveConversation 
  } = useChat();
  const { userProfile } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (conversation?.name) {
      setNewName(conversation.name);
    }
  }, [conversation]);

  if (!isOpen || !conversation) return null;

  const isGroupConversation = conversation.type === 'group';
  const currentParticipants = conversation.participants || [];

  const handleNameSave = async () => {
    if (!newName.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await updateConversationName(conversation.id, newName.trim());
      setIsEditingName(false);
    } catch (err) {
      setError('Failed to update group name');
      console.error('Error updating name:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipants = async (selectedUsers) => {
    setLoading(true);
    setError('');
    
    try {
      await addParticipantsToConversation(conversation.id, selectedUsers);
      setShowAddParticipants(false);
    } catch (err) {
      setError('Failed to add participants');
      console.error('Error adding participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      setLoading(true);
      setError('');
      
      try {
        await removeParticipantFromConversation(conversation.id, participantId);
      } catch (err) {
        setError('Failed to remove participant');
        console.error('Error removing participant:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (window.confirm('Are you sure you want to leave this group? You will need to be re-added to rejoin.')) {
      setLoading(true);
      setError('');
      
      try {
        await leaveConversation(conversation.id);
        onClose(); // Close modal after leaving
      } catch (err) {
        setError(err.message || 'Failed to leave group');
        console.error('Error leaving group:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const getParticipantInfo = (participantId) => {
    // Check if it's the current user first
    if (participantId === userProfile?.id) {
      return {
        name: `${userProfile.firstName || 'Unknown'} ${userProfile.lastName || 'User'}`,
        email: userProfile.email,
        isCurrentUser: true,
        isUnknown: false,
        participantId
      };
    }
    
    const user = organizationUsers.find(u => u.id === participantId);
    if (!user) {
      console.warn('Unknown participant ID:', participantId);
      console.log('Current user ID:', userProfile?.id);
      console.log('Available users:', organizationUsers.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));
      return { 
        name: 'Unknown User', 
        email: `ID: ${participantId}`,
        isCurrentUser: false,
        isUnknown: true,
        participantId 
      };
    }
    
    return {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      isCurrentUser: false,
      isUnknown: false,
      participantId
    };
  };

  const modalContent = (
    <>
      <div 
        className="modal-overlay"
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
          zIndex: 10001
        }}
      >
        <div 
          className="modal-container conversation-settings-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            transform: 'none'
          }}
        >
          <div className="modal-header">
            <h2>Conversation Settings</h2>
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Group Name Section - Only for groups */}
            {isGroupConversation && (
              <div className="settings-section">
                <h3>Group Name</h3>
                {isEditingName ? (
                  <div className="name-edit-form">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter group name"
                      maxLength={50}
                      autoFocus
                    />
                    <div className="name-edit-actions">
                      <button 
                        onClick={handleNameSave}
                        disabled={loading}
                        className="btn-primary"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditingName(false);
                          setNewName(conversation.name || '');
                          setError('');
                        }}
                        disabled={loading}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="name-display">
                    <span>{conversation.name || 'Unnamed Group'}</span>
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="icon-button"
                      title="Edit name"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Participants Section */}
            <div className="settings-section">
              <div className="section-header">
                <h3>Participants ({currentParticipants.length})</h3>
                {isGroupConversation && (
                  <button 
                    onClick={() => setShowAddParticipants(true)}
                    className="icon-button"
                    title="Add participants"
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </div>
              
              <div className="participants-list">
                {currentParticipants.map((participantId) => {
                  const { name, email, isCurrentUser, isUnknown } = getParticipantInfo(participantId);
                  
                  return (
                    <div key={participantId} className={`participant-item ${isUnknown ? 'participant-item--unknown' : ''}`}>
                      <div className="participant-info">
                        <div className="participant-name">
                          {name} {isCurrentUser && '(You)'}
                        </div>
                        {email && (
                          <div className="participant-email">{email}</div>
                        )}
                      </div>
                      {isGroupConversation && !isCurrentUser && currentParticipants.length > 2 && (
                        <button
                          onClick={() => handleRemoveParticipant(participantId)}
                          className="icon-button remove-button"
                          title={isUnknown ? "Remove unknown participant" : "Remove participant"}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversation Type */}
            <div className="settings-section">
              <h3>Conversation Type</h3>
              <p className="conversation-type">
                {isGroupConversation ? '👥 Group Chat' : '👤 Direct Message'}
              </p>
            </div>

            {/* Leave Group - Only for group conversations */}
            {isGroupConversation && currentParticipants.length > 2 && (
              <div className="settings-section">
                <button 
                  onClick={handleLeaveGroup}
                  disabled={loading}
                  className="leave-group-button"
                >
                  <LogOut size={16} />
                  Leave Group
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Participants Modal */}
      {showAddParticipants && (
        <EmployeeSelector
          isOpen={showAddParticipants}
          onClose={() => setShowAddParticipants(false)}
          onSelect={handleAddParticipants}
          multiSelect={true}
          excludeUsers={currentParticipants}
          title="Add Participants"
        />
      )}
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ConversationSettingsModal;