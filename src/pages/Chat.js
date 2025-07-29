import React, { useState } from "react";
import { useChat } from "../contexts/ChatContext";
import ConversationList from "../components/chat/ConversationList";
import MessageThread from "../components/chat/MessageThread";
import MessageInput from "../components/chat/MessageInput";
import EmployeeSelector from "../components/chat/EmployeeSelector";
import "./Chat.css";

const Chat = () => {
  const { activeConversation } = useChat();
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  return (
    <div className="chat-page">
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