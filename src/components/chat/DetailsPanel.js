import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, Users, Image as ImageIcon, File, Link2, 
  Bell, Search, Shield, Trash2, LogOut, UserPlus
} from 'lucide-react';
import UserAvatar from '../shared/UserAvatar';
import presenceService from '../../services/presenceService';
import './DetailsPanel.css';

const DetailsPanel = ({ onClose }) => {
  const { 
    activeConversation, 
    getConversationDisplayName,
    organizationUsers,
    deleteConversation,
    messages
  } = useChat();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('members');
  const [participantPresence, setParticipantPresence] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track presence for conversation participants
  useEffect(() => {
    if (!activeConversation?.participants) return;
    
    const presenceUnsubscribes = [];
    activeConversation.participants.forEach(participantId => {
      if (participantId !== userProfile?.id) {
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
      }
    });
    
    return () => {
      presenceUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [activeConversation?.participants, userProfile?.id]);

  // Get shared media from messages
  const getSharedMedia = () => {
    const media = {
      images: [],
      files: [],
      links: []
    };

    messages.forEach(message => {
      if (message.type === 'image') {
        media.images.push({
          id: message.id,
          url: message.fileUrl,
          sender: message.senderId,
          timestamp: message.timestamp
        });
      } else if (message.type === 'file') {
        media.files.push({
          id: message.id,
          url: message.fileUrl,
          name: message.fileName,
          size: message.fileSize,
          sender: message.senderId,
          timestamp: message.timestamp
        });
      }
      // Extract links from text messages
      if (message.text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.text.match(urlRegex);
        if (urls) {
          urls.forEach(url => {
            media.links.push({
              id: `${message.id}-${url}`,
              url: url,
              sender: message.senderId,
              timestamp: message.timestamp
            });
          });
        }
      }
    });

    return media;
  };

  const handleDeleteConversation = async () => {
    if (showDeleteConfirm) {
      try {
        await deleteConversation(activeConversation.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const sharedMedia = getSharedMedia();
  const participants = activeConversation?.participants || [];
  const isGroup = activeConversation?.type === 'group';

  return (
    <div className="details-panel">
      {/* Header */}
      <div className="details-panel__header">
        <h3>Details</h3>
        <button onClick={onClose} className="details-panel__close">
          <X size={20} />
        </button>
      </div>

      {/* Conversation Info */}
      <div className="details-panel__info">
        <UserAvatar 
          user={{ displayName: getConversationDisplayName(activeConversation) }}
          size="xlarge"
        />
        <h3>{getConversationDisplayName(activeConversation)}</h3>
        {isGroup && (
          <p>{participants.length} members</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="details-panel__actions">
        <button className="details-panel__action">
          <Bell size={18} />
          <span>Mute</span>
        </button>
        <button className="details-panel__action">
          <Search size={18} />
          <span>Search</span>
        </button>
        {isGroup && (
          <button className="details-panel__action">
            <UserPlus size={18} />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="details-panel__tabs">
        <button
          className={`details-panel__tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        <button
          className={`details-panel__tab ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          Media
        </button>
        <button
          className={`details-panel__tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button
          className={`details-panel__tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Links
        </button>
      </div>

      {/* Tab Content */}
      <div className="details-panel__content">
        {activeTab === 'members' && (
          <div className="details-panel__members">
            {participants.map(participantId => {
              const user = organizationUsers?.find(u => u.id === participantId);
              const isOnline = participantPresence[participantId]?.online;
              const isMe = participantId === userProfile?.id;
              
              return (
                <div key={participantId} className="details-panel__member">
                  <UserAvatar user={user} size="medium" />
                  <div className="details-panel__member-info">
                    <span className="details-panel__member-name">
                      {user?.firstName} {user?.lastName}
                      {isMe && ' (You)'}
                    </span>
                    <span className="details-panel__member-status">
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  {isOnline && <div className="details-panel__online-dot" />}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="details-panel__media-grid">
            {sharedMedia.images.length === 0 ? (
              <p className="details-panel__empty">No media shared yet</p>
            ) : (
              sharedMedia.images.map(image => (
                <div key={image.id} className="details-panel__media-item">
                  <img src={image.url} alt="Shared media" />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="details-panel__files">
            {sharedMedia.files.length === 0 ? (
              <p className="details-panel__empty">No files shared yet</p>
            ) : (
              sharedMedia.files.map(file => (
                <a
                  key={file.id}
                  href={file.url}
                  download={file.name}
                  className="details-panel__file"
                >
                  <File size={20} />
                  <div className="details-panel__file-info">
                    <span className="details-panel__file-name">{file.name}</span>
                    <span className="details-panel__file-size">{file.size}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="details-panel__links">
            {sharedMedia.links.length === 0 ? (
              <p className="details-panel__empty">No links shared yet</p>
            ) : (
              sharedMedia.links.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="details-panel__link"
                >
                  <Link2 size={16} />
                  <span>{link.url}</span>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="details-panel__danger">
        <button
          className={`details-panel__danger-btn ${showDeleteConfirm ? 'confirm' : ''}`}
          onClick={handleDeleteConversation}
        >
          <Trash2 size={18} />
          <span>{showDeleteConfirm ? 'Click again to confirm' : 'Delete Conversation'}</span>
        </button>
        {!isGroup && (
          <button className="details-panel__danger-btn">
            <Shield size={18} />
            <span>Block User</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DetailsPanel;