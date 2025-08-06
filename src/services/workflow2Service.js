// src/services/workflow2Service.js
// This service will handle PostgreSQL workflows
// For now, we'll use mock data since we can't directly access Prisma from the browser

class Workflow2Service {
  constructor() {
    // Initialize with mock data that matches what we seeded
    this.mockWorkflows = null;
  }

  async getWorkflows(userId, organizationId) {
    // In a real implementation, this would call your backend API
    // For now, return mock data matching your seeded data
    
    if (!this.mockWorkflows) {
      this.mockWorkflows = [
        {
          id: 'wf-sports-1',
          name: 'My Sports Photography',
          description: 'Personal workflow for managing sports photography jobs',
          organizationId: organizationId,
          isActive: true,
          isDefault: true,
          createdBy: userId,
          stages: [
            { id: 'stage-1', name: 'To Schedule', order: 0, color: '#6b7280', icon: 'calendar-plus' },
            { id: 'stage-2', name: 'Scheduled', order: 1, color: '#3b82f6', icon: 'calendar-check' },
            { id: 'stage-3', name: 'Shooting', order: 2, color: '#f59e0b', icon: 'camera' },
            { id: 'stage-4', name: 'Editing', order: 3, color: '#8b5cf6', icon: 'edit' },
            { id: 'stage-5', name: 'Review', order: 4, color: '#ef4444', icon: 'eye' },
            { id: 'stage-6', name: 'Completed', order: 5, color: '#10b981', icon: 'check-circle', isCompleted: true }
          ],
          items: [
            {
              id: 'item-1',
              workflowId: 'wf-sports-1',
              stageId: 'stage-1',
              stage: { id: 'stage-1', name: 'To Schedule' },
              type: 'job',
              title: 'Varsity Football - Championship Game',
              description: 'State championship game, need full coverage with action shots and team celebration',
              priority: 'urgent',
              schoolId: 'lincoln-high',
              assignedTo: userId,
              createdBy: userId,
              metadata: {
                location: 'Memorial Stadium',
                expectedPhotos: 500,
                gameTime: '7:00 PM',
                opponent: 'Roosevelt High'
              },
              tags: ['football', 'championship', 'varsity'],
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            },
            {
              id: 'item-2',
              workflowId: 'wf-sports-1',
              stageId: 'stage-2',
              stage: { id: 'stage-2', name: 'Scheduled' },
              type: 'job',
              title: 'JV Basketball vs Central',
              description: 'Regular season game, focus on starting lineup and key plays',
              priority: 'medium',
              schoolId: 'washington-middle',
              assignedTo: userId,
              createdBy: userId,
              photographerId: userId,
              metadata: {
                location: 'Home Gym',
                expectedPhotos: 150,
                gameTime: '4:00 PM'
              },
              tags: ['basketball', 'jv', 'home-game'],
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            },
            {
              id: 'item-3',
              workflowId: 'wf-sports-1',
              stageId: 'stage-3',
              stage: { id: 'stage-3', name: 'Shooting' },
              type: 'job',
              title: 'Soccer Team Photos - Varsity & JV',
              description: 'Annual team photos for both varsity and JV soccer teams',
              priority: 'high',
              schoolId: 'jefferson-high',
              assignedTo: userId,
              createdBy: userId,
              photographerId: userId,
              metadata: {
                location: 'Soccer Field',
                expectedPhotos: 200,
                teams: ['Varsity Boys', 'Varsity Girls', 'JV Boys', 'JV Girls']
              },
              tags: ['soccer', 'team-photos', 'annual']
            },
            {
              id: 'item-4',
              workflowId: 'wf-sports-1',
              stageId: 'stage-4',
              stage: { id: 'stage-4', name: 'Editing' },
              type: 'job',
              title: 'Swimming Districts - Day 1',
              description: 'District swimming meet coverage, all events from day 1',
              priority: 'high',
              schoolId: 'aquatic-center',
              assignedTo: userId,
              createdBy: userId,
              photographerId: userId,
              metadata: {
                location: 'City Aquatic Center',
                expectedPhotos: 800,
                eventType: 'districts',
                day: 1
              },
              tags: ['swimming', 'districts', 'competition']
            },
            {
              id: 'item-5',
              workflowId: 'wf-sports-1',
              stageId: 'stage-5',
              stage: { id: 'stage-5', name: 'Review' },
              type: 'job',
              title: 'Baseball Senior Night',
              description: 'Senior night ceremony and game coverage',
              priority: 'medium',
              schoolId: 'madison-high',
              assignedTo: userId,
              createdBy: userId,
              photographerId: userId,
              metadata: {
                location: 'Baseball Field',
                expectedPhotos: 300,
                seniors: 8,
                includesCeremony: true
              },
              tags: ['baseball', 'senior-night', 'ceremony']
            }
          ]
        },
        {
          id: 'wf-portrait-1',
          name: 'Portrait Sessions',
          description: 'Workflow for individual and group portrait sessions',
          organizationId: organizationId,
          isActive: true,
          isDefault: false,
          createdBy: userId,
          stages: [
            { id: 'p-stage-1', name: 'Inquiries', order: 0, color: '#94a3b8', icon: 'mail' },
            { id: 'p-stage-2', name: 'Booked', order: 1, color: '#3b82f6', icon: 'calendar' },
            { id: 'p-stage-3', name: 'Prep', order: 2, color: '#f59e0b', icon: 'clipboard' },
            { id: 'p-stage-4', name: 'Session', order: 3, color: '#8b5cf6', icon: 'camera' },
            { id: 'p-stage-5', name: 'Processing', order: 4, color: '#ec4899', icon: 'cpu' },
            { id: 'p-stage-6', name: 'Delivered', order: 5, color: '#10b981', icon: 'check', isCompleted: true }
          ],
          items: [
            {
              id: 'p-item-1',
              workflowId: 'wf-portrait-1',
              stageId: 'p-stage-2',
              stage: { id: 'p-stage-2', name: 'Booked' },
              type: 'session',
              title: 'Class of 2024 - Senior Portraits',
              description: 'Individual senior portraits for yearbook',
              priority: 'high',
              assignedTo: userId,
              createdBy: userId,
              photographerId: userId,
              metadata: {
                sessionType: 'senior-portraits',
                studentCount: 45,
                timePerStudent: '5 minutes'
              },
              tags: ['seniors', 'portraits', 'yearbook'],
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            }
          ]
        }
      ];
    }

    return this.mockWorkflows;
  }

