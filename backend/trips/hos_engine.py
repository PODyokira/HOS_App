"""
FMCSA Hours of Service Engine
Property-carrying CMV, 70hr/8-day cycle
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any
from datetime import datetime, timedelta
import math


# HOS Constants
DRIVING_SPEED_MPH = 55          # Average speed
MAX_DRIVING_PER_SHIFT = 11.0    # 11-hour driving limit
MAX_WINDOW_HOURS = 14.0         # 14-hour driving window
REQUIRED_OFF_DUTY = 10.0        # 10 consecutive hours off duty
BREAK_AFTER_DRIVING = 8.0       # 30-min break required after 8 cumulative driving hours
BREAK_DURATION = 0.5            # 30 minutes
PICKUP_DROPOFF_DURATION = 1.0   # 1 hour for pickup/dropoff
FUEL_INTERVAL_MILES = 1000.0    # Fuel every 1000 miles
FUEL_STOP_DURATION = 0.5        # 30 minutes for fuel
MAX_WEEKLY_HOURS = 70.0         # 70-hour/8-day limit


STATUS_OFF_DUTY = "OFF_DUTY"
STATUS_SLEEPER = "SLEEPER_BERTH"
STATUS_DRIVING = "DRIVING"
STATUS_ON_DUTY = "ON_DUTY_NOT_DRIVING"


@dataclass
class HOSEvent:
    status: str
    start_time: datetime
    end_time: datetime
    location: str
    notes: str = ""
    miles_driven: float = 0.0

    def duration_hours(self) -> float:
        return (self.end_time - self.start_time).total_seconds() / 3600

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "start_hour": self.start_time.hour + self.start_time.minute / 60.0,
            "end_hour": self.end_time.hour + self.end_time.minute / 60.0,
            "duration_hours": round(self.duration_hours(), 4),
            "location": self.location,
            "notes": self.notes,
            "miles_driven": round(self.miles_driven, 1),
            "day": (self.start_time - self.start_time.replace(
                hour=0, minute=0, second=0, microsecond=0
            )).days,
        }


@dataclass
class HOSState:
    """Tracks current HOS compliance state"""
    current_time: datetime
    shift_start_time: datetime   # When current 14-hr window started
    driving_since_break: float = 0.0   # Cumulative driving since last 30-min break
    driving_this_shift: float = 0.0    # Driving hours in current shift
    on_duty_this_shift: float = 0.0    # On-duty hours in current shift (for 14-hr window)
    weekly_on_duty: float = 0.0        # Rolling 70-hr total
    miles_since_fuel: float = 0.0
    total_miles: float = 0.0

    def hours_in_window(self) -> float:
        """Hours elapsed since shift start (14-hr window clock)"""
        return (self.current_time - self.shift_start_time).total_seconds() / 3600

    def can_drive(self) -> bool:
        return (
            self.driving_this_shift < MAX_DRIVING_PER_SHIFT
            and self.hours_in_window() < MAX_WINDOW_HOURS
            and self.weekly_on_duty < MAX_WEEKLY_HOURS
        )

    def needs_30_min_break(self) -> bool:
        return self.driving_since_break >= BREAK_AFTER_DRIVING

    def remaining_drive_hours(self) -> float:
        """Maximum driving hours available right now"""
        by_shift = MAX_DRIVING_PER_SHIFT - self.driving_this_shift
        by_window = MAX_WINDOW_HOURS - self.hours_in_window()
        by_weekly = MAX_WEEKLY_HOURS - self.weekly_on_duty
        return max(0, min(by_shift, by_window, by_weekly))

    def remaining_drive_before_break(self) -> float:
        """Driving hours until mandatory 30-min break"""
        return max(0, BREAK_AFTER_DRIVING - self.driving_since_break)


def geocode_location(location: str) -> Dict[str, Any]:
    """
    Return approximate lat/lng for a location string.
    In production, this would call a geocoding API.
    We use a lookup table for common US cities + fallback.
    """
    CITY_COORDS = {
        "new york": {"lat": 40.7128, "lng": -74.0060, "name": "New York, NY"},
        "los angeles": {"lat": 34.0522, "lng": -118.2437, "name": "Los Angeles, CA"},
        "chicago": {"lat": 41.8781, "lng": -87.6298, "name": "Chicago, IL"},
        "houston": {"lat": 29.7604, "lng": -95.3698, "name": "Houston, TX"},
        "dallas": {"lat": 32.7767, "lng": -96.7970, "name": "Dallas, TX"},
        "phoenix": {"lat": 33.4484, "lng": -112.0740, "name": "Phoenix, AZ"},
        "san antonio": {"lat": 29.4241, "lng": -98.4936, "name": "San Antonio, TX"},
        "san diego": {"lat": 32.7157, "lng": -117.1611, "name": "San Diego, CA"},
        "denver": {"lat": 39.7392, "lng": -104.9903, "name": "Denver, CO"},
        "seattle": {"lat": 47.6062, "lng": -122.3321, "name": "Seattle, WA"},
        "miami": {"lat": 25.7617, "lng": -80.1918, "name": "Miami, FL"},
        "atlanta": {"lat": 33.7490, "lng": -84.3880, "name": "Atlanta, GA"},
        "boston": {"lat": 42.3601, "lng": -71.0589, "name": "Boston, MA"},
        "philadelphia": {"lat": 39.9526, "lng": -75.1652, "name": "Philadelphia, PA"},
        "las vegas": {"lat": 36.1699, "lng": -115.1398, "name": "Las Vegas, NV"},
        "nashville": {"lat": 36.1627, "lng": -86.7816, "name": "Nashville, TN"},
        "memphis": {"lat": 35.1495, "lng": -90.0490, "name": "Memphis, TN"},
        "kansas city": {"lat": 39.0997, "lng": -94.5786, "name": "Kansas City, MO"},
        "st. louis": {"lat": 38.6270, "lng": -90.1994, "name": "St. Louis, MO"},
        "minneapolis": {"lat": 44.9778, "lng": -93.2650, "name": "Minneapolis, MN"},
        "detroit": {"lat": 42.3314, "lng": -83.0458, "name": "Detroit, MI"},
        "cleveland": {"lat": 41.4993, "lng": -81.6944, "name": "Cleveland, OH"},
        "pittsburgh": {"lat": 40.4406, "lng": -79.9959, "name": "Pittsburgh, PA"},
        "indianapolis": {"lat": 39.7684, "lng": -86.1581, "name": "Indianapolis, IN"},
        "columbus": {"lat": 39.9612, "lng": -82.9988, "name": "Columbus, OH"},
        "charlotte": {"lat": 35.2271, "lng": -80.8431, "name": "Charlotte, NC"},
        "raleigh": {"lat": 35.7796, "lng": -78.6382, "name": "Raleigh, NC"},
        "richmond": {"lat": 37.5407, "lng": -77.4360, "name": "Richmond, VA"},
        "new orleans": {"lat": 29.9511, "lng": -90.0715, "name": "New Orleans, LA"},
        "oklahoma city": {"lat": 35.4676, "lng": -97.5164, "name": "Oklahoma City, OK"},
        "albuquerque": {"lat": 35.0844, "lng": -106.6504, "name": "Albuquerque, NM"},
        "el paso": {"lat": 31.7619, "lng": -106.4850, "name": "El Paso, TX"},
        "tucson": {"lat": 32.2226, "lng": -110.9747, "name": "Tucson, AZ"},
        "sacramento": {"lat": 38.5816, "lng": -121.4944, "name": "Sacramento, CA"},
        "san francisco": {"lat": 37.7749, "lng": -122.4194, "name": "San Francisco, CA"},
        "portland": {"lat": 45.5231, "lng": -122.6765, "name": "Portland, OR"},
        "salt lake city": {"lat": 40.7608, "lng": -111.8910, "name": "Salt Lake City, UT"},
        "boise": {"lat": 43.6150, "lng": -116.2023, "name": "Boise, ID"},
        "omaha": {"lat": 41.2565, "lng": -95.9345, "name": "Omaha, NE"},
        "wichita": {"lat": 37.6872, "lng": -97.3301, "name": "Wichita, KS"},
        "tulsa": {"lat": 36.1540, "lng": -95.9928, "name": "Tulsa, OK"},
        "jacksonville": {"lat": 30.3322, "lng": -81.6557, "name": "Jacksonville, FL"},
        "tampa": {"lat": 27.9506, "lng": -82.4572, "name": "Tampa, FL"},
        "orlando": {"lat": 28.5383, "lng": -81.3792, "name": "Orlando, FL"},
        "baltimore": {"lat": 39.2904, "lng": -76.6122, "name": "Baltimore, MD"},
        "washington": {"lat": 38.9072, "lng": -77.0369, "name": "Washington, DC"},
        "washington dc": {"lat": 38.9072, "lng": -77.0369, "name": "Washington, DC"},
        "louisville": {"lat": 38.2527, "lng": -85.7585, "name": "Louisville, KY"},
        "cincinnati": {"lat": 39.1031, "lng": -84.5120, "name": "Cincinnati, OH"},
        "st louis": {"lat": 38.6270, "lng": -90.1994, "name": "St. Louis, MO"},
        "buffalo": {"lat": 42.8864, "lng": -78.8784, "name": "Buffalo, NY"},
        "hartford": {"lat": 41.7658, "lng": -72.6734, "name": "Hartford, CT"},
        "providence": {"lat": 41.8240, "lng": -71.4128, "name": "Providence, RI"},
    }

    loc_lower = location.lower().strip()
    # Try exact match first
    if loc_lower in CITY_COORDS:
        return CITY_COORDS[loc_lower]
    # Try partial match
    for key, val in CITY_COORDS.items():
        if key in loc_lower or loc_lower in key:
            return val
    # Default fallback - center of US
    return {"lat": 39.5, "lng": -98.35, "name": location}


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two lat/lng points"""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def interpolate_location(start_coords, end_coords, fraction: float) -> Dict:
    """Get interpolated lat/lng between two points"""
    lat = start_coords["lat"] + (end_coords["lat"] - start_coords["lat"]) * fraction
    lng = start_coords["lng"] + (end_coords["lng"] - start_coords["lng"]) * fraction
    return {"lat": round(lat, 6), "lng": round(lng, 6)}


