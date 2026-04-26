import React, { useEffect, useRef, useCallback, useState } from 'react';
import { DailyLog, DutyStatus } from '../types/hos';

interface Props {
  log: DailyLog;
  dayNumber: number;
  summary: {
    current_location: string;
    pickup_location: string;
    dropoff_location: string;
  };
}

const STATUS_ROW: Record<DutyStatus, number> = {
  OFF_DUTY: 0,
  SLEEPER_BERTH: 1,
  DRIVING: 2,
  ON_DUTY_NOT_DRIVING: 3,
};

const STATUS_COLOR: Record<DutyStatus, string> = {
  OFF_DUTY: '#2563EB',
  SLEEPER_BERTH: '#7C3AED',
  DRIVING: '#DC2626',
  ON_DUTY_NOT_DRIVING: '#D97706',
};

export const ELDLogCanvas: React.FC<Props> = ({ log, dayNumber, summary }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Load the background image
  useEffect(() => {
    const img = new Image();
    img.src = '/blank-paper-log.png';
    img.onload = () => setBgImage(img);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale factor for high resolution drawing
    const SCALE = 1000 / bgImage.naturalWidth;
    const W = 1000;
    const H = bgImage.naturalHeight * SCALE;
    canvas.width = W;
    canvas.height = H;
    ctx.scale(SCALE, SCALE);

    // ─── Layout Constants for the natural image size (approx 513x518) ───
    const GRID_LEFT = 64;
    const GRID_RIGHT = 455;
    const GRID_W = GRID_RIGHT - GRID_LEFT;
    const GRID_TOP = 186;
    const GRID_BOTTOM = 256;
    const GRID_H = GRID_BOTTOM - GRID_TOP;
    const ROW_H = GRID_H / 4;
    
    // ─── Background ─────────────────────────────────────────────────
    ctx.drawImage(bgImage, 0, 0, bgImage.naturalWidth, bgImage.naturalHeight);

    // ─── Header Info ────────────────────────────────────────────────
    ctx.fillStyle = '#0033aa'; // Blue ink
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'left';

    // Date (split into M/D/Y)
    const dateParts = log.date.split('/');
    if (dateParts.length === 3) {
      ctx.fillText(dateParts[0], 185, 16);
      ctx.fillText(dateParts[1], 223, 16);
      ctx.fillText(dateParts[2].slice(-2), 262, 16);
    }

    // From / To
    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.fillText(summary.current_location, 115, 43);
    ctx.fillText(summary.dropoff_location, 315, 43);

    // Miles (Inside the boxes)
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(log.total_miles.toFixed(0), 95, 80);
    ctx.fillText(log.total_miles.toFixed(0), 180, 80);

    // Carrier & Info
    ctx.textAlign = 'left';
    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.fillText('TruckLogPro Inc.', 240, 70);
    ctx.fillText('1234 Logistics Ave, USA', 240, 95);
    ctx.fillText('Main Terminal, USA', 240, 115);
    
    // Truck Numbers
    ctx.fillText(`TRK-${String(dayNumber).padStart(3, '0')}`, 115, 115);

    // ─── Duty Status Lines ──────────────────────────────────────────
    if (log.events.length > 0) {
      const sortedEvents = [...log.events].sort((a, b) => a.start_hour - b.start_hour);

      // 1. Colored bands
      sortedEvents.forEach(evt => {
        const row = STATUS_ROW[evt.status as DutyStatus];
        const x1 = GRID_LEFT + (evt.start_hour / 24) * GRID_W;
        const x2 = GRID_LEFT + (evt.end_hour / 24) * GRID_W;
        const y = GRID_TOP + row * ROW_H;
        ctx.fillStyle = STATUS_COLOR[evt.status as DutyStatus] + '22';
        ctx.fillRect(x1, y + 1, x2 - x1, ROW_H - 1);
      });

      // 2. The continuous red line
      ctx.strokeStyle = '#E11D48';
      ctx.lineWidth = 2;
      ctx.beginPath();

      let prevRow = STATUS_ROW[sortedEvents[0].status as DutyStatus];
      let startX = GRID_LEFT + (sortedEvents[0].start_hour / 24) * GRID_W;
      let startY = GRID_TOP + prevRow * ROW_H + ROW_H / 2;

      ctx.moveTo(startX, startY);

      sortedEvents.forEach((evt, idx) => {
        const row = STATUS_ROW[evt.status as DutyStatus];
        const x1 = GRID_LEFT + (evt.start_hour / 24) * GRID_W;
        const x2 = GRID_LEFT + (Math.min(evt.end_hour, 24) / 24) * GRID_W;
        const lineY = GRID_TOP + row * ROW_H + ROW_H / 2;

        if (idx > 0) {
          const prevLineY = GRID_TOP + prevRow * ROW_H + ROW_H / 2;
          ctx.lineTo(x1, prevLineY);
          ctx.lineTo(x1, lineY);
        }

        ctx.lineTo(x2, lineY);
        prevRow = row;
      });

      ctx.stroke();

      // 3. Status change dots
      ctx.fillStyle = '#E11D48';
      sortedEvents.forEach((evt) => {
        const row = STATUS_ROW[evt.status as DutyStatus];
        const x = GRID_LEFT + (evt.start_hour / 24) * GRID_W;
        const y = GRID_TOP + row * ROW_H + ROW_H / 2;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // ─── Total Hours Column ─────────────────────────────────────────
      const totalsX = 492;
      const statusOrder: DutyStatus[] = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING'];
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'right';
      statusOrder.forEach((s, i) => {
        const y = GRID_TOP + i * ROW_H + ROW_H / 2 + 4;
        const hrs = log.totals[s] || 0;
        ctx.fillStyle = hrs > 0 ? '#0033aa' : '#999';
        ctx.fillText(hrs.toFixed(1), totalsX, y);
      });

      // Total sum at the bottom of the column
      ctx.fillStyle = '#0033aa';
      ctx.fillText(log.total_hours.toFixed(1), totalsX, GRID_BOTTOM + 24);
    }

    // ─── Remarks ────────────────────────────────────────────────────
    const REMARKS_X = 110;
    const REMARKS_START_Y = 290;
    ctx.textAlign = 'left';
    ctx.font = '7.5px "Courier New", monospace';
    
    log.remarks.slice(0, 8).forEach((remark, i) => {
      const ry = REMARKS_START_Y + i * 10.5;
      ctx.fillStyle = '#0033aa';
      ctx.fillText(`${remark.time} - ${remark.status.replace(/_/g, ' ')}: ${remark.location}`, REMARKS_X, ry);
    });

    // ─── Certification Recap ────────────────────────────────────────
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    const onDutyToday = log.totals.DRIVING + log.totals.ON_DUTY_NOT_DRIVING;
    ctx.fillText(onDutyToday.toFixed(1), 85, 445);
    
  }, [log, dayNumber, summary, bgImage]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="eld-log-wrapper">
      <div className="log-canvas-container" style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <canvas
          ref={canvasRef}
          className="eld-canvas"
          style={{ 
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
            borderRadius: '4px',
            backgroundColor: '#fff',
            display: 'block',
            margin: '0 auto'
          }}
        />
      </div>
    </div>
  );
};
