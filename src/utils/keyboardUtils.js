// src/utils/keyboardUtils.js

/**
 * Detects if an element is an input field where typing should not trigger shortcuts
 */
export const isInputElement = (element) => {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  const isEditable = element.isContentEditable;
  const isInput = ['input', 'textarea', 'select'].includes(tagName);
  return isInput || isEditable;
};

/**
 * Gets a normalized key combination string from a keyboard event
 * Examples: "ctrl+k", "escape", "/"
 */
export const getKeyCombo = (event) => {
  const key = event.key.toLowerCase();
  const parts = [];

  // Add modifiers (in consistent order)
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');

  // Add the main key
  parts.push(key);

  return parts.join('+');
};

/**
 * Checks if a keyboard event matches a shortcut pattern
 */
export const matchesShortcut = (event, pattern) => {
  const combo = getKeyCombo(event);
  return combo === pattern.toLowerCase();
};

/**
 * Prevents default behavior for keyboard shortcuts
 */
export const preventDefaultForShortcut = (event, shouldPreventDefault = true) => {
  if (shouldPreventDefault) {
    event.preventDefault();
    event.stopPropagation();
  }
};

/**
 * Common keyboard shortcuts
 */
export const SHORTCUTS = {
  // Global
  OPEN_NEW_TASK: 'ctrl+k',
  TOGGLE_TASK_PANEL: 'ctrl+/',
  SEARCH: '/',
  HELP: '?',

  // Navigation
  ESCAPE: 'escape',
  ENTER: 'enter',
  ARROW_UP: 'arrowup',
  ARROW_DOWN: 'arrowdown',
  ARROW_LEFT: 'arrowleft',
  ARROW_RIGHT: 'arrowright',

  // Actions
  SAVE: 'ctrl+s',
  SAVE_SUBMIT: 'ctrl+enter',
  DELETE: 'delete',
  SPACE: ' ',

  // Numbers for filter tabs
  TAB_1: '1',
  TAB_2: '2',
  TAB_3: '3',
  TAB_4: '4'
};

/**
 * Format shortcut for display
 * Example: "ctrl+k" => "⌘K" (Mac) or "Ctrl+K" (Windows)
 */
export const formatShortcutForDisplay = (shortcut) => {
  const isMac = navigator.platform.toLowerCase().includes('mac');

  const parts = shortcut.split('+').map(part => {
    switch (part.toLowerCase()) {
      case 'ctrl':
        return isMac ? '⌘' : 'Ctrl';
      case 'alt':
        return isMac ? '⌥' : 'Alt';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'enter':
        return '↵';
      case 'escape':
        return 'Esc';
      case 'arrowup':
        return '↑';
      case 'arrowdown':
        return '↓';
      case 'arrowleft':
        return '←';
      case 'arrowright':
        return '→';
      case ' ':
        return 'Space';
      default:
        return part.toUpperCase();
    }
  });

  return parts.join(isMac ? '' : '+');
};
