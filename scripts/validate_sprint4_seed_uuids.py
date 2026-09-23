import re
import uuid
from pathlib import Path

text = Path("supabase/seed/sprint4_seed.sql").read_text(encoding="utf-8")
ids = re.findall(r"'([0-9a-fA-F-]{36})'", text)
bad = []
for s in ids:
    try:
        uuid.UUID(s)
    except Exception as exc:  # noqa: BLE001
        bad.append((s, str(exc)))

legacy = re.findall(r"'([g-zG-Z][0-9a-fA-F-]{35})'", text)
print(f"uuid_literals={len(ids)}")
print(f"invalid={bad}")
print(f"legacy_non_hex_prefix={legacy}")
raise SystemExit(0 if not bad and not legacy else 1)
