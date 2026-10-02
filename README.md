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
python3 server.py
```

Open http://127.0.0.1:8000, then:

1. **Paste your API key** at the top. It must be an API key from
   [console.anthropic.com](https://console.anthropic.com) (a Claude.ai or Claude Code login
   can't be used by other apps). The key is sent only to the local server and on to
   Anthropic. It is kept for the browser session, or on this device if you tick
   "Remember key". Alternatively put `ANTHROPIC_API_KEY=...` in a `.env` file
   (see `.env.example`) and leave the field empty.
2. **Pick a model.** The list has common models; "Load my models" fetches exactly what your
   key can use.
3. **Paste text or upload files** (button or drag and drop): `.txt .md .csv .json .html .pdf .docx`.
   Several files open as tabs. PDF and Word text is read in your browser (the readers load
   from cdnjs, so that part needs internet). Scanned PDFs and images have no text to read.
4. Click **Fact-check**.

## Test

```bash
python3 -m unittest
```

## Limits

- Claude judges from its own training knowledge, with no web lookup, so it can miss very
  recent events or occasionally flag something wrongly. Treat flags as prompts to verify.
- Text is limited to 200,000 characters per document.
- Highlights sit on the extracted text. For PDF/Word/HTML that is the text the page read from the file, not the original layout.
