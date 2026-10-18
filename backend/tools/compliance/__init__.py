"""Compliance tool: Q&A + dashboard views over the shared core."""
from __future__ import annotations

from . import views
from .assistant import ComplianceAssistant

__all__ = ["ComplianceAssistant", "views"]
