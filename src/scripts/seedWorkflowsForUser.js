// src/scripts/seedWorkflowsForUser.js
import prisma from '../lib/prisma.js';

// Your actual user ID and organization ID
const USER_ID = 'i1e5cj8ZvjOCrCkxvLrJunOjtnP2';
const ORG_ID = 'Iconik-Schools-Studios'; // Replace with your actual org ID if different

async function seedWorkflowsForUser() {
  try {
    console.log('Starting workflow seed for user:', USER_ID);
    
    // Create a sports photography workflow
    const sportsWorkflow = await prisma.workflow.create({
      data: {
        name: 'My Sports Photography',
        description: 'Personal workflow for managing sports photography jobs',
        organizationId: ORG_ID,
        isActive: true,
        isDefault: true,
        createdBy: USER_ID,
        stages: {
          create: [
            {
              name: 'To Schedule',
              description: 'Jobs waiting to be scheduled',
              order: 0,
              color: '#6b7280',
              icon: 'calendar-plus',
            },
            {
              name: 'Scheduled',
              description: 'Jobs scheduled and ready',
              order: 1,
              color: '#3b82f6',
              icon: 'calendar-check',
            },
            {
              name: 'Shooting',
              description: 'Currently shooting on location',
              order: 2,
              color: '#f59e0b',
              icon: 'camera',
            },
            {
              name: 'Editing',
              description: 'Post-processing and editing',
              order: 3,
              color: '#8b5cf6',
              icon: 'edit',
            },
            {
              name: 'Review',
              description: 'Client review and feedback',
              order: 4,
              color: '#ef4444',
              icon: 'eye',
            },
            {
              name: 'Completed',
              description: 'Delivered and archived',
              order: 5,
              color: '#10b981',
              icon: 'check-circle',
              isCompleted: true,
            }
          ]
        }
      },
      include: {
        stages: true
      }
    });

    console.log(`Created workflow: ${sportsWorkflow.name}`);

    // Add real-looking items assigned to you
    const items = [
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[0].id, // To Schedule
        type: 'job',
        title: 'Varsity Football - Championship Game',
        description: 'State championship game, need full coverage with action shots and team celebration',
        priority: 'urgent',
        schoolId: 'lincoln-high',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        metadata: {
          location: 'Memorial Stadium',
          expectedPhotos: 500,
          gameTime: '7:00 PM',
          opponent: 'Roosevelt High'
        },
        tags: ['football', 'championship', 'varsity'],
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[1].id, // Scheduled
        type: 'job',
        title: 'JV Basketball vs Central',
        description: 'Regular season game, focus on starting lineup and key plays',
        priority: 'medium',
        schoolId: 'washington-middle',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        photographerId: USER_ID,
        metadata: {
          location: 'Home Gym',
          expectedPhotos: 150,
          gameTime: '4:00 PM'
        },
        tags: ['basketball', 'jv', 'home-game'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[2].id, // Shooting
        type: 'job',
        title: 'Soccer Team Photos - Varsity & JV',
        description: 'Annual team photos for both varsity and JV soccer teams',
        priority: 'high',
        schoolId: 'jefferson-high',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        photographerId: USER_ID,
        metadata: {
          location: 'Soccer Field',
          expectedPhotos: 200,
          teams: ['Varsity Boys', 'Varsity Girls', 'JV Boys', 'JV Girls']
        },
        tags: ['soccer', 'team-photos', 'annual'],
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[3].id, // Editing
        type: 'job',
        title: 'Swimming Districts - Day 1',
        description: 'District swimming meet coverage, all events from day 1',
        priority: 'high',
        schoolId: 'aquatic-center',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        photographerId: USER_ID,
        metadata: {
          location: 'City Aquatic Center',
          expectedPhotos: 800,
          eventType: 'districts',
          day: 1
        },
        tags: ['swimming', 'districts', 'competition'],
      },
      {
        workflowId: sportsWorkflow.id,
        stageId: sportsWorkflow.stages[4].id, // Review
        type: 'job',
        title: 'Baseball Senior Night',
        description: 'Senior night ceremony and game coverage',
        priority: 'medium',
        schoolId: 'madison-high',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        photographerId: USER_ID,
        metadata: {
          location: 'Baseball Field',
          expectedPhotos: 300,
          seniors: 8,
          includesCeremony: true
        },
        tags: ['baseball', 'senior-night', 'ceremony'],
      },
    ];

    for (const item of items) {
      const created = await prisma.workflowItem.create({
        data: item
      });
      console.log(`Created item: ${created.title}`);
    }

    // Create a portrait workflow
    const portraitWorkflow = await prisma.workflow.create({
      data: {
        name: 'Portrait Sessions',
        description: 'Workflow for individual and group portrait sessions',
        organizationId: ORG_ID,
        isActive: true,
        createdBy: USER_ID,
        stages: {
          create: [
            { name: 'Inquiries', order: 0, color: '#94a3b8', icon: 'mail' },
            { name: 'Booked', order: 1, color: '#3b82f6', icon: 'calendar' },
            { name: 'Prep', order: 2, color: '#f59e0b', icon: 'clipboard' },
            { name: 'Session', order: 3, color: '#8b5cf6', icon: 'camera' },
            { name: 'Processing', order: 4, color: '#ec4899', icon: 'cpu' },
            { name: 'Delivered', order: 5, color: '#10b981', icon: 'check', isCompleted: true }
          ]
        }
      }
    });

    console.log(`Created workflow: ${portraitWorkflow.name}`);

    // Add some portrait items
    await prisma.workflowItem.create({
      data: {
        workflowId: portraitWorkflow.id,
        stageId: portraitWorkflow.stages[1].id, // Booked
        type: 'session',
        title: 'Class of 2024 - Senior Portraits',
        description: 'Individual senior portraits for yearbook',
        priority: 'high',
        assignedTo: USER_ID,
        createdBy: USER_ID,
        photographerId: USER_ID,
        metadata: {
          sessionType: 'senior-portraits',
          studentCount: 45,
          timePerStudent: '5 minutes'
        },
        tags: ['seniors', 'portraits', 'yearbook'],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }
    });

    console.log('\n✅ User-specific seed completed successfully!');
    console.log(`Created workflows for user: ${USER_ID}`);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedWorkflowsForUser();