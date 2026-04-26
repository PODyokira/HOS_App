from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime
from .hos_engine import generate_trip_plan
from .models import Trip
import json

@api_view(['POST'])
def plan_trip(request):
    data = request.data
    required = ['current_location', 'pickup_location', 'dropoff_location', 'cycle_hours_used']
    for field in required:
        if field not in data:
            return Response({'error': f'Missing required field: {field}'}, status=400)

    current_location = str(data['current_location']).strip()
    pickup_location = str(data['pickup_location']).strip()
    dropoff_location = str(data['dropoff_location']).strip()

    try:
        cycle_hours_used = float(data['cycle_hours_used'])
    except (ValueError, TypeError):
        return Response({'error': 'cycle_hours_used must be a number'}, status=400)

    if not (0 <= cycle_hours_used <= 70):
        return Response({'error': 'cycle_hours_used must be between 0 and 70'}, status=400)

    try:
        start_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        result = generate_trip_plan(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            cycle_hours_used=cycle_hours_used,
            start_datetime=start_dt,
        )
        trip = Trip.objects.create(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            cycle_hours_used=cycle_hours_used,
        )
        trip.set_result(result)
        trip.save()
        result['trip_id'] = trip.id
        return Response(result, status=200)
    except Exception as e:
        import traceback
        return Response({'error': f'Failed to generate trip plan: {str(e)}', 'traceback': traceback.format_exc()}, status=500)

@api_view(['GET'])
def get_trip(request, trip_id):
    try:
        trip = Trip.objects.get(id=trip_id)
        result = trip.get_result()
        if result:
            result['trip_id'] = trip.id
            return Response(result)
        return Response({'error': 'Trip result not found'}, status=404)
    except Trip.DoesNotExist:
        return Response({'error': 'Trip not found'}, status=404)

@api_view(['GET'])
def health_check(request):
    return Response({'status': 'ok', 'service': 'HOS Trip Planner API'})
