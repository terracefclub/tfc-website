# Newsletter OCR job

Reads every newsletter page image in `static/archive/pages/` with Tesseract and writes one deterministic JSON file per newsletter to `src/lib/archive/ocr/<issue>.json`. The engine is Tesseract 5.5.3 with English data, supplied by the repo-local devenv (`devenv.nix`, pinned by `devenv.lock`). Nothing is installed in a user profile.

The images are renderings of the original PDFs, which are not stored in the repository. The recorded `sourcePdfSha256` ties each result back to the PDF the images came from.

## Rerun from a clean checkout

```sh
cd web
direnv allow .                       # once per checkout
direnv exec . bun run ocr:newsletters
```

That is the whole command. It needs no `bun install`. The first `direnv exec` in a fresh checkout may take a few minutes while Nix fetches Tesseract and the English model (about 25 MB).

Options (pass after the script name):

| Option | Effect |
| --- | --- |
| `--check` | Verify the committed files cover every page image with a matching hash and valid schema. Needs no OCR engine, so it also works in CI. Exits 1 when anything is stale. |
| `--force` | Re-run OCR for every page, ignoring committed results. |
| `--issue <slug>` | Only handle one newsletter, for example `--issue fall-2023`. Repeatable. |
| `--jobs <n>` | Parallel Tesseract processes. Default `min(4, CPU cores)`. |
| `--out <dir>` | Write somewhere else (for timing trials or comparisons). |

## What it does

For each newsletter it hashes every page image (and checks the hash against `static/archive/pages/manifest.json`), skips pages whose committed entry has the same image hash and was made by the same tool, engine and settings, runs Tesseract on the rest, and rewrites the JSON only if its bytes change. It prints per-newsletter and total counts: `processed`, `skipped`, `removed`, `failed`. Running it twice in a row therefore processes nothing and changes nothing. If any page fails, that newsletter's file is left untouched, the failure is printed, and the command exits 1; fix the cause and rerun.

Every page is read three times, with Tesseract's three binarisation methods (`thresholding_method` 0, 1 and 2). Pale text over photographs or marbled backgrounds can be invisible to one method and clear to another, and no single method wins everywhere. The page keeps the reading with the most solid words (words at confidence 70 or more); a later method must beat the current one by 5% to replace it, so near-ties keep the plainer method. Counting solid words rather than all words stops a noisy binarisation winning with hundreds of low-confidence guesses. The rule was picked by comparing candidate rules against the PDF text layer on the 56 pages whose text layer is rich enough to serve as a rough reference. The method used is stored per page as `thresholding`. This is a fixed, automatic rule, not manual correction.

A result file contains, per page: `page`, `file`, `sourceSha256` (of the page image), `text`, `thresholding` (the binarisation method kept), `confidence` (mean word confidence, 0-100, or `null` when no words were found), `words` and `solidWords`. The file header records `schemaVersion`, `issueSlug`, `sourcePdfSha256` and `tool` (`name`, `version`, `engine`, `language`, `psm`, `oem`, `thresholding`). There are no timestamps, so identical inputs give byte-identical output. Tesseract runs single-threaded per process (`OMP_THREAD_LIMIT=1`) for reproducibility.

Text is exactly what Tesseract read, joined into lines and paragraphs in its reading order. Nothing is corrected by hand or by a script. Columns, captions, decorative lettering and handwriting can be misread or interleaved, so treat it as a search aid. The page image is the authority.

## When results become stale

- A page image changes: its hash no longer matches, so only that page is redone.
- The job's `TOOL_VERSION` (in `lib.ts`) changes, or `devenv.lock` moves Tesseract to a new version: every page is redone, because the recorded `tool.engine`/`tool.version` differ. Bump `TOOL_VERSION` whenever the settings or text assembly change.
- Pages are added or removed from `static/archive/pages/manifest.json`: new pages are processed, removed pages are dropped.

After a rerun, review `git diff --stat` and spot-check a few pages before committing. `bun test` (`tests/newsletter-ocr.test.ts`) verifies the schema, that every page image has a current entry, and, when run inside the devenv, that re-reading one page reproduces the committed text.

## Runtime

Measured on a 10-core Apple Silicon Mac: all 102 pages (306 Tesseract passes) took 152.6 s with 5 parallel jobs on a lightly loaded machine, and 447.8 s with 4 jobs while the machine was heavily loaded. Expect roughly 3 to 8 minutes. A rerun with nothing changed takes about 2 seconds. If you add many more pages, or the machine is busy, use falcon.

## Running on the Linux builder (falcon)

Falcon has 32 cores, Nix, devenv and direnv. Use the shared heavy-job queue so that only one heavy job runs at a time. This route was written for the job but has not been exercised; check it with `--check` first.

```sh
# from the repository root, copy the working tree (without local state) to a task-specific checkout
rsync -a --delete --exclude node_modules --exclude .devenv --exclude .direnv --exclude .svelte-kit --exclude build \
  -e 'ssh -o IdentitiesOnly=yes -i ~/.ssh/personal' ./ tristan@192.168.50.215:terrace-work/newsletter-ocr/

# run through the queue, then copy the results back
/Users/tristan/.codex/worktrees/terrace-revival/millionaire/tools/falcon-heavy -C ~/terrace-work/newsletter-ocr/web -- \
  'direnv allow . && direnv exec . bun run ocr:newsletters --jobs 16'
rsync -a -e 'ssh -o IdentitiesOnly=yes -i ~/.ssh/personal' \
  tristan@192.168.50.215:terrace-work/newsletter-ocr/web/src/lib/archive/ocr/ web/src/lib/archive/ocr/
```

Results from a different platform or build are not guaranteed to be byte-identical (image decoder and floating-point details). Review `git diff --stat` on the copied-back files: if pages that should be unchanged differ, commit results from one platform only.
