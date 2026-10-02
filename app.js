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
  const modelMenuEl = $("model-menu");
  const providerEl = $("provider");
  const providerNoteEl = $("provider-note");
  const panelKeyEl = $("panel-key");
  const panelOllamaEl = $("panel-ollama");
  const urlFieldEl = $("url-field");
  const customUrlEl = $("custom-url");
  const keyLabelEl = $("key-label");
  const keyHintEl = $("key-hint");
  const ollamaUrlEl = $("ollama-url");
  const ollamaModelEl = $("ollama-model");

  const Core = window.FactCore;
  const MAX_CHARS = 200000;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
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
  const P = Core.providerById;
  const cfg = { provider: "free", models: {}, urls: {}, recent: {} };
  try { Object.assign(cfg, JSON.parse(store.get("localStorage", "fc_cfg") || "{}")); } catch (_) { /* start fresh */ }
  if (!Core.PROVIDERS.some((p) => p.id === cfg.provider)) cfg.provider = "free";
  cfg.models = cfg.models || {};
  cfg.urls = cfg.urls || {};
  cfg.recent = cfg.recent || {};
  const saveCfg = () => store.set("localStorage", "fc_cfg", JSON.stringify(cfg));

  // Keys live in memory per provider; each is saved under its own storage key.
  const keys = {};
  for (const p of Core.PROVIDERS) {
    keys[p.id] = store.get("localStorage", `fc_key_${p.id}`) || store.get("sessionStorage", `fc_key_${p.id}`) || "";
  }
  // Older versions saved a single Claude key.
  keys.anthropic = keys.anthropic || store.get("localStorage", "fc_key") || store.get("sessionStorage", "fc_key") || "";
  const remembered = (id) => Boolean(store.get("localStorage", `fc_key_${id}`) || (id === "anthropic" && store.get("localStorage", "fc_key")));

  const loadedModels = {}; // provider id -> [{id, name}] from "Load my models"
  const modelName = (p, id) => {
    const hit = (loadedModels[p.id] || []).concat((p.models || []).map(([i, n]) => ({ id: i, name: n }))).find((m) => m.id === id);
    return hit ? hit.name : id;
  };

  function fillProviders() {
    const groups = [["free", "Free"], ["cloud", "Cloud (needs your API key)"], ["private", "Private (stays on your computer)"]];
    for (const [group, label] of groups) {
      const og = document.createElement("optgroup");
      og.label = label;
      for (const p of Core.PROVIDERS.filter((x) => x.group === group)) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.label;
        og.append(opt);
      }
      providerEl.append(og);
    }
  }

  // Most recently used models for a provider, newest first (kept on this device only).
  const recentOf = (id) => cfg.recent[id] || [];
  function pushRecent(id, model) {
    if (!model) return;
    cfg.recent[id] = [model].concat(recentOf(id).filter((m) => m !== model)).slice(0, 4);
    saveCfg();
  }

  const modelChoices = (p) => loadedModels[p.id] || (p.models || []).map(([id, name]) => ({ id, name }));

  // The model list: recently used, then recommended for accuracy, then the rest.
  // `filter` narrows it while the user types in the box.
  function renderModelMenu(p, filter) {
    const q = (filter || "").trim().toLowerCase();
    const selected = cfg.models[p.id] || p.defaultModel || "";
    const ranked = Core.rankModels(modelChoices(p));
    const byId = new Map(ranked.map((m) => [m.id, m]));
    const matches = (m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
    const recent = recentOf(p.id).map((id) => byId.get(id) || { id, name: id }).filter(matches);
    const seen = new Set(recent.map((m) => m.id));
    const recommended = ranked.filter((m) => m.recommended && !seen.has(m.id) && matches(m));
    recommended.forEach((m) => seen.add(m.id));
    const rest = ranked.filter((m) => !seen.has(m.id) && matches(m));

    modelMenuEl.replaceChildren();
    const section = (title, items, badge) => {
      if (!items.length) return;
      const head = document.createElement("div");
      head.className = "menu-head";
      head.textContent = title;
      modelMenuEl.append(head);
      for (const m of items) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "menu-item";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(m.id === selected));
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = m.id === selected ? "✓" : "";
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = m.name;
        if (m.name !== m.id && !m.name.includes(m.id)) {
          const id = document.createElement("span");
          id.className = "id";
          id.textContent = `  ${m.id}`;
          label.append(id);
        }
        row.append(tick, label);
        if (badge) {
          const b = document.createElement("span");
          b.className = "badge";
          b.textContent = badge;
          row.append(b);
        }
        row.addEventListener("click", () => chooseModel(p, m.id));
        modelMenuEl.append(row);
      }
    };
    section("Recently used", recent);
    section("Recommended for accuracy", recommended, "Recommended");
    section(q ? "Matches" : "All models", rest);
    if (!modelMenuEl.children.length) {
      const empty = document.createElement("div");
      empty.className = "menu-empty";
      empty.textContent = q ? "No match. The name you typed will be used as is." : "No models yet. Click “Load my models”.";
      modelMenuEl.append(empty);
    }
  }

  function chooseModel(p, id) {
    cfg.models[p.id] = id;
    modelEl.value = id;
    saveCfg();
    renderModelMenu(p);
    refreshEngine();
  }

  function fillOllamaModels(models, selected) {
    ollamaModelEl.replaceChildren();
    if (!models.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Click “Detect models”";
      ollamaModelEl.append(opt);
      return;
    }
    const ranked = Core.rankModels(models.map((id) => ({ id, name: id }))).map((m) => m.id);
    const recents = recentOf("ollama").filter((id) => ranked.includes(id));
    const ordered = recents.concat(ranked.filter((id) => !recents.includes(id)));
    for (const id of ordered.includes(selected) || !selected ? ordered : ordered.concat(selected)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      ollamaModelEl.append(opt);
    }
    ollamaModelEl.value = selected && [...ollamaModelEl.options].some((o) => o.value === selected) ? selected : ordered[0];
  }

  // The engine actually used: the chosen provider if it's usable (key entered / model chosen),
  // otherwise the free model.
  function currentEngine() {
    const p = P(cfg.provider);
    const free = Core.engineFor("free");
    if (p.id === "free") return free;
    if (p.api === "ollama") {
      const model = cfg.models.ollama;
      return model ? Core.engineFor("ollama", { model, base: cfg.urls.ollama || Core.DEFAULT_OLLAMA_URL }) : free;
    }
    const key = (keys[p.id] || "").trim();
    if (!key && !p.keyOptional) return free;
    const base = p.needsUrl ? (cfg.urls[p.id] || "").trim() : "";
    const model = (cfg.models[p.id] || p.defaultModel || "").trim();
    if (p.needsUrl && (!base || !model)) return free;
    const engine = Core.engineFor(p.id, { key, model, base });
    engine.label = `${p.short} · ${modelName(p, model)}`;
    return engine;
  }

  function refreshEngine() {
    const engine = currentEngine();
    engineLabel.textContent = engine.label;
    engineBtn.dataset.kind = engine.id === "free" ? "free" : P(engine.id).group === "private" ? "ollama" : "anthropic";
  }

  // Show the right fields for the provider picked in the sheet.
  function showProvider() {
    const p = P(cfg.provider);
    providerEl.value = p.id;
    const isOllama = p.api === "ollama";
    const isFree = p.id === "free";
    panelKeyEl.hidden = isFree || isOllama;
    panelOllamaEl.hidden = !isOllama;
    providerNoteEl.textContent = p.privacy || (isOllama ? "" : `Your text is sent to ${p.short === "Custom" ? "that server" : p.label.replace(/ \(.*/, "")}. Without a key, the free model is used instead.`);
    if (isFree || isOllama) return;
    urlFieldEl.hidden = !p.needsUrl;
    customUrlEl.value = cfg.urls[p.id] || "";
    keyLabelEl.textContent = p.keyOptional ? "API key (optional)" : `${p.short} API key`;
    keyEl.value = keys[p.id] || "";
    rememberEl.checked = remembered(p.id);
    modelEl.value = cfg.models[p.id] || p.defaultModel || "";
    modelEl.placeholder = p.defaultModel || "Model name";
    renderModelMenu(p);
    keyHintEl.replaceChildren();
    if (p.keyUrl) {
      keyHintEl.append("Get a key at ");
      const a = document.createElement("a");
      a.href = p.keyUrl; a.target = "_blank"; a.rel = "noopener"; a.textContent = p.keyHost;
      keyHintEl.append(a, ". ");
    }
    keyHintEl.append(`${p.keyNote ? p.keyNote + " " : ""}It goes straight from this page to ${p.needsUrl ? "that server" : p.short} and is only saved if you tick the box.`);
  }

  function saveKey() {
    const id = cfg.provider;
    keys[id] = keyEl.value;
    store.del("localStorage", `fc_key_${id}`);
    store.del("sessionStorage", `fc_key_${id}`);
    if (id === "anthropic") { store.del("localStorage", "fc_key"); store.del("sessionStorage", "fc_key"); }
    if (keyEl.value) store.set(rememberEl.checked ? "localStorage" : "sessionStorage", `fc_key_${id}`, keyEl.value);
    refreshEngine();
  }

  function setSettingsStatus(message, isError) {
    settingsStatus.textContent = message;
    settingsStatus.classList.toggle("error", Boolean(isError));
  }

  fillProviders();
  fillOllamaModels(cfg.models.ollama ? [cfg.models.ollama] : [], cfg.models.ollama);
  ollamaUrlEl.value = cfg.urls.ollama || Core.DEFAULT_OLLAMA_URL;
  showProvider();
  refreshEngine();

  engineBtn.addEventListener("click", () => { setSettingsStatus(""); showProvider(); dialog.showModal(); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  providerEl.addEventListener("change", () => {
    cfg.provider = providerEl.value;
    saveCfg();
    setSettingsStatus("");
    showProvider();
    refreshEngine();
  });
  keyEl.addEventListener("input", saveKey);
  rememberEl.addEventListener("change", saveKey);
  modelEl.addEventListener("input", () => {
    cfg.models[cfg.provider] = modelEl.value.trim();
    saveCfg();
    renderModelMenu(P(cfg.provider), modelEl.value);
    refreshEngine();
  });
  customUrlEl.addEventListener("input", () => { cfg.urls[cfg.provider] = customUrlEl.value.trim(); saveCfg(); refreshEngine(); });
  ollamaUrlEl.addEventListener("change", () => {
    cfg.urls.ollama = ollamaUrlEl.value.trim() || Core.DEFAULT_OLLAMA_URL;
    saveCfg();
    refreshEngine();
  });
  ollamaModelEl.addEventListener("change", () => {
    cfg.models.ollama = ollamaModelEl.value;
    saveCfg();
    refreshEngine();
  });

  $("load-models").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const p = P(cfg.provider);
    if (!keyEl.value.trim() && !p.keyOptional) return setSettingsStatus("Enter your API key first.", true);
    btn.disabled = true;
    setSettingsStatus("Loading models…");
    try {
      const models = await Core.listModels(p.id, { key: keyEl.value.trim(), base: (cfg.urls[p.id] || "").trim() });
      if (!models.length) throw new Error("No models were returned for this key.");
      loadedModels[p.id] = models;
      // If the starting default isn't offered to this key, move to the best-ranked model that is.
      if (!cfg.models[p.id] && !models.some((m) => m.id === p.defaultModel)) {
        cfg.models[p.id] = Core.rankModels(models)[0].id;
        modelEl.value = cfg.models[p.id];
        saveCfg();
      }
      renderModelMenu(p);
      refreshEngine();
      setSettingsStatus(`${models.length} models available. Pick one from the list.`);
    } catch (err) {
      setSettingsStatus(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $("detect-ollama").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    cfg.urls.ollama = ollamaUrlEl.value.trim() || Core.DEFAULT_OLLAMA_URL;
    saveCfg();
    btn.disabled = true;
    setSettingsStatus("Looking for Ollama…");
    try {
      const models = (await Core.listModels("ollama", { base: cfg.urls.ollama })).map((m) => m.id);
      if (!models.length) throw new Error("Ollama is running but has no models. Run: ollama pull llama3.1");
      fillOllamaModels(models, cfg.models.ollama);
      cfg.models.ollama = ollamaModelEl.value;
      saveCfg();
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
      if (engine.id !== "free") pushRecent(engine.id, engine.model);
      doc.unplaced = result.unplaced;
      const notes = [`Checked with ${engine.label}.`];
      if (cfg.provider !== "free" && engine.id === "free") notes.push("(Your chosen AI isn't set up yet, so the free model was used.)");
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
