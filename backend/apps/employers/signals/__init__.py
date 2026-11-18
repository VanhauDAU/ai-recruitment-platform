"""Signal công khai của employers; receiver nằm ở ``receivers``."""

from django.dispatch import Signal

# Sent inside the transaction that changed a campaign's status, after the row
# is saved: ``campaign``, ``previous_status``, ``actor`` (``None`` for the
# system). Other apps react here so employers never imports their services.
campaign_status_changed = Signal()
