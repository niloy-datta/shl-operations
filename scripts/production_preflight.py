#!/usr/bin/env python3
"""Offline configuration checks. Passing does NOT certify security or authorize go-live."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REQUIRED = (
    "SHL_DOMAIN", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD",
    "BOOTSTRAP_ADMIN_USERNAME", "BOOTSTRAP_ADMIN_PASSWORD", "MFA_ENCRYPTION_KEY",
)
DOMAIN = re.compile(r"^(?=.{4,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[A-Za-z]{2,63}$")
HEX_KEY = re.compile(r"^[0-9a-fA-F]{64}$")


def read_env(path: Path) -> dict[str, str]:
    settings: dict[str, str] = {}
    for index, row in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = row.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid .env syntax on line {index}")
        key, value = line.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) or key in settings:
            raise ValueError(f"Invalid or duplicate .env key on line {index}")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        settings[key] = value
    return settings


def validate_settings(settings: dict[str, str]) -> list[str]:
    failures: list[str] = []
    for name in REQUIRED:
        if not settings.get(name):
            failures.append(f"{name} is required")
    domain = settings.get("SHL_DOMAIN", "")
    if not DOMAIN.fullmatch(domain) or domain.endswith((".example.com", ".localhost", ".invalid", ".test")):
        failures.append("SHL_DOMAIN must be a real, fully qualified hostname")
    for name in ("POSTGRES_DB", "POSTGRES_USER", "BOOTSTRAP_ADMIN_USERNAME"):
        if settings.get(name) and not re.fullmatch(r"[A-Za-z0-9_-]{3,80}", settings[name]):
            failures.append(f"{name} has invalid characters or length")
    for name in ("POSTGRES_PASSWORD", "BOOTSTRAP_ADMIN_PASSWORD"):
        value = settings.get(name, "")
        if value and (len(value) < 20 or any(fragment in value.lower() for fragment in ("replace", "example", "password", "changeme"))):
            failures.append(f"{name} must be a unique, non-placeholder secret of at least 20 characters")
    if settings.get("POSTGRES_PASSWORD") and settings.get("POSTGRES_PASSWORD") == settings.get("BOOTSTRAP_ADMIN_PASSWORD"):
        failures.append("Database and administrator passwords must be different")
    key = settings.get("MFA_ENCRYPTION_KEY", "")
    if key and (not HEX_KEY.fullmatch(key) or len(set(key.lower())) < 8):
        failures.append("MFA_ENCRYPTION_KEY must be a high-entropy 64-character hex key")
    return failures


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    path = root / ".env"
    if not path.is_file():
        print("Missing .env — copy .env.production.example, configure secrets, and keep it private.", file=sys.stderr)
        return 1
    try:
        settings = read_env(path)
        issues = validate_settings(settings)
    except (OSError, ValueError) as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1
    if issues:
        for issue in issues:
            print(f"FAIL: {issue}", file=sys.stderr)
        return 1
    try:
        subprocess.run(
            ["docker", "compose", "--env-file", str(path), "-f", str(root / "compose.prod.yaml"),
             "config", "--quiet"],
            check=True, cwd=root
        )
    except (OSError, subprocess.CalledProcessError):
        print("FAIL: Docker Compose configuration validation failed.", file=sys.stderr)
        return 1
    print("Static production config checks passed. Security review, backup drills, and release approval remain mandatory.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
