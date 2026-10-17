"""Helpers for safely resolving environment-variable references."""

import os
import re
from typing import Any, Dict, Optional


_ENV_REFERENCE = re.compile(r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)")


def resolve_env_value(value: Optional[str]) -> Optional[str]:
    """Resolve process.env.NAME references recursively without exposing values."""
    def expand(current: str, resolving: frozenset, depth: int) -> Optional[str]:
        if depth > 100:
            return None

        def replace(match) -> str:
            name = match.group(1)
            if name in resolving:
                raise ValueError("cyclic environment reference")
            referenced = os.getenv(name)
            if referenced is None:
                raise KeyError(name)
            resolved = expand(referenced, resolving | {name}, depth + 1)
            if resolved is None:
                raise ValueError("unresolvable environment reference")
            return resolved

        try:
            return _ENV_REFERENCE.sub(replace, current)
        except (KeyError, ValueError):
            return None

    if value is None:
        return None
    return expand(value, frozenset(), 0)


def get_env_value(name: str, default: Optional[str] = None) -> Optional[str]:
    """Read and recursively resolve an environment variable."""
    value = os.getenv(name)
    if value is None:
        return default
    return resolve_env_value(value)


def resolve_config_values(config: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively resolve process.env references in configuration structures."""
    def resolve(value: Any) -> Any:
        if isinstance(value, str):
            return resolve_env_value(value)
        if isinstance(value, list):
            return [resolve(item) for item in value]
        if isinstance(value, dict):
            return {key: resolve(item) for key, item in value.items()}
        return value

    return resolve(config)
