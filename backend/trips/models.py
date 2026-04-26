from django.db import models
import json

class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    cycle_hours_used = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    result_json = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.current_location} to {self.dropoff_location}"

    def get_result(self):
        if self.result_json:
            return json.loads(self.result_json)
        return None

    def set_result(self, data):
        self.result_json = json.dumps(data)
