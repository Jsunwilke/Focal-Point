// src/components/tasks/TaskPanelTrigger.js
import React from 'react';
import { ListTodo } from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';

const TaskPanelTrigger = () => {
  const { togglePanel, getPanelTasks } = useTask();

  const panelTasks = getPanelTasks();

  // Count urgent/overdue tasks for badge
  const urgentCount = panelTasks.filter(task => {
    const isOverdue = task.dueDate && task.dueDate.toDate
      ? task.dueDate.toDate() < new Date()
      : false;
    const isUrgent = task.priority === 'urgent' || task.priority === 'high';
    return isOverdue || isUrgent;
  }).length;

  return (
    <button
      className="header__task-trigger"
      onClick={togglePanel}
      aria-label="Toggle tasks panel"
      title="Tasks"
    >
      <ListTodo size={20} />
      {urgentCount > 0 && (
        <span className="header__task-badge">{urgentCount > 9 ? '9+' : urgentCount}</span>
      )}
    </button>
  );
};

export default TaskPanelTrigger;
