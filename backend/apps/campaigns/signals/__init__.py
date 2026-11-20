"""Signal công khai của campaigns; receiver nằm ở ``receivers``."""

from django.dispatch import Signal

# Sent inside the transaction that changed a campaign's status, after the row
# is saved: ``campaign``, ``previous_status``, ``actor`` (``None`` for the
# system). Other apps (jobs, campaign social posts) react here.
campaign_status_changed = Signal()

# Sent inside the transaction that saved a post already due (``post_id``), so
# "post now" publishes at once instead of at the next minute-long beat.
social_post_due = Signal()
