#!/usr/bin/env python3
"""Serve the map copy with a chat endpoint answered by Claude Code.

    python3 teams/team-education/chat_server.py        # from the repo root, instead of serve.py
    open http://localhost:8765/teams/team-education/map/design-storm-water-system-3d

It replaces the repo's serve.py (same port, 8765): static files are served exactly as
serve.py does, so the original map still works at its usual address. POST /api/chat runs the
`claude` CLI in print mode (your Claude Code login; no API key needed), grounded in
this team's findings, and streams the answer back as server-sent events.

A request may add "audience": "young" (the pop-out lessons page does) to get answers written
for ages 13 to 16, grounded also in a text digest of map/strontia-lessons.json; the map's chat
omits it and gets the original prompt.

Listens on 127.0.0.1 only: every question spends your Claude Code usage.
The grounding documents include Denver Water derived findings; their terms are in
data/TERMS.md.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

TEAM = Path(__file__).resolve().parent
REPO = TEAM.parents[1]
sys.path.insert(0, str(REPO))
from serve import HtmlFallbackHandler  # noqa: E402  (the repo's static handler)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
MAX_MESSAGES = 24
MAX_CHARS = 4000
BUSY = threading.BoundedSemaphore(2)          # at most two answers in flight
WORKDIR = tempfile.mkdtemp(prefix="strontia-chat-")  # empty cwd: no CLAUDE.md picked up

DOCS = [  # (title, path) grounding documents, read at startup
    ("FINDINGS.md (the team's findings, with evidence)", TEAM / "FINDINGS.md"),
    ("analysis/QC.md (how the sonde data was cleaned)", TEAM / "analysis" / "QC.md"),
    ("README.md (the project, the fill-in experiment, questions for Denver Water)", TEAM / "README.md"),
    ("glossary.md (water and statistics terms)", REPO / "glossary.md"),
    ("analysis/out/storm_numbers.json (every number the findings quote)",
     TEAM / "analysis" / "out" / "storm_numbers.json"),
]

INSTRUCTIONS = """You are the guide built into a 3D map of Denver Water's collection system. You \
explain one panel: a depth-by-time picture of Strontia Springs Reservoir from a profiling sonde \
(Apr 7 to Aug 19, 2026), and how the August 14 to 15, 2026 storm moved through it. It was built \
by a small team at the Explore DDD 2026 Design Storm.

The people asking are usually new to water treatment, limnology, or data analysis. Explain in \
plain language, define a term the first time you use it, and prefer a short concrete answer \
(roughly 150 words or fewer) unless they ask for more. Use short paragraphs or a few bullets.

Ground every answer in the project documents below:
- Only quote numbers that appear in them. If a number is not there, say you do not have it.
- Keep the documents' distinction: "measured" (computed from the data) vs "interpreted" (what \
it probably means). When you add general water-treatment or lake knowledge not in the documents, \
say it is general knowledge.
- All readings are provisional (Denver Water and USGS); the page already says so. Do not add \
provisional or data-quality disclaimers to your answers. Explain it only if the viewer asks how \
reliable or final the data is.
- Some things are unknown, notably the depth of the Foothills intake, what the sonde's \
"vertical position" means exactly (treated as depth below surface), and sample times. Do not \
guess them; say they are open questions for Denver Water.
- You cannot see the screen. A context note may tell you what the viewer has selected or is \
hovering over; use it to make the answer specific.
- This analysis says nothing about whether tap water is safe to drink. Only if the viewer asks \
about drinking-water safety, say so and point to Denver Water; never add it otherwise.
- End when the answer is done: no closing caveats or sign-off lines.
- If a question is unrelated to this project, answer briefly or steer back.

Do not use tools. Answer from the documents and general knowledge only."""


# The pop-out lessons page (map/strontia.html) sends "audience": "young".
YOUNG = """

