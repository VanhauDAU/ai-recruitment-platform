from django.urls import path

from ..views import RealtimeTicketView

urlpatterns = [
    path('ticket/', RealtimeTicketView.as_view(), name='realtime-ticket'),
]
