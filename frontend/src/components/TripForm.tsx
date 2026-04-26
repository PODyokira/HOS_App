import React, { useState } from 'react';
import { TripFormData } from '../types/hos';

interface Props {
  onSubmit: (data: TripFormData) => void;
  loading: boolean;
}

const EXAMPLE_TRIPS = [
  { label: 'NYC → ATL → MIA', current: 'New York', pickup: 'Atlanta', dropoff: 'Miami', hours: 0 },
  { label: 'CHI → DAL → LA', current: 'Chicago', pickup: 'Dallas', dropoff: 'Los Angeles', hours: 20 },
  { label: 'SEA → DEN → HOU', current: 'Seattle', pickup: 'Denver', dropoff: 'Houston', hours: 35 },
  { label: 'SF → LA → SD', current: 'San Francisco', pickup: 'Los Angeles', dropoff: 'San Diego', hours: 5 },
  { label: 'PHX → ABQ → OKC', current: 'Phoenix', pickup: 'Albuquerque', dropoff: 'Oklahoma City', hours: 12 },
  { label: 'BOS → PROV → NEWH', current: 'Boston', pickup: 'Providence', dropoff: 'New Haven', hours: 0 },
];

export const TripForm: React.FC<Props> = ({ onSubmit, loading }) => {
  const [form, setForm] = useState<TripFormData>({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    cycle_hours_used: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'cycle_hours_used' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current_location || !form.pickup_location || !form.dropoff_location) return;
    onSubmit(form);
  };

  const loadExample = (ex: typeof EXAMPLE_TRIPS[0]) => {
    setForm({
      current_location: ex.current,
      pickup_location: ex.pickup,
      dropoff_location: ex.dropoff,
      cycle_hours_used: ex.hours,
    });
  };

  return (
    <div className="trip-form-card">
      <div className="form-header">
        <div className="form-icon">🚛</div>
        <div>
          <h2 className="font-display form-title">PLAN YOUR TRIP</h2>
          <p className="form-subtitle">70-Hour / 8-Day Cycle · FMCSA Compliant</p>
        </div>
      </div>

      <div className="example-pills">
        <span className="example-label">Quick fill:</span>
        {EXAMPLE_TRIPS.map(ex => (
          <button key={ex.label} className="example-pill" onClick={() => loadExample(ex)} type="button">
            {ex.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="trip-form">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">📍</span> Current Location
            </label>
            <input
              name="current_location"
              value={form.current_location}
              onChange={handleChange}
              placeholder="e.g. Chicago"
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">📦</span> Pickup Location
            </label>
            <input
              name="pickup_location"
              value={form.pickup_location}
              onChange={handleChange}
              placeholder="e.g. Dallas"
              className="form-input"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">🏁</span> Dropoff Location
            </label>
            <input
              name="dropoff_location"
              value={form.dropoff_location}
              onChange={handleChange}
              placeholder="e.g. Los Angeles"
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">⏱</span> Current Cycle Used (hrs)
            </label>
            <input
              name="cycle_hours_used"
              type="number"
              min={0}
              max={70}
              step={0.5}
              value={form.cycle_hours_used}
              onChange={handleChange}
              className="form-input"
            />
            <div className="cycle-bar-wrap">
              <div
                className="cycle-bar-fill"
                style={{ width: `${(form.cycle_hours_used / 70) * 100}%` }}
              />
              <span className="cycle-bar-label font-mono">
                {form.cycle_hours_used}h / 70h
              </span>
            </div>
          </div>
        </div>

        <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
          {loading ? (
            <><span className="spinner" /> CALCULATING ROUTE...</>
          ) : (
            <><span>GENERATE ELD LOG</span> <span className="btn-arrow">→</span></>
          )}
        </button>
      </form>
    </div>
  );
};
