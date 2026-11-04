#!/usr/bin/env python3
"""Resolve the single errors-catalog conflict hunk in both mirror files.

Rule (MECHANICAL, preserves both intents verbatim):
  conflict block = OURS: [expanded public_receipt_not_found row]
                   THEIRS: [short public_receipt_not_found row, public_lobby_unavailable row]
  resolved       = OURS lines + THEIRS lines minus their first line
                   (the short receipt row is the base text the PR expanded;
                    keeping it would duplicate the code with stale copy).
Asserts: exactly one conflict block per file, OURS is 1 line naming
public_receipt_not_found, THEIRS is 2 lines whose first names the same code
and second names public_lobby_unavailable. Any other shape aborts.
"""
import sys

FILES = [
    "skills/project-room/references/errors-catalog.md",
    "plugins/project-room/skills/project-room/references/errors-catalog.md",
]

def resolve(path):
    lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
    out, i, blocks = [], 0, 0
    while i < len(lines):
        if lines[i].startswith("<<<<<<<"):
            j = lines.index(next(l for l in lines[i:] if l.startswith("=======")), i)
            k = next(idx for idx in range(j, len(lines)) if lines[idx].startswith(">>>>>>>"))
            ours, theirs = lines[i+1:j], lines[j+1:k]
            assert len(ours) == 1 and "public_receipt_not_found" in ours[0], ours
            assert len(theirs) == 2 and "public_receipt_not_found" in theirs[0], theirs
            assert "public_lobby_unavailable" in theirs[1], theirs
            out.extend(ours)
            out.extend(theirs[1:])
            blocks += 1
            i = k + 1
        else:
            out.append(lines[i]); i += 1
    assert blocks == 1, f"{path}: expected exactly 1 conflict block, got {blocks}"
    open(path, "w", encoding="utf-8").write("".join(out))
    print(f"resolved {path}: 1 block -> PR receipt row + main lobby row")

for f in FILES:
    resolve(f)
