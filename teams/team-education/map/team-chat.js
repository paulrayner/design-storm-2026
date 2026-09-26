// Team addition (teams/team-education): the chat window, shared by design-storm-water-system-3d.html
// and strontia.html. POSTs to /api/chat, which only exists under teams/team-education/chat_server.py
// (not serve.py). Styles: team-chat.css.
//
//   TeamChat.mount({ questions, context, audience, title, placeholder, fine, openLabel, intro })
//   TeamChat.open()          opens the window; never sends a question by itself
//
// questions: { topic: [question, ...] }; context(): a short note of what the viewer sees;
// audience: omitted for the map, "young" for the lessons page; intro(): HTML of the greeting.
(function () {
  const chat = { messages: [], busy: false, starters: [], next: null, asked: new Set(), opts: null, pool: [] };

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Five starters, one from each of five randomly chosen topics, so the spread shows what is askable.
  function pickStarters(n = 5) {
    const Q = chat.opts.questions;
    return shuffled(Object.keys(Q)).slice(0, n).map((t) => shuffled(Q[t])[0]);
  }

  // One random question not yet asked, preferring a different topic from the last suggestion.
  function pickNext() {
    const fresh = chat.pool.filter((x) => !chat.asked.has(x.q) && x.q !== chat.next?.q);
    if (!fresh.length) return null;
    const other = fresh.filter((x) => x.topic !== chat.next?.topic);
    return shuffled(other.length ? other : fresh)[0];
  }

  function chatEscape(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // Small, safe markdown subset: paragraphs, bullet lists, **bold**, *italic*, `code`.
  function chatMarkdown(text) {
    const out = [];
    let list = false;
    for (const raw of chatEscape(text).split("\n")) {
      const line = raw.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
      const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
      if (item) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${item[1]}</li>`); continue; }
      if (list) { out.push("</ul>"); list = false; }
      if (line.trim()) out.push(`<p>${line.replace(/^#+\s*/, "")}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  }

  function chatRender() {
    const log = document.getElementById("chat-log");
    if (!chat.messages.length) {
      if (!chat.starters.length) chat.starters = pickStarters();
      log.innerHTML = `<div class="msg bot">${chat.opts.intro()}</div>
        <div class="starters">${chat.starters.map((q) => `<button type="button">${chatEscape(q)}</button>`).join("")}</div>`;
      log.querySelectorAll(".starters button").forEach((b) => b.onclick = () => chatSend(b.textContent));
      return;
    }
    const suggest = !chat.busy && chat.next
      ? `<div class="next-q"><span>Explore next:</span>
          <button type="button" class="next-ask">${chatEscape(chat.next.q)}</button>
          <button type="button" class="next-shuffle" title="Suggest a different question" aria-label="Suggest a different question">&#8635;</button></div>`
      : "";
    log.innerHTML = chat.messages.map((m) => m.role === "user"
      ? `<div class="msg user">${chatEscape(m.content)}</div>`
      : `<div class="msg bot ${m.error ? "err" : ""}">${m.content ? chatMarkdown(m.content) : '<span class="typing">Thinking&hellip;</span>'}</div>`).join("") + suggest;
    if (suggest) {
      log.querySelector(".next-ask").onclick = () => chatSend(chat.next.q);
      log.querySelector(".next-shuffle").onclick = () => { chat.next = pickNext() || chat.next; chatRender(); };
    }
    log.scrollTop = log.scrollHeight;
  }

  async function chatSend(text) {
    text = (text || "").trim();
    if (!text || chat.busy) return;
    chat.busy = true;
    document.getElementById("chat-send").disabled = true;
    chat.asked.add(text);
    chat.messages.push({ role: "user", content: text });
    const answer = { role: "assistant", content: "" };
    chat.messages.push(answer);
    chatRender();
    try {
      const history = chat.messages.filter((m) => m !== answer && !m.error)
        .map(({ role, content }) => ({ role, content }));
      const body = { messages: history, context: chat.opts.context() };
      if (chat.opts.audience) body.audience = chat.opts.audience;
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) });
      if (!r.ok) throw new Error(r.status === 501 || r.status === 404 || r.status === 405
        ? "Chat needs the team server. Stop serve.py, run `python3 teams/team-education/chat_server.py` from the repo root instead (same port, same pages), and reload."
        : `Chat server error ${r.status}.`);
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, cut); buf = buf.slice(cut + 2);
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.text) { answer.content += ev.text; chatRender(); }
          if (ev.error) throw new Error(ev.error);
        }
      }
      if (!answer.content) throw new Error("No answer came back.");
    } catch (err) {
      answer.content = err.message; answer.error = true;
    }
    chat.busy = false;
    if (!answer.error) chat.next = pickNext();
    document.getElementById("chat-send").disabled = false;
    chatRender();
  }

  function open() {
    document.getElementById("chat").classList.add("open");
    document.getElementById("chat-open").style.display = "none";
    chatRender();
    document.getElementById("chat-input").focus();
  }

  function mount(opts) {
    chat.opts = opts;
    chat.pool = Object.entries(opts.questions).flatMap(([topic, qs]) => qs.map((q) => ({ q, topic })));
    const wrap = document.createElement("div");
    wrap.innerHTML = `
<button type="button" id="chat-open" aria-controls="chat">${opts.openLabel}</button>
<section id="chat" aria-label="${opts.title}">
  <header><b>${opts.title}</b>
    <button type="button" id="chat-clear">New chat</button>
    <button type="button" id="chat-close" aria-label="Close">&#10005;</button></header>
  <div id="chat-log" aria-live="polite"></div>
  <form id="chat-form">
    <textarea id="chat-input" rows="1" placeholder="${opts.placeholder}"></textarea>
    <button type="submit" id="chat-send">Send</button>
  </form>
  <div class="fine">${opts.fine}</div>
</section>`;
    document.body.append(...wrap.children);

    document.getElementById("chat-open").onclick = () => open();
    document.getElementById("chat-close").onclick = () => {
      document.getElementById("chat").classList.remove("open");
      document.getElementById("chat-open").style.display = "";
    };
    document.getElementById("chat-clear").onclick = () => {
      if (chat.busy) return;
      Object.assign(chat, { messages: [], starters: [], next: null, asked: new Set() });
      chatRender();
    };
    document.getElementById("chat-form").onsubmit = (e) => {
      e.preventDefault();
      const box = document.getElementById("chat-input");
      chatSend(box.value); box.value = "";
    };
    document.getElementById("chat-input").onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("chat-form").requestSubmit(); }
    };
  }

  // Re-draw the greeting (e.g. when the lesson changes) if no conversation has started yet.
  function refresh() {
    if (chat.opts && !chat.messages.length && document.getElementById("chat")?.classList.contains("open")) chatRender();
  }

  window.TeamChat = { mount, open, refresh };
})();
