// src/pages/api/workflows/test.js
import workflowDbService from '../../../services/workflowDbService';

export default async function handler(req, res) {
  try {
    // Test connection and create a sample workflow
    if (req.method === 'POST') {
      const testWorkflow = await workflowDbService.createWorkflow({
        name: "Test Sports Photography Workflow",
        description: "Testing PostgreSQL connection",
        organizationId: "test-org-123", // Use your actual org ID
        createdBy: "test-user",
        stages: [
          { name: "Scheduled", color: "#3b82f6", icon: "calendar" },
          { name: "Shooting", color: "#f59e0b", icon: "camera" },
          { name: "Editing", color: "#8b5cf6", icon: "edit" },
          { name: "Review", color: "#ef4444", icon: "eye" },
          { name: "Delivered", color: "#10b981", icon: "check" }
        ]
      });
      
      res.status(200).json({ 
        success: true, 
        message: "Database connected successfully!",
        workflow: testWorkflow 
      });
    } else if (req.method === 'GET') {
      // Fetch all workflows
      const workflows = await workflowDbService.getWorkflows("test-org-123");
      res.status(200).json({ 
        success: true,
        count: workflows.length,
        workflows 
      });
    }
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}