def generate_trip_plan(
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    cycle_hours_used: float,
    start_datetime: datetime = None,
) -> Dict[str, Any]:
    """
    Main function: generates a complete HOS-compliant trip plan.
    Returns events timeline, daily logs, route info, and stop markers.
    """
    if start_datetime is None:
        # Force start at Midnight of the current day for clean logs
        start_datetime = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Geocode all locations
    current_coords = geocode_location(current_location)
    pickup_coords = geocode_location(pickup_location)
    dropoff_coords = geocode_location(dropoff_location)

    # Calculate distances
    dist_to_pickup = haversine_distance(
        current_coords["lat"], current_coords["lng"],
        pickup_coords["lat"], pickup_coords["lng"]
    )
    dist_pickup_to_dropoff = haversine_distance(
        pickup_coords["lat"], pickup_coords["lng"],
        dropoff_coords["lat"], dropoff_coords["lng"]
    )
    total_distance = dist_to_pickup + dist_pickup_to_dropoff

    # Initialize HOS state
    state = HOSState(
        current_time=start_datetime,
        shift_start_time=start_datetime,
        weekly_on_duty=cycle_hours_used,
    )

    events: List[HOSEvent] = []

    # ---- INITIAL WAIT: Midnight to 6 AM (Standard prep) ----
    _add_event(events, state, STATUS_OFF_DUTY, 6.0,
               current_coords["name"], "Origin Wait - preparing for departure")

    # ---- SEGMENT 1: Current Location → Pickup ----
    _drive_segment(
        events=events,
        state=state,
        segment_miles=dist_to_pickup,
        start_location=current_coords["name"],
        end_location=pickup_coords["name"],
        start_coords=current_coords,
        end_coords=pickup_coords,
        segment_label="to_pickup",
    )

    # ---- PICKUP STOP: 1 hour on duty ----
    _add_event(events, state, STATUS_ON_DUTY, PICKUP_DROPOFF_DURATION,
               pickup_coords["name"], "Pickup - loading cargo")

    # ---- SEGMENT 2: Pickup → Dropoff ----
    _drive_segment(
        events=events,
        state=state,
        segment_miles=dist_pickup_to_dropoff,
        start_location=pickup_coords["name"],
        end_location=dropoff_coords["name"],
        start_coords=pickup_coords,
        end_coords=dropoff_coords,
        segment_label="to_dropoff",
    )

    # ---- DROPOFF STOP: 1 hour on duty ----
    _add_event(events, state, STATUS_ON_DUTY, PICKUP_DROPOFF_DURATION,
               dropoff_coords["name"], "Dropoff - unloading cargo")

    # Final off-duty (Ensure we cover the entire day)
    current_h = state.current_time.hour + state.current_time.minute / 60.0
    if current_h < 23.9:
        remaining_of_day = 24.0 - current_h
        _add_event(events, state, STATUS_OFF_DUTY, remaining_of_day,
                   dropoff_coords["name"], "Trip complete - off duty")

    # Build daily logs
    daily_logs = _build_daily_logs(events, start_datetime)

    # Build route waypoints
    route_waypoints = _build_route_waypoints(
        events, current_coords, pickup_coords, dropoff_coords, dist_to_pickup, dist_pickup_to_dropoff
    )

    # Summary stats
    total_driving_hours = sum(e.duration_hours() for e in events if e.status == STATUS_DRIVING)
    total_on_duty_hours = sum(e.duration_hours() for e in events if e.status == STATUS_ON_DUTY)
    total_trip_hours = (events[-1].end_time - events[0].start_time).total_seconds() / 3600

    return {
        "summary": {
            "current_location": current_coords["name"],
            "pickup_location": pickup_coords["name"],
            "dropoff_location": dropoff_coords["name"],
            "total_distance_miles": round(total_distance, 1),
            "distance_to_pickup_miles": round(dist_to_pickup, 1),
            "distance_pickup_to_dropoff_miles": round(dist_pickup_to_dropoff, 1),
            "total_driving_hours": round(total_driving_hours, 2),
            "total_on_duty_hours": round(total_on_duty_hours + total_driving_hours, 2),
            "total_trip_hours": round(total_trip_hours, 2),
            "num_days": len(daily_logs),
            "cycle_hours_used_start": cycle_hours_used,
            "cycle_hours_used_end": round(state.weekly_on_duty, 2),
            "start_time": events[0].start_time.isoformat(),
            "end_time": events[-1].end_time.isoformat(),
            "fuel_stops": sum(1 for e in events if "Fuel" in e.notes),
        },
        "events": [e.to_dict() for e in events],
        "daily_logs": daily_logs,
        "route": {
            "waypoints": route_waypoints,
            "current_coords": current_coords,
            "pickup_coords": pickup_coords,
            "dropoff_coords": dropoff_coords,
        },
    }


