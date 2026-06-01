#!/usr/bin/env python3
"""
enrich_company_profiles.py — full pipeline wrapper.

Runs gather (raw + summaries) then synthesize (display fields).

Prefer running steps separately:
  python3 populate_company_urls.py --event <slug>
  python3 gather_company_signals.py --event <slug>
  python3 synthesize_company_profiles.py --event <slug>

This script runs gather + synthesize in one go:
  python3 enrich_company_profiles.py --event identity-week-2026
"""

import sys

from gather_company_signals import main as gather_main
from synthesize_company_profiles import main as synthesize_main


def main():
    print("Running full pipeline: gather → synthesize\n")
    gather_main()
    print("\n" + "=" * 60 + "\n")
    synthesize_main()


if __name__ == "__main__":
    main()
