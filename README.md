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

| Provider | Needs | Where your text goes |
|---|---|---|
| **Free** (default) | nothing | GPT-OSS 20B on Pollinations.ai. Less accurate; not for sensitive documents. |
| **Claude** (Anthropic) | API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) | Straight to Anthropic |
| **ChatGPT** (OpenAI) | API key from [platform.openai.com](https://platform.openai.com/api-keys) | Straight to OpenAI |
| **Gemini** (Google) | API key from [aistudio.google.com](https://aistudio.google.com/apikey) (has a free tier) | Straight to Google |
| **Mistral**, **Groq**, **OpenRouter**, **Grok** (xAI), **DeepSeek** | that service's API key | Straight to that service |
| **Other** | any OpenAI-compatible address (LM Studio, a company gateway, ...), key optional | That server |
| **Ollama** (optional, private) | install [Ollama](https://ollama.com), `ollama pull llama3.1`, run `OLLAMA_ORIGINS=* ollama serve`, then "Detect models" | Stays on your computer |

Each cloud provider has its own key box, model list and "Remember key on this device" option.
The model list shows your recently used models first, then "Recommended for accuracy", then
the rest ("Load my models" fetches what your key can use; you can also type a name). The
ranking is a rule of thumb, not a benchmark: bigger, newer models tend to get facts right more
often, while mini/lite/small variants, previews and dated snapshots rank lower. Keys are sent only to that
provider and are kept for the browser session unless you tick Remember. With no key entered,
the free model is used automatically.

These are API keys, not chat logins: a Claude.ai, Claude Code or ChatGPT subscription can't
be used by other apps.

## Files

`.txt .md .csv .json .html .pdf .docx` via the Upload button or drag and drop. Several files
open as tabs. PDF/Word text is read in your browser (the readers load from cdnjs, so that
needs internet). Scanned PDFs and images have no text to read.

Long documents are checked in pieces, so size is limited only by the AI service's speed
(200,000 characters per document).

## Test

Open `tests.html` in a browser (served as above). The tab title says `ALL n PASSED`. The tests cover quote matching, chunking, and the request format of every provider.

## Limits

- The AI judges from its own training knowledge, with no web lookup. It can miss very recent
  events or flag things wrongly, and the free model is weaker than Claude. Treat flags as
  prompts to verify.
- Highlights sit on the text the page extracted. For PDF/Word/HTML that isn't the original layout.
- Browsers can block a hosted https page from reaching `http://localhost` Ollama (Safari does).
  Chrome and Firefox allow it.
