import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Users, User, Search, Check, Camera } from 'lucide-react';
import { useStreamChat } from '../../contexts/StreamChatContext';
import './CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose, client, currentUser }) => {
  const { streamChatService } = useStreamChat();
  
  // Chat type: 'direct' or 'group'
  const [chatType, setChatType] = useState('direct');
  
  // Form fields
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupImage, setGroupImage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch organization users from Stream Chat
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser?.organizationID || !client) return;
      
      try {
        // Build query filters for Stream Chat
        const filters = {
          organizationID: { $eq: currentUser.organizationID }
        };
        
        // Add search filter if there's a search term
        if (searchTerm) {
          filters.$or = [
            { name: { $icontains: searchTerm } },
            { email: { $icontains: searchTerm } }
          ];
        }
        
        // Query users from Stream Chat
        const response = await client.queryUsers(
          filters,
          { name: 1 }, // Sort by name
          { limit: 100 }
        );
        
        // Get the actual current user ID from Stream Chat client or props
        const currentUserId = client.userID || currentUser?.id || currentUser?.uid;
        const currentUserEmail = currentUser?.email?.toLowerCase();
        
        console.log('Current user ID from client:', client.userID);
        console.log('Current user ID from prop:', currentUser?.id || currentUser?.uid);
        console.log('Current user email:', currentUserEmail);
        console.log('All users from Stream:', response.users.map(u => ({ id: u.id, email: u.email })));
        
        // Filter out current user by ID or email
        const formattedUsers = response.users
          .filter(u => {
            // Filter by ID if we have it, otherwise by email
            if (currentUserId) {
              return u.id !== currentUserId;
            } else if (currentUserEmail) {
              return u.email?.toLowerCase() !== currentUserEmail;
            }
            return true;
          })
          .map(u => ({
            id: u.id,
            uid: u.id, // Keep uid for compatibility
            name: u.name || u.email?.split('@')[0] || 'User',
            email: u.email,
            image: u.image,
            online: u.online || false, // Real-time online status from Stream Chat
            role: u.firebaseRole || u.role, // Use original Firebase role if available
            ...u
          }));
        
        console.log('Filtered users count:', formattedUsers.length);
        console.log('Sample user structure:', formattedUsers[0]);
        setAvailableUsers(formattedUsers);
      } catch (err) {
        console.error('Failed to fetch users from Stream Chat:', err);
        setError('Failed to load users');
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, currentUser, client]);

  const handleCreateChat = async () => {
    // Validation based on chat type
    if (chatType === 'group') {
      if (!groupName.trim()) {
        setError('Please enter a group name');
        return;
      }
      if (selectedMembers.length === 0) {
        setError('Please select at least one member');
        return;
      }
    } else {
      // Direct message
      if (selectedMembers.length !== 1) {
        setError('Please select exactly one person for a direct message');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // Validate current user exists (check both uid and id)
      const userIdField = currentUser?.uid || currentUser?.id;
      if (!userIdField) {
        console.error('Current user ID is missing', currentUser);
        setError('User session error. Please refresh and try again.');
        return;
      }
      
      const currentUserId = String(userIdField);
      console.log('Current user ID:', currentUserId);
      
      // Collect all member IDs (including current user for groups)
      const memberIds = chatType === 'direct' 
        ? [currentUserId, String(selectedMembers[0].id || selectedMembers[0].uid)]
        : [currentUserId, ...selectedMembers.map(m => String(m.id || m.uid))];
      
      console.log('Raw member IDs:', memberIds);
      
      // Remove duplicates and filter out undefined/null values
      const uniqueMemberIds = [...new Set(memberIds)].filter(id => id && id !== 'undefined' && id !== 'null' && id !== '');
      
      console.log('Filtered member IDs:', uniqueMemberIds);
      
      // Check if we have valid member IDs
      if (uniqueMemberIds.some(id => !id || id === 'undefined')) {
        console.error('Invalid member IDs detected:', uniqueMemberIds);
        setError('Invalid user selection. Please try again.');
        return;
      }
      
      // Users are already migrated to Stream Chat, no need to sync
      
      if (chatType === 'direct') {
        // Create or get direct message channel
        const otherUser = selectedMembers[0];
        const otherUserId = String(otherUser.id || otherUser.uid || '');
        
        // Validate other user ID
        if (!otherUserId || otherUserId === 'undefined' || otherUserId === 'null' || otherUserId === '') {
          console.error('Invalid other user ID:', otherUser);
          setError('Invalid user selected. Please try again.');
          return;
        }
        
        const sortedIds = [currentUserId, otherUserId].sort();
        const channelId = `dm-${sortedIds.join('-')}`;
        
        console.log('Creating DM channel with IDs:', sortedIds);
        
        // Now create channel with both users (they should exist in Stream now)
        const channel = client.channel('messaging', channelId, {
          members: sortedIds,
          name: otherUser.name
        });
        
        await channel.watch();
        console.log('Direct message channel created successfully');
        
      } else {
        // Create group channel
        const channelId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const channelData = {
          name: groupName,
          description: groupDescription,
          image: groupImage || generateGroupAvatar(groupName)
          // Don't include created_by - Stream Chat will set it automatically
        };

        // Create channel with all members (they should exist in Stream now)
        const channel = client.channel('messaging', channelId, {
          ...channelData,
          members: uniqueMemberIds
        });
        
        await channel.watch();
        console.log('Group channel created successfully with all members');
      }
      
      // Reset form and close modal
      handleClose();
      
    } catch (err) {
      console.error('Failed to create chat:', err);
      setError('Failed to create chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setGroupDescription('');
    setSelectedMembers([]);
    setChatType('direct');
    setGroupImage('');
    setSearchTerm('');
    setError('');
    onClose();
  };

  const toggleMemberSelection = (user) => {
    console.log('Selected user:', user);
    if (chatType === 'direct') {
      // For direct messages, only allow one selection
      setSelectedMembers([user]);
    } else {
      // For groups, allow multiple selections
      setSelectedMembers(prev => {
        const isSelected = prev.some(m => m.id === user.id);
        if (isSelected) {
          return prev.filter(m => m.id !== user.id);
        } else {
          return [...prev, user];
        }
      });
    }
  };

  const isUserSelected = (user) => {
    return selectedMembers.some(m => m.id === user.id);
  };

  const generateGroupAvatar = (name) => {
    const initial = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=6366f1&color=fff&size=200`;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="modal-overlay" 
      onClick={handleClose}
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
        className="create-chat-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '800px',
          height: '90vh',
          maxHeight: '720px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>New Conversation</h2>
          <button className="close-button" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Chat Type Toggle */}
        <div className="chat-type-toggle">
          <button
            className={`toggle-option ${chatType === 'direct' ? 'active' : ''}`}
            onClick={() => {
              setChatType('direct');
              setSelectedMembers([]);
            }}
          >
            <User size={18} />
            <span>Direct Message</span>
          </button>
          <button
            className={`toggle-option ${chatType === 'group' ? 'active' : ''}`}
            onClick={() => {
              setChatType('group');
              setSelectedMembers([]);
            }}
          >
            <Users size={18} />
            <span>Group Chat</span>
          </button>
        </div>

        {/* Body with two columns */}
        <div className="modal-body-grid">
          {/* Left Column - Settings */}
          <div className="settings-column">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {chatType === 'group' && (
              <>
                {/* Group Image */}
                <div className="group-image-section">
                  <div className="group-image-preview">
                    {groupImage ? (
                      <img src={groupImage} alt="Group" />
                    ) : (
                      <div className="image-placeholder">
                        <Camera size={24} />
                      </div>
                    )}
                  </div>
                  <div className="image-upload-area">
                    <input
                      type="file"
                      id="group-image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="group-image" className="upload-label">
                      {groupImage ? 'Change Image' : 'Add Group Image'}
                    </label>
                    <span className="upload-hint">Optional</span>
                  </div>
                </div>

                {/* Group Name */}
                <div className="form-group">
                  <label htmlFor="group-name">Group Name *</label>
                  <input
                    id="group-name"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Marketing Team"
                    maxLength={50}
                    autoFocus
                  />
                </div>

                {/* Group Description */}
                <div className="form-group">
                  <label htmlFor="group-description">Description</label>
                  <textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What's this group about? (optional)"
                    rows={3}
                    maxLength={200}
                  />
                </div>
              </>
            )}

            {chatType === 'direct' && selectedMembers.length === 1 && (
              <div className="selected-dm-user">
                <img 
                  src={selectedMembers[0].image || generateGroupAvatar(selectedMembers[0].name)} 
                  alt={selectedMembers[0].name} 
                />
                <div className="dm-user-info">
                  <h3>{selectedMembers[0].name}</h3>
                  <p>{selectedMembers[0].email}</p>
                </div>
              </div>
            )}

            {/* Selected Members Count */}
            {chatType === 'group' && selectedMembers.length > 0 && (
              <div className="selected-count">
                <span>{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected</span>
              </div>
            )}
          </div>

          {/* Right Column - User Selection */}
          <div className="users-column">
            <div className="users-header">
              <h3>
                {chatType === 'direct' ? 'Select a person' : 'Add members'}
              </h3>
              {chatType === 'group' && availableUsers.length > 0 && (
                <div className="bulk-actions">
                  <button 
                    className="text-button"
                    onClick={() => setSelectedMembers(availableUsers)}
                  >
                    Select All
                  </button>
                  <button 
                    className="text-button"
                    onClick={() => setSelectedMembers([])}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="user-search">
              <Search size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>

            {/* User List */}
            <div className="users-list">
              {availableUsers.map(user => (
                <div
                  key={user.id}
                  className={`user-item ${isUserSelected(user) ? 'selected' : ''}`}
                  onClick={() => toggleMemberSelection(user)}
                >
                  <img 
                    src={user.image || generateGroupAvatar(user.name)} 
                    alt={user.name} 
                    className="user-avatar"
                  />
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                  {isUserSelected(user) && (
                    <div className="check-mark">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              ))}
              {availableUsers.length === 0 && searchTerm && (
                <div className="no-users">No users found matching "{searchTerm}"</div>
              )}
              {availableUsers.length === 0 && !searchTerm && (
                <div className="no-users">No team members available</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="cancel-button" onClick={handleClose}>
            Cancel
          </button>
          <button 
            className="create-button" 
            onClick={handleCreateChat}
            disabled={
              isLoading || 
              (chatType === 'direct' && selectedMembers.length !== 1) ||
              (chatType === 'group' && (!groupName.trim() || selectedMembers.length === 0))
            }
          >
            {isLoading ? 'Creating...' : 
             chatType === 'direct' ? 'Start Conversation' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateGroupModal;