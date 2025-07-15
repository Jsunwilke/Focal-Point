// src/utils/workflowTemplates.js
// Default workflow templates for different photography session types

// Generate unique step IDs
const generateStepId = (prefix, index) => `${prefix}_step_${index + 1}`;

// Define standard workflow groups
export const WORKFLOW_GROUPS = [
  {
    id: 'pre_shoot',
    name: 'Pre-Shoot',
    description: 'Preparation steps before the photography session',
    color: '#3b82f6', // Blue
    order: 1
  },
  {
    id: 'shoot',
    name: 'Shoot',
    description: 'Photography session execution',
    color: '#10b981', // Green
    order: 2
  },
  {
    id: 'editing',
    name: 'Editing',
    description: 'Post-processing and photo enhancement',
    color: '#f59e0b', // Amber
    order: 3
  },
  {
    id: 'production',
    name: 'Production',
    description: 'Final delivery and client communication',
    color: '#8b5cf6', // Purple
    order: 4
  }
];

export const DEFAULT_WORKFLOW_TEMPLATES = {
  portrait: {
    name: "Portrait Session Workflow",
    description: "Complete workflow for portrait photography sessions from booking to delivery",
    sessionTypes: ["portrait", "portrait_day"],
    estimatedDays: 7,
    groups: WORKFLOW_GROUPS,
    steps: [
      {
        id: generateStepId("portrait", 0),
        title: "Session Confirmation",
        description: "Contact client to confirm session details, timing, and location",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [],
        dueOffsetDays: -2, // Due 2 days before session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: [],
          outputs: ["confirmed_details"]
        }
      },
      {
        id: generateStepId("portrait", 1),
        title: "Equipment Preparation",
        description: "Check camera equipment, batteries, memory cards, and backup gear",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("portrait", 0)],
        dueOffsetDays: -1, // Due 1 day before session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["confirmed_details"],
          outputs: ["equipment_checklist"]
        }
      },
      {
        id: generateStepId("portrait", 2),
        title: "Location Setup",
        description: "Arrive early, scout location, and set up lighting/backdrop if needed",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("portrait", 1)],
        dueOffsetDays: 0, // Due on session day (before shoot)
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["equipment_checklist"],
          outputs: ["location_ready"]
        }
      },
      {
        id: generateStepId("portrait", 3),
        title: "Conduct Portrait Session",
        description: "Photograph client according to planned shot list and style",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 2,
        dependencies: [generateStepId("portrait", 2)],
        dueOffsetDays: 0, // Due on session day
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["location_ready"],
          outputs: ["session_completed"]
        }
      },
      {
        id: generateStepId("portrait", 4),
        title: "Download & Backup Photos",
        description: "Download all photos from camera/memory cards and create backup",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("portrait", 3)],
        dueOffsetDays: 0, // Due same day as session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 6
        },
        files: {
          required: ["session_completed"],
          outputs: ["raw_photos"]
        }
      },
      {
        id: generateStepId("portrait", 5),
        title: "Photo Culling",
        description: "Review and select the best photos from the session",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 2,
        dependencies: [generateStepId("portrait", 4)],
        dueOffsetDays: 1, // Due 1 day after session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: ["raw_photos"],
          outputs: ["selected_photos"]
        }
      },
      {
        id: generateStepId("portrait", 6),
        title: "Basic Editing",
        description: "Apply basic edits (exposure, color correction, cropping)",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "editor",
        estimatedHours: 3,
        dependencies: [generateStepId("portrait", 5)],
        dueOffsetDays: 3, // Due 3 days after session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 48
        },
        files: {
          required: ["selected_photos"],
          outputs: ["edited_photos"]
        }
      },
      {
        id: generateStepId("portrait", 7),
        title: "Quality Review",
        description: "Review edited photos for quality and consistency",
        type: "approval",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 1,
        dependencies: [generateStepId("portrait", 6)],
        dueOffsetDays: 4, // Due 4 days after session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["edited_photos"],
          outputs: ["approved_photos"]
        }
      },
      {
        id: generateStepId("portrait", 8),
        title: "Create Client Gallery",
        description: "Upload photos to client gallery platform",
        type: "task",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [generateStepId("portrait", 7)],
        dueOffsetDays: 5, // Due 5 days after session
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["approved_photos"],
          outputs: ["client_gallery"]
        }
      },
      {
        id: generateStepId("portrait", 9),
        title: "Client Notification",
        description: "Send gallery link and instructions to client",
        type: "notification",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.1,
        dependencies: [generateStepId("portrait", 8)],
        dueOffsetDays: 5, // Due same day as gallery creation
        notifications: {
          onStart: false,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["client_gallery"],
          outputs: ["client_email"]
        }
      }
    ]
  },

  sports: {
    name: "Sports Photography Workflow",
    description: "Complete workflow for sports photography from preparation to sales",
    sessionTypes: ["sports", "sports_photography"],
    estimatedDays: 5,
    groups: WORKFLOW_GROUPS,
    steps: [
      {
        id: generateStepId("sports", 0),
        title: "Roster Collection",
        description: "Collect team roster and jersey numbers from coach/school",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [],
        dueOffsetDays: -3, // Due 3 days before event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: [],
          outputs: ["roster_data"]
        }
      },
      {
        id: generateStepId("sports", 1),
        title: "Equipment Check",
        description: "Check cameras, telephoto lenses, extra batteries, and memory cards",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("sports", 0)],
        dueOffsetDays: -1, // Due 1 day before event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["roster_data"],
          outputs: ["equipment_ready"]
        }
      },
      {
        id: generateStepId("sports", 2),
        title: "Venue Setup",
        description: "Arrive early to scout best shooting positions and lighting conditions",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("sports", 1)],
        dueOffsetDays: 0, // Due on event day (before game)
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["equipment_ready"],
          outputs: ["venue_ready"]
        }
      },
      {
        id: generateStepId("sports", 3),
        title: "Game Coverage",
        description: "Photograph players during the sporting event",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 3,
        dependencies: [generateStepId("sports", 2)],
        dueOffsetDays: 0, // Due on event day
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["venue_ready"],
          outputs: ["event_photos"]
        }
      },
      {
        id: generateStepId("sports", 4),
        title: "Photo Download & Backup",
        description: "Download photos and create backup copies",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("sports", 3)],
        dueOffsetDays: 0, // Due same day as event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 6
        },
        files: {
          required: ["event_photos"],
          outputs: ["raw_photos", "backup_photos"]
        }
      },
      {
        id: generateStepId("sports", 5),
        title: "Batch Processing",
        description: "Apply batch corrections and basic edits to all photos",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "editor",
        estimatedHours: 4,
        dependencies: [generateStepId("sports", 4)],
        dueOffsetDays: 1, // Due 1 day after event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["raw_photos"],
          outputs: ["processed_photos"]
        }
      },
      {
        id: generateStepId("sports", 6),
        title: "Team Sorting",
        description: "Sort photos by team and player using roster data",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 2,
        dependencies: [generateStepId("sports", 5)],
        dueOffsetDays: 2, // Due 2 days after event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["processed_photos", "roster_data"],
          outputs: ["sorted_photos"]
        }
      },
      {
        id: generateStepId("sports", 7),
        title: "Gallery Creation",
        description: "Create team and individual player galleries",
        type: "task",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 1,
        dependencies: [generateStepId("sports", 6)],
        dueOffsetDays: 3, // Due 3 days after event
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["sorted_photos"],
          outputs: ["team_galleries"]
        }
      },
      {
        id: generateStepId("sports", 8),
        title: "Launch Sales",
        description: "Activate galleries for team and parent purchases",
        type: "task",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [generateStepId("sports", 7)],
        dueOffsetDays: 3, // Due same day as gallery creation
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["team_galleries"],
          outputs: ["live_galleries"]
        }
      }
    ]
  },

  wedding: {
    name: "Wedding Photography Workflow", 
    description: "Complete wedding photography workflow from preparation to final delivery",
    sessionTypes: ["wedding", "event", "school_event"],
    estimatedDays: 21,
    groups: WORKFLOW_GROUPS,
    steps: [
      {
        id: generateStepId("wedding", 0),
        title: "Pre-Wedding Consultation",
        description: "Meet with couple to discuss timeline, shot list, and special requests",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 2,
        dependencies: [],
        dueOffsetDays: -7, // Due 7 days before wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: [],
          outputs: ["shot_list", "timeline"]
        }
      },
      {
        id: generateStepId("wedding", 1),
        title: "Equipment Preparation",
        description: "Check all cameras, lenses, batteries, and backup equipment",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("wedding", 0)],
        dueOffsetDays: -2, // Due 2 days before wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["shot_list", "timeline"],
          outputs: ["equipment_ready"]
        }
      },
      {
        id: generateStepId("wedding", 2),
        title: "Venue Setup",
        description: "Arrive early to scout ceremony and reception venues",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("wedding", 1)],
        dueOffsetDays: 0, // Due on wedding day (before ceremony)
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["equipment_ready"],
          outputs: ["venue_ready"]
        }
      },
      {
        id: generateStepId("wedding", 3),
        title: "Wedding Day Coverage",
        description: "Photograph ceremony, reception, and all key moments",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 8,
        dependencies: [generateStepId("wedding", 2)],
        dueOffsetDays: 0, // Due on wedding day
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 10
        },
        files: {
          required: ["venue_ready"],
          outputs: ["wedding_photos"]
        }
      },
      {
        id: generateStepId("wedding", 4),
        title: "Photo Import & Backup",
        description: "Import all wedding photos and create multiple backups",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 2,
        dependencies: [generateStepId("wedding", 3)],
        dueOffsetDays: 0, // Due same day as wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 6
        },
        files: {
          required: ["wedding_photos"],
          outputs: ["raw_photos", "backup_1", "backup_2"]
        }
      },
      {
        id: generateStepId("wedding", 5),
        title: "Initial Culling",
        description: "Remove duplicates and obviously bad shots",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 6,
        dependencies: [generateStepId("wedding", 4)],
        dueOffsetDays: 1, // Due 1 day after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: ["raw_photos"],
          outputs: ["culled_photos"]
        }
      },
      {
        id: generateStepId("wedding", 6),
        title: "Sneak Peek Selection",
        description: "Select 10-15 photos for same-day sneak peek",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("wedding", 5)],
        dueOffsetDays: 1, // Due 1 day after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 6
        },
        files: {
          required: ["culled_photos"],
          outputs: ["sneak_peek_raws"]
        }
      },
      {
        id: generateStepId("wedding", 7),
        title: "Sneak Peek Editing",
        description: "Quick edit sneak peek photos for social media",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "editor",
        estimatedHours: 2,
        dependencies: [generateStepId("wedding", 6)],
        dueOffsetDays: 2, // Due 2 days after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["sneak_peek_raws"],
          outputs: ["sneak_peek_final"]
        }
      },
      {
        id: generateStepId("wedding", 8),
        title: "Sneak Peek Delivery",
        description: "Send sneak peek photos to couple",
        type: "notification",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [generateStepId("wedding", 7)],
        dueOffsetDays: 2, // Due same day as sneak peek editing
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["sneak_peek_final"],
          outputs: ["sneak_peek_delivered"]
        }
      },
      {
        id: generateStepId("wedding", 9),
        title: "Final Photo Selection",
        description: "Final culling to delivery-ready photo count",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 4,
        dependencies: [generateStepId("wedding", 8)],
        dueOffsetDays: 7, // Due 7 days after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 48
        },
        files: {
          required: ["culled_photos"],
          outputs: ["final_selection"]
        }
      },
      {
        id: generateStepId("wedding", 10),
        title: "Professional Editing",
        description: "Full professional editing of all selected photos",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "editor",
        estimatedHours: 20,
        dependencies: [generateStepId("wedding", 9)],
        dueOffsetDays: 14, // Due 14 days after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 72
        },
        files: {
          required: ["final_selection"],
          outputs: ["edited_finals"]
        }
      },
      {
        id: generateStepId("wedding", 11),
        title: "Final Review",
        description: "Final quality check and approval",
        type: "approval",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 2,
        dependencies: [generateStepId("wedding", 10)],
        dueOffsetDays: 16, // Due 16 days after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["edited_finals"],
          outputs: ["approved_finals"]
        }
      },
      {
        id: generateStepId("wedding", 12),
        title: "Gallery Creation",
        description: "Create online gallery with client access",
        type: "task",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 1,
        dependencies: [generateStepId("wedding", 11)],
        dueOffsetDays: 18, // Due 18 days after wedding
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["approved_finals"],
          outputs: ["client_gallery"]
        }
      },
      {
        id: generateStepId("wedding", 13),
        title: "Final Delivery",
        description: "Send gallery link and download instructions to couple",
        type: "notification",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [generateStepId("wedding", 12)],
        dueOffsetDays: 18, // Due same day as gallery creation
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["client_gallery"],
          outputs: ["delivery_complete"]
        }
      }
    ]
  },

  graduation: {
    name: "Graduation Photography Workflow",
    description: "Complete graduation ceremony workflow from preparation to family delivery",
    sessionTypes: ["graduation", "ceremony"],
    estimatedDays: 7,
    groups: WORKFLOW_GROUPS,
    steps: [
      {
        id: generateStepId("graduation", 0),
        title: "Graduate Roster Collection",
        description: "Collect graduate roster with names and seating order from school",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 0.5,
        dependencies: [],
        dueOffsetDays: -3, // Due 3 days before ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: [],
          outputs: ["graduate_roster"]
        }
      },
      {
        id: generateStepId("graduation", 1),
        title: "Equipment Setup",
        description: "Prepare multiple cameras with telephoto lenses for ceremony coverage",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("graduation", 0)],
        dueOffsetDays: -1, // Due 1 day before ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["graduate_roster"],
          outputs: ["equipment_ready"]
        }
      },
      {
        id: generateStepId("graduation", 2),
        title: "Venue Positioning",
        description: "Arrive early to position cameras for optimal ceremony coverage",
        type: "task",
        group: "pre_shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 0.5,
        dependencies: [generateStepId("graduation", 1)],
        dueOffsetDays: 0, // Due on ceremony day (before start)
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 2
        },
        files: {
          required: ["equipment_ready"],
          outputs: ["venue_ready"]
        }
      },
      {
        id: generateStepId("graduation", 3),
        title: "Ceremony Coverage",
        description: "Photograph graduates walking across stage during ceremony",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 4,
        dependencies: [generateStepId("graduation", 2)],
        dueOffsetDays: 0, // Due on ceremony day
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 5
        },
        files: {
          required: ["venue_ready"],
          outputs: ["ceremony_photos"]
        }
      },
      {
        id: generateStepId("graduation", 4),
        title: "Photo Download",
        description: "Download ceremony photos from all cameras and create backups",
        type: "task",
        group: "shoot",
        assigneeRule: "role",
        assigneeValue: "photographer",
        estimatedHours: 1,
        dependencies: [generateStepId("graduation", 3)],
        dueOffsetDays: 0, // Due same day as ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["ceremony_photos"],
          outputs: ["raw_ceremony_photos"]
        }
      },
      {
        id: generateStepId("graduation", 5),
        title: "Graduate Identification",
        description: "Match photos to graduate roster using name cards and seating order",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 8,
        dependencies: [generateStepId("graduation", 4)],
        dueOffsetDays: 1, // Due 1 day after ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 24
        },
        files: {
          required: ["raw_ceremony_photos", "graduate_roster"],
          outputs: ["identified_photos"]
        }
      },
      {
        id: generateStepId("graduation", 6),
        title: "Batch Processing",
        description: "Apply consistent color correction and cropping to all photos",
        type: "task",
        group: "editing",
        assigneeRule: "role",
        assigneeValue: "editor",
        estimatedHours: 4,
        dependencies: [generateStepId("graduation", 5)],
        dueOffsetDays: 3, // Due 3 days after ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 12
        },
        files: {
          required: ["identified_photos"],
          outputs: ["processed_photos"]
        }
      },
      {
        id: generateStepId("graduation", 7),
        title: "Individual Galleries",
        description: "Create individual graduate galleries for family access",
        type: "task",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 2,
        dependencies: [generateStepId("graduation", 6)],
        dueOffsetDays: 4, // Due 4 days after ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 8
        },
        files: {
          required: ["processed_photos"],
          outputs: ["individual_galleries"]
        }
      },
      {
        id: generateStepId("graduation", 8),
        title: "Family Notifications",
        description: "Send gallery access codes and instructions to graduate families",
        type: "notification",
        group: "production",
        assigneeRule: "role",
        assigneeValue: "admin",
        estimatedHours: 1,
        dependencies: [generateStepId("graduation", 7)],
        dueOffsetDays: 5, // Due 5 days after ceremony
        notifications: {
          onStart: true,
          onComplete: true,
          escalationHours: 4
        },
        files: {
          required: ["individual_galleries"],
          outputs: ["family_notifications"]
        }
      }
    ]
  }
};

