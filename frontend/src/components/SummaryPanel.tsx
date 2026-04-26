import React from 'react';
import { TripPlan } from '../types/hos';

interface Props {
  plan: TripPlan;
}

const Stat: React.FC<{ label: string; value: string | number; accent?: boolean; icon?: string }> = ({ label, value, accent, icon }) => (
  <div className={`stat-card ${accent ? 'stat-accent' : ''}`}>
    {icon && <div className="stat-icon">{icon}</div>}
    <div className="stat-value font-mono">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const HOSMeter: React.FC<{ used: number; total: number; label: string }> = ({ used, total, label }) => {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 90 ? '#E02020' : pct > 70 ? '#F59E0B' : '#22C55E';
  return (
    <div className="hos-meter">
      <div className="hos-meter-header">
        <span className="hos-meter-label">{label}</span>
        <span className="hos-meter-value font-mono">{used.toFixed(1)}h / {total}h</span>
      </div>
      <div className="hos-meter-track">
        <div className="hos-meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

export const SummaryPanel: React.FC<Props> = ({ plan }) => {
  const { summary } = plan;
  const tripDays = Math.ceil(summary.total_trip_hours / 24);

  return (
    <div className="summary-panel">
      <div className="panel-header">
        <h3 className="font-display panel-title">TRIP SUMMARY</h3>
        <div className="trip-route-badge">
          <span>{summary.current_location}</span>
          <span className="route-arrow">→</span>
          <span>{summary.pickup_location}</span>
          <span className="route-arrow">→</span>
          <span>{summary.dropoff_location}</span>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon="🛣️" label="Total Distance" value={`${summary.total_distance_miles.toLocaleString()} mi`} accent />
        <Stat icon="📅" label="Trip Duration" value={`${tripDays} day${tripDays !== 1 ? 's' : ''}`} />
        <Stat icon="🚗" label="Driving Hours" value={`${summary.total_driving_hours.toFixed(1)}h`} />
        <Stat icon="⏰" label="Total On-Duty" value={`${summary.total_on_duty_hours.toFixed(1)}h`} />
        <Stat icon="📋" label="Log Sheets" value={summary.num_days} />
        <Stat icon="⛽" label="Fuel Stops" value={summary.fuel_stops} />
      </div>

      <div className="hos-meters">
        <HOSMeter
          label="70-Hr Cycle (Start)"
          used={summary.cycle_hours_used_start}
          total={70}
        />
        <HOSMeter
          label="70-Hr Cycle (End of Trip)"
          used={summary.cycle_hours_used_end}
          total={70}
        />
      </div>

      <div className="assumptions-box">
        <div className="assumptions-title font-mono">⚡ HOS ASSUMPTIONS APPLIED</div>
        <div className="assumptions-grid">
          <div className="assumption-item">✓ 70hr/8-day cycle</div>
          <div className="assumption-item">✓ 11-hr driving limit</div>
          <div className="assumption-item">✓ 14-hr driving window</div>
          <div className="assumption-item">✓ 10-hr mandatory rest</div>
          <div className="assumption-item">✓ 30-min break / 8hrs</div>
          <div className="assumption-item">✓ 1-hr pickup & dropoff</div>
          <div className="assumption-item">✓ Fuel every 1,000 mi</div>
          <div className="assumption-item">✓ 55 mph avg speed</div>
        </div>
      </div>
    </div>
  );
};
