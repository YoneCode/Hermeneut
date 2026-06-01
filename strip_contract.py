#!/usr/bin/env python3
"""
AST-based stripper: parse, drop docstrings, re-emit via ast.unparse.

Comments are gone after parse anyway, so the output keeps full
semantics minus docstrings. The first-line GenVM runner header
(`# { "Depends": "..." }`) is re-attached after unparse.

Usage:
    python3 strip_contract.py contracts/hermeneut.py \
        -o contracts/hermeneut.min.py
"""
from __future__ import annotations
import argparse
import ast
import io
import sys


def _strip_docstrings(tree: ast.AST) -> None:
    for node in ast.walk(tree):
        if isinstance(
            node,
            (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef),
        ):
            body = getattr(node, "body", None)
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                # Remove the leading docstring node.
                body.pop(0)
                # Make sure the body is non-empty so the unparse stays valid.
                if not body:
                    body.append(ast.Pass())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("-o", "--output")
    args = ap.parse_args()

    with open(args.path) as f:
        source = f.read()

    # Preserve the GenVM runner header if it's on the first line.
    header = ""
    rest = source
    first_nl = source.find("\n")
    if first_nl >= 0 and source.startswith("# {"):
        header = source[: first_nl + 1]
        rest = source[first_nl + 1 :]

    tree = ast.parse(rest)
    _strip_docstrings(tree)
    unparsed = ast.unparse(tree)
    if not unparsed.endswith("\n"):
        unparsed += "\n"

    out = header + unparsed

    print(
        f"original={len(source)} bytes  stripped={len(out)} bytes  "
        f"reduction={(1 - len(out) / len(source)) * 100:.1f}%",
        file=sys.stderr,
    )

    if args.output:
        with open(args.output, "w") as f:
            f.write(out)
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
