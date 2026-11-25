"""Settings dùng chung mọi môi trường, ghép từ ``components/``.

Thứ tự import không mang nghĩa: component nào cần giá trị nền (``BASE_DIR``,
``config``, ``IS_PRODUCTION``…) tự import từ ``.core``, ``core`` không import
component nào khác.
"""

from .components.ai import *  # noqa: F403
from .components.api import *  # noqa: F403
from .components.core import *  # noqa: F403
from .components.http import *  # noqa: F403
from .components.integrations import *  # noqa: F403
from .components.observability import *  # noqa: F403
from .components.product import *  # noqa: F403
from .components.storage import *  # noqa: F403
from .components.tasks import *  # noqa: F403