// Function to get all default templates
export const getAllDefaultTemplates = () => {
  return Object.values(DEFAULT_WORKFLOW_TEMPLATES);
};

// Function to get template by session type
export const getTemplateBySessionType = (sessionType) => {
  const template = Object.values(DEFAULT_WORKFLOW_TEMPLATES).find(
    template => template.sessionTypes.includes(sessionType)
  );
  return template || null;
};

// Function to create a template for an organization
export const createTemplateForOrganization = (organizationID, templateKey, customizations = {}) => {
  const baseTemplate = DEFAULT_WORKFLOW_TEMPLATES[templateKey];
  if (!baseTemplate) {
    throw new Error(`Template "${templateKey}" not found`);
  }

  return {
    ...baseTemplate,
    ...customizations,
    organizationID,
    isDefault: customizations.isDefault || false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Function to get step types with descriptions
export const getStepTypes = () => {
  return [
    {
      id: 'task',
      name: 'Task',
      description: 'A work item that needs to be completed',
      icon: '📋'
    },
    {
      id: 'approval',
      name: 'Approval',
      description: 'A step that requires review and approval',
      icon: '✅'
    },
    {
      id: 'notification',
      name: 'Notification',
      description: 'Automatic notification to client or team member',
      icon: '📧'
    },
    {
      id: 'delay',
      name: 'Delay',
      description: 'Wait period before next step can begin',
      icon: '⏰'
    },
    {
      id: 'conditional',
      name: 'Conditional',
      description: 'Step that branches based on conditions',
      icon: '🔀'
    }
  ];
};

// Function to get assignee rules
export const getAssigneeRules = () => {
  return [
    {
      id: 'role',
      name: 'By Role',
      description: 'Assign to any user with a specific role',
      options: ['photographer', 'editor', 'admin', 'manager']
    },
    {
      id: 'specific',
      name: 'Specific User',
      description: 'Assign to a specific team member'
    },
    {
      id: 'auto',
      name: 'Automatic',
      description: 'System automatically handles (for notifications, etc.)'
    }
  ];
};

// Get the recommended workflow template for a session type
export const getRecommendedWorkflowTemplate = (sessionType) => {
  if (!sessionType) return 'portrait';
  
  const sessionTypeLower = sessionType.toLowerCase();
  
  // Check for exact matches first
  const exactMatches = {
    'portrait': 'portrait',
    'portrait_day': 'portrait',
    'sports': 'sports',
    'sports_photography': 'sports',
    'event': 'wedding',
    'school_event': 'wedding',
    'wedding': 'wedding',
    'graduation': 'graduation',
    'ceremony': 'graduation',
    'underclass': 'graduation', // Common school photography term
    'upperclass': 'graduation', // Common school photography term
    'senior': 'portrait', // Senior portraits
    'seniors': 'portrait', // Senior portraits
    'other': 'portrait'
  };
  
  if (exactMatches[sessionType]) {
    return exactMatches[sessionType];
  }
  
  // Fuzzy matching for custom session types
  if (sessionTypeLower.includes('portrait') || sessionTypeLower.includes('individual') || sessionTypeLower.includes('senior')) {
    return 'portrait';
  } else if (sessionTypeLower.includes('sport') || sessionTypeLower.includes('game') || sessionTypeLower.includes('team') || sessionTypeLower.includes('athletic')) {
    return 'sports';
  } else if (sessionTypeLower.includes('wedding') || sessionTypeLower.includes('event') || sessionTypeLower.includes('party') || sessionTypeLower.includes('celebration')) {
    return 'wedding';
  } else if (sessionTypeLower.includes('graduation') || sessionTypeLower.includes('ceremony') || sessionTypeLower.includes('commencement') || 
             sessionTypeLower.includes('class') || sessionTypeLower.includes('grade') || sessionTypeLower.includes('school')) {
    return 'graduation';
  }
  
  // Default fallback
  return 'portrait';
};

// Get a human-readable explanation of which workflow will be used
export const getWorkflowMappingExplanation = (sessionType) => {
  const recommendedTemplate = getRecommendedWorkflowTemplate(sessionType);
  const templateNames = {
    'portrait': 'Portrait Session Workflow',
    'sports': 'Sports Photography Workflow', 
    'wedding': 'Wedding Photography Workflow',
    'graduation': 'Graduation Photography Workflow'
  };
  
  return {
    templateKey: recommendedTemplate,
    templateName: templateNames[recommendedTemplate],
    reason: getWorkflowMappingReason(sessionType, recommendedTemplate)
  };
};

// Get the reason why a particular workflow was selected
const getWorkflowMappingReason = (sessionType, templateKey) => {
  const sessionTypeLower = sessionType.toLowerCase();
  
  if (sessionType === 'other') {
    return 'Default workflow for unspecified session types';
  }
  
  const reasons = {
    'portrait': {
      exact: ['portrait', 'portrait_day', 'senior', 'seniors'],
      fuzzy: ['portrait', 'individual', 'senior'],
      default: 'Best fit for individual photography sessions'
    },
    'sports': {
      exact: ['sports', 'sports_photography'],
      fuzzy: ['sport', 'game', 'team', 'athletic'],
      default: 'Best fit for team and athletic photography'
    },
    'wedding': {
      exact: ['event', 'school_event', 'wedding'],
      fuzzy: ['wedding', 'event', 'party', 'celebration'],
      default: 'Best fit for events and celebrations'
    },
    'graduation': {
      exact: ['graduation', 'ceremony', 'underclass', 'upperclass'],
      fuzzy: ['graduation', 'ceremony', 'commencement', 'class', 'grade', 'school'],
      default: 'Best fit for ceremonies and school photography'
    }
  };
  
  const config = reasons[templateKey];
  if (!config) return 'Default selection';
  
  // Check for exact match
  if (config.exact.includes(sessionType)) {
    return 'Exact match';
  }
  
  // Check for fuzzy match
  for (const keyword of config.fuzzy) {
    if (sessionTypeLower.includes(keyword)) {
      return `Contains keyword "${keyword}"`;
    }
  }
  
  return config.default;
};

// Group utility functions
export const getWorkflowGroups = () => {
  return WORKFLOW_GROUPS;
};

export const getGroupById = (groupId) => {
  return WORKFLOW_GROUPS.find(group => group.id === groupId);
};

export const getGroupsByTemplate = (template) => {
  return template.groups || WORKFLOW_GROUPS;
};

export const groupStepsByGroup = (steps, groups = WORKFLOW_GROUPS) => {
  const groupedSteps = {};
  
  // Initialize all groups
  groups.forEach(group => {
    groupedSteps[group.id] = {
      group: group,
      steps: []
    };
  });
  
  // Add ungrouped category for steps without a group
  groupedSteps['ungrouped'] = {
    group: {
      id: 'ungrouped',
      name: 'Other',
      description: 'Steps without a specific group',
      color: '#6b7280',
      order: 999
    },
    steps: []
  };
  
  // Group the steps
  steps.forEach(step => {
    const groupId = step.group || 'ungrouped';
    if (groupedSteps[groupId]) {
      groupedSteps[groupId].steps.push(step);
    } else {
      // If group doesn't exist, add to ungrouped
      groupedSteps['ungrouped'].steps.push(step);
    }
  });
  
  // Remove empty groups and sort by order
  const result = Object.values(groupedSteps)
    .filter(groupData => groupData.steps.length > 0)
    .sort((a, b) => a.group.order - b.group.order);
  
  return result;
};

export const getStepCountsByGroup = (steps, groups = WORKFLOW_GROUPS) => {
  const counts = {};
  
  groups.forEach(group => {
    counts[group.id] = 0;
  });
  counts['ungrouped'] = 0;
  
  steps.forEach(step => {
    const groupId = step.group || 'ungrouped';
    if (counts.hasOwnProperty(groupId)) {
      counts[groupId]++;
    } else {
      counts['ungrouped']++;
    }
  });
  
  return counts;
};

export const getGroupProgress = (steps, stepProgress, groupId) => {
  const groupSteps = steps.filter(step => step.group === groupId);
  if (groupSteps.length === 0) return 0;
  
  const completedSteps = groupSteps.filter(step => 
    stepProgress[step.id]?.status === 'completed'
  ).length;
  
  return (completedSteps / groupSteps.length) * 100;
};

export const validateStepGroup = (groupId, availableGroups = WORKFLOW_GROUPS) => {
  return availableGroups.some(group => group.id === groupId);
};