// src/hooks/useKeyboardShortcuts.js
import { useEffect, useCallback } from 'react';
import { getKeyCombo, isInputElement, preventDefaultForShortcut } from '../utils/keyboardUtils';

/**
 * Custom hook for managing keyboard shortcuts
 *
 * @param {Object} shortcuts - Map of key combinations to handler functions
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether shortcuts are enabled (default: true)
 * @param {boolean} options.preventDefault - Whether to prevent default behavior (default: true)
 * @param {boolean} options.enableInInputs - Allow shortcuts even when focused on inputs (default: false)
 * @param {Array<string>} options.allowInInputs - Specific shortcuts allowed in inputs (e.g., ['escape'])
 *
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+k': () => openNewTask(),
 *   'escape': () => closeModal(),
 *   '/': () => focusSearch()
 * }, {
 *   enabled: true,
 *   preventDefault: true,
 *   allowInInputs: ['escape']
 * });
 */
const useKeyboardShortcuts = (shortcuts, options = {}) => {
  const {
    enabled = true,
    preventDefault = true,
    enableInInputs = false,
    allowInInputs = []
  } = options;

  const handleKeyDown = useCallback((event) => {
    // Skip if shortcuts are disabled
    if (!enabled) return;

    // Get the key combination
    const keyCombo = getKeyCombo(event);

    // Check if we're in an input element
    const inInputElement = isInputElement(event.target);

    // If in input and not explicitly allowed, skip
    if (inInputElement && !enableInInputs && !allowInInputs.includes(keyCombo)) {
      return;
    }

    // Find matching shortcut
    const handler = shortcuts[keyCombo];

    if (handler) {
      // Prevent default if configured
      if (preventDefault) {
        preventDefaultForShortcut(event, true);
      }

      // Execute handler
      handler(event);
    }
  }, [shortcuts, enabled, preventDefault, enableInInputs, allowInInputs]);

  useEffect(() => {
    if (!enabled) return;

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

export default useKeyboardShortcuts;