def _add_event(
    events: List[HOSEvent],
    state: HOSState,
    status: str,
    duration_hours: float,
    location: str,
    notes: str = "",
    miles: float = 0.0,
):
    """Add an event and update state"""
    start = state.current_time
    end = start + timedelta(hours=duration_hours)

    events.append(HOSEvent(
        status=status,
        start_time=start,
        end_time=end,
        location=location,
        notes=notes,
        miles_driven=miles,
    ))

    state.current_time = end

    if status == STATUS_DRIVING:
        state.driving_since_break += duration_hours
        state.driving_this_shift += duration_hours
        state.on_duty_this_shift += duration_hours
        state.weekly_on_duty += duration_hours
        state.miles_since_fuel += miles
        state.total_miles += miles
    elif status in (STATUS_ON_DUTY,):
        state.on_duty_this_shift += duration_hours
        state.weekly_on_duty += duration_hours
    elif status in (STATUS_OFF_DUTY, STATUS_SLEEPER):
        # Check if this resets the shift
        if duration_hours >= 34.0:
            state.shift_start_time = end
            state.driving_this_shift = 0.0
            state.driving_since_break = 0.0
            state.on_duty_this_shift = 0.0
            state.weekly_on_duty = 0.0  # FMCSA 34-hour restart
        elif duration_hours >= REQUIRED_OFF_DUTY:
            state.shift_start_time = end
            state.driving_this_shift = 0.0
            state.driving_since_break = 0.0
            state.on_duty_this_shift = 0.0
        elif duration_hours >= BREAK_DURATION:
            state.driving_since_break = 0.0


