import React, { useState, useRef } from 'react';
import { TripPlan } from '../types/hos';
import { ELDLogCanvas } from './ELDLogCanvas';

interface Props {
  plan: TripPlan;
}

export const ELDLogsViewer: React.FC<Props> = ({ plan }) => {
  const [activeDay, setActiveDay] = useState(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const logs = plan.daily_logs;
  const currentLog = logs[activeDay];

  const downloadLog = () => {
    const canvas = canvasContainerRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `ELD-Log-Day-${activeDay + 1}-${currentLog.date.replace(/\//g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadAll = async () => {
    // Create a combined download of all logs
    for (let i = 0; i < logs.length; i++) {
      setActiveDay(i);
      await new Promise(r => setTimeout(r, 200));
      const canvas = canvasContainerRef.current?.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) continue;
      const link = document.createElement('a');
      link.download = `ELD-Log-Day-${i + 1}-${logs[i].date.replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      await new Promise(r => setTimeout(r, 100));
    }
  };

  return (
    <div className="eld-viewer">
      <div className="panel-header">
        <h3 className="font-display panel-title">DRIVER'S DAILY LOG SHEETS</h3>
        <div className="eld-actions">
          <button className="action-btn" onClick={downloadLog}>
            ⬇ Download Day {activeDay + 1}
          </button>
          <button className="action-btn action-btn-primary" onClick={downloadAll}>
            ⬇ Download All ({logs.length})
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="day-tabs">
        {logs.map((log, i) => (
          <button
            key={i}
            className={`day-tab ${i === activeDay ? 'active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            <span className="day-tab-num font-mono">Day {log.day_number}</span>
            <span className="day-tab-date">{log.date}</span>
            <span className="day-tab-miles font-mono">{log.total_miles.toFixed(0)} mi</span>
          </button>
        ))}
      </div>

      {/* Log canvas */}
      <div ref={canvasContainerRef} className="canvas-container">
        {currentLog && (
          <ELDLogCanvas
            key={`log-${activeDay}`}
            log={currentLog}
            dayNumber={currentLog.day_number}
            summary={{
              current_location: plan.summary.current_location,
              pickup_location: plan.summary.pickup_location,
              dropoff_location: plan.summary.dropoff_location,
            }}
          />
        )}
      </div>

      {/* Color legend */}
      <div className="log-legend">
        {[
          { color: '#3B82F6', label: 'Off Duty' },
          { color: '#8B5CF6', label: 'Sleeper Berth' },
          { color: '#E02020', label: 'Driving' },
          { color: '#F59E0B', label: 'On Duty (Not Driving)' },
        ].map(item => (
          <div key={item.label} className="legend-item">
            <div className="legend-swatch" style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Event timeline for this day */}
      <div className="day-events">
        <h4 className="events-title font-mono">DAY {currentLog?.day_number} EVENT LOG</h4>
        <div className="events-list">
          {currentLog?.events.map((evt, i) => {
            const colors: Record<string, string> = {
              OFF_DUTY: '#3B82F6', SLEEPER_BERTH: '#8B5CF6',
              DRIVING: '#E02020', ON_DUTY_NOT_DRIVING: '#F59E0B',
            };
            const icons: Record<string, string> = {
              OFF_DUTY: '💤', SLEEPER_BERTH: '🛌', DRIVING: '🚛', ON_DUTY_NOT_DRIVING: '📋',
            };
            const fmtH = (h: number) => {
              const hr = Math.floor(h) % 24;
              const min = Math.round((h % 1) * 60);
              const ampm = hr < 12 ? 'AM' : 'PM';
              return `${hr % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`;
            };
            return (
              <div key={i} className="event-row" style={{ borderLeftColor: colors[evt.status] }}>
                <span className="event-icon">{icons[evt.status]}</span>
                <div className="event-info">
                  <span className="event-status font-mono" style={{ color: colors[evt.status] }}>
                    {evt.status.replace(/_/g, ' ')}
                  </span>
                  <span className="event-time font-mono">{fmtH(evt.start_hour)} → {fmtH(evt.end_hour)}</span>
                  <span className="event-dur">{evt.duration.toFixed(2)}h</span>
                </div>
                <div className="event-location">{evt.location}</div>
                {evt.notes && <div className="event-notes">{evt.notes}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
