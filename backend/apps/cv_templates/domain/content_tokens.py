"""Thay token {position} trong content template — module thuần, models và services đều dùng được."""


def _format(value, position_name):
    return value.replace('{position}', position_name)


def _materialize_tokens(value, position_name):
    if isinstance(value, str):
        return _format(value, position_name)
    if isinstance(value, list):
        return [_materialize_tokens(item, position_name) for item in value]
    if isinstance(value, dict):
        return {key: _materialize_tokens(item, position_name) for key, item in value.items()}
    return value
