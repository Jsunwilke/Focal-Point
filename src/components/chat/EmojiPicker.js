import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import './EmojiPicker.css';

const EMOJI_CATEGORIES = {
  smileys: {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '😵', '🤯', '😎', '🤓', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '😦', '😧', '😨', '😰', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿']
  },
  hearts: {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥', '❤️‍🩹', '💟']
  },
  hands: {
    name: 'Hands',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
  },
  symbols: {
    name: 'Symbols',
    emojis: ['✅', '❌', '❓', '❗', '❕', '❔', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '💯', '✨', '💫', '🔥', '💥', '💢', '💦', '💨', '💬', '💭', '🗯️']
  },
  objects: {
    name: 'Objects',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🎯', '🎮', '🎲', '🎰', '🎸', '🎵', '🎶', '🎤', '🎧', '📱', '💻', '⌚', '📷', '📹', '🔍', '🔎', '💡', '🔦', '📚', '📖', '✏️', '✒️', '📝', '📄', '📧', '📨', '📬', '📭', '📮']
  }
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'];

export const EmojiPicker = ({ onSelect, isReaction = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('smileys');

  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    if (!isReaction) {
      setIsOpen(false);
    }
  };

  if (isReaction) {
    return (
      <div className="emoji-reactions">
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            className="emoji-reaction-btn"
            onClick={() => handleEmojiClick(emoji)}
            title="React with emoji"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="emoji-picker-container">
      <button
        className="emoji-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <Smile size={20} />
      </button>

      {isOpen && (
        <div className="emoji-picker-dropdown">
          <div className="emoji-picker-header">
            {Object.keys(EMOJI_CATEGORIES).map(category => (
              <button
                key={category}
                className={`emoji-category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {EMOJI_CATEGORIES[category].name}
              </button>
            ))}
          </div>
          
          <div className="emoji-picker-body">
            <div className="emoji-grid">
              {EMOJI_CATEGORIES[selectedCategory].emojis.map(emoji => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleEmojiClick(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MessageReactions = ({ reactions = {}, messageId, onReact, currentUserId }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleReaction = (emoji) => {
    onReact(messageId, emoji);
    setShowPicker(false);
  };

  const getReactionCount = (emoji) => {
    return reactions[emoji]?.length || 0;
  };

  const hasUserReacted = (emoji) => {
    return reactions[emoji]?.includes(currentUserId);
  };

  return (
    <div className="message-reactions-container">
      {Object.keys(reactions).length > 0 && (
        <div className="message-reactions">
          {Object.keys(reactions).map(emoji => (
            <button
              key={emoji}
              className={`reaction-badge ${hasUserReacted(emoji) ? 'active' : ''}`}
              onClick={() => handleReaction(emoji)}
              title={`${reactions[emoji].length} reaction(s)`}
            >
              {emoji} {getReactionCount(emoji)}
            </button>
          ))}
        </div>
      )}
      
      <button
        className="add-reaction-btn"
        onClick={() => setShowPicker(!showPicker)}
        title="Add reaction"
      >
        <Smile size={14} />
      </button>

      {showPicker && (
        <div className="reaction-picker">
          <EmojiPicker onSelect={handleReaction} isReaction={true} />
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;