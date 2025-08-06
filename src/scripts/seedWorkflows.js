// src/scripts/seedWorkflows.js
import prisma from '../lib/prisma.js';

async function seedWorkflows() {
  try {
    console.log('Starting workflow seed...');
    
    // Create a sample workflow for sports photography
    const sportsWorkflow = await prisma.workflow.create({
      data: {
        name: 'Sports Photography Workflow',
        description: 'Standard workflow for sports photography jobs',
        organizationId: 'demo-org-123', // Replace with your actual org ID
        isActive: true,
        isDefault: true,
        createdBy: 'seed-script',
        stages: {
          create: [
            {
              name: 'Scheduled',
              description: 'Job is scheduled and assigned',
              order: 0,
              color: '#3b82f6',
              icon: 'calendar',
              settings: {
                autoMove: false,
                notifyPhotographer: true
              }
            },
            {
              name: 'In Progress',
              description: 'Photographer is on-site shooting',
              order: 1,
              color: '#f59e0b',
              icon: 'camera',
              settings: {
                requireCheckIn: true
              }
            },
            {
              name: 'Editing',
              description: 'Photos are being edited',
              order: 2,
              color: '#8b5cf6',
              icon: 'edit',
              settings: {
                estimatedDuration: '48 hours'
              }
            },
            {
              name: 'Review',
              description: 'Photos are ready for client review',
              order: 3,
              color: '#ef4444',
              icon: 'eye',
              settings: {
                requireApproval: true
              }
            },
            {
              name: 'Delivered',
              description: 'Photos have been delivered to client',
              order: 4,
              color: '#10b981',
              icon: 'check-circle',
              isCompleted: true,
              settings: {
                sendNotification: true
              }
            }
          ]
        }
      },
      include: {
        stages: true
      }
    });

    console.log(`Created workflow: ${sportsWorkflow.name}`);
    console.log(`With ${sportsWorkflow.stages.length} stages`);

    // Add some sample items to the workflow
    const items = [
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[0].id, // Scheduled
        type: 'job',
        title: 'Varsity Basketball vs Lincoln High',
        description: 'Home game, full coverage needed',
        priority: 'high',
        schoolId: 'school-001',
        photographerId: 'photo-001',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        metadata: {
          location: 'Main Gym',
          expectedPhotos: 200,
          teamColors: ['blue', 'white']
        },
        tags: ['basketball', 'varsity', 'home-game']
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[1].id, // In Progress
        type: 'job',
        title: 'JV Soccer Team Photos',
        description: 'Team and individual photos',
        priority: 'medium',
        schoolId: 'school-002',
        photographerId: 'photo-002',
        metadata: {
          location: 'Soccer Field',
          expectedPhotos: 150
        },
        tags: ['soccer', 'team-photos', 'jv']
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[2].id, // Editing
        type: 'job',
        title: 'Swimming Championship',
        description: 'Regional championship meet',
        priority: 'urgent',
        schoolId: 'school-001',
        metadata: {
          location: 'Aquatic Center',
          expectedPhotos: 500,
          eventType: 'championship'
        },
        tags: ['swimming', 'championship', 'regional']
      }
    ];

    for (const item of items) {
      const created = await prisma.workflowItem.create({
        data: {
          ...item,
          createdBy: 'seed-script'
        }
      });
      console.log(`Created item: ${created.title}`);
    }

    // Create an event workflow
    const eventWorkflow = await prisma.workflow.create({
      data: {
        name: 'Event Photography Workflow',
        description: 'Workflow for special events and ceremonies',
        organizationId: 'demo-org-123',
        isActive: true,
        createdBy: 'seed-script',
        stages: {
          create: [
            { name: 'Booked', order: 0, color: '#6b7280', icon: 'bookmark' },
            { name: 'Preparation', order: 1, color: '#3b82f6', icon: 'clipboard' },
            { name: 'Event Day', order: 2, color: '#f59e0b', icon: 'calendar' },
            { name: 'Processing', order: 3, color: '#8b5cf6', icon: 'cpu' },
            { name: 'Completed', order: 4, color: '#10b981', icon: 'check', isCompleted: true }
          ]
        }
      }
    });

    console.log(`Created workflow: ${eventWorkflow.name}`);

    console.log('\n✅ Seed completed successfully!');
    console.log('You can now view the data in Prisma Studio or your app.');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedWorkflows();