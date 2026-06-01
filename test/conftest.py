"""Pytest config for HERMENEUT integration tests.

Ensures the project root is on sys.path so `from contracts import ...`
works if you ever import the contract module for direct-mode tests, and
silences a few noisy warnings from gltest's deps.
"""
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

warnings.filterwarnings("ignore", category=DeprecationWarning)
