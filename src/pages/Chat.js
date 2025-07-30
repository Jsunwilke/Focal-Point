import React, { useState } from "react";
import { useChat } from "../contexts/ChatContext";
import { useFirebaseConnection } from "../hooks/useFirebaseConnection";
import ConversationList from "../components/chat/ConversationList";
import MessageThread from "../components/chat/MessageThread";
import MessageInput from "../components/chat/MessageInput";
import EmployeeSelector from "../components/chat/EmployeeSelector";
import { WifiOff } from "lucide-react";
import "./Chat.css";

const Chat = () => {
  const { activeConversation, setIsMainChatView } = useChat();
  const { isConnected } = useFirebaseConnection();
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  
  // Set main chat view flag
  React.useEffect(() => {
    setIsMainChatView(true);
    return () => setIsMainChatView(false);
  }, [setIsMainChatView]);

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  return (
    <div className="chat-page">
      {!isConnected && (
        <div style={{
          position: 'fixed',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <WifiOff size={16} />
          <span>No connection - Messages may not send</span>
        </div>
      )}
      <div className="chat-container">
        <div className="chat-sidebar">
          <div className="chat-sidebar__header">
            <h2>Conversations</h2>
            <button 
              className="chat-sidebar__new-btn"
              onClick={handleNewConversation}
            >
              New Chat
            </button>
          </div>
          <div className="chat-sidebar__list">
            <ConversationList onNewConversation={handleNewConversation} />
          </div>
        </div>
        
        <div className="chat-main">
          {activeConversation ? (
            <div className="chat-main__conversation">
              <MessageThread />
              <MessageInput />
            </div>
          ) : (
            <div className="chat-main__empty">
              <div className="chat-main__empty-content">
                <h3>Welcome to Chat</h3>
                <p>Select a conversation or start a new one to begin messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <EmployeeSelector
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
      />
    </div>
  );
};

export default Chat;