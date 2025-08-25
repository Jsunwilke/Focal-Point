import React from 'react';
import { useChatContext } from 'stream-chat-react';
import { Hash, Lock, Users, Circle, Pin } from 'lucide-react';
import './CustomChannelPreview.css';

const CustomChannelPreview = ({ channel, setActiveChannel, watchers, Avatar, displayTitle, displayImage }) => {
  const { client } = useChatContext();
  
  if (!channel) return null;

  const { data, state } = channel;
  const members = Object.values(state?.members || {});
  const isDirectMessage = channel.type === 'messaging' && members.length === 2;
  const unreadCount = channel.state?.unreadCount || 0;
  
  // Get the last message
  const lastMessage = channel.state?.messages?.[channel.state.messages.length - 1];
  
  // Format timestamp
  const formatTimestamp = (date) => {
    if (!date) return '';
    
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get display info
  const getDisplayInfo = () => {
    if (isDirectMessage) {
      const otherMember = members.find(m => m.user?.id !== client.userID);
      const otherUser = otherMember?.user;
      return {
        name: otherUser?.name || 'Unknown User',
        image: otherUser?.image,
        isOnline: otherUser?.online
      };
    }
    
    return {
      name: data?.name || 'Unnamed Channel',
      image: data?.image,
      isOnline: false
    };
  };

  const { name, image, isOnline } = getDisplayInfo();

  // Format last message preview
  const getMessagePreview = () => {
    if (!lastMessage) return 'No messages yet';
    
    const senderName = lastMessage.user?.id === client.userID ? 'You' : lastMessage.user?.name;
    const messageText = lastMessage.text || '';
    
    if (lastMessage.attachments?.length > 0) {
      const attachment = lastMessage.attachments[0];
      if (attachment.type === 'image') return `${senderName}: 📷 Photo`;
      if (attachment.type === 'giphy') return `${senderName}: GIF`;
      if (attachment.type === 'file') return `${senderName}: 📎 ${attachment.title || 'File'}`;
    }
    
    if (messageText.length > 30) {
      return `${senderName}: ${messageText.substring(0, 30)}...`;
    }
    
    return `${senderName}: ${messageText}`;
  };

  // Get channel icon
  const getChannelIcon = () => {
    if (isDirectMessage) return null;
    if (data?.isPrivate) return <Lock size={16} />;
    if (channel.type === 'team') return <Users size={16} />;
    return <Hash size={16} />;
  };

  const isActive = channel.cid === client?.activeChannel?.cid;
  const [isPinned, setIsPinned] = React.useState(channel.data?.pinned || false);

  const handlePin = async (e) => {
    e.stopPropagation();
    try {
      const newPinnedState = !isPinned;
      setIsPinned(newPinnedState);
      
      // Update channel data
      await channel.updatePartial({
        set: {
          pinned: newPinnedState
        }
      });
      
      console.log(`Channel ${newPinnedState ? 'pinned' : 'unpinned'}`);
    } catch (error) {
      console.error('Failed to pin/unpin channel:', error);
      setIsPinned(!isPinned); // Revert on error
    }
  };

  return (
    <div 
      className={`custom-channel-preview ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
      onClick={() => setActiveChannel(channel)}
    >
      {/* Avatar */}
      <div className="preview-avatar">
        {image ? (
          <img src={image} alt={name} />
        ) : (
          <div className="avatar-fallback">
            {isDirectMessage ? '👤' : '👥'}
          </div>
        )}
        {isOnline && (
          <span className="online-badge"></span>
        )}
      </div>

      {/* Content */}
      <div className="preview-content">
        <div className="preview-header">
          <div className="preview-name">
            {getChannelIcon()}
            <span>{name}</span>
          </div>
          <div className="preview-right">
            <span className="preview-time">
              {formatTimestamp(lastMessage?.created_at || channel.data?.created_at)}
            </span>
            {unreadCount > 0 && (
              <span className="unread-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
            <button 
              className={`pin-button ${isPinned ? 'pinned' : ''}`}
              onClick={handlePin}
              title={isPinned ? "Unpin conversation" : "Pin conversation"}
            >
              <Pin size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomChannelPreview;