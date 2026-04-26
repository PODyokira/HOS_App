import React, { useState } from 'react';
import axios from 'axios';
import { TripPlan, TripFormData } from './types/hos';
import { TripForm } from './components/TripForm';
import { SummaryPanel } from './components/SummaryPanel';
import { MapView } from './components/MapView';
import { ELDLogsViewer } from './components/ELDLogsViewer';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Tab = 'map' | 'logs';

function App() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('map');

  const handleSubmit = async (formData: TripFormData) => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await axios.post(`${API_URL}/api/trips/plan/`, formData);
      setPlan(res.data);
      setActiveTab('map');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🚛</span>
            <div>
              <span className="font-display logo-text">TRUCKLOG</span>
              <span className="logo-sub font-mono">PRO</span>
            </div>
          </div>
          <div className="header-tags">
            <span className="tag">FMCSA Compliant</span>
            <span className="tag tag-red">70-Hr / 8-Day</span>
            <span className="tag">ELD Log Generator</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="form-section">
          <TripForm onSubmit={handleSubmit} loading={loading} />
        </section>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
            <button className="error-close" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {plan && (
          <section className="results-section">
            <SummaryPanel plan={plan} />
            <div className="results-tabs">
              <button className={`results-tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                🗺 Route Map
              </button>
              <button className={`results-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                📋 ELD Log Sheets ({plan.daily_logs.length})
              </button>
            </div>
            <div className="tab-content">
              {activeTab === 'map' && <MapView plan={plan} />}
              {activeTab === 'logs' && <ELDLogsViewer plan={plan} />}
            </div>
          </section>
        )}

        {!plan && !loading && !error && (
          <div className="empty-state">
            <div className="empty-graphic">
              <div className="road-line" />
              <span className="empty-truck">🚛</span>
              <div className="road-line" />
            </div>
            <p className="empty-title font-display">READY TO ROLL</p>
            <p className="empty-sub">Enter trip details above to generate a fully compliant ELD log and route plan.</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span className="font-mono">TRUCKLOG PRO</span>
        <span>·</span>
        <span>FMCSA 49 CFR Part 395 Compliant</span>
        <span>·</span>
        <span>70-Hour / 8-Day Property Carrier</span>
      </footer>
    </div>
  );
}

export default App;
