"""Shared Firebase Admin SDK initialization."""

import os
from typing import Any, Dict

try:
    import firebase_admin
    from firebase_admin import credentials
except ImportError:
    firebase_admin = None
    credentials = None


def initialize_firebase_app(config: Dict[str, Any]):
    """Return the default Firebase app, initializing it once when necessary."""
    if firebase_admin is None or credentials is None:
        raise RuntimeError("Firebase Admin SDK is unavailable.")

    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    key_path = config.get("firebase_key_path")
    if key_path:
        if not os.path.isfile(key_path):
            raise RuntimeError("Firebase credential file is unavailable.")
        credential = credentials.Certificate(key_path)
    else:
        credential = credentials.ApplicationDefault()

    options = {}
    storage_bucket = config.get("firebase_storage_bucket")
    if storage_bucket:
        options["storageBucket"] = storage_bucket

    try:
        return firebase_admin.initialize_app(credential, options=options or None)
    except ValueError:
        # Another service may have initialized the default app concurrently.
        return firebase_admin.get_app()