The viewer is 13 to 16 years old. Use short sentences and everyday words, explain any science \
word, one idea at a time, friendly tone, under about 120 words unless asked for more. They may be \
working through a lesson; the context note names it. Help them think it through rather than just \
listing numbers. The lessons on their page are at the end of the project documents. When the viewer \
is on a lesson, use the numbers shown in that lesson (they may differ from similar numbers in the \
findings, e.g. the top 3 m rather than the deep water), and describe only the pictures and charts \
that lesson shows. Lessons link into one chain; when it helps, point back to the earlier lesson an idea \
came from. The "Put it all together" lesson is a made-up what-if: reason about it from the earlier \
lessons, and never give it measured numbers of its own."""


LESSONS = TEAM / "map" / "strontia-lessons.json"   # the pop-out page's lessons (build_lessons.py)


def visual_note(v):
    """One short phrase per lesson visual, so the chat knows what is on screen (no data arrays)."""
    if v["type"] == "heat":
        box = f", yellow box: {v['highlight']['label']}" if v.get("highlight") else ""
        dots = ", white dots" if v.get("points") else ""
        note = f", labelled '{v['note']}'" if v.get("note") else ""
        return f"depth-by-time colour picture of {v['param']} ({v['view']} view{box}{dots}{note})"
    if v["type"] == "strip":
        return "river gage turbidity line" if v["which"] == "gage" else "plant TOC line (daily lab values)"
    kind = "depth profile chart" if v["type"] == "profile" else "line chart"
    return f"{kind} '{v['title']}' ({', '.join(s['name'] for s in v['series'])})"


def lessons_digest():
    """Compact text of the pop-out page's opening screen and every lesson, for the young chat's grounding.

    Per lesson: the visuals (no data arrays), Look, each question with its choices ([correct] marked,
    and the "why not" feedback shown for each wrong pick), the reveal, Why + Comparison (general
    science), Connect the dots, and Why you'd care."""
    if not LESSONS.exists():
        return ""
    J = json.loads(LESSONS.read_text())
    L = J["lessons"]
    core = [l["id"] for l in L if not l.get("bonus")]
    bonus = [l["id"] for l in L if l.get("bonus")]
    out = ["\n## map/strontia-lessons.json (the lessons on the viewer's page, as text)\n"]
    I = J.get("intro")
    if I:
        chain = " -> ".join(f"{c['label']} ({c['text']})" for c in I["chain"])
        paras = " ".join(f"{p['tag']}: {p['text']}" for p in I["paras"])
        out.append(f"\n### Opening screen, \"Start here\": {I['title']}\nPath: {chain}\n"
                   f"Quote: \"{I['quote']}\" ({I['quote_by']})\n{paras}\n")
    for l in L:
        if l.get("bonus"):
            name = f"Bonus lesson {bonus.index(l['id']) + 1} of {len(bonus)} (optional)"
        elif l.get("whatif"):
            name = f"Lesson {l['n']} of {len(core)}, Put it all together (a made-up what-if; no measurements)"
        else:
            name = f"Lesson {l['n']} of {len(core)}"
        qs = l.get("questions") or [l["question"]]
        qtext = []
        for i, q in enumerate(qs):
            choices = "; ".join(
                f"[correct] {c['text']}" if c["correct"] else f"{c['text']} (why not: {c.get('why_not', '')})"
                for c in q["choices"])
            head = f"Question {i + 1} of {len(qs)}" if len(qs) > 1 else "Question"
            qtext.append(f"{head}: {q['prompt']}\nChoices: {choices}\nReveal: {q['explain']}\n")
        out.append(f"\n### {name}: {l['title']}\n"
                   f"Shows: {'; '.join(visual_note(v) for v in l['visuals'])}.\n"
                   f"Look: {l['look']}\n{''.join(qtext)}"
                   f"Why (general science): {l['why']} {l.get('comparison', '')}\n"
                   + (f"Connect the dots: {l['connect']}\n" if l.get("connect") else "")
                   + (f"Why you'd care: {l['care']}\n" if l.get("care") else ""))
    return "".join(out)


