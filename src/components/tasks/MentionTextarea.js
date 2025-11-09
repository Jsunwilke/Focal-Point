// src/components/tasks/MentionTextarea.js
import React, { useState, useRef, useEffect } from 'react';
import { AtSign, User } from 'lucide-react';
import { useDataCache } from '../../contexts/DataCacheContext';
import './MentionTextarea.css';

const MentionTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled = false,
  className = ''
}) => {
  const { users } = useDataCache();
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter users based on search term
  const filteredUsers = users?.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const searchTerm = mentionSearch.toLowerCase();
    return fullName.includes(searchTerm) || user.email?.toLowerCase().includes(searchTerm);
  }).slice(0, 10) || []; // Limit to 10 results

  // Handle textarea change
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Detect @ character
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      // Check if @ is at start or after whitespace
      const charBeforeAt = lastAtSymbol === 0 ? ' ' : textBeforeCursor[lastAtSymbol - 1];
      const isValidMention = /\s/.test(charBeforeAt) || lastAtSymbol === 0;

      if (isValidMention) {
        const searchText = textBeforeCursor.substring(lastAtSymbol + 1);

        // Only show dropdown if there's no space after @ (still typing mention)
        if (!searchText.includes(' ')) {
          setMentionSearch(searchText);
          setMentionPosition(lastAtSymbol);
          setShowMentionDropdown(true);
          setSelectedIndex(0);
        } else {
          setShowMentionDropdown(false);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }

    onChange(newValue);
  };

  // Insert mention
  const insertMention = (user) => {
    if (!user || mentionPosition === null) return;

    const beforeMention = value.substring(0, mentionPosition);
    const afterMention = value.substring(textareaRef.current.selectionStart);
    const mentionText = `@${user.firstName} ${user.lastName}`;
    const newValue = beforeMention + mentionText + ' ' + afterMention;

    onChange(newValue);
    setShowMentionDropdown(false);
    setMentionSearch('');
    setMentionPosition(null);

    // Focus textarea and position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const cursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showMentionDropdown || filteredUsers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        if (showMentionDropdown) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentionDropdown(false);
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target)
      ) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (showMentionDropdown && dropdownRef.current) {
      const selectedItem = dropdownRef.current.querySelector('.mention-dropdown__item--selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showMentionDropdown]);

  return (
    <div className={`mention-textarea ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="mention-textarea__input"
      />

      {showMentionDropdown && filteredUsers.length > 0 && (
        <div ref={dropdownRef} className="mention-dropdown">
          <div className="mention-dropdown__header">
            <AtSign size={14} />
            <span>Mention someone</span>
          </div>
          <div className="mention-dropdown__list">
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                className={`mention-dropdown__item ${index === selectedIndex ? 'mention-dropdown__item--selected' : ''}`}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="mention-dropdown__item-avatar">
                  {user.profilePhoto ? (
                    <img src={user.profilePhoto} alt={user.firstName} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <div className="mention-dropdown__item-info">
                  <div className="mention-dropdown__item-name">
                    {user.firstName} {user.lastName}
                  </div>
                  {user.email && (
                    <div className="mention-dropdown__item-email">{user.email}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mention-dropdown__footer">
            <span className="mention-dropdown__hint">↑↓ to navigate • Enter to select • Esc to cancel</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
