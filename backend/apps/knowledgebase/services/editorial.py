"""Optimistic-concurrency guard and admin audit shared by every editorial write."""

from apps.accounts.services import record_admin_action
from common.errors import DomainError


class KnowledgeConflict(DomainError):
    status_code = 409

    def __init__(self, code, detail, *, current_revision_token=None, open_revision=None):
        self.code = code
        self.detail = detail
        self.current_revision_token = current_revision_token
        self.open_revision = open_revision
        super().__init__(detail)

    def payload(self):
        data = {'code': self.code, 'detail': self.detail}
        if self.current_revision_token is not None:
            data['current_revision_token'] = self.current_revision_token
        if self.open_revision is not None:
            data['open_revision'] = {
                'number': self.open_revision.number,
                'status': self.open_revision.status,
            }
        return data


def record_editorial_action(*, actor, action, target, payload=None):
    return record_admin_action(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__,
        target_public_id=target.public_id,
        payload=payload or {},
    )


def assert_revision_token(resource, expected):
    if expected is None or resource.revision_token != expected:
        raise KnowledgeConflict(
            'knowledgebase_revision_stale',
            'Nội dung đã thay đổi trên máy chủ. Hãy đối chiếu trước khi tiếp tục.',
            current_revision_token=resource.revision_token,
        )
