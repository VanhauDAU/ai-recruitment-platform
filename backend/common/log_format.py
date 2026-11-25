"""Định dạng log một dòng JSON cho stdout của container (``docker compose logs``).

Mỗi bản ghi một dòng để grep/jq được và traceback không bị cắt thành nhiều
dòng rời. Không thêm trường tùy ý từ ``extra``: log không được thành đường lộ
PII ngoài ý muốn.
"""

import json
import logging
from datetime import UTC, datetime


class JsonLineFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            'time': datetime.fromtimestamp(record.created, tz=UTC).isoformat(
                timespec='milliseconds'
            ),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        if record.exc_info:
            payload['exc_info'] = self.formatException(record.exc_info)
        if record.stack_info:
            payload['stack_info'] = self.formatStack(record.stack_info)
        return json.dumps(payload, ensure_ascii=False, default=str)
