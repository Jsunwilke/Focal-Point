import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SDCardTab from '../components/tracking/SDCardTab';
import JobBoxTab from '../components/tracking/JobBoxTab';
import './Tracking.css';

const Tracking = () => {
  const [activeTab, setActiveTab] = useState('sdcards');
  const { userProfile } = useAuth();

  if (!userProfile?.organizationID) {
    return (
      <div className="tracking-loading">
        <p>Loading tracking data...</p>
      </div>
    );
  }

  return (
    <div className="tracking-container">
      <div className="tracking-header">
        <h1>Tracking</h1>
        <p>Track SD cards and job boxes throughout your workflow</p>
      </div>

      <div className="tracking-tabs">
        <button
          className={`tracking-tab ${activeTab === 'sdcards' ? 'active' : ''}`}
          onClick={() => setActiveTab('sdcards')}
        >
          SD Cards
        </button>
        <button
          className={`tracking-tab ${activeTab === 'jobboxes' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobboxes')}
        >
          Job Boxes
        </button>
      </div>

      <div className="tracking-content">
        {activeTab === 'sdcards' && (
          <SDCardTab organizationID={userProfile.organizationID} />
        )}
        {activeTab === 'jobboxes' && (
          <JobBoxTab organizationID={userProfile.organizationID} />
        )}
      </div>
    </div>
  );
};

export default Tracking;