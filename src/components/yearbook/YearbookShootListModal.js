// src/components/yearbook/YearbookShootListModal.js
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy,
  Search,
  Download,
  Upload,
  Camera,
  StickyNote,
  Save,
  XCircle
} from 'lucide-react';
import { useYearbook } from '../../contexts/YearbookContext';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import CreateShootListModal from './CreateShootListModal';
import AddShootItemModal from './AddShootItemModal';
import '../shared/Modal.css';
import './YearbookShootListModal.css';

const YearbookShootListModal = ({ 
  isOpen, 
  onClose, 
  schoolId, 
  schoolName,
  initialYear = null,
  sessionContext = null // Optional: { sessionId, photographerId, photographerName, sessionDate }
}) => {
  const { userProfile } = useAuth();
  const { 
    getShootList, 
    updateShootItem,
    addShootItem, 
    getAvailableYears, 
    getCurrentSchoolYear,
    deleteShootList,
    canEdit,
    loading 
  } = useYearbook();

  const [selectedYear, setSelectedYear] = useState(initialYear || getCurrentSchoolYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [shootList, setShootList] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingNotes, setEditingNotes] = useState({});
  const [noteValues, setNoteValues] = useState({});

  // Load available years
  useEffect(() => {
    if (!isOpen || !schoolId) return;

    const loadYears = async () => {
      const years = await getAvailableYears(schoolId);
      setAvailableYears(years);
      
      // If no initial year and current year not available, select most recent
      if (!initialYear && !years.includes(getCurrentSchoolYear()) && years.length > 0) {
        setSelectedYear(years[0]);
      }
    };

    loadYears();
  }, [isOpen, schoolId, initialYear, getAvailableYears, getCurrentSchoolYear]);

  // Load shoot list for selected year
  useEffect(() => {
    if (!isOpen || !schoolId || !selectedYear) return;

    let mounted = true;

    const loadShootList = async () => {
      try {
        const list = await getShootList(schoolId, selectedYear);
        if (mounted) {
          setShootList(list);
          
          // Expand all categories by default
          if (list?.items) {
            const categories = [...new Set(list.items.map(item => item.category))];
            const expanded = {};
            categories.forEach(cat => { expanded[cat] = true; });
            setExpandedCategories(expanded);
          }
        }
      } catch (error) {
        console.error('Error loading shoot list:', error);
        if (mounted) {
          setShootList(null);
        }
      }
    };

    loadShootList();

    return () => { mounted = false; };
  }, [isOpen, schoolId, selectedYear, getShootList]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!shootList?.items || !searchTerm) return shootList?.items || [];
    
    const term = searchTerm.toLowerCase();
    return shootList.items.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  }, [shootList?.items, searchTerm]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped = {};
    (filteredItems || []).forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  }, [filteredItems]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!shootList?.items) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    
    const total = shootList.items.length;
    const completed = shootList.completedCount || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, percentage };
  }, [shootList]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleItemToggle = async (itemId, currentStatus) => {
    if (!canEdit) return;

    try {
      const updateData = {
        completed: !currentStatus,
        completedDate: !currentStatus ? new Date() : null,
        photographerId: !currentStatus ? userProfile.uid : null,
        photographerName: !currentStatus ? userProfile.displayName : null
      };

      // If we have session context and we're marking as complete, include it
      if (!currentStatus && sessionContext) {
        updateData.completedBySession = sessionContext.sessionId;
        if (sessionContext.photographerId) {
          updateData.photographerId = sessionContext.photographerId;
        }
        if (sessionContext.photographerName) {
          updateData.photographerName = sessionContext.photographerName;
        }
        if (sessionContext.sessionDate) {
          updateData.completedDate = new Date(sessionContext.sessionDate);
        }
      }

      await updateShootItem(schoolId, selectedYear, itemId, updateData);

      // Update local state optimistically
      setShootList(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                completed: !currentStatus,
                completedDate: !currentStatus ? new Date() : null,
                photographerId: !currentStatus ? userProfile.uid : null,
                photographerName: !currentStatus ? userProfile.displayName : null
              }
            : item
        ),
        completedCount: prev.completedCount + (!currentStatus ? 1 : -1)
      }));
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const isCurrentYear = selectedYear === getCurrentSchoolYear();
  const isReadOnly = !canEdit || !isCurrentYear;

  const handleNotesUpdate = async (itemId, notes) => {
    if (!canEdit) return;

    try {
      await updateShootItem(schoolId, selectedYear, itemId, {
        notes: notes || ''
      });

      // Update local state
      setShootList(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { ...item, notes: notes || '' }
            : item
        )
      }));

      // Close edit mode
      setEditingNotes(prev => ({ ...prev, [itemId]: false }));
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('Failed to update notes');
    }
  };

  const startEditingNotes = (itemId, currentNotes) => {
    setEditingNotes(prev => ({ ...prev, [itemId]: true }));
    setNoteValues(prev => ({ ...prev, [itemId]: currentNotes || '' }));
  };

  const cancelEditingNotes = (itemId) => {
    setEditingNotes(prev => ({ ...prev, [itemId]: false }));
    setNoteValues(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleAddItem = async (category, itemData) => {
    try {
      await addShootItem(schoolId, selectedYear, category, itemData);
      
      // Refresh the shoot list to show the new item
      const updatedList = await getShootList(schoolId, selectedYear, true);
      setShootList(updatedList);
      
      // Close the modal
      setShowAddItemModal(false);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const handleEditItem = async (category, itemData) => {
    try {
      // Update the item with new values
      await updateShootItem(schoolId, selectedYear, itemData.id, {
        name: itemData.name,
        description: itemData.description,
        category: category,
        required: itemData.required
      });
      
      // Update local state
      setShootList(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemData.id 
            ? { ...item, name: itemData.name, description: itemData.description, category, required: itemData.required }
            : item
        )
      }));
      
      // Close the modal
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const handleDelete = async () => {
    if (!shootList || isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await deleteShootList(schoolId, selectedYear, shootList.id);
      
      if (result.success) {
        setShowDeleteConfirm(false);
        // Refresh available years
        const years = await getAvailableYears(schoolId);
        setAvailableYears(years);
        
        // If we deleted the current selection, select another year or close
        if (years.length === 0) {
          onClose();
        } else {
          // Select the most recent year
          setSelectedYear(years[0]);
          setShootList(null);
        }
      } else {
        alert('Failed to delete shoot list: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting shoot list:', error);
      alert('Failed to delete shoot list');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div style={overlayStyles} onClick={onClose}>
      <div className="yearbook-modal" style={modalStyles} onClick={(e) => e.stopPropagation()}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.5rem', 
          borderBottom: '1px solid var(--border-color)' 
        }}>
          <div className="yearbook-modal-title">
            <h2>Yearbook Shoot List</h2>
            <span className="school-name">{schoolName}</span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="yearbook-controls">
          <div className="year-selector">
            <Calendar size={16} />
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="year-dropdown"
            >
              {availableYears.length === 0 && (
                <option value={selectedYear}>{selectedYear}</option>
              )}
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year} {year === getCurrentSchoolYear() && '(Current)'}
                </option>
              ))}
            </select>
          </div>

          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {canEdit && (
            <div className="action-buttons">
              {shootList && (
                <button 
                  className="btn btn-danger" 
                  title="Delete Shoot List"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} />
                </button>
              )}
              {isCurrentYear && (
                <button className="btn btn-secondary" title="Import CSV">
                  <Upload size={16} />
                </button>
              )}
              <button className="btn btn-secondary" title="Export List">
                <Download size={16} />
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddItemModal(true)}
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>
          )}
        </div>

        <div className="yearbook-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Items</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.percentage}%</span>
            <span className="stat-label">Progress</span>
          </div>
        </div>

        <div className="yearbook-progress-bar">
          <div 
            className="yearbook-progress-fill" 
            style={{ width: `${stats.percentage}%` }}
          />
        </div>

        <div className="yearbook-content" style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {loading[`${schoolId}_${selectedYear}`] ? (
            <LoadingSpinner />
          ) : !shootList ? (
            <div className="empty-state">
              <Camera size={48} />
              <h3>No Yearbook List Found</h3>
              <p>No yearbook shoot list exists for {selectedYear}</p>
              {canEdit && isCurrentYear && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Shoot List
                </button>
              )}
            </div>
          ) : Object.keys(itemsByCategory).length === 0 ? (
            <div className="empty-state">
              <p>No items found{searchTerm ? ' matching your search' : ''}</p>
            </div>
          ) : (
            <div className="categories-list">
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} className="category-section">
                  <div 
                    className="category-header"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="category-title">
                      {expandedCategories[category] ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                      <h3>{category}</h3>
                      <span className="category-count">
                        {items.filter(i => i.completed).length}/{items.length}
                      </span>
                    </div>
                  </div>

                  {expandedCategories[category] && (
                    <div className="category-items">
                      {items.map(item => (
                        <div 
                          key={item.id} 
                          className={`shoot-item ${item.completed ? 'completed' : ''} ${item.required ? 'required' : ''}`}
                        >
                          <div className="item-checkbox">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleItemToggle(item.id, item.completed)}
                              disabled={isReadOnly}
                              id={`item-${item.id}`}
                            />
                            <label htmlFor={`item-${item.id}`}>
                              {item.completed && <Check size={16} />}
                            </label>
                          </div>

                          <div className="item-content">
                            <div className="item-name">
                              {item.name}
                              {item.required && <span className="required-badge">Required</span>}
                            </div>
                            {item.description && (
                              <div className="item-description">{item.description}</div>
                            )}
                            {item.completed && item.completedDate && (
                              <div className="item-meta">
                                Completed by {item.photographerName} on {
                                  // Handle Firebase Timestamp objects
                                  item.completedDate.toDate 
                                    ? item.completedDate.toDate().toLocaleDateString()
                                    : new Date(item.completedDate).toLocaleDateString()
                                }
                                {item.imageNumbers && item.imageNumbers.length > 0 && (
                                  <span> • Images: {item.imageNumbers.join(', ')}</span>
                                )}
                              </div>
                            )}
                            
                            {/* Notes section */}
                            <div className="item-notes-section">
                              {editingNotes[item.id] ? (
                                <div className="notes-editor">
                                  <textarea
                                    value={noteValues[item.id] || ''}
                                    onChange={(e) => setNoteValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder="Add notes..."
                                    className="notes-input"
                                    rows={3}
                                    maxLength={500}
                                  />
                                  <div className="notes-actions">
                                    <span className="char-count">{(noteValues[item.id] || '').length}/500</span>
                                    <button 
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => cancelEditingNotes(item.id)}
                                    >
                                      <XCircle size={14} />
                                      Cancel
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleNotesUpdate(item.id, noteValues[item.id])}
                                    >
                                      <Save size={14} />
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {item.notes ? (
                                    <div className="item-notes" onClick={() => canEdit && isCurrentYear && startEditingNotes(item.id, item.notes)}>
                                      <StickyNote size={14} />
                                      <span>{item.notes}</span>
                                    </div>
                                  ) : (
                                    canEdit && isCurrentYear && (
                                      <button 
                                        className="add-notes-btn"
                                        onClick={() => startEditingNotes(item.id, '')}
                                      >
                                        <StickyNote size={14} />
                                        Add notes
                                      </button>
                                    )
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {canEdit && isCurrentYear && (
                            <div className="item-actions">
                              <button 
                                className="btn-icon"
                                onClick={() => setEditingItem(item)}
                                title="Edit item"
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isCurrentYear && (
          <div className="yearbook-footer">
            <div className="read-only-notice">
              <span>Viewing historical data - Changes not allowed</span>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="confirmation-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Shoot List?</h3>
            <p>
              Are you sure you want to delete the {selectedYear} yearbook shoot list for {schoolName}? 
              This action cannot be undone.
            </p>
            <div className="confirmation-buttons">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateShootListModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          schoolId={schoolId}
          schoolName={schoolName}
          schoolYear={selectedYear}
          onSuccess={() => {
            setShowCreateModal(false);
            // Reload the shoot list
            getShootList(schoolId, selectedYear, true);
          }}
        />
      )}

      {showAddItemModal && shootList && (
        <AddShootItemModal
          isOpen={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          categories={[...new Set(shootList.items.map(item => item.category))].sort()}
          onSave={handleAddItem}
        />
      )}
      {editingItem && shootList && (
        <AddShootItemModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          categories={[...new Set(shootList.items.map(item => item.category))].sort()}
          onSave={handleEditItem}
          editItem={editingItem}
        />
      )}
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
  zIndex: 9999, // Lower z-index for parent modal
  pointerEvents: 'auto', // Ensure click events work
};

const modalStyles = {
  position: 'relative',
  width: '90%',
  maxWidth: '900px',
  maxHeight: '90vh',
  backgroundColor: 'var(--background)',
  borderRadius: '12px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  transform: 'none',
};

export default YearbookShootListModal;