def system_prompt(extra=""):
    parts = [INSTRUCTIONS + extra, "\n\n# Project documents\n"]
    for title, path in DOCS:
        if path.exists():
            text = path.read_text()
            if path.suffix == ".json":
                text = json.dumps(json.loads(text), separators=(",", ":"))
            parts.append(f"\n## {title}\n\n{text}\n")
    return "".join(parts)


SYSTEM = system_prompt()
# the young prompt also carries the lesson text, so its numbers match the lesson on screen
SYSTEMS = {"default": SYSTEM, "young": system_prompt(YOUNG) + lessons_digest()}   # built at startup


def transcript(messages, context):
    """The whole conversation as one prompt: print mode keeps no state between calls."""
    lines = []
    if context:
        lines.append(f"[Context from the page: {context}]\n")
    for m in messages[:-1]:
        who = "Viewer" if m["role"] == "user" else "You"
        lines.append(f"{who}: {m['content']}\n")
    if len(messages) > 1:
        lines.append("Now answer the viewer's latest message.\n")
    lines.append(f"Viewer: {messages[-1]['content']}")
    return "\n".join(lines)


class ChatHandler(HtmlFallbackHandler):
    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(min(n, 200_000)))
            messages = [m for m in body.get("messages", [])
                        if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)]
            messages = [{"role": m["role"], "content": m["content"][:MAX_CHARS]}
                        for m in messages[-MAX_MESSAGES:]]
            context = str(body.get("context", ""))[:1000]
            system = SYSTEMS.get(str(body.get("audience", "default")), SYSTEM)
            if not messages or messages[-1]["role"] != "user":
                raise ValueError("last message must be from the viewer")
        except (ValueError, json.JSONDecodeError) as err:
            self.send_error(400, str(err))
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()

        def send(obj):
            self.wfile.write(f"data: {json.dumps(obj)}\n\n".encode())
            self.wfile.flush()

        if not BUSY.acquire(blocking=False):
            send({"error": "Two answers are already running; try again in a moment."})
            return
        proc = None
        try:
            exe = shutil.which("claude")
            if not exe:
                send({"error": "The `claude` command was not found on this machine."})
                return
            cmd = [exe, "-p", "--output-format", "stream-json", "--verbose",
                   "--include-partial-messages", "--tools", "", "--strict-mcp-config",
                   "--no-session-persistence", "--system-prompt", system]
            proc = subprocess.Popen(cmd, cwd=WORKDIR, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True, bufsize=1)
            proc.stdin.write(transcript(messages, context))
            proc.stdin.close()
            got_text = False
            for line in proc.stdout:
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "stream_event":
                    e = ev.get("event", {})
                    d = e.get("delta", {})
                    if e.get("type") == "content_block_delta" and d.get("type") == "text_delta":
                        got_text = True
                        send({"text": d["text"]})
                elif ev.get("type") == "result":
                    if ev.get("is_error") or not got_text:
                        send({"error": ev.get("result") or "Claude Code returned no answer."})
            proc.wait(timeout=30)
            if proc.returncode and not got_text:
                err = proc.stderr.read().strip()[-400:]
                send({"error": err or f"claude exited with code {proc.returncode}"})
            send({"done": True})
        except (BrokenPipeError, ConnectionResetError):
            pass  # the viewer closed the chat mid-answer
        finally:
            if proc and proc.poll() is None:
                proc.kill()
            BUSY.release()


if __name__ == "__main__":
    os.chdir(REPO)
    with ThreadingHTTPServer(("127.0.0.1", PORT), ChatHandler) as httpd:
        print(f"Serving {REPO} with chat at http://localhost:{PORT}/teams/team-education/map/"
              f"design-storm-water-system-3d  (system prompt {len(SYSTEM):,} chars)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
