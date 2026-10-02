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
  const keyEl = $("key");
  const modelEl = $("model");
  const rememberEl = $("remember");
  const loadModelsBtn = $("load-models");
  const tabsEl = $("tabs");
  const fileEl = $("file");
  const dropEl = $("drop");

  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const FALLBACK_MODELS = [
    ["claude-sonnet-5-5", "Claude Sonnet 5.5"],
    ["claude-opus-5-5", "Claude Opus 5.5"],
    ["claude-fable-5-1", "Claude Fable 5.1"],
    ["claude-haiku-4-5", "Claude Haiku 4.5"],
  ];
  const LIBS = {
    pdf: ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"],
    docx: ["https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"],
  };
  const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // ---------- storage (every access guarded: it can be blocked or empty) ----------
  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch { /* ignore */ } },
    del(area, key) { try { window[area].removeItem(key); } catch { /* ignore */ } },
  };

  // ---------- settings: key + model ----------
  function fillModels(models, selected) {
    modelEl.replaceChildren();
    for (const [id, name] of models) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      opt.title = id;
      modelEl.append(opt);
    }
    if (selected && !models.some(([id]) => id === selected)) {
      const opt = document.createElement("option");
      opt.value = selected;
      opt.textContent = selected;
      modelEl.append(opt);
    }
    if (selected) modelEl.value = selected;
  }

  function saveKey() {
    store.del("localStorage", "fc_key");
    store.del("sessionStorage", "fc_key");
    if (!keyEl.value) return;
    store.set(rememberEl.checked ? "localStorage" : "sessionStorage", "fc_key", keyEl.value);
  }

  keyEl.value = store.get("localStorage", "fc_key") || store.get("sessionStorage", "fc_key") || "";
  rememberEl.checked = Boolean(store.get("localStorage", "fc_key"));
  fillModels(FALLBACK_MODELS, store.get("localStorage", "fc_model") || FALLBACK_MODELS[0][0]);
  keyEl.addEventListener("input", saveKey);
  rememberEl.addEventListener("change", saveKey);
  modelEl.addEventListener("change", () => store.set("localStorage", "fc_model", modelEl.value));

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (keyEl.value.trim()) headers["X-Api-Key"] = keyEl.value.trim();
    return headers;
  }

  loadModelsBtn.addEventListener("click", async () => {
    loadModelsBtn.disabled = true;
    setStatus("Loading models…");
    try {
      const res = await fetch("/api/models", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load models.");
      if (!data.models.length) throw new Error("No Claude models were returned for this key.");
      fillModels(data.models.map((m) => [m.id, m.name]), modelEl.value);
      store.set("localStorage", "fc_model", modelEl.value);
      setStatus(`${data.models.length} models available.`);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      loadModelsBtn.disabled = false;
    }
  });

  // ---------- documents (pasted text or uploaded files), one tab each ----------
  let docs = [];
  let active = 0;
  let nextId = 1;

  function newDoc(name, text) {
    docs.push({ id: nextId++, name, text, claims: null, unplaced: 0 });
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
    checkBtn.disabled = true;
    setStatus(`Checking with ${modelEl.value}…`);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text, model: modelEl.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      doc.claims = data.claims;
      doc.unplaced = data.unplaced;
      if (current() === doc) showDoc(); else renderTabs();
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener("click", runCheck);
  editBtn.addEventListener("click", () => {
    const doc = current();
    doc.claims = null;
    showDoc();
    input.focus();
  });

  // ---------- file upload: read the text out of the file, in the browser ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load the PDF/Word reader (needs an internet connection)."));
      document.head.append(s);
    });
  }
  const libCache = {};
  function ensureLib(name) {
    libCache[name] = libCache[name] || Promise.all(LIBS[name].map(loadScript));
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
    if (ext === "doc" || ["png", "jpg", "jpeg", "gif", "webp", "xlsx", "pptx", "zip"].includes(ext)) {
      throw new Error("not supported");
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
