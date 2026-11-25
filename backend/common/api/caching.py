"""Cache ngắn cho GET công khai trả cùng nội dung cho mọi người xem.

Khác ``cache_page`` của Django ở khóa cache: chỉ gồm host, path, ngôn ngữ và
các tham số query mà view thật sự đọc. Tham số lạ bị bỏ qua nên không ai tạo
được vô số bản cache bằng ``?x=<ngẫu nhiên>``. Host nằm trong khóa nên URL
media tuyệt đối trong response vẫn đúng domain của request.
"""

from functools import wraps
from hashlib import sha256

from django.core.cache import cache
from django.utils.cache import patch_cache_control
from django.utils.translation import get_language

PUBLIC_CACHE_SECONDS = 120


def _cache_key(request, query_params):
    query = '&'.join(
        f'{name}={value}' for name in sorted(query_params) for value in request.GET.getlist(name)
    )
    raw = '|'.join((request.get_host(), request.path, get_language() or '', query))
    return f'public-get:{sha256(raw.encode()).hexdigest()}'


def cache_public_get(seconds=PUBLIC_CACHE_SECONDS, *, query_params=()):
    """Class decorator: serve ``get`` from the cache for ``seconds``.

    ``query_params`` must list every query parameter the view reads. Only
    successful responses are cached; they also tell browsers and Cloudflare
    they may keep the copy for the same time. Only for views whose output does
    not depend on the account or cookies of the visitor.
    """

    def decorate(view_class):
        original_get = view_class.get

        @wraps(original_get)
        def get(self, request, *args, **kwargs):
            key = _cache_key(request, query_params)
            cached = cache.get(key)
            if cached is not None:
                return cached
            response = original_get(self, request, *args, **kwargs)
            if response.status_code != 200:
                return response
            patch_cache_control(response, public=True, max_age=seconds)
            if callable(getattr(response, 'render', None)):
                # DRF renders after the view returns; store the rendered bytes.
                # The callback must return None: Django replaces the response
                # with any other return value, and django-redis ``set`` returns True.
                def store(rendered):
                    cache.set(key, rendered, seconds)

                response.add_post_render_callback(store)
            else:
                cache.set(key, response, seconds)
            return response

        view_class.get = get
        return view_class

    return decorate