def _drive_segment(
    events: List[HOSEvent],
    state: HOSState,
    segment_miles: float,
    start_location: str,
    end_location: str,
    start_coords: Dict,
    end_coords: Dict,
    segment_label: str,
):
    """
    Drive a segment, inserting breaks, rest periods, and fuel stops as needed.
    """
    remaining_miles = segment_miles
    miles_covered = 0.0

    while remaining_miles > 0.001:
        # Check if we need a rest period
        if not state.can_drive():
            rest_hrs = REQUIRED_OFF_DUTY
            frac = miles_covered / segment_miles if segment_miles > 0 else 0
            rest_loc = _interpolated_name(start_location, end_location, frac)
            notes = "Mandatory 10-hour rest period"
            
            if state.weekly_on_duty >= MAX_WEEKLY_HOURS:
                rest_hrs = 34.0
                notes = "70-HOUR LIMIT REACHED - MANDATORY 34-HOUR RESTART"
            
            _add_event(events, state, STATUS_SLEEPER, rest_hrs, rest_loc, notes)
            continue

        # Check if we need a 30-min break
        if state.needs_30_min_break():
            frac = miles_covered / segment_miles if segment_miles > 0 else 0
            break_loc = _interpolated_name(start_location, end_location, frac)
            _add_event(events, state, STATUS_OFF_DUTY, BREAK_DURATION, break_loc,
                       "Mandatory 30-minute rest break")
            continue

        # Check if fuel is needed
        if state.miles_since_fuel >= FUEL_INTERVAL_MILES:
            frac = miles_covered / segment_miles if segment_miles > 0 else 0
            fuel_loc = _interpolated_name(start_location, end_location, frac)
            _add_event(events, state, STATUS_ON_DUTY, FUEL_STOP_DURATION, fuel_loc,
                       f"Fuel stop (every {int(FUEL_INTERVAL_MILES)} miles)")
            state.miles_since_fuel = 0.0
            continue

        # Calculate how far we can drive
        hours_available = min(
            state.remaining_drive_hours(),
            state.remaining_drive_before_break(),
        )

        if hours_available <= 0:
            continue

        # Also check miles to next fuel stop
        miles_to_fuel = FUEL_INTERVAL_MILES - state.miles_since_fuel
        max_miles_this_leg = min(
            hours_available * DRIVING_SPEED_MPH,
            miles_to_fuel,
            remaining_miles,
        )

        if max_miles_this_leg <= 0:
            break

        drive_hours = max_miles_this_leg / DRIVING_SPEED_MPH
        miles_covered += max_miles_this_leg
        remaining_miles -= max_miles_this_leg

        frac_start = (miles_covered - max_miles_this_leg) / segment_miles if segment_miles > 0 else 0
        frac_end = miles_covered / segment_miles if segment_miles > 0 else 1

        leg_start_loc = _interpolated_name(start_location, end_location, frac_start)
        leg_end_loc = _interpolated_name(start_location, end_location, frac_end)

        drive_label = leg_end_loc if remaining_miles <= 0 else f"En route to {end_location}"
        _add_event(
            events, state, STATUS_DRIVING, drive_hours,
            drive_label,
            f"Driving {round(max_miles_this_leg, 1)} miles",
            miles=max_miles_this_leg,
        )


