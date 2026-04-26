import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TripPlan, Waypoint } from '../types/hos';

// Fix for default marker icons in Leaflet with build tools
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetina,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  plan: TripPlan;
}

const ICON_MAP: Record<string, { color: string; emoji: string }> = {
  start:   { color: '#3B82F6', emoji: '🚛' },
  pickup:  { color: '#22C55E', emoji: '📦' },
  dropoff: { color: '#E02020', emoji: '🏁' },
  rest:    { color: '#F59E0B', emoji: '😴' },
  fuel:    { color: '#A855F7', emoji: '⛽' },
};

// Component to auto-fit bounds when plan changes
const BoundsUpdater: React.FC<{ plan: TripPlan }> = ({ plan }) => {
  const map = useMap();
  React.useEffect(() => {
    const { current_coords, pickup_coords, dropoff_coords, waypoints } = plan.route;
    const allPoints: [number, number][] = [
      [current_coords.lat, current_coords.lng],
      [pickup_coords.lat, pickup_coords.lng],
      [dropoff_coords.lat, dropoff_coords.lng],
      ...waypoints.map((w: Waypoint) => [w.lat, w.lng] as [number, number]),
    ];
    
    if (allPoints.length > 0) {
      map.fitBounds(allPoints, { padding: [50, 50] });
    }
  }, [plan, map]);
  return null;
};

export const MapView: React.FC<Props> = ({ plan }) => {
  const { current_coords, pickup_coords, dropoff_coords, waypoints } = plan.route;

  const renderMarker = (wp: Waypoint, idx: number) => {
    const info = ICON_MAP[wp.type] || ICON_MAP.rest;
    const isMajor = ['start', 'pickup', 'dropoff'].includes(wp.type);
    
    const icon = L.divIcon({
      html: `
        <div style="
          background: ${info.color};
          border: 2px solid white;
          border-radius: ${isMajor ? '6px' : '50%'};
          width: ${isMajor ? '36px' : '28px'};
          height: ${isMajor ? '36px' : '28px'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isMajor ? '18px' : '14px'};
          box-shadow: 0 0 12px ${info.color}88;
        ">${info.emoji}</div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const timeStr = wp.time ? new Date(wp.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    const durationStr = wp.duration_hours ? ` · ${wp.duration_hours}h rest` : '';

    return (
      <Marker key={`${wp.type}-${idx}`} position={[wp.lat, wp.lng]} icon={icon}>
        <Popup>
          <div style={{ fontFamily: 'monospace', color: '#111', minWidth: '180px' }}>
            <b style={{ color: info.color, fontSize: '13px' }}>{info.emoji} {wp.label.toUpperCase()}</b><br/>
            <span style={{ fontSize: '12px' }}>{wp.location}</span><br/>
            {timeStr && <span style={{ color: '#666', fontSize: '11px' }}>{timeStr}{durationStr}</span>}
            {wp.notes && <><br/><span style={{ color: '#555', fontSize: '11px' }}>{wp.notes}</span></>}
          </div>
        </Popup>
      </Marker>
    );
  };

  return (
    <div className="map-container">
      <div className="panel-header">
        <h3 className="font-display panel-title">ROUTE MAP</h3>
        <div className="map-legend">
          {Object.entries(ICON_MAP).map(([type, info]) => (
            <span key={type} className="legend-item">
              <span>{info.emoji}</span>
              <span className="legend-label">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </span>
          ))}
        </div>
      </div>
      
      <div className="leaflet-map">
        <MapContainer 
          center={[current_coords.lat, current_coords.lng]} 
          zoom={5} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <BoundsUpdater plan={plan} />

          {/* Empty Leg: Current -> Pickup */}
          <Polyline 
            positions={[[current_coords.lat, current_coords.lng], [pickup_coords.lat, pickup_coords.lng]]}
            pathOptions={{ color: '#3B82F6', weight: 3, opacity: 0.7, dashArray: '8,4' }}
          />

          {/* Loaded Leg: Pickup -> Dropoff */}
          <Polyline 
            positions={[[pickup_coords.lat, pickup_coords.lng], [dropoff_coords.lat, dropoff_coords.lng]]}
            pathOptions={{ color: '#E02020', weight: 3, opacity: 0.8 }}
          />

          {/* Markers */}
          {waypoints.map((wp, idx) => renderMarker(wp, idx))}
        </MapContainer>
      </div>
    </div>
  );
};
