from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check),
    path('trips/plan/', views.plan_trip),
    path('trips/<int:trip_id>/', views.get_trip),
]
