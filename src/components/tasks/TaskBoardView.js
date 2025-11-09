// src/components/tasks/TaskBoardView.js
import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import { useTask } from '../../contexts/TaskContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import TaskBoardColumn from './TaskBoardColumn';
import './TaskBoardView.css';

const TaskBoardView = ({ tasks, onTaskClick, filterSettings }) => {
  const { updateTask } = useTask();
  const { users } = useDataCache();
  const isDraggingRef = useRef(false);

  const [tasksByStatus, setTasksByStatus] = useState({
    todo: [],
    in_progress: [],
    on_hold: [],
    completed: []
  });

  // Organize tasks by status and sort by order field
  useEffect(() => {
    // Skip re-organizing if we're currently dragging to prevent flashing
    if (isDraggingRef.current) {
      return;
    }

    const organized = {
      todo: [],
      in_progress: [],
      on_hold: [],
      completed: []
    };

    tasks.forEach(task => {
      const status = task.status || 'todo';
      if (organized[status]) {
        organized[status].push(task);
      }
    });

    // Sort each column by order field (or use fallback for tasks without order)
    Object.keys(organized).forEach(status => {
      organized[status].sort((a, b) => {
        const orderA = a.order ?? 999999;
        const orderB = b.order ?? 999999;
        return orderA - orderB;
      });
    });

    setTasksByStatus(organized);
  }, [tasks]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Set dragging flag to prevent re-sorting during update
    isDraggingRef.current = true;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    // Update local state optimistically
    const sourceTasks = Array.from(tasksByStatus[sourceStatus]);
    const destTasks = sourceStatus === destStatus ? sourceTasks : Array.from(tasksByStatus[destStatus]);

    // Remove from source
    const [movedTask] = sourceTasks.splice(source.index, 1);

    // Add to destination
    destTasks.splice(destination.index, 0, movedTask);

    // Update state optimistically
    const newTasksByStatus = {
      ...tasksByStatus,
      [sourceStatus]: sourceTasks,
      [destStatus]: destTasks
    };
    setTasksByStatus(newTasksByStatus);

    // Update task in database with new status and order
    try {
      // Calculate new order based on position in destination column
      const newOrder = destination.index;

      // Update the moved task's status and order
      await updateTask(draggableId, {
        status: destStatus,
        order: newOrder
      });

      // Update order for all other tasks in the destination column
      const updatePromises = [];
      destTasks.forEach((task, index) => {
        if (task.id !== draggableId && task.order !== index) {
          updatePromises.push(updateTask(task.id, { order: index }));
        }
      });

      // If source and destination are different, update source column order too
      if (sourceStatus !== destStatus) {
        sourceTasks.forEach((task, index) => {
          if (task.order !== index) {
            updatePromises.push(updateTask(task.id, { order: index }));
          }
        });
      }

      // Execute all order updates
      await Promise.all(updatePromises);

      // Clear dragging flag after a delay to allow Firebase to sync
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 500);

    } catch (error) {
      console.error('Error updating task order:', error);
      // Clear dragging flag on error
      isDraggingRef.current = false;
      // Revert on error
      setTasksByStatus(tasksByStatus);
    }
  };

  const statuses = ['todo', 'in_progress', 'on_hold', 'completed'];

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="task-board-view">
        {statuses.map(status => (
          <TaskBoardColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] || []}
            onTaskClick={onTaskClick}
            users={users}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

export default TaskBoardView;
