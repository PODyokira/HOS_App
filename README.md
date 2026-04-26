# TruckLog Pro — FMCSA HOS ELD Trip Planner

Full-stack Django + React app for FMCSA Hours of Service compliance.

## Stack

- **Backend**: Django + Django REST Framework (Python)
- **Frontend**: React + TypeScript + Leaflet (OpenStreetMap)

## Quick Start

### Backend

```bash
cd backend
pip install django djangorestframework django-cors-headers
python manage.py migrate
python manage.py runserver 8000
```

### Frontend

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

## HOS Rules Implemented (49 CFR Part 395)

- 70-hour / 8-day cycle
- 11-hour driving limit per shift
- 14-hour driving window
- 10-hour mandatory rest between shifts
- 30-minute break after 8 cumulative driving hours
- 1-hour pickup & dropoff stops
- Fuel stop every 1,000 miles
- 55 mph average speed assumption