def _interpolated_name(start: str, end: str, fraction: float) -> str:
    """Give a descriptive name for intermediate points"""
    if fraction <= 0.05:
        return start
    if fraction >= 0.95:
        return end
    return f"En route ({int(fraction * 100)}% to {end})"


def _build_daily_logs(events: List[HOSEvent], trip_start: datetime) -> List[Dict]:
    """Group events into 24-hour daily log sheets"""
    if not events:
        return []

    logs = []
    trip_start_day = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Find total days needed
    last_event_day = (events[-1].end_time.replace(hour=0, minute=0, second=0, microsecond=0) - trip_start_day).days
    num_days = last_event_day + 1

    for day_num in range(num_days):
        day_start = trip_start_day + timedelta(days=day_num)
        day_end = day_start + timedelta(days=1)

        day_events = []
        for evt in events:
            # Clip event to this day
            evt_start = max(evt.start_time, day_start)
            evt_end = min(evt.end_time, day_end)
            if evt_start < evt_end:
                day_events.append({
                    "status": evt.status,
                    "start_hour": (evt_start - day_start).total_seconds() / 3600,
                    "end_hour": (evt_end - day_start).total_seconds() / 3600,
                    "duration": (evt_end - evt_start).total_seconds() / 3600,
                    "location": evt.location,
                    "notes": evt.notes,
                    "miles_driven": evt.miles_driven if evt.status == STATUS_DRIVING else 0,
                })

        # Calculate totals per status
        totals = {STATUS_OFF_DUTY: 0, STATUS_SLEEPER: 0, STATUS_DRIVING: 0, STATUS_ON_DUTY: 0}
        for e in day_events:
            if e["status"] in totals:
                totals[e["status"]] += e["duration"]

        total_miles_day = sum(e["miles_driven"] for e in day_events)

        # Find primary locations
        drive_locations = [e["location"] for e in day_events if e["status"] == STATUS_DRIVING]
        remarks = _build_remarks(day_events, day_start)

        logs.append({
            "day_number": day_num + 1,
            "date": day_start.strftime("%m/%d/%Y"),
            "events": day_events,
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "total_hours": round(sum(totals.values()), 2),
            "total_miles": round(total_miles_day, 1),
            "remarks": remarks,
            "has_activity": len(day_events) > 0,
        })

    return [log for log in logs if log["has_activity"]]


