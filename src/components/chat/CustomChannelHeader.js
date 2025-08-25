import React, { useState } from 'react';
import { useChannelStateContext, Avatar, useChatContext } from 'stream-chat-react';
import { Info, Search, Pin, Users, Settings, MoreVertical, Trash2, X } from 'lucide-react';
import PinnedMessages from './PinnedMessages';
import MessageSearch from './MessageSearch';
import './CustomChannelHeader.css';

const CustomChannelHeader = ({ onSettingsClick }) => {
  const { channel, watcher_count } = useChannelStateContext();
  const { client, setActiveChannel } = useChatContext();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  if (!channel) return null;

  const members = Object.values(channel.state.members || {});
  const isDirectMessage = channel.type === 'messaging' && members.length === 2;
  const channelName = channel.data?.name || 'Channel';
  const channelImage = channel.data?.image;
  
  // Get online members count
  const onlineMembers = members.filter(member => member.user?.online).length;
  
  // Get other user for DM
  const getOtherUser = () => {
    if (isDirectMessage) {
      const otherMember = members.find(m => m.user?.id !== channel._client.userID);
      return otherMember?.user;
    }
    return null;
  };

  const otherUser = getOtherUser();
  const displayName = isDirectMessage && otherUser ? otherUser.name : channelName;
  const displayImage = isDirectMessage && otherUser ? otherUser.image : channelImage;
  
  // Handle channel deletion
  const handleDeleteChannel = async () => {
    if (!channel) return;
    
    setIsDeleting(true);
    try {
      // Delete the channel
      await channel.delete();
      
      // Clear active channel
      setActiveChannel(null);
      
      // Close modal
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting channel:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMoreMenu && !e.target.closest('.more-menu-container')) {
        setShowMoreMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreMenu]);

  return (
    <>
    <div className="custom-channel-header">
      <div className="header-left">
        {/* Channel/User Avatar */}
        <div className="channel-avatar">
          {displayImage ? (
            <img src={displayImage} alt={displayName} />
          ) : (
            <div className="avatar-placeholder">
              {isDirectMessage ? '👤' : '👥'}
            </div>
          )}
          {isDirectMessage && otherUser?.online && (
            <span className="online-indicator"></span>
          )}
        </div>

        {/* Channel Info */}
        <div className="channel-info">
          <h3 className="channel-name">
            {!isDirectMessage && channel.type === 'team' && '# '}
            {displayName}
          </h3>
          <div className="channel-status">
            {isDirectMessage ? (
              otherUser?.online ? (
                <span className="status-online">Active now</span>
              ) : (
                <span className="status-offline">
                  {otherUser?.last_active ? 
                    `Last seen ${formatLastSeen(otherUser.last_active)}` : 
                    'Offline'}
                </span>
              )
            ) : (
              <span className="member-count">
                <Users size={14} />
                {members.length} members
                {onlineMembers > 0 && ` • ${onlineMembers} online`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Action Buttons */}
        <button 
          className="header-action" 
          title="View pinned messages"
          onClick={() => setShowPinnedMessages(!showPinnedMessages)}
        >
          <Pin size={18} />
        </button>
        <button 
          className="header-action" 
          title="Search in conversation"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search size={18} />
        </button>
        
        {/* Settings/Info */}
        {!isDirectMessage && (
          <button 
            className="header-action" 
            title="Channel settings"
            onClick={onSettingsClick}
          >
            <Settings size={18} />
          </button>
        )}
        
        <div className="more-menu-container">
          <button 
            className="header-action" 
            title="More options"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
          >
            <MoreVertical size={18} />
          </button>
          
          {showMoreMenu && (
            <div className="more-menu-dropdown">
              <button 
                className="menu-item delete-item"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setShowMoreMenu(false);
                }}
              >
                <Trash2 size={16} />
                <span>Delete Conversation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    
    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
        <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-header">
            <h3>Delete Conversation</h3>
            <button 
              className="close-button"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="delete-modal-body">
            <p>
              Are you sure you want to delete this conversation? 
              {!isDirectMessage && ' This will delete the channel for all members.'}
            </p>
            <p className="warning-text">
              This action cannot be undone.
            </p>
          </div>
          
          <div className="delete-modal-footer">
            <button 
              className="cancel-button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button 
              className="delete-button"
              onClick={handleDeleteChannel}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Pinned Messages Overlay */}
    {showPinnedMessages && (
      <PinnedMessages 
        channel={channel}
        onClose={() => setShowPinnedMessages(false)}
      />
    )}
    
    {/* Message Search Overlay */}
    {showSearch && (
      <MessageSearch 
        channel={channel}
        onClose={() => setShowSearch(false)}
      />
    )}
    </>
  );
};

// Helper function to format last seen time
const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'recently';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
};

export default CustomChannelHeader;