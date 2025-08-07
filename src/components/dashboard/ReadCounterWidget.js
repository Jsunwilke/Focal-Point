import React, { useState, useEffect } from 'react';
import { Activity, Database, DollarSign, TrendingDown, TrendingUp, Download, RotateCcw } from 'lucide-react';
import readCounter from '../../services/readCounter';
import './ReadCounterWidget.css';

const ReadCounterWidget = () => {
  const [stats, setStats] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Get initial stats
    setStats(readCounter.getStats());

    // Subscribe to real-time updates
    const unsubscribe = readCounter.subscribe((updatedStats) => {
      setStats(updatedStats);
    });

    return unsubscribe;
  }, []);

  if (!stats) {
    return (
      <div className="read-counter-widget">
        <div className="read-counter-widget__loading">
          <Activity size={20} />
          <span>Loading read counter...</span>
        </div>
      </div>
    );
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

  const formatTime = (seconds) => {
    if (seconds < 60) {
      return Math.round(seconds) + 's';
    } else if (seconds < 3600) {
      return Math.round(seconds / 60) + 'm';
    }
    return Math.round(seconds / 3600) + 'h';
  };

  const getTopCollections = (byCollection) => {
    return Object.entries(byCollection)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
  };

  const handleReset = () => {
    if (window.confirm('Reset session read counter?')) {
      readCounter.resetSession();
    }
  };

  const handleExport = () => {
    readCounter.exportData();
  };

  const toggleEnabled = () => {
    readCounter.setEnabled(!readCounter.isEnabled);
    // Force re-render by getting fresh stats
    setStats(readCounter.getStats());
  };

  // Calculate savings vs pre-optimization baseline (assuming 58M reads in 6 days)
  const baselineDaily = 58000000 / 6; // ~9.67M reads per day
  const currentDaily = stats.daily.total;
  const savingsPercent = baselineDaily > 0 ? ((baselineDaily - currentDaily) / baselineDaily * 100) : 0;
  const costSavings = (baselineDaily - currentDaily) / 100000 * 0.36;

  return (
    <div className={`read-counter-widget ${isExpanded ? 'read-counter-widget--expanded' : ''}`}>
      <div className="read-counter-widget__header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="read-counter-widget__title">
          <Database size={20} />
          <span>Firestore Reads</span>
          {!readCounter.isEnabled && <span className="read-counter-widget__disabled">(Disabled)</span>}
        </div>
        <div className="read-counter-widget__main-stats">
          <div className="read-counter-widget__stat">
            <span className="read-counter-widget__value">{formatNumber(stats.session.total)}</span>
            <span className="read-counter-widget__label">Session</span>
          </div>
          <div className="read-counter-widget__stat">
            <span className="read-counter-widget__value">{formatNumber(stats.daily.total)}</span>
            <span className="read-counter-widget__label">Today</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="read-counter-widget__content">
          {/* Performance Metrics */}
          <div className="read-counter-widget__section">
            <h4>Performance</h4>
            <div className="read-counter-widget__metrics">
              <div className="read-counter-widget__metric">
                <Activity size={16} />
                <span>{stats.session.readsPerSecond.toFixed(2)} reads/sec</span>
              </div>
              <div className="read-counter-widget__metric">
                <span>{stats.listeners.active} active listeners</span>
              </div>
              <div className="read-counter-widget__metric">
                <span>Session: {formatTime(stats.session.duration)}</span>
              </div>
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="read-counter-widget__section">
            <h4>Cost Analysis</h4>
            <div className="read-counter-widget__costs">
              <div className="read-counter-widget__cost-item">
                <DollarSign size={16} />
                <span>Session: {formatCost(stats.session.cost)}</span>
              </div>
              <div className="read-counter-widget__cost-item">
                <span>Today: {formatCost(stats.daily.cost)}</span>
              </div>
              <div className="read-counter-widget__cost-item">
                <span>Projected Monthly: {formatCost(stats.projections.projectedMonthlyCost)}</span>
              </div>
            </div>
          </div>

          {/* Cache Performance */}
          {stats.cache && (stats.cache.session.hits > 0 || stats.cache.session.misses > 0) && (
            <div className="read-counter-widget__section">
              <h4>Cache Performance</h4>
              <div className="read-counter-widget__cache">
                <div className="read-counter-widget__cache-stats">
                  <div className="read-counter-widget__metric">
                    <Database size={16} />
                    <span>Hit Rate: {stats.cache.session.hitRate.toFixed(1)}%</span>
                  </div>
                  <div className="read-counter-widget__metric">
                    <span>Hits: {stats.cache.session.hits} | Misses: {stats.cache.session.misses}</span>
                  </div>
                  <div className="read-counter-widget__metric">
                    <TrendingDown size={16} className="read-counter-widget__savings-icon" />
                    <span>Saved: {formatNumber(stats.cache.session.savings)} reads</span>
                  </div>
                  <div className="read-counter-widget__metric">
                    <DollarSign size={16} />
                    <span>Cache Savings: {formatCost(stats.cache.session.savingsCost)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Savings Indicator */}
          {savingsPercent > 0 && (
            <div className="read-counter-widget__section">
              <h4>Cost Savings</h4>
              <div className="read-counter-widget__savings">
                <div className="read-counter-widget__savings-percent">
                  <TrendingDown size={16} className="read-counter-widget__savings-icon" />
                  <span>{savingsPercent.toFixed(1)}% reduction</span>
                </div>
                <div className="read-counter-widget__savings-amount">
                  <span>Daily savings: {formatCost(costSavings)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Top Collections */}
          <div className="read-counter-widget__section">
            <h4>Top 10 Collections (Session)</h4>
            <div className="read-counter-widget__collections">
              {getTopCollections(stats.session.byCollection).map(([collection, count]) => (
                <div key={collection} className="read-counter-widget__collection">
                  <span className="read-counter-widget__collection-name">{collection}</span>
                  <span className="read-counter-widget__collection-count">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="read-counter-widget__controls">
            <button 
              className="read-counter-widget__btn read-counter-widget__btn--secondary"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <button 
              className="read-counter-widget__btn read-counter-widget__btn--secondary"
              onClick={handleReset}
            >
              <RotateCcw size={14} />
              Reset Session
            </button>
            <button 
              className="read-counter-widget__btn read-counter-widget__btn--secondary"
              onClick={handleExport}
            >
              <Download size={14} />
              Export
            </button>
          </div>

          {/* Detailed Breakdown */}
          {showDetails && (
            <div className="read-counter-widget__details">
              <div className="read-counter-widget__detail-section">
                <h5>By Operation</h5>
                {Object.entries(stats.session.byOperation).map(([operation, count]) => (
                  <div key={operation} className="read-counter-widget__detail-item">
                    <span>{operation}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                ))}
              </div>

              <div className="read-counter-widget__detail-section">
                <h5>By Component</h5>
                {Object.entries(stats.session.byComponent).slice(0, 5).map(([component, count]) => (
                  <div key={component} className="read-counter-widget__detail-item">
                    <span>{component}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                ))}
              </div>

              {stats.historical.length > 0 && (
                <div className="read-counter-widget__detail-section">
                  <h5>Recent History</h5>
                  {stats.historical.slice(-5).map((day) => (
                    <div key={day.date} className="read-counter-widget__detail-item">
                      <span>{day.date}</span>
                      <span>{formatNumber(day.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReadCounterWidget;