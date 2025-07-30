import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { X, Search, Users, User } from 'lucide-react';
import UserAvatar from '../shared/UserAvatar';
import '../shared/Modal.css';
import './EmployeeSelector.css';

const EmployeeSelector = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  multiSelect = false, 
  excludeUsers = [], 
  title = "Select Employee",
  onConversationCreated 
}) => {
  const { organizationUsers, createConversation, conversations } = useChat();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [conversationType, setConversationType] = useState('direct');
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredUsers = organizationUsers.filter(user => {
    // Exclude specified users
    if (excludeUsers.includes(user.id)) return false;
    
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    
    return fullName.includes(search) || email.includes(search);
  });

  const handleUserToggle = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        // For direct conversations, only allow one user
        if (conversationType === 'direct') {
          return [user];
        }
        return [...prev, user];
      }
    });
  };

  const handleTypeChange = (type) => {
    setConversationType(type);
    if (type === 'direct' && selectedUsers.length > 1) {
      setSelectedUsers([selectedUsers[0]]);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    // If onSelect is provided, use that instead of creating a conversation
    if (onSelect) {
      onSelect(selectedUsers);
      setSelectedUsers([]);
      setSearchTerm('');
      onClose();
      return;
    }

    setIsCreating(true);
    try {
      const participantIds = selectedUsers.map(user => user.id);
      const customName = conversationType === 'group' && groupName.trim() 
        ? groupName.trim() 
        : null;

      const conversationId = await createConversation(participantIds, conversationType, customName);
      
      // Find the created conversation
      if (onConversationCreated) {
        const createdConversation = conversations.find(conv => conv.id === conversationId);
        if (createdConversation) {
          onConversationCreated(createdConversation);
        }
      }
      
      // Reset form and close modal
      setSelectedUsers([]);
      setGroupName('');
      setSearchTerm('');
      onClose();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = selectedUsers.length > 0 && !isCreating;

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10001
      }}
    >
      <div 
        className="modal modal--medium employee-selector-modal"
        style={{
          position: 'relative',
          margin: 0,
          transform: 'none'
        }}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">{title || 'Start New Conversation'}</h2>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal__content employee-selector__content">
          {/* Conversation Type Selection - only show when not in select mode */}
          {!onSelect && (
            <div className="employee-selector__type-selection">
              <button
                className={`employee-selector__type-btn ${
                  conversationType === 'direct' ? 'employee-selector__type-btn--active' : ''
                }`}
                onClick={() => handleTypeChange('direct')}
              >
                <User size={20} />
                Direct Message
              </button>
            <button
              className={`employee-selector__type-btn ${
                conversationType === 'group' ? 'employee-selector__type-btn--active' : ''
              }`}
              onClick={() => handleTypeChange('group')}
            >
              <Users size={20} />
              Group Chat
            </button>
            </div>
          )}

          {/* Group Name Input - only show when creating new group */}
          {!onSelect && conversationType === 'group' && (
            <div className="employee-selector__group-name">
              <label htmlFor="groupName">Group Name (optional)</label>
              <input
                id="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="employee-selector__group-input"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="employee-selector__search">
            <div className="employee-selector__search-container">
              <Search size={20} className="employee-selector__search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employees..."
                className="employee-selector__search-input"
              />
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="employee-selector__selected">
              <h4>Selected ({selectedUsers.length})</h4>
              <div className="employee-selector__selected-list">
                {selectedUsers.map(user => (
                  <div key={user.id} className="employee-selector__selected-user">
                    <span>{user.firstName} {user.lastName}</span>
                    <button
                      onClick={() => handleUserToggle(user)}
                      className="employee-selector__remove-btn"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employee List */}
          <div className="employee-selector__list">
            <h4>
              Team Members 
              {!onSelect && conversationType === 'direct' && ' (select one)'}
              {!onSelect && conversationType === 'group' && ' (select multiple)'}
              {onSelect && multiSelect && ' (select multiple)'}
              {onSelect && !multiSelect && ' (select one)'}
            </h4>
            <div className="employee-selector__users">
              {filteredUsers.length === 0 ? (
                <div className="employee-selector__empty">
                  <p>No employees found</p>
                </div>
              ) : (
                filteredUsers.map(user => {
                  const isSelected = selectedUsers.find(u => u.id === user.id);
                  
                  return (
                    <div
                      key={user.id}
                      className={`employee-selector__user ${
                        isSelected ? 'employee-selector__user--selected' : ''
                      }`}
                      onClick={() => handleUserToggle(user)}
                    >
                      <UserAvatar user={user} size="medium" />
                      <div className="employee-selector__user-info">
                        <h5>{user.firstName} {user.lastName}</h5>
                        <p>{user.email}</p>
                      </div>
                      <div className="employee-selector__user-checkbox">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => handleUserToggle(user)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="modal__actions">
          <button
            className="btn btn--secondary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleCreateConversation}
            disabled={!canCreate}
          >
            {isCreating ? 'Creating...' : `Create ${conversationType === 'direct' ? 'Conversation' : 'Group'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EmployeeSelector;