  async moveItem(itemId, newStageId, workflowId) {
    // Find the workflow and update the item's stage
    const workflow = this.mockWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      const item = workflow.items.find(i => i.id === itemId);
      if (item) {
        item.stageId = newStageId;
        const newStage = workflow.stages.find(s => s.id === newStageId);
        item.stage = { id: newStage.id, name: newStage.name };
        
        // In a real app, this would save to PostgreSQL
        console.log('Item moved:', item.title, 'to', newStage.name);
        return item;
      }
    }
    throw new Error('Item or workflow not found');
  }

  async createItem(workflowId, stageId, itemData) {
    const workflow = this.mockWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      const stage = workflow.stages.find(s => s.id === stageId);
      const newItem = {
        id: `item-${Date.now()}`,
        workflowId,
        stageId,
        stage: { id: stage.id, name: stage.name },
        type: itemData.type || 'task',
        title: itemData.title,
        description: itemData.description,
        priority: itemData.priority,
        assignedTo: itemData.assignedTo,
        createdBy: itemData.createdBy,
        metadata: itemData.metadata || {},
        tags: itemData.tags || [],
        createdAt: new Date()
      };
      
      workflow.items.push(newItem);
      console.log('Item created:', newItem.title);
      return newItem;
    }
    throw new Error('Workflow not found');
  }
}

export default new Workflow2Service();