def _build_remarks(day_events: List[Dict], day_start: datetime) -> List[Dict]:
    """Build remarks section entries (location changes)"""
    remarks = []
    prev_status = None
    for evt in day_events:
        if evt["status"] != prev_status:
            h = evt["start_hour"]
            hour_12 = int(h) % 12 or 12
            am_pm = "AM" if int(h) < 12 else "PM"
            minutes = int((h % 1) * 60)
            remarks.append({
                "time": f"{hour_12}:{minutes:02d} {am_pm}",
                "time_24": round(h, 2),
                "status": evt["status"],
                "location": evt["location"],
                "notes": evt["notes"],
            })
            prev_status = evt["status"]
    return remarks


def _build_route_waypoints(
    events: List[HOSEvent],
    current_coords: Dict,
    pickup_coords: Dict,
    dropoff_coords: Dict,
    dist_to_pickup: float,
    dist_pickup_to_dropoff: float,
) -> List[Dict]:
    """Build map waypoints from events"""
    waypoints = []
    total_dist = dist_to_pickup + dist_pickup_to_dropoff

    # Start
    waypoints.append({
        "type": "start",
        "label": "Start",
        "location": current_coords["name"],
        "lat": current_coords["lat"],
        "lng": current_coords["lng"],
        "time": events[0].start_time.isoformat() if events else None,
    })

    # Pickup
    waypoints.append({
        "type": "pickup",
        "label": "Pickup",
        "location": pickup_coords["name"],
        "lat": pickup_coords["lat"],
        "lng": pickup_coords["lng"],
        "time": None,
    })

    # Add rest stops and fuel stops
    miles_accum = 0.0
    for evt in events:
        if evt.status in (STATUS_SLEEPER, STATUS_OFF_DUTY) and "rest" in evt.notes.lower():
            # Estimate position
            if miles_accum < dist_to_pickup:
                frac = miles_accum / dist_to_pickup if dist_to_pickup > 0 else 0
                coords = interpolate_location(current_coords, pickup_coords, min(frac, 1))
            else:
                frac = (miles_accum - dist_to_pickup) / dist_pickup_to_dropoff if dist_pickup_to_dropoff > 0 else 0
                coords = interpolate_location(pickup_coords, dropoff_coords, min(frac, 1))

            waypoints.append({
                "type": "rest",
                "label": f"Rest Stop",
                "location": evt.location,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "time": evt.start_time.isoformat(),
                "duration_hours": round(evt.duration_hours(), 1),
                "notes": evt.notes,
            })

        elif evt.status == STATUS_ON_DUTY and "Fuel" in evt.notes:
            if miles_accum < dist_to_pickup:
                frac = miles_accum / dist_to_pickup if dist_to_pickup > 0 else 0
                coords = interpolate_location(current_coords, pickup_coords, min(frac, 1))
            else:
                frac = (miles_accum - dist_to_pickup) / dist_pickup_to_dropoff if dist_pickup_to_dropoff > 0 else 0
                coords = interpolate_location(pickup_coords, dropoff_coords, min(frac, 1))

            waypoints.append({
                "type": "fuel",
                "label": "Fuel Stop",
                "location": evt.location,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "time": evt.start_time.isoformat(),
                "notes": evt.notes,
            })

        if evt.status == STATUS_DRIVING:
            miles_accum += evt.miles_driven

    # Dropoff
    waypoints.append({
        "type": "dropoff",
        "label": "Dropoff",
        "location": dropoff_coords["name"],
        "lat": dropoff_coords["lat"],
        "lng": dropoff_coords["lng"],
        "time": None,
    })

    return waypoints
