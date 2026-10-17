"""HTTP API for the frontend. The only place the web framework lives."""
from __future__ import annotations

from .main import create_app

__all__ = ["create_app"]
