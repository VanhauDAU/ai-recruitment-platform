from django.conf import settings

from .assets import register_blog_speech_generation
from .client import SpeechServiceRejected, tts_service_client
from .normalization import blog_post_speech_script, plain_text_speech_script

# Ad-hoc lines carry no editorial revision. Pinning one constant here lets the
# same sentence spoken from any surface resolve to a single cached artifact,
# because the synthesis identity already hashes the normalized text itself.
ADHOC_SOURCE_REVISION = 'text:v1'


def get_speech_catalog():
    capabilities = tts_service_client.capabilities()
    return {
        'default_voice_id': capabilities['default_voice_id'],
        'sample_rate': capabilities.get('sample_rate', 48_000),
        'voices': capabilities['voices'],
        'styles': capabilities['styles'],
    }


def _resolve_voice_and_style(voice_id, style):
    catalog = get_speech_catalog()
    voices = {voice.get('id'): voice for voice in catalog['voices']}
    styles = [item.get('id') for item in catalog['styles'] if item.get('id')]
    style_ids = set(styles)
    voice_id = voice_id if voice_id in voices else catalog['default_voice_id']
    preferred_style = voices[voice_id].get('default_style', 'tu_nhien')
    style = style if style in style_ids else preferred_style
    if style not in style_ids:
        style = styles[0] if styles else ''
    if not voice_id or not style:
        raise SpeechServiceRejected
    return voice_id, style


def create_blog_post_speech_session(*, post, voice_id, style):
    voice_id, style = _resolve_voice_and_style(voice_id, style)
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


def create_text_speech_session(*, text, voice_id, style):
    """Create one narration session for caller-supplied text.

    Deliberately no durable artifact: these lines are short, numerous and
    disposable, so registering a row plus an MP3 finalizer per utterance would
    cost far more than re-synthesising a cache miss. Playback therefore always
    runs through the live stream, served from the synthesis cache on a repeat.
    """
    voice_id, style = _resolve_voice_and_style(voice_id, style)
    script = plain_text_speech_script(text, max_chars=settings.SPEECH_MAX_ADHOC_TEXT_CHARS)
    if not script['text']:
        raise SpeechServiceRejected

    session = tts_service_client.create_session(
        text=script['text'],
        voice_id=voice_id,
        style=style,
        text_hash=script['text_hash'],
        normalizer_version=script['normalizer_version'],
        source_revision=ADHOC_SOURCE_REVISION,
    )
    return {
        **session,
        'voice_id': voice_id,
        'style': style,
        'truncated': script['truncated'],
    }
