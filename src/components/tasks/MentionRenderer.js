// src/components/tasks/MentionRenderer.js
import React from 'react';
import './MentionRenderer.css';

const MentionRenderer = ({ text, mentions = [] }) => {
  // If no text, return null
  if (!text) return null;

  // If no mentions, just return the text
  if (!mentions || mentions.length === 0) {
    return <span className="mention-renderer__text">{text}</span>;
  }

  // Parse text and identify mentions
  const mentionPattern = /@([A-Z][a-z]+(?: [A-Z][a-z]+)+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
        key: `text-${lastIndex}`
      });
    }

    // Find corresponding mention data
    const mentionName = match[1];
    const mentionData = mentions.find(m =>
      m.userName === mentionName || `${m.userName}` === mentionName
    );

    // Add mention
    parts.push({
      type: 'mention',
      content: match[0],
      data: mentionData,
      key: `mention-${match.index}`
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
      key: `text-${lastIndex}`
    });
  }

  // If no mentions were found, return original text
  if (parts.length === 0) {
    return <span className="mention-renderer__text">{text}</span>;
  }

  // Render parts
  return (
    <span className="mention-renderer">
      {parts.map(part => {
        if (part.type === 'mention') {
          return (
            <span
              key={part.key}
              className="mention-renderer__mention"
              title={part.data?.userId ? `User ID: ${part.data.userId}` : undefined}
            >
              {part.content}
            </span>
          );
        }
        return <span key={part.key}>{part.content}</span>;
      })}
    </span>
  );
};

export default MentionRenderer;
