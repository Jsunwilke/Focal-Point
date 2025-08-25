import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Users, Settings, Trash2, UserPlus, UserMinus, Edit2, Camera, Bell, BellOff } from 'lucide-react';
import './ChannelSettingsModal.css';

const ChannelSettingsModal = ({ isOpen, onClose, channel, currentUser }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelImage, setChannelImage] = useState('');
  const [members, setMembers] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (channel && isOpen) {
      setChannelName(channel.data?.name || '');
      setChannelDescription(channel.data?.description || '');
      setChannelImage(channel.data?.image || '');
      setMembers(Object.values(channel.state?.members || {}));
      setIsMuted(channel.muteStatus()?.muted || false);
    }
  }, [channel, isOpen]);

  const handleSaveChanges = async () => {
    if (!channel) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await channel.update({
        name: channelName,
        description: channelDescription,
        image: channelImage
      });
      
      setIsEditing(false);
      console.log('Channel updated successfully');
    } catch (err) {
      console.error('Failed to update channel:', err);
      setError('Failed to update channel settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    if (!channel) return;
    
    try {
      await channel.addMembers([userId]);
      console.log('Member added successfully');
    } catch (err) {
      console.error('Failed to add member:', err);
      setError('Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!channel || userId === currentUser?.uid) return;
    
    try {
      await channel.removeMembers([userId]);
      setMembers(prev => prev.filter(m => m.user?.id !== userId));
      console.log('Member removed successfully');
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
    }
  };

  const handleToggleMute = async () => {
    if (!channel) return;
    
    try {
      if (isMuted) {
        await channel.unmute();
      } else {
        await channel.mute();
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
      setError('Failed to update notification settings');
    }
  };

  const handleLeaveChannel = async () => {
    if (!channel || !currentUser) return;
    
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    
    try {
      await channel.removeMembers([currentUser.uid]);
      onClose();
    } catch (err) {
      console.error('Failed to leave channel:', err);
      setError('Failed to leave channel');
    }
  };

  const handleDeleteChannel = async () => {
    if (!channel) return;
    
    if (!window.confirm('Are you sure you want to delete this channel? This action cannot be undone.')) return;
    
    try {
      await channel.delete();
      onClose();
    } catch (err) {
      console.error('Failed to delete channel:', err);
      setError('Failed to delete channel');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChannelImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen || !channel) return null;

  const isOwner = channel.data?.created_by_id === currentUser?.uid;
  const isAdmin = members.find(m => m.user?.id === currentUser?.uid)?.role === 'admin' || isOwner;

  return ReactDOM.createPortal(
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
        className="channel-settings-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="settings-header">
          <h2>Channel Settings</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={18} />
            General
          </button>
          <button
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={18} />
            Members ({members.length})
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {error && (
            <div className="error-message">{error}</div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="general-settings">
              {/* Channel Image */}
              <div className="channel-image-section">
                <div className="channel-image-preview">
                  {channelImage ? (
                    <img src={channelImage} alt="Channel" />
                  ) : (
                    <div className="image-placeholder">
                      <Camera size={32} />
                    </div>
                  )}
                </div>
                {isEditing && isAdmin && (
                  <>
                    <input
                      type="file"
                      id="channel-image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="channel-image" className="upload-button">
                      Change Image
                    </label>
                  </>
                )}
              </div>

              {/* Channel Name */}
              <div className="form-group">
                <label>Channel Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    maxLength={50}
                  />
                ) : (
                  <div className="display-value">
                    {channelName || 'Unnamed Channel'}
                    {isAdmin && (
                      <button onClick={() => setIsEditing(true)}>
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Channel Description */}
              <div className="form-group">
                <label>Description</label>
                {isEditing ? (
                  <textarea
                    value={channelDescription}
                    onChange={(e) => setChannelDescription(e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder="What's this channel about?"
                  />
                ) : (
                  <div className="display-value">
                    {channelDescription || 'No description'}
                  </div>
                )}
              </div>

              {/* Channel Info */}
              <div className="channel-info-section">
                <div className="info-item">
                  <label>Created</label>
                  <span>{new Date(channel.data?.created_at).toLocaleDateString()}</span>
                </div>
                <div className="info-item">
                  <label>Type</label>
                  <span>{channel.type === 'team' ? 'Team Channel' : 'Direct Message'}</span>
                </div>
                <div className="info-item">
                  <label>Members</label>
                  <span>{members.length}</span>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="notification-settings">
                <button
                  className="notification-toggle"
                  onClick={handleToggleMute}
                >
                  {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
                  {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                </button>
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="edit-actions">
                  <button 
                    className="cancel-button"
                    onClick={() => {
                      setIsEditing(false);
                      setChannelName(channel.data?.name || '');
                      setChannelDescription(channel.data?.description || '');
                      setChannelImage(channel.data?.image || '');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="save-button"
                    onClick={handleSaveChanges}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* Danger Zone */}
              <div className="danger-zone">
                <h3>Danger Zone</h3>
                <button
                  className="danger-button leave"
                  onClick={handleLeaveChannel}
                >
                  Leave Channel
                </button>
                {isOwner && (
                  <button
                    className="danger-button delete"
                    onClick={handleDeleteChannel}
                  >
                    <Trash2 size={16} />
                    Delete Channel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="members-settings">
              <div className="members-list">
                {members.map(member => (
                  <div key={member.user?.id} className="member-item">
                    <img 
                      src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name}&background=6366f1&color=fff`} 
                      alt={member.user?.name}
                      className="member-avatar"
                    />
                    <div className="member-info">
                      <div className="member-name">
                        {member.user?.name}
                        {member.user?.id === currentUser?.uid && ' (You)'}
                        {member.user?.id === channel.data?.created_by_id && ' (Owner)'}
                      </div>
                      <div className="member-status">
                        {member.user?.online ? (
                          <span className="online">Online</span>
                        ) : (
                          <span className="offline">Offline</span>
                        )}
                      </div>
                    </div>
                    {isAdmin && member.user?.id !== currentUser?.uid && (
                      <button
                        className="remove-member"
                        onClick={() => handleRemoveMember(member.user?.id)}
                        title="Remove member"
                      >
                        <UserMinus size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {isAdmin && (
                <button className="add-member-button">
                  <UserPlus size={18} />
                  Add Members
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChannelSettingsModal;