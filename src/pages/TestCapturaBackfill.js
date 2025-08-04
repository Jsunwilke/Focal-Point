// src/pages/TestCapturaBackfill.js
import React, { useState } from 'react';
import { functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { Calendar, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const TestCapturaBackfill = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleBackfill = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const backfillFunction = httpsCallable(functions, 'backfillHistoricalData');
      const response = await backfillFunction({ startDate, endDate });
      
      setResult(response.data);
    } catch (error) {
      console.error('Backfill error:', error);
      setError(error.message || 'Failed to run backfill');
    } finally {
      setLoading(false);
    }
  };

  // Set default dates for last 7 days
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Captura Stats Backfill Test</h1>
      
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <p style={{ marginBottom: '16px' }}>
          Use this tool to backfill historical order data from Captura. 
          This will fetch orders for the selected date range and store them for statistics.
        </p>
        
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
        
        <button
          onClick={handleBackfill}
          disabled={loading || !startDate || !endDate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: loading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Running Backfill...
            </>
          ) : (
            <>
              <Calendar size={16} />
              Run Backfill
            </>
          )}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {result && (
        <div style={{
          padding: '16px',
          background: '#d4edda',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            Backfill Complete!
          </h3>
          
          <h4>Results by Date:</h4>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '4px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {result.results?.map((dayResult, index) => (
              <div key={index} style={{
                padding: '8px',
                borderBottom: '1px solid #e9ecef',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>{dayResult.date}</span>
                <span style={{
                  color: dayResult.status === 'completed' ? '#28a745' : 
                         dayResult.status === 'skipped' ? '#ffc107' : '#dc3545'
                }}>
                  {dayResult.status === 'completed' 
                    ? `✓ ${dayResult.orders} orders`
                    : dayResult.status === 'skipped'
                    ? `⚠ ${dayResult.reason}`
                    : `✗ ${dayResult.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default TestCapturaBackfill;