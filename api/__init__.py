"""HTTP API for the frontend. The only place the web framework lives."""
from __future__ import annotations


def create_app(*args, **kwargs):
    """Import lazily so ``python -m api.main`` does not execute the module twice."""
    from .main import create_app as build
    return build(*args, **kwargs)


__all__ = ["create_app"]
