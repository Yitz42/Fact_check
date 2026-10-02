(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const review = $("review");
  const checkBtn = $("check");
  const editBtn = $("edit");
  const statusEl = $("status");
  const bubble = $("bubble");
  const bubbleCorrection = $("bubble-correction");
  const bubbleWhy = $("bubble-why");
  const tabsEl = $("tabs");
  const fileEl = $("file");
  const dropEl = $("drop");
  const engineBtn = $("engine");
  const engineLabel = $("engine-label");
  const dialog = $("settings");
  const settingsStatus = $("settings-status");
  const keyEl = $("key");
  const rememberEl = $("remember");
  const modelEl = $("model");
  const ollamaUrlEl = $("ollama-url");
  const ollamaModelEl = $("ollama-model");

  const Core = window.FactCore;
  const MAX_CHARS = 200000;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const CLAUDE_MODELS = [
    ["claude-sonnet-5-5", "Claude Sonnet 5.5"],
    ["claude-opus-5-5", "Claude Opus 5.5"],
    ["claude-fable-5-1", "Claude Fable 5.1"],
    ["claude-haiku-4-5", "Claude Haiku 4.5"],
  ];
  const LIBS = {
    pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    docx: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
  };
  const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // ---------- storage (every access guarded: it can be blocked or empty) ----------
  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (_) { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch (_) { /* ignore */ } },
    del(area, key) { try { window[area].removeItem(key); } catch (_) { /* ignore */ } },
  };

  // ---------- engine settings (behind the button in the top bar) ----------
  const settings = {
    provider: store.get("localStorage", "fc_provider") || "free",
    claudeModel: store.get("localStorage", "fc_amodel") || Core.DEFAULT_ANTHROPIC_MODEL,
    ollamaUrl: store.get("localStorage", "fc_ourl") || Core.DEFAULT_OLLAMA_URL,
    ollamaModel: store.get("localStorage", "fc_omodel") || "",
  };

  function fillSelect(select, models, selected, emptyText) {
    select.replaceChildren();
    if (!models.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyText || "No models";
      select.append(opt);
      return;
    }
    const list = models.slice();
    if (selected && !list.some(([id]) => id === selected)) list.push([selected, selected]);
    for (const [id, name] of list) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      opt.title = id;
      select.append(opt);
    }
    select.value = selected && list.some(([id]) => id === selected) ? selected : list[0][0];
  }

  function saveKey() {
    store.del("localStorage", "fc_key");
    store.del("sessionStorage", "fc_key");
    if (keyEl.value) store.set(rememberEl.checked ? "localStorage" : "sessionStorage", "fc_key", keyEl.value);
    refreshEngine();
  }

  // The engine actually used: Claude only with a key, Ollama only once a model is chosen,
  // otherwise the free model.
  function currentEngine() {
    const key = keyEl.value.trim();
    if (settings.provider === "anthropic" && key) {
      const name = modelEl.options[modelEl.selectedIndex];
      return { kind: "anthropic", key, model: modelEl.value || settings.claudeModel, label: name ? name.textContent : settings.claudeModel };
    }
    if (settings.provider === "ollama" && settings.ollamaModel) {
      return { kind: "ollama", url: settings.ollamaUrl, model: settings.ollamaModel, label: `${settings.ollamaModel} (on your computer)` };
    }
    return { kind: "free", label: "Free model" };
  }

  function refreshEngine() {
    const engine = currentEngine();
    engineLabel.textContent = engine.label;
    engineBtn.dataset.kind = engine.kind;
    document.querySelectorAll(".seg [data-provider]").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.provider === settings.provider));
    });
    document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== settings.provider; });
  }

  function setSettingsStatus(message, isError) {
    settingsStatus.textContent = message;
    settingsStatus.classList.toggle("error", Boolean(isError));
  }

  keyEl.value = store.get("localStorage", "fc_key") || store.get("sessionStorage", "fc_key") || "";
  rememberEl.checked = Boolean(store.get("localStorage", "fc_key"));
  fillSelect(modelEl, CLAUDE_MODELS, settings.claudeModel);
  fillSelect(ollamaModelEl, settings.ollamaModel ? [[settings.ollamaModel, settings.ollamaModel]] : [], settings.ollamaModel, "Click “Detect models”");
  ollamaUrlEl.value = settings.ollamaUrl;
  refreshEngine();

  engineBtn.addEventListener("click", () => { setSettingsStatus(""); dialog.showModal(); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  document.querySelectorAll(".seg [data-provider]").forEach((b) => b.addEventListener("click", () => {
    settings.provider = b.dataset.provider;
    store.set("localStorage", "fc_provider", settings.provider);
    setSettingsStatus("");
    refreshEngine();
  }));
  keyEl.addEventListener("input", saveKey);
  rememberEl.addEventListener("change", saveKey);
  modelEl.addEventListener("change", () => {
    settings.claudeModel = modelEl.value;
    store.set("localStorage", "fc_amodel", modelEl.value);
    refreshEngine();
  });
  ollamaUrlEl.addEventListener("change", () => {
    settings.ollamaUrl = ollamaUrlEl.value.trim() || Core.DEFAULT_OLLAMA_URL;
    store.set("localStorage", "fc_ourl", settings.ollamaUrl);
  });
  ollamaModelEl.addEventListener("change", () => {
    settings.ollamaModel = ollamaModelEl.value;
    store.set("localStorage", "fc_omodel", settings.ollamaModel);
    refreshEngine();
  });

  $("load-models").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!keyEl.value.trim()) return setSettingsStatus("Enter your API key first.", true);
    btn.disabled = true;
    setSettingsStatus("Loading models…");
    try {
      const models = await Core.listAnthropicModels(keyEl.value.trim());
      if (!models.length) throw new Error("No Claude models were returned for this key.");
      fillSelect(modelEl, models.map((m) => [m.id, m.name]), modelEl.value);
      settings.claudeModel = modelEl.value;
      store.set("localStorage", "fc_amodel", modelEl.value);
      refreshEngine();
      setSettingsStatus(`${models.length} models available.`);
    } catch (err) {
      setSettingsStatus(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $("detect-ollama").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    settings.ollamaUrl = ollamaUrlEl.value.trim() || Core.DEFAULT_OLLAMA_URL;
    store.set("localStorage", "fc_ourl", settings.ollamaUrl);
    btn.disabled = true;
    setSettingsStatus("Looking for Ollama…");
    try {
      const models = await Core.listOllamaModels(settings.ollamaUrl);
      if (!models.length) throw new Error("Ollama is running but has no models. Run: ollama pull llama3.1");
      fillSelect(ollamaModelEl, models.map((m) => [m.id, m.name]), settings.ollamaModel);
      settings.ollamaModel = ollamaModelEl.value;
      store.set("localStorage", "fc_omodel", settings.ollamaModel);
      refreshEngine();
      setSettingsStatus(`Found ${models.length} model${models.length === 1 ? "" : "s"} on your computer.`);
    } catch (err) {
      setSettingsStatus(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  // ---------- documents (pasted text or uploaded files), one tab each ----------
  let docs = [];
  let active = 0;
  let nextId = 1;

  function newDoc(name, text) {
    docs.push({ id: nextId++, name, text, claims: null, unplaced: 0, note: "" });
    active = docs.length - 1;
  }
  newDoc("Pasted text", "");

  const current = () => docs[active];

  function renderTabs() {
    tabsEl.replaceChildren();
    docs.forEach((doc, i) => {
      const tab = document.createElement("div");
      tab.className = "tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(i === active));
      tab.tabIndex = 0;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = doc.name;
      tab.append(name);
      if (doc.claims && doc.claims.length) {
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = String(doc.claims.length);
        tab.append(count);
      }
      const close = document.createElement("button");
      close.className = "close";
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", `Close ${doc.name}`);
      close.addEventListener("click", (e) => { e.stopPropagation(); closeDoc(i); });
      tab.append(close);
      tab.addEventListener("click", () => selectDoc(i));
      tab.addEventListener("keydown", (e) => {
        if (e.target === tab && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectDoc(i); }
      });
      tabsEl.append(tab);
    });
  }

  $("add-doc").addEventListener("click", () => { newDoc("Pasted text", ""); showDoc(); input.focus(); });

  function selectDoc(i) {
    active = i;
    showDoc();
  }

  function closeDoc(i) {
    docs.splice(i, 1);
    if (!docs.length) newDoc("Pasted text", "");
    active = Math.min(active, docs.length - 1);
    showDoc();
  }

  // Show the active document: edit box if unchecked, highlighted read-only view if checked.
  function showDoc() {
    hideBubble();
    const doc = current();
    renderTabs();
    if (doc.claims) {
      render(doc.text, doc.claims);
      input.hidden = true;
      review.hidden = false;
      checkBtn.hidden = true;
      editBtn.hidden = false;
      const n = doc.claims.length;
      let message = n === 0 ? "No false claims found." : `${n} false claim${n === 1 ? "" : "s"} found. Click a red highlight.`;
      if (doc.unplaced) message += ` (${doc.unplaced} couldn't be located in the text.)`;
      if (doc.note) message += ` ${doc.note}`;
      setStatus(message);
    } else {
      input.value = doc.text;
      input.hidden = false;
      review.hidden = true;
      checkBtn.hidden = false;
      editBtn.hidden = true;
      setStatus("");
    }
  }

  input.addEventListener("input", () => { current().text = input.value; });

  // ---------- rendering: original text, unchanged, with <mark> around flagged ranges ----------
  let currentClaims = [];
  let activeMark = null;

  function render(text, claims) {
    currentClaims = claims;
    review.replaceChildren();
    let pos = 0;
    claims.forEach((claim, i) => {
      if (claim.start < pos) return;
      review.append(text.slice(pos, claim.start));
      const mark = document.createElement("mark");
      mark.className = "false-claim";
      mark.tabIndex = 0;
      mark.dataset.claim = String(i);
      mark.textContent = text.slice(claim.start, claim.end);
      review.append(mark);
      pos = claim.end;
    });
    review.append(text.slice(pos));
    if (review.textContent !== text) {
      throw new Error("Safety check failed: rendered text differs from the original.");
    }
  }

  function showBubble(mark, claim) {
    hideBubble();
    activeMark = mark;
    mark.classList.add("active");
    bubbleCorrection.textContent = claim.correction;
    bubbleWhy.textContent = claim.explanation;
    bubble.hidden = false;
    const rect = mark.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    bubble.style.left = `${left + window.scrollX}px`;
    bubble.style.top = `${rect.bottom + window.scrollY + 8}px`;
  }

  function hideBubble() {
    bubble.hidden = true;
    if (activeMark) activeMark.classList.remove("active");
    activeMark = null;
  }

  review.addEventListener("click", (event) => {
    const mark = event.target.closest("mark.false-claim");
    if (!mark) return;
    event.stopPropagation();
    if (mark === activeMark) return hideBubble();
    showBubble(mark, currentClaims[Number(mark.dataset.claim)]);
  });
  review.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("mark.false-claim")) {
      event.preventDefault();
      event.target.click();
    }
  });
  document.addEventListener("click", (event) => {
    if (!bubble.contains(event.target)) hideBubble();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideBubble();
  });
  window.addEventListener("resize", hideBubble);

  // ---------- checking ----------
  async function runCheck() {
    const doc = current();
    const text = doc.text;
    if (!text.trim()) return setStatus("Paste, type or upload some text first.", true);
    if (text.length > MAX_CHARS) return setStatus(`Text is too long (max ${MAX_CHARS.toLocaleString()} characters).`, true);
    const engine = currentEngine();
    checkBtn.disabled = true;
    setStatus(`Checking with ${engine.label}…`);
    try {
      const result = await Core.checkText(text, engine, (i, n) => setStatus(`Checking part ${i} of ${n} with ${engine.label}…`));
      doc.claims = result.claims;
      doc.unplaced = result.unplaced;
      const notes = [`Checked with ${engine.label}.`];
      if (settings.provider === "anthropic" && engine.kind === "free") notes.push("(No API key set, so the free model was used.)");
      if (result.failedParts) notes.push(`${result.failedParts} of ${result.parts} parts couldn't be checked.`);
      doc.note = notes.join(" ");
      if (current() === doc) showDoc(); else renderTabs();
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener("click", runCheck);
  editBtn.addEventListener("click", () => {
    current().claims = null;
    showDoc();
    input.focus();
  });

  // ---------- file upload: read the text out of the file, in the browser ----------
  const libCache = {};
  function ensureLib(name) {
    libCache[name] = libCache[name] || new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LIBS[name];
      s.onload = resolve;
      s.onerror = () => { delete libCache[name]; reject(new Error("Couldn't load the PDF/Word reader (needs an internet connection).")); };
      document.head.append(s);
    });
    return libCache[name];
  }

  async function extractPdf(buffer) {
    await ensureLib("pdf");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      let out = "";
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform ? item.transform[5] : null;
        if (out && lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
        out += item.str;
        if (item.hasEOL) out += "\n";
        if (y !== null && item.str) lastY = y;
      }
      pages.push(out.trim());
    }
    return pages.join("\n\n");
  }

  async function extractText(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return extractPdf(await file.arrayBuffer());
    if (ext === "docx") {
      await ensureLib("docx");
      return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    }
    if (["doc", "png", "jpg", "jpeg", "gif", "webp", "xlsx", "pptx", "zip"].includes(ext)) {
      throw new Error("this file type isn't supported");
    }
    const text = await file.text();
    if (ext === "html" || ext === "htm") return new DOMParser().parseFromString(text, "text/html").body.textContent;
    return text;
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    const problems = [];
    let added = 0;
    for (const file of files) {
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error("larger than 20 MB");
        setStatus(`Reading ${file.name}…`);
        const text = await extractText(file);
        if (!text.trim()) throw new Error("no readable text (scanned PDFs and images aren't supported)");
        // Replace the single empty starter tab instead of leaving it behind.
        if (docs.length === 1 && !docs[0].text.trim() && !docs[0].claims) docs.pop();
        newDoc(file.name, text);
        added++;
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }
    if (!docs.length) newDoc("Pasted text", "");
    showDoc();
    if (problems.length) setStatus(`Couldn't read ${problems.join("; ")}`, true);
    else if (added) setStatus(`Loaded ${added} file${added === 1 ? "" : "s"}. Click Fact-check.`);
  }

  $("upload").addEventListener("click", () => fileEl.click());
  fileEl.addEventListener("change", () => { addFiles(fileEl.files); fileEl.value = ""; });

  ["dragenter", "dragover"].forEach((type) => dropEl.addEventListener(type, (e) => {
    e.preventDefault();
    dropEl.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((type) => dropEl.addEventListener(type, (e) => {
    e.preventDefault();
    dropEl.classList.remove("dragging");
  }));
  dropEl.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  showDoc();
})();
