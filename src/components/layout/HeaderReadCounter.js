import React, { useState, useEffect, useRef } from 'react';
import { Database, ChevronDown, RotateCcw, Download, Eye, DollarSign, Activity } from 'lucide-react';
import readCounter from '../../services/readCounter';
import './HeaderReadCounter.css';

const HeaderReadCounter = () => {
  const [stats, setStats] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get initial stats
    setStats(readCounter.getStats());

    // Subscribe to real-time updates
    const unsubscribe = readCounter.subscribe((updatedStats) => {
      setStats(updatedStats);
    });

    return unsubscribe;
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  if (!stats || !readCounter.isEnabled) {
    return null;
  }

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCost = (cost) => {
    if (cost < 0.01) {
      return '<$0.01';
    }
    return '$' + cost.toFixed(2);
  };

  const getCostColor = (cost) => {
    if (cost < 1) return 'green';
    if (cost < 5) return 'orange';
    return 'red';
  };

  const handleResetSession = () => {
    if (window.confirm('Reset session read counter?')) {
      readCounter.resetSession();
    }
  };

  const handleResetDaily = () => {
    if (window.confirm('Reset today\'s read counter? This will clear all reads for today.')) {
      readCounter.resetDaily();
    }
  };

  const handleExport = () => {
    readCounter.exportData();
  };

  const toggleExpanded = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="header-read-counter" ref={dropdownRef}>
      <button 
        className="header-read-counter__trigger"
        onClick={toggleExpanded}
        title="Firebase Read Counter"
      >
        <Database size={16} className="header-read-counter__icon" />
        <span className="header-read-counter__values">
          <span className="header-read-counter__session">{formatNumber(stats.session.total)}</span>
          <span className="header-read-counter__separator">|</span>
          <span className="header-read-counter__daily">{formatNumber(stats.daily.total)}</span>
          <span className="header-read-counter__separator">|</span>
          <span 
            className={`header-read-counter__cost header-read-counter__cost--${getCostColor(stats.session.cost)}`}
          >
            {formatCost(stats.session.cost)}
          </span>
        </span>
        <ChevronDown 
          size={14} 
          className={`header-read-counter__chevron ${isExpanded ? 'header-read-counter__chevron--expanded' : ''}`} 
        />
      </button>

      {isExpanded && (
        <div className="header-read-counter__dropdown">
          <div className="header-read-counter__stats">
            <div className="header-read-counter__stat-row">
              <span className="header-read-counter__stat-label">Session:</span>
              <span className="header-read-counter__stat-value">
                {formatNumber(stats.session.total)} reads ({formatCost(stats.session.cost)})
              </span>
            </div>
            <div className="header-read-counter__stat-row">
              <span className="header-read-counter__stat-label">Today:</span>
              <span className="header-read-counter__stat-value">
                {formatNumber(stats.daily.total)} reads ({formatCost(stats.daily.cost)})
              </span>
            </div>
            
            {stats.cache && (stats.cache.session.hits > 0 || stats.cache.session.misses > 0) && (
              <>
                <div className="header-read-counter__stat-row">
                  <span className="header-read-counter__stat-label">Cache Hit Rate:</span>
                  <span className="header-read-counter__stat-value">
                    {stats.cache.session.hitRate.toFixed(1)}%
                  </span>
                </div>
                <div className="header-read-counter__stat-row">
                  <span className="header-read-counter__stat-label">Cache Savings:</span>
                  <span className="header-read-counter__stat-value">
                    {formatCost(stats.cache.session.savingsCost)}
                  </span>
                </div>
              </>
            )}

            <div className="header-read-counter__stat-row">
              <span className="header-read-counter__stat-label">Projected Monthly:</span>
              <span className="header-read-counter__stat-value">
                {formatCost(stats.projections.projectedMonthlyCost)}
              </span>
            </div>
          </div>

          {showDetails && (
            <div className="header-read-counter__details">
              <div className="header-read-counter__detail-section">
                <h5>Session Performance</h5>
                <div className="header-read-counter__metrics">
                  <div className="header-read-counter__metric">
                    <Activity size={12} />
                    <span>{stats.session.readsPerSecond.toFixed(2)} reads/sec</span>
                  </div>
                  <div className="header-read-counter__metric">
                    <span>{stats.listeners.active} active listeners</span>
                  </div>
                </div>
              </div>

              <div className="header-read-counter__detail-section">
                <h5>Top 10 Collections (Session)</h5>
                {Object.entries(stats.session.byCollection)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([collection, count]) => (
                    <div key={collection} className="header-read-counter__collection">
                      <span className="header-read-counter__collection-name">{collection}</span>
                      <span className="header-read-counter__collection-count">{formatNumber(count)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          <div className="header-read-counter__controls">
            <button 
              className="header-read-counter__btn header-read-counter__btn--secondary"
              onClick={() => setShowDetails(!showDetails)}
              title="Toggle detailed statistics"
            >
              <Eye size={12} />
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <button 
              className="header-read-counter__btn header-read-counter__btn--secondary"
              onClick={handleResetSession}
              title="Reset session counter"
            >
              <RotateCcw size={12} />
              Reset Session
            </button>
            <button 
              className="header-read-counter__btn header-read-counter__btn--danger"
              onClick={handleResetDaily}
              title="Reset today's counter"
            >
              <RotateCcw size={12} />
              Reset Daily
            </button>
            <button 
              className="header-read-counter__btn header-read-counter__btn--secondary"
              onClick={handleExport}
              title="Export data to CSV"
            >
              <Download size={12} />
              Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderReadCounter;