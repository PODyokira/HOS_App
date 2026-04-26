export type DutyStatus = 'OFF_DUTY' | 'SLEEPER_BERTH' | 'DRIVING' | 'ON_DUTY_NOT_DRIVING';

export interface HOSEvent {
  status: DutyStatus;
  start_time: string;
  end_time: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  location: string;
  notes: string;
  miles_driven: number;
}

export interface DayLogEvent {
  status: DutyStatus;
  start_hour: number;
  end_hour: number;
  duration: number;
  location: string;
  notes: string;
  miles_driven: number;
}

export interface Remark {
  time: string;
  time_24: number;
  status: DutyStatus;
  location: string;
  notes: string;
}

export interface DailyLog {
  day_number: number;
  date: string;
  events: DayLogEvent[];
  totals: Record<DutyStatus, number>;
  total_hours: number;
  total_miles: number;
  remarks: Remark[];
  has_activity: boolean;
}

export interface Coords {
  lat: number;
  lng: number;
  name: string;
}

export interface Waypoint {
  type: 'start' | 'pickup' | 'dropoff' | 'rest' | 'fuel';
  label: string;
  location: string;
  lat: number;
  lng: number;
  time?: string;
  duration_hours?: number;
  notes?: string;
}

export interface TripSummary {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  total_distance_miles: number;
  distance_to_pickup_miles: number;
  distance_pickup_to_dropoff_miles: number;
  total_driving_hours: number;
  total_on_duty_hours: number;
  total_trip_hours: number;
  num_days: number;
  cycle_hours_used_start: number;
  cycle_hours_used_end: number;
  start_time: string;
  end_time: string;
  fuel_stops: number;
}

export interface TripPlan {
  trip_id: number;
  summary: TripSummary;
  events: HOSEvent[];
  daily_logs: DailyLog[];
  route: {
    waypoints: Waypoint[];
    current_coords: Coords;
    pickup_coords: Coords;
    dropoff_coords: Coords;
  };
}

export interface TripFormData {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_hours_used: number;
}
