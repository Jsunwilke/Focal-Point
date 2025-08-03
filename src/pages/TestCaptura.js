// Test page for Captura API endpoints
import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const TestCaptura = () => {
  const [results, setResults] = useState(null);
  const [simpleResult, setSimpleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testEndpoints = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const testFunction = httpsCallable(functions, 'testCapturaEndpoints');
      const result = await testFunction();
      setResults(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testSimple = async () => {
    setLoading(true);
    setError(null);
    setSimpleResult(null);

    try {
      const simpleFunction = httpsCallable(functions, 'getCapturaOrdersSimple');
      const result = await simpleFunction();
      setSimpleResult(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Test Captura API Endpoints</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={testSimple} 
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Simple (No Params)'}
        </button>

        <button 
          onClick={testEndpoints} 
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test All Endpoints'}
        </button>
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          padding: '1rem', 
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#721c24'
        }}>
          Error: {error}
        </div>
      )}

      {simpleResult && (
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h2>Simple Test Result (No Parameters)</h2>
          <p><strong>Success:</strong> {simpleResult.success ? 'Yes' : 'No'}</p>
          <p><strong>URL:</strong> <code>{simpleResult.url}</code></p>
          <p><strong>Status:</strong> {simpleResult.status || 'N/A'}</p>
          {simpleResult.error && (
            <p><strong>Error:</strong> {simpleResult.error}</p>
          )}
          {simpleResult.success && (
            <div>
              <p><strong>Response Preview:</strong></p>
              <pre style={{ backgroundColor: 'white', padding: '0.5rem', overflow: 'auto' }}>
                {JSON.stringify(simpleResult.data, null, 2).slice(0, 500)}...
              </pre>
            </div>
          )}
        </div>
      )}

      {results && (
        <div>
          <h2>Test Results</h2>
          <p><strong>Token Status:</strong> {results.token}</p>
          
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            marginTop: '1rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Endpoint</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.results?.map((result, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{result.endpoint}</td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: result.success ? 'green' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {result.status || 'Failed'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {result.success ? '✓ Success' : `✗ ${result.error}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h3>Next Steps:</h3>
            <p>Look for endpoints that return status 200. Those are the correct API endpoints to use.</p>
            <p>If all endpoints fail with 404, the API might require:</p>
            <ul>
              <li>Different URL structure</li>
              <li>Additional headers</li>
              <li>Different authentication method</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCaptura;