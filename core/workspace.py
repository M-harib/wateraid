"""Per-project uploaded-document corpus: status tracker + disk persistence."""
from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .ingest import kind_from_name, units_from_file
from .store import FindingStore, UnitStore

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class DocMeta:
    doc_id: str
    filename: str
    kind: str
    status: str = "queued"  # queued | ingesting | ready | failed
    error: str | None = None
    unit_count: int = 0
    uploaded_at: str = field(default_factory=_now)

    def to_dict(self) -> dict:
        return asdict(self)


class ProjectCorpus:
    """One project's uploaded files, their ingestion status, and in-memory units."""

    def __init__(self, project_id: str, root: Path) -> None:
        self.project_id = project_id
        self.root = root
        self.files_dir = root / "files"
        self.meta_path = root / "documents.json"
        self.units = UnitStore()
        self.findings = FindingStore()
        self.docs: dict[str, DocMeta] = {}
        self._lock = asyncio.Lock()
        self._tasks: set[asyncio.Task] = set()

    def _stored_path(self, meta: DocMeta) -> Path:
        return self.files_dir / f"{meta.doc_id}__{meta.filename}"

    async def _persist(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        payload = json.dumps([m.to_dict() for m in self.docs.values()], indent=2)
        await asyncio.to_thread(self.meta_path.write_text, payload)

    async def add_file(self, filename: str, data: bytes) -> DocMeta:
        """Save an upload and register it as queued. Raises ValueError on bad type."""
        name = _SAFE.sub("_", Path(filename).name) or "upload"
        kind = kind_from_name(name)
        if kind is None:
            raise ValueError(f"unsupported file type: {filename}")
        self.files_dir.mkdir(parents=True, exist_ok=True)
        meta = DocMeta(doc_id=uuid.uuid4().hex[:12], filename=name, kind=kind)
        await asyncio.to_thread(self._stored_path(meta).write_bytes, data)
        async with self._lock:
            self.docs[meta.doc_id] = meta
            await self._persist()
        return meta

    async def ingest(self, doc_id: str) -> None:
        """Parse one queued file into units; update the tracker to ready/failed."""
        meta = self.docs.get(doc_id)
        if meta is None:
            return
        meta.status, meta.error = "ingesting", None
        await self._persist()
        try:
            units = await units_from_file(doc_id, str(self._stored_path(meta)), meta.kind)
            await self.units.remove_doc(doc_id)  # idempotent re-ingest
            await self.units.load(units)
            meta.status, meta.unit_count = "ready", len(units)
        except Exception as exc:  # noqa: BLE001 - any parse failure goes to the tracker
            meta.status, meta.error = "failed", str(exc)[:300]
        await self._persist()

    def schedule_ingest(self, doc_id: str) -> None:
        """Fire-and-forget background ingestion (status visible via the tracker)."""
        task = asyncio.create_task(self.ingest(doc_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def remove(self, doc_id: str) -> bool:
        meta = self.docs.pop(doc_id, None)
        if meta is None:
            return False
        await self.units.remove_doc(doc_id)
        path = self._stored_path(meta)
        if path.exists():
            await asyncio.to_thread(path.unlink)
        await self._persist()
        return True

    def path_for(self, doc_id: str) -> Path | None:
        meta = self.docs.get(doc_id)
        return self._stored_path(meta) if meta else None

    def documents(self) -> list[dict]:
        return [m.to_dict() for m in self.docs.values()]

    def ready(self) -> bool:
        return bool(self.docs) and all(m.status == "ready" for m in self.docs.values())

    def absent(self) -> list:
        return []

    async def load(self) -> None:
        """Restore docs from disk and re-ingest their files to rebuild units."""
        if not self.meta_path.exists():
            return
        try:
            data = json.loads(self.meta_path.read_text())
        except (json.JSONDecodeError, OSError):
            return
        fields = DocMeta.__dataclass_fields__
        for entry in data:
            meta = DocMeta(**{k: entry[k] for k in fields if k in entry})
            self.docs[meta.doc_id] = meta
        for doc_id, meta in list(self.docs.items()):
            if self._stored_path(meta).exists():
                await self.ingest(doc_id)
            else:
                meta.status, meta.error = "failed", "file missing"


class Workspace:
    """Projects keyed by id; files live under data/projects/<id>/."""

    def __init__(self, data_dir: str | Path | None = None) -> None:
        self.data_dir = Path(data_dir or os.getenv("GG_DATA_DIR", "data")) / "projects"
        self.projects: dict[str, ProjectCorpus] = {}
        self._lock = asyncio.Lock()

    async def project(self, project_id: str) -> ProjectCorpus:
        pid = _SAFE.sub("_", project_id) or "default"
        async with self._lock:
            corpus = self.projects.get(pid)
            if corpus is None:
                corpus = ProjectCorpus(pid, self.data_dir / pid)
                self.projects[pid] = corpus
                await corpus.load()
            return corpus

    async def load_all(self) -> None:
        if not self.data_dir.exists():
            return
        for child in sorted(self.data_dir.iterdir()):
            if child.is_dir():
                await self.project(child.name)
