// src/pages/Workflow2.js
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Plus, Clock, AlertCircle, CheckCircle, User, Calendar, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import workflow2Service from '../services/workflow2Service';
import './Workflow2.css';

const Workflow2 = () => {
  const { user, organization } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemStage, setNewItemStage] = useState(null);

  // Fetch workflows on component mount
  useEffect(() => {
    if (user && organization) {
      fetchWorkflows();
    }
  }, [user, organization]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      // Use the service instead of API call
      const data = await workflow2Service.getWorkflows(user.uid, organization.id);
      
      if (data && data.length > 0) {
        setWorkflows(data);
        // Select default workflow or first one
        const defaultWorkflow = data.find(w => w.isDefault) || data[0];
        setSelectedWorkflow(defaultWorkflow);
        setError(null);
      } else {
        setError('No workflows found');
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // If dropped in same position, do nothing
    if (source.droppableId === destination.droppableId && 
        source.index === destination.index) {
      return;
    }

    // Update local state optimistically
    const newWorkflow = { ...selectedWorkflow };
    const sourceStage = newWorkflow.stages.find(s => s.id === source.droppableId);
    const destStage = newWorkflow.stages.find(s => s.id === destination.droppableId);
    
    // Find and move the item
    const itemIndex = newWorkflow.items.findIndex(item => item.id === draggableId);
    if (itemIndex !== -1) {
      newWorkflow.items[itemIndex].stageId = destination.droppableId;
      newWorkflow.items[itemIndex].stage = destStage;
      setSelectedWorkflow(newWorkflow);
    }

    // Update using service
    try {
      await workflow2Service.moveItem(
        draggableId,
        destination.droppableId,
        selectedWorkflow.id
      );
    } catch (err) {
      console.error('Error moving item:', err);
      // Revert on error
      fetchWorkflows();
    }
  };

  const createNewItem = async (title, description) => {
    if (!title || !newItemStage) return;

    try {
      const newItem = await workflow2Service.createItem(
        selectedWorkflow.id,
        newItemStage,
        {
          title,
          description,
          type: 'task',
          assignedTo: user.uid,
          createdBy: user.uid,
        }
      );

      // Add to local state
      const newWorkflow = { ...selectedWorkflow };
      newWorkflow.items.push(newItem);
      setSelectedWorkflow(newWorkflow);
      setShowAddItem(false);
      setNewItemStage(null);
    } catch (err) {
      console.error('Error creating item:', err);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getItemsForStage = (stageId) => {
    if (!selectedWorkflow) return [];
    return selectedWorkflow.items.filter(item => item.stageId === stageId);
  };

  if (loading) {
    return (
      <div className="workflow2-loading">
        <div className="spinner"></div>
        <p>Loading workflows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workflow2-error">
        <AlertCircle size={48} />
        <h3>Error Loading Workflows</h3>
        <p>{error}</p>
        <button onClick={fetchWorkflows}>Retry</button>
      </div>
    );
  }

  if (!selectedWorkflow) {
    return (
      <div className="workflow2-empty">
        <h2>No Workflows Found</h2>
        <p>Create your first workflow to get started.</p>
      </div>
    );
  }

  return (
    <div className="workflow2-container">
      <div className="workflow2-header">
        <div className="workflow2-title">
          <h1>Workflow (PostgreSQL)</h1>
          <span className="workflow-name">{selectedWorkflow.name}</span>
        </div>
        
        <div className="workflow2-actions">
          {workflows.length > 1 && (
            <select 
              value={selectedWorkflow.id}
              onChange={(e) => {
                const workflow = workflows.find(w => w.id === e.target.value);
                setSelectedWorkflow(workflow);
              }}
              className="workflow-selector"
            >
              {workflows.map(workflow => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          )}
          
          <div className="workflow-stats">
            <span className="stat">
              <Hash size={16} />
              {selectedWorkflow.items.length} items
            </span>
            <span className="stat">
              <User size={16} />
              My tasks
            </span>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="workflow2-board">
          {selectedWorkflow.stages.map((stage) => (
            <div key={stage.id} className="workflow2-column">
              <div 
                className="column-header"
                style={{ borderTopColor: stage.color || '#6b7280' }}
              >
                <div className="column-title">
                  <span className="column-name">{stage.name}</span>
                  <span className="column-count">{getItemsForStage(stage.id).length}</span>
                </div>
                <button
                  className="add-item-btn"
                  onClick={() => {
                    setNewItemStage(stage.id);
                    setShowAddItem(true);
                  }}
                  title="Add item"
                >
                  <Plus size={16} />
                </button>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`column-content ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {getItemsForStage(stage.id).map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`workflow-item ${snapshot.isDragging ? 'dragging' : ''}`}
                          >
                            <div className="item-header">
                              <span className="item-type">{item.type}</span>
                              {item.priority && (
                                <span 
                                  className="item-priority"
                                  style={{ backgroundColor: getPriorityColor(item.priority) }}
                                >
                                  {item.priority}
                                </span>
                              )}
                            </div>
                            
                            <h4 className="item-title">{item.title}</h4>
                            
                            {item.description && (
                              <p className="item-description">{item.description}</p>
                            )}
                            
                            <div className="item-metadata">
                              {item.dueDate && (
                                <span className="metadata-item">
                                  <Calendar size={12} />
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              {item.assignedTo && (
                                <span className="metadata-item">
                                  <User size={12} />
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="add-item-modal" onClick={e => e.stopPropagation()}>
            <h3>Add New Item</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                createNewItem(formData.get('title'), formData.get('description'));
              }}
            >
              <input
                type="text"
                name="title"
                placeholder="Item title"
                required
                autoFocus
              />
              <textarea
                name="description"
                placeholder="Description (optional)"
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddItem(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflow2;