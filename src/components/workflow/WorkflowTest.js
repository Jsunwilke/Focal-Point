// src/components/workflow/WorkflowTest.js
// Simple test component to verify workflow system is working
import React, { useState } from 'react';
import { 
  getWorkflowTemplates,
  initializeDefaultWorkflowTemplates,
  createWorkflowTemplate 
} from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const WorkflowTest = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const { organization } = useAuth();
  const { showToast } = useToast();

  const testWorkflowAccess = async () => {
    if (!organization?.id) {
      showToast('Error', 'No organization found', 'error');
      return;
    }

    setLoading(true);
    try {
      console.log('Testing workflow template access...');
      
      // Test reading templates
      const existingTemplates = await getWorkflowTemplates(organization.id);
      console.log('Existing templates:', existingTemplates);
      setTemplates(existingTemplates);
      
      if (existingTemplates.length === 0) {
        console.log('No templates found, initializing defaults...');
        const newTemplates = await initializeDefaultWorkflowTemplates(organization.id);
        console.log('Created templates:', newTemplates);
        setTemplates(newTemplates);
        showToast('Success', `Created ${newTemplates.length} default workflow templates`, 'success');
      } else {
        showToast('Success', `Found ${existingTemplates.length} existing templates`, 'success');
      }
      
    } catch (error) {
      console.error('Workflow test error:', error);
      showToast('Error', `Workflow test failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px',
      backgroundColor: '#f9fafb',
      margin: '1rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0' }}>Workflow System Test</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={testWorkflowAccess}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Workflow Access'}
        </button>
      </div>

      <div>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Templates Found: {templates.length}</h4>
        {templates.map(template => (
          <div key={template.id} style={{
            padding: '0.5rem',
            backgroundColor: 'white',
            borderRadius: '4px',
            marginBottom: '0.5rem',
            fontSize: '0.875rem'
          }}>
            <strong>{template.name}</strong> - {template.steps?.length || 0} steps
            {template.sessionTypes && (
              <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                ({template.sessionTypes.join(', ')})
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: '1rem', 
        padding: '0.75rem',
        backgroundColor: '#fef3c7',
        borderRadius: '4px',
        fontSize: '0.75rem'
      }}>
        <strong>Note:</strong> If you see permission errors, the Firestore rules need to be deployed. 
        Run: <code>firebase deploy --only firestore:rules</code>
      </div>
    </div>
  );
};

export default WorkflowTest;