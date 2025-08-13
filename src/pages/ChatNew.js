import React, { useState, useEffect } from "react";
import { useChat } from "../contexts/ChatContext";
import { useFirebaseConnection } from "../hooks/useFirebaseConnection";
import ConversationPanel from "../components/chat/ConversationPanel";
import MessagePanel from "../components/chat/MessagePanel";
import DetailsPanel from "../components/chat/DetailsPanel";
import EmployeeSelector from "../components/chat/EmployeeSelector";
import { WifiOff, Menu, X, Sun, Moon } from "lucide-react";
import "./ChatNew.css";

const ChatNew = () => {
  const { activeConversation, setIsMainChatView } = useChat();
  const { isConnected } = useFirebaseConnection();
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [showConversationPanel, setShowConversationPanel] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('chat-theme') || 'light');
  
  // Set main chat view flag
  useEffect(() => {
    setIsMainChatView(true);
    return () => setIsMainChatView(false);
  }, [setIsMainChatView]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-chat-theme', theme);
    localStorage.setItem('chat-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  return (
    <div className="chat-new">
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="chat-new__connection-banner">
          <WifiOff size={16} />
          <span>No connection - Messages may not send</span>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="chat-new__container">
        {/* Mobile Menu Toggle */}
        <button 
          className="chat-new__mobile-toggle"
          onClick={() => setShowConversationPanel(!showConversationPanel)}
        >
          {showConversationPanel ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Theme Toggle */}
        <button 
          className="chat-new__theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Conversation Panel */}
        <div className={`chat-new__panel chat-new__panel--conversations ${showConversationPanel ? 'active' : ''}`}>
          <ConversationPanel 
            onNewConversation={handleNewConversation}
            onSelectConversation={() => {
              // Hide panel on mobile after selection
              if (window.innerWidth < 768) {
                setShowConversationPanel(false);
              }
            }}
          />
        </div>

        {/* Message Panel */}
        <div className="chat-new__panel chat-new__panel--messages">
          <MessagePanel 
            onToggleDetails={() => setShowDetailsPanel(!showDetailsPanel)}
            showDetails={showDetailsPanel}
          />
        </div>

        {/* Details Panel */}
        {activeConversation && (
          <div className={`chat-new__panel chat-new__panel--details ${showDetailsPanel ? 'active' : ''}`}>
            <DetailsPanel 
              onClose={() => setShowDetailsPanel(false)}
            />
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <EmployeeSelector
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
      />
    </div>
  );
};

export default ChatNew;