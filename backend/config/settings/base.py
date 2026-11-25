"""Settings dùng chung mọi môi trường, ghép từ ``components/`` theo thứ tự phụ thuộc."""

from .components.ai import *  # noqa: F403
from .components.api import *  # noqa: F403
from .components.core import *  # noqa: F403
from .components.http import *  # noqa: F403
from .components.integrations import *  # noqa: F403
from .components.observability import *  # noqa: F403
from .components.product import *  # noqa: F403
from .components.storage import *  # noqa: F403
from .components.tasks import *  # noqa: F403
