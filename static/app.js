(() => {
  const input = document.getElementById("input");
  const review = document.getElementById("review");
  const checkBtn = document.getElementById("check");
  const editBtn = document.getElementById("edit");
  const statusEl = document.getElementById("status");
  const bubble = document.getElementById("bubble");
  const bubbleCorrection = document.getElementById("bubble-correction");
  const bubbleWhy = document.getElementById("bubble-why");

  let activeMark = null;

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  // Render the original text unchanged, wrapping flagged ranges in <mark>. Everything goes
  // in through text nodes, so the text can't be altered or interpreted as HTML.
  function render(text, claims) {
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

  let currentClaims = [];

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

  async function runCheck() {
    const text = input.value;
    if (!text.trim()) return setStatus("Paste or type some text first.", true);
    checkBtn.disabled = true;
    setStatus("Checking…");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      currentClaims = data.claims;
      render(text, currentClaims);
      input.hidden = true;
      review.hidden = false;
      checkBtn.hidden = true;
      editBtn.hidden = false;
      const n = currentClaims.length;
      let message = n === 0 ? "No false claims found." : `${n} false claim${n === 1 ? "" : "s"} found. Click a red highlight.`;
      if (data.unplaced) message += ` (${data.unplaced} couldn't be located in the text.)`;
      setStatus(message);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener("click", runCheck);
  editBtn.addEventListener("click", () => {
    hideBubble();
    review.hidden = true;
    input.hidden = false;
    editBtn.hidden = true;
    checkBtn.hidden = false;
    setStatus("");
    input.focus();
  });
})();
