// src/test-tracking-workflow.js
// Simple test to verify tracking workflow creation works

import { 
  createTrackingWorkflowForSchool,
  getTrackingWorkflowsForSchool,
  getWorkflowsWithMetadata 
} from './firebase/firestore';

// Test function to create a composite tracking workflow
export const testCreateCompositeWorkflow = async (schoolId, organizationID) => {
  try {
    console.log("🧪 Testing composite workflow creation...");
    
    // Create a composite tracking workflow
    const workflowId = await createTrackingWorkflowForSchool(
      schoolId,
      organizationID,
      "composite",
      "2024-2025",
      {
        trackingStartDate: new Date(),
        trackingEndDate: new Date(Date.now() + 30*24*60*60*1000), // 30 days
        additionalData: {
          compositeSize: "24x30",
          frameType: "Wood",
          notes: "Test composite workflow creation"
        }
      }
    );
    
    console.log("✅ Workflow created successfully with ID:", workflowId);
    
    // Verify workflow exists
    const trackingWorkflows = await getTrackingWorkflowsForSchool(schoolId, organizationID, "composite", "2024-2025");
    console.log("📋 Found tracking workflows:", trackingWorkflows.length);
    
    // Get workflow with metadata
    const workflowsWithMeta = await getWorkflowsWithMetadata(organizationID, {
      workflowType: 'tracking',
      schoolId: schoolId
    });
    console.log("🏫 Workflows with school metadata:", workflowsWithMeta.length);
    
    if (workflowsWithMeta.length > 0) {
      const workflow = workflowsWithMeta[0];
      console.log("📄 Workflow details:");
      console.log("  - ID:", workflow.id);
      console.log("  - School:", workflow.schoolName);
      console.log("  - Type:", workflow.trackingType);
      console.log("  - Academic Year:", workflow.academicYear);
      console.log("  - Template:", workflow.templateName);
      console.log("  - Status:", workflow.status);
      console.log("  - Steps:", Object.keys(workflow.stepProgress).length);
      
      // Show first few steps
      Object.entries(workflow.stepProgress).slice(0, 3).forEach(([stepId, step], index) => {
        console.log(`  - Step ${index + 1}: ${step.status || 'pending'}`);
      });
    }
    
    return {
      success: true,
      workflowId,
      trackingWorkflows,
      workflowsWithMeta
    };
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Test function to be called from browser console
window.testCompositeWorkflow = testCreateCompositeWorkflow;