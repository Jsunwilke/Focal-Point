// src/components/yearbook/CreateShootListModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useYearbook } from '../../contexts/YearbookContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import '../shared/Modal.css';
import './CreateShootListModal.css';

const DEFAULT_CATEGORIES = {
  elementary: [
    {
      name: 'Administration & Staff',
      items: [
        { name: 'Principal Portrait', description: 'Formal portrait of principal', required: true },
        { name: 'Assistant Principal', description: 'Formal portrait', required: false },
        { name: 'Office Staff Group', description: 'Group photo of office staff', required: true },
        { name: 'Teachers by Grade', description: 'Individual teacher portraits by grade level', required: true },
        { name: 'Support Staff', description: 'Librarian, counselor, nurse, etc.', required: true },
      ]
    },
    {
      name: 'Student Life',
      items: [
        { name: 'Classroom Candids', description: 'Students engaged in learning', required: true },
        { name: 'Recess Activities', description: 'Playground and outdoor activities', required: false },
        { name: 'Cafeteria', description: 'Lunchtime candids', required: false },
        { name: 'Library Time', description: 'Students reading and studying', required: false },
        { name: 'Art & Music Classes', description: 'Special subjects in action', required: true },
      ]
    },
    {
      name: 'Events & Activities',
      items: [
        { name: 'School Assemblies', description: 'All-school gatherings', required: true },
        { name: 'Field Day', description: 'Sports and games activities', required: true },
        { name: 'Science Fair', description: 'Student projects and presentations', required: false },
        { name: 'Holiday Celebrations', description: 'Seasonal events and parties', required: false },
      ]
    }
  ],
  highSchool: [
    {
      name: 'Administration & Staff',
      items: [
        { name: 'Principal Portrait', description: 'Formal portrait', required: true },
        { name: 'Assistant Principals', description: 'Individual portraits', required: true },
        { name: 'Department Heads', description: 'Academic department leaders', required: true },
        { name: 'Faculty by Department', description: 'Group photos by subject', required: true },
        { name: 'Support Staff', description: 'Counselors, admin, maintenance', required: true },
      ]
    },
    {
      name: 'Student Organizations',
      items: [
        { name: 'Student Council', description: 'Student government group photo', required: true },
        { name: 'National Honor Society', description: 'NHS members group photo', required: true },
        { name: 'Academic Clubs', description: 'Math, Science, Debate, etc.', required: false },
        { name: 'Service Clubs', description: 'Key Club, Interact, etc.', required: false },
      ]
    },
    {
      name: 'Athletics',
      items: [
        { name: 'Fall Sports Teams', description: 'Team photos for all fall sports', required: true },
        { name: 'Winter Sports Teams', description: 'Team photos for all winter sports', required: true },
        { name: 'Spring Sports Teams', description: 'Team photos for all spring sports', required: true },
        { name: 'Athletic Action Shots', description: 'Games and practices', required: false },
      ]
    },
    {
      name: 'Arts & Activities',
      items: [
        { name: 'Band/Orchestra', description: 'Music groups and performances', required: true },
        { name: 'Choir', description: 'Vocal groups and concerts', required: true },
        { name: 'Theatre/Drama', description: 'Cast photos and performances', required: true },
        { name: 'Art Classes', description: 'Students creating artwork', required: false },
      ]
    }
  ]
};

const CreateShootListModal = ({ 
  isOpen, 
  onClose, 
  schoolId, 
  schoolName,
  schoolYear,
  onSuccess 
}) => {
  const { createShootList } = useYearbook();
  const [selectedTemplate, setSelectedTemplate] = useState('elementary');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.elementary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTemplateChange = (template) => {
    setSelectedTemplate(template);
    setCategories(DEFAULT_CATEGORIES[template] || []);
  };

  const handleAddCategory = () => {
    setCategories([...categories, { name: 'New Category', items: [] }]);
  };

  const handleRemoveCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleCategoryNameChange = (index, name) => {
    const updated = [...categories];
    updated[index].name = name;
    setCategories(updated);
  };

  const handleAddItem = (categoryIndex) => {
    const updated = [...categories];
    updated[categoryIndex].items.push({
      name: 'New Item',
      description: '',
      required: false
    });
    setCategories(updated);
  };

  const handleRemoveItem = (categoryIndex, itemIndex) => {
    const updated = [...categories];
    updated[categoryIndex].items = updated[categoryIndex].items.filter((_, i) => i !== itemIndex);
    setCategories(updated);
  };

  const handleItemChange = (categoryIndex, itemIndex, field, value) => {
    const updated = [...categories];
    updated[categoryIndex].items[itemIndex][field] = value;
    setCategories(updated);
  };

  const handleSubmit = async () => {
    if (categories.length === 0) {
      setError('Please add at least one category');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Flatten categories and items into a single array
      const items = [];
      categories.forEach(category => {
        category.items.forEach(item => {
          items.push({
            category: category.name,
            name: item.name,
            description: item.description,
            required: item.required
          });
        });
      });

      const result = await createShootList(schoolId, schoolName, schoolYear, items);
      
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to create shoot list');
      }
    } catch (err) {
      setError('Failed to create shoot list');
      console.error('Error creating shoot list:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" style={overlayStyles} onClick={onClose}>
      <div className="modal-container create-shootlist-modal" style={modalStyles} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Yearbook Shoot List</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="template-selector">
            <label>Start with a template:</label>
            <select 
              value={selectedTemplate} 
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              <option value="elementary">Elementary School</option>
              <option value="highSchool">High School</option>
              <option value="blank">Blank Template</option>
            </select>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="categories-editor">
            {categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="category-editor">
                <div className="category-header-edit">
                  <GripVertical size={16} className="drag-handle" />
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => handleCategoryNameChange(categoryIndex, e.target.value)}
                    className="category-name-input"
                    placeholder="Category Name"
                  />
                  <button 
                    className="btn-icon"
                    onClick={() => handleRemoveCategory(categoryIndex)}
                    title="Remove category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="items-list">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="item-editor">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(categoryIndex, itemIndex, 'name', e.target.value)}
                        className="item-name-input"
                        placeholder="Item name"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(categoryIndex, itemIndex, 'description', e.target.value)}
                        className="item-description-input"
                        placeholder="Description (optional)"
                      />
                      <label className="required-checkbox">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) => handleItemChange(categoryIndex, itemIndex, 'required', e.target.checked)}
                        />
                        Required
                      </label>
                      <button 
                        className="btn-icon"
                        onClick={() => handleRemoveItem(categoryIndex, itemIndex)}
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    className="add-item-btn"
                    onClick={() => handleAddItem(categoryIndex)}
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>
              </div>
            ))}

            <button 
              className="add-category-btn"
              onClick={handleAddCategory}
            >
              <Plus size={16} />
              Add Category
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="small" /> : 'Create Shoot List'}
          </button>
        </div>
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
  zIndex: 10001,
};

const modalStyles = {
  position: 'relative',
  width: '90%',
  maxWidth: '800px',
  maxHeight: '90vh',
  backgroundColor: 'var(--background)',
  borderRadius: '12px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  transform: 'none',
};

export default CreateShootListModal;