from django.conf import settings
from django.core.cache import cache

from apps.sitecontent.models import SiteSetting

SPEECH_POLICY_CACHE_KEY = 'speech:policy:v1'
SURFACES = ('blog', 'onboarding', 'chatbot', 'interview')
DEFAULT_POLICY = {
    'speech_enabled': False,
    'speech_live_enabled': False,
    'speech_blog_enabled': False,
    'speech_onboarding_enabled': False,
    'speech_chatbot_enabled': False,
    'speech_interview_enabled': False,
    'speech_daily_authenticated_limit': 30,
    'speech_daily_anonymous_limit': 30,
    'speech_blog_voice_id': 'north-male-natural',
    'speech_blog_style': 'tu_nhien',
    'speech_assistant_voice_id': 'north-female-news',
    'speech_assistant_style': 'tin_tuc',
}


def get_speech_policy():
    cached = cache.get(SPEECH_POLICY_CACHE_KEY)
    if cached is not None:
        return cached
    values = dict(SiteSetting.objects.filter(key__in=DEFAULT_POLICY).values_list('key', 'value'))
    policy = {**DEFAULT_POLICY, **values}
    runtime_enabled = bool(settings.SPEECH_RUNTIME_ENABLED)
    master_enabled = runtime_enabled and policy['speech_enabled'] is True
    live_enabled = master_enabled and policy['speech_live_enabled'] is True
    effective = {
        **policy,
        'runtime_enabled': runtime_enabled,
        'speech_enabled': master_enabled,
        'speech_live_enabled': live_enabled,
    }
    for surface in SURFACES:
        key = f'speech_{surface}_enabled'
        effective[key] = live_enabled and policy[key] is True
    cache.set(SPEECH_POLICY_CACHE_KEY, effective, settings.SPEECH_POLICY_CACHE_SECONDS)
    return effective


def speech_surface_config(surface):
    if surface not in SURFACES:
        return None
    policy = get_speech_policy()
    voice_prefix = 'blog' if surface == 'blog' else 'assistant'
    return {
        'enabled': bool(policy[f'speech_{surface}_enabled']),
        'voice_id': policy[f'speech_{voice_prefix}_voice_id'],
        'style': policy[f'speech_{voice_prefix}_style'],
        'daily_authenticated_limit': _positive_int(policy['speech_daily_authenticated_limit'], 30),
        'daily_anonymous_limit': _positive_int(policy['speech_daily_anonymous_limit'], 30),
    }


def _positive_int(value, default):
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default
