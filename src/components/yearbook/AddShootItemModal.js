// src/components/yearbook/AddShootItemModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus } from 'lucide-react';
import '../shared/Modal.css';
import './AddShootItemModal.css';

const AddShootItemModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  categories = [],
  editItem = null // If provided, we're in edit mode
}) => {
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        // Edit mode - populate with existing values
        setCategory(editItem.category || '');
        setNewCategory('');
        setIsNewCategory(false);
        setItemName(editItem.name || '');
        setItemDescription(editItem.description || '');
        setIsRequired(editItem.required || false);
      } else {
        // Add mode - reset to defaults
        setCategory(categories.length > 0 ? categories[0] : '');
        setNewCategory('');
        setIsNewCategory(categories.length === 0);
        setItemName('');
        setItemDescription('');
        setIsRequired(false);
      }
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, categories, editItem]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const finalCategory = isNewCategory ? newCategory.trim() : category;
    const name = itemName.trim();
    
    if (!finalCategory) {
      setError('Please select or enter a category');
      return;
    }
    
    if (!name) {
      setError('Please enter an item name');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const itemData = {
        name,
        description: itemDescription.trim(),
        required: isRequired
      };
      
      if (editItem) {
        // Include item ID for edit mode
        itemData.id = editItem.id;
      }
      
      await onSave(finalCategory, itemData);
      
      onClose();
    } catch (err) {
      setError(err.message || `Failed to ${editItem ? 'update' : 'add'} item`);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" style={overlayStyles} onClick={onClose}>
      <div className="modal-container add-item-modal" style={modalStyles} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editItem ? 'Edit Item' : 'Add New Item'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-item-form">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            {categories.length > 0 && !editItem && (
              <div className="category-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    checked={!isNewCategory}
                    onChange={() => setIsNewCategory(false)}
                  />
                  <span>Existing Category</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    checked={isNewCategory}
                    onChange={() => setIsNewCategory(true)}
                  />
                  <span>New Category</span>
                </label>
              </div>
            )}
            
            {isNewCategory ? (
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter new category name"
                className="form-input"
                autoFocus
              />
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-select"
                disabled={categories.length === 0}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="itemName">Item Name *</label>
            <input
              id="itemName"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Team Photo"
              className="form-input"
              autoFocus={!isNewCategory}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="itemDescription">Description (Optional)</label>
            <textarea
              id="itemDescription"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Add any helpful details..."
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              <span>Required Item</span>
            </label>
            <p className="form-help">Mark this if the item must be completed</p>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving}
            >
              {editItem ? (
                isSaving ? 'Updating...' : 'Update Item'
              ) : (
                <>
                  <Plus size={16} />
                  {isSaving ? 'Adding...' : 'Add Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

// Inline styles for modal positioning
const overlayStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999, // Very high z-index to ensure it's on top
};

const modalStyles = {
  position: 'relative',
  width: '90%',
  maxWidth: '500px',
  maxHeight: '90vh',
  backgroundColor: 'var(--background)',
  borderRadius: '12px',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  transform: 'none',
};

export default AddShootItemModal;