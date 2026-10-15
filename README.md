# Fact Check

Paste text or upload files. Flagged claims are highlighted in place, one colour per verdict:

| Colour | Meaning |
|---|---|
| **Red** | False: the claim is clearly wrong. |
| **Orange** | Misrepresented: a true basis that is distorted, exaggerated, cherry-picked, misquoted or missing context that changes its meaning. |
| **Yellow** | Can't be said definitely: stated as fact, but disputed, unproven or not reliably established. |

Click a highlight to see a bubble with what's actually true, why the claim was flagged, and
links to sources. The sources come from the AI (only `http`/`https` links are shown, at most
three), so open them to confirm; every bubble also has a "Search the web for this claim" link.

### Real sources with web search (optional, Claude or Gemini)

With **Claude** or **Gemini** selected, tick **Search the web for real sources** in the engine
settings. The box is separate for each, off by default, and never used by other providers.
The AI then looks claims up online while checking, and the page compares every source link
with what the search actually returned, so a link from memory is never shown as found:

- **Claude** reports the exact pages it found, so matching links are marked
  **✓ found by web search**. Anthropic bills about $0.01 per search, at most 10 searches per
  part of your text, plus the tokens the results use. If your Anthropic organization has web
  search turned off, the page says so; an admin can turn it on in the Claude Console under
  Settings → Capabilities.
- **Gemini** uses Google Search, which only reveals the sites it found (its links are Google
  redirects). A link on one of those sites is marked **✓ site found by search**: the site was
  searched, but the exact page came from memory, so open it to confirm. Google redirect links
  are marked **✓ found by web search** and shown as "via Google Search". Google's search
  suggestions are shown under your text, in a sandboxed frame (no scripts, links open in a new
  tab), as Google asks for grounded answers. Grounded requests are billed separately after a
  free allowance; see [Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing).

Searching is slower than checking from memory. The status line says how many searches ran.

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

Open `tests.html` in a browser (served as above). The tab title says `ALL n PASSED`. The tests cover quote matching, verdicts, source-link filtering, Claude and Gemini web search (paused Claude turns, the fallback for older Claude models, Gemini site matching), chunking, and the request format of every provider.

## Limits

- The AI judges from its own training knowledge, with no web lookup. It can miss very recent
  events or flag things wrongly, and the free model is weaker than Claude. Treat flags as
  prompts to verify. Unless web search is on, source links are suggested from the AI's
  memory, not looked up, so a link can be wrong or dead; the web-search link always works.
- Highlights sit on the text the page extracted. For PDF/Word/HTML that isn't the original layout.
- Browsers can block a hosted https page from reaching `http://localhost` Ollama (Safari does).
  Chrome and Firefox allow it.
