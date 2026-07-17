#!/usr/bin/env python3
"""Run the canonical research-MVP demonstration."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
from foresight.cli import run_study


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,default=ROOT/"generated/demo")
    parser.add_argument("--input",type=Path,default=ROOT/"examples/soy-trade-shock.json")
    args=parser.parse_args(argv)
    result=run_study(args.input,args.output)
    print(f"status={result['status']} runs={result['runs']} actors={result['actors']} specialists={result['specialists']}")
    for name,path in result["outputs"].items(): print(f"{name}={path}")
    return 0

if __name__=="__main__": raise SystemExit(main())
