// src/components/workflow/overview/WorkflowStats.js
import React from 'react';
import { 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  TrendingUp
} from 'lucide-react';

const WorkflowStats = ({ workflows }) => {
  // Calculate statistics
  const stats = workflows.reduce((acc, workflow) => {
    // Status counts
    acc[workflow.status] = (acc[workflow.status] || 0) + 1;
    
    // Calculate overdue tasks
    Object.values(workflow.stepProgress).forEach(step => {
      if (step.status === 'overdue') {
        acc.overdueTasks++;
      }
      if (step.status === 'in_progress') {
        acc.inProgressTasks++;
      }
    });
    
    return acc;
  }, {
    active: 0,
    completed: 0,
    on_hold: 0,
    cancelled: 0,
    overdueTasks: 0,
    inProgressTasks: 0
  });

  // Calculate completion rate
  const totalWorkflows = workflows.length;
  const completionRate = totalWorkflows > 0 
    ? Math.round((stats.completed / totalWorkflows) * 100) 
    : 0;

  const statCards = [
    {
      label: 'Active Workflows',
      value: stats.active,
      icon: Activity,
      color: '#3b82f6'
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      color: '#10b981'
    },
    {
      label: 'Overdue Tasks',
      value: stats.overdueTasks,
      icon: AlertCircle,
      color: '#ef4444'
    },
    {
      label: 'In Progress',
      value: stats.inProgressTasks,
      icon: Clock,
      color: '#f59e0b'
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: '#8b5cf6'
    }
  ];

  return (
    <div className="workflow-stats">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="stat-card">
            <div 
              className="stat-icon" 
              style={{ backgroundColor: stat.color + '20', color: stat.color }}
            >
              <Icon size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowStats;