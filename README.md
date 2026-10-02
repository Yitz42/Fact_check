# Fact Check

Paste text in. Claude finds statements that are factually false and highlights them in
**red**, in place. Click a highlight to see a bubble with the corrected fact.

Your text is never modified. Claude only returns short quotes; the server finds each quote
verbatim in your original text (quotes it can't find are dropped, never guessed), and the
page renders your exact text with highlights drawn over it. The page also asserts that the
rendered text equals your input before showing it.

## Run

Needs only Python 3 (no packages to install) and an Anthropic API key.

```bash
cp .env.example .env      # then put your key in .env
python3 server.py
```

Open http://127.0.0.1:8000.

Optional settings in `.env`: `FACTCHECK_MODEL` (default `claude-sonnet-5-5`), `PORT`.

## Test

```bash
python3 -m unittest
```

## Limits

- Claude judges from its own training knowledge, with no web lookup, so it can miss very
  recent events or occasionally flag something wrongly. Treat flags as prompts to verify.
- Text is limited to 20,000 characters.
