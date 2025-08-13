import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  onSearch,
  onNewConversation,
  onToggleSidebar,
  onEscape,
  onNavigateUp,
  onNavigateDown
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for modifier keys
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      
      // Cmd/Ctrl + K - Search
      if (isCtrlOrCmd && e.key === 'k') {
        e.preventDefault();
        onSearch?.();
        return;
      }
      
      // Cmd/Ctrl + N - New conversation
      if (isCtrlOrCmd && e.key === 'n') {
        e.preventDefault();
        onNewConversation?.();
        return;
      }
      
      // Cmd/Ctrl + \ - Toggle sidebar
      if (isCtrlOrCmd && e.key === '\\') {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }
      
      // Escape - Close modals
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      
      // Arrow keys for navigation (when not in input)
      const activeElement = document.activeElement;
      const isInInput = activeElement.tagName === 'INPUT' || 
                       activeElement.tagName === 'TEXTAREA' ||
                       activeElement.contentEditable === 'true';
      
      if (!isInInput) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onNavigateUp?.();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onNavigateDown?.();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearch, onNewConversation, onToggleSidebar, onEscape, onNavigateUp, onNavigateDown]);
};

export default useKeyboardShortcuts;