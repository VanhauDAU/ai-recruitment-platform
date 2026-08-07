from django.conf import settings

from .assets import register_blog_speech_generation
from .client import SpeechServiceRejected, SpeechServiceUnavailable, tts_service_client
from .normalization import blog_post_speech_script, plain_text_speech_script
from .policy import get_speech_policy, speech_surface_config
from .usage import record_speech_usage, reserve_generation_quota

# Ad-hoc lines carry no editorial revision. The surface remains in the identity
# so future voice/policy changes cannot accidentally share an incompatible item.
ADHOC_SOURCE_REVISION = 'text:{surface}:v1'


class SpeechFeatureDisabled(Exception):
    pass


def get_speech_catalog():
    policy = get_speech_policy()
    if not policy['speech_enabled'] or not policy['speech_live_enabled']:
        raise SpeechFeatureDisabled
    capabilities = tts_service_client.capabilities()
    surfaces = {
        surface: speech_surface_config(surface)
        for surface in ('blog', 'onboarding', 'chatbot', 'interview')
    }
    allowed_voice_ids = {item['voice_id'] for item in surfaces.values()}
    allowed_style_ids = {item['style'] for item in surfaces.values()}
    return {
        'default_voice_id': surfaces['blog']['voice_id'],
        'sample_rate': capabilities.get('sample_rate', 48_000),
        'voices': [
            voice for voice in capabilities['voices'] if voice.get('id') in allowed_voice_ids
        ],
        'styles': [
            style for style in capabilities['styles'] if style.get('id') in allowed_style_ids
        ],
        'surfaces': surfaces,
    }


def _surface_configuration(surface):
    config = speech_surface_config(surface)
    if config is None or not config['enabled']:
        raise SpeechFeatureDisabled
    capabilities = tts_service_client.capabilities()
    voice_ids = {voice.get('id') for voice in capabilities['voices']}
    style_ids = {style.get('id') for style in capabilities['styles']}
    if config['voice_id'] not in voice_ids or config['style'] not in style_ids:
        raise SpeechServiceUnavailable
    return config


def _apply_quota_and_usage(
    *, session, surface, requested_chars, quota_subject, authenticated, config
):
    generation_count = 0
    if not session['cached']:
        limit = (
            config['daily_authenticated_limit']
            if authenticated
            else config['daily_anonymous_limit']
        )
        generation_count = int(
            reserve_generation_quota(
                artifact_key=session['artifact_key'],
                surface=surface,
                subject=quota_subject,
                authenticated=authenticated,
                limit=limit,
            )
        )
    record_speech_usage(
        surface,
        session_count=1,
        generation_count=generation_count,
        requested_chars=requested_chars,
        cache_hit_count=int(session['cached']),
        cache_miss_count=int(not session['cached']),
    )


def create_blog_post_speech_session(*, post, quota_subject, authenticated):
    surface = 'blog'
    config = _surface_configuration(surface)
    voice_id, style = config['voice_id'], config['style']
    script = blog_post_speech_script(post, max_chars=settings.SPEECH_MAX_TEXT_CHARS)
    if not script['text']:
        raise SpeechServiceRejected
    session = tts_service_client.create_session(
        text=script['text'],
        voice_id=voice_id,
        style=style,
        text_hash=script['text_hash'],
        normalizer_version=script['normalizer_version'],
        source_revision=f'blog.post:{post.public_id}:r{post.edit_revision}',
        artifact_policy='durable',
    )
    _apply_quota_and_usage(
        session=session,
        surface=surface,
        requested_chars=len(script['text']),
        quota_subject=quota_subject,
        authenticated=authenticated,
        config=config,
    )
    register_blog_speech_generation(
        post=post,
        session=session,
        text_hash=script['text_hash'],
        voice_id=voice_id,
        style=style,
    )
    return {
        **session,
        'voice_id': voice_id,
        'style': style,
        'truncated': script['truncated'],
    }


def create_text_speech_session(*, text, surface, quota_subject, authenticated):
    """Create one narration session for caller-supplied text.

    Deliberately no durable artifact: these lines are short, numerous and
    disposable, so registering a row plus an MP3 finalizer per utterance would
    cost far more than re-synthesising a cache miss. Playback therefore always
    runs through the live stream, served from the synthesis cache on a repeat.
    """
    config = _surface_configuration(surface)
    voice_id, style = config['voice_id'], config['style']
    script = plain_text_speech_script(text, max_chars=settings.SPEECH_MAX_ADHOC_TEXT_CHARS)
    if not script['text']:
        raise SpeechServiceRejected

    session = tts_service_client.create_session(
        text=script['text'],
        voice_id=voice_id,
        style=style,
        text_hash=script['text_hash'],
        normalizer_version=script['normalizer_version'],
        source_revision=ADHOC_SOURCE_REVISION.format(surface=surface),
        artifact_policy='cache_only',
    )
    _apply_quota_and_usage(
        session=session,
        surface=surface,
        requested_chars=len(script['text']),
        quota_subject=quota_subject,
        authenticated=authenticated,
        config=config,
    )
    return {
        **session,
        'voice_id': voice_id,
        'style': style,
        'truncated': script['truncated'],
    }
