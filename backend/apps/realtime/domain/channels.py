"""Pure definitions shared by the socket consumer and the publishers."""

# A ticket only bridges one authenticated HTTP request to one socket handshake.
TICKET_TTL_SECONDS = 30
# How often an open socket re-checks the account and its login session.
REVALIDATE_SECONDS = 60
# Clients only ever send heartbeats; anything larger is dropped unread.
MAX_CLIENT_MESSAGE_BYTES = 256
# Application close code (4000-4999): the client must get a new ticket, and
# re-authenticate first if that fails, instead of blindly reconnecting.
CLOSE_UNAUTHORIZED = 4401
# Every admin socket also joins this group. Admin events only name which queue
# changed (same counts any admin may read over REST), never the item itself.
ADMIN_GROUP = 'role.admin'
ADMIN_QUEUE_CHANGED = 'admin.queue.changed'


def user_group(user_id):
    """Per-account group: notification events are addressed to one account."""
    return f'user.{int(user_id)}'
