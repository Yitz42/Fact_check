# Fact Check

Paste text or upload files. Claims that are factually false are underlined in **red**,
in place. Click one to see a bubble with the corrected fact.

**Your text is never changed.** The AI only returns short quotes; the page finds each quote
verbatim in your original text (quotes it can't find are dropped, never guessed) and draws
highlights over your exact text. It also asserts that the displayed text equals your input.

It's a small static site (no server, no install, no build): `index.html`, `style.css`,
`core.js`, `app.js`. It works on computers and phones. The AI is called straight from the
browser.

## Run

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

then visit http://127.0.0.1:8000. To use it on a phone, put the folder on any static host
(GitHub Pages, Netlify, ...).

## Choose the AI (button in the top bar)

| Engine | Setup | Where your text goes |
|---|---|---|
| **Free** (default) | none | GPT-OSS 20B on Pollinations.ai. Less accurate; not for sensitive documents. |
| **Claude** | paste an API key from [console.anthropic.com](https://console.anthropic.com) and pick a model ("Load my models" lists what your key can use) | Straight to Anthropic. Key is kept for the session, or on the device if you tick "Remember". |
| **Local** (optional) | install [Ollama](https://ollama.com), `ollama pull llama3.1`, run `OLLAMA_ORIGINS=* ollama serve`, then "Detect models" | Stays on your computer. |

With no key entered, the free model is used automatically. A Claude.ai or Claude Code
login can't be used by other apps; it must be an API key.

## Files

`.txt .md .csv .json .html .pdf .docx` via the Upload button or drag and drop. Several files
open as tabs. PDF/Word text is read in your browser (the readers load from cdnjs, so that
needs internet). Scanned PDFs and images have no text to read.

Long documents are checked in pieces, so size is limited only by the AI service's speed
(200,000 characters per document).

## Test

Open `tests.html` in a browser (served as above). The tab title says `ALL n PASSED`.

## Limits

- The AI judges from its own training knowledge, with no web lookup. It can miss very recent
  events or flag things wrongly, and the free model is weaker than Claude. Treat flags as
  prompts to verify.
- Highlights sit on the text the page extracted. For PDF/Word/HTML that isn't the original layout.
- Browsers can block a hosted https page from reaching `http://localhost` Ollama (Safari does).
  Chrome and Firefox allow it.
