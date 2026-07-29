# PolyTwist Mathematical Monograph

This directory contains the self-contained mathematical foundation for the Stratified Kinematic Atlas.

## Files

- `polytwist-monograph.tex`: canonical LaTeX source.
- `polytwist-monograph.pdf`: compiled artifact generated from the source.
- `../sources/references.bib`: bibliography used by the monograph.

The source contains all diagrams directly in TikZ. No external image asset is required.

## Build

From `research/monograph/`:

```bash
latexmk -pdf -interaction=nonstopmode -halt-on-error polytwist-monograph.tex
```

A manual equivalent is:

```bash
pdflatex -interaction=nonstopmode -halt-on-error polytwist-monograph.tex
biber polytwist-monograph
pdflatex -interaction=nonstopmode -halt-on-error polytwist-monograph.tex
pdflatex -interaction=nonstopmode -halt-on-error polytwist-monograph.tex
```

TeX dependencies include `newtx`, `mathtools`, `amsthm`, `tikz`, `tcolorbox`, `biblatex`, `biber`, `cleveref`, and `seqsplit`.

## Status

The monograph is a mathematical research draft dated 2026-07-29 and audited against repository commit:

```text
a970c65ab367b98ea380d48919c449bb63fa8638
```

It introduces a target formalism and proves the results listed in `../mathematics/THEOREM_LEDGER.md`. It does not claim that the current runtime implements the general atlas.

## Reproducibility checks

The released PDF should satisfy:

- successful `latexmk` build with no undefined references or citations;
- no overfull or underfull boxes in the final log;
- 200-DPI rendered-page inspection for clipping and diagram defects;
- bibliography resolved from `../sources/references.bib`;
- all repository-specific theorem IDs synchronized with `../claims.json`.
