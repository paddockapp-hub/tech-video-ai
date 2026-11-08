"""Vercel Flask application entry point."""

import sys
from pathlib import Path

SOURCE_DIR = Path(__file__).resolve().parent / "src"
if str(SOURCE_DIR) not in sys.path:
    sys.path.insert(0, str(SOURCE_DIR))

from integrated_main import IntegratedSystem


_system = IntegratedSystem()
if _system.web_server is None or _system.web_server.app is None:
    raise RuntimeError("The Flask application could not be initialized.")

app = _system.web_server.app
