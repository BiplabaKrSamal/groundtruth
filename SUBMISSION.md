# Founding AI Engineer Assignment — GroundTruth

**Biplaba Kr Samal** · [GitHub repo — ADD LINK] · [Live app — ADD LINK]

---

## What I built, and why

The brief's own examples (quiz app, FPV game, real-time collab) all work;
going elsewhere entirely was also fine. I built a quiz app on purpose,
because it's a small version of Superbrain's actual problem: TokenFold
compresses context without losing grounding, and edits wait for approval.
Both are the same question — how do you let a system generate or act on
your behalf and still verify it. An LLM asked to write quiz questions from
a document will just as happily invent a fact that isn't there.

GroundTruth: paste in a document, or upload a PDF, and it generates a live
multiplayer quiz where every question cites the exact passage it came
from and carries a confidence score for how well that grounding holds up.
Host reviews and edits before going live. Afterward, a report compares
the model's confidence against what the room actually got right — the
closest thing to closing the loop on whether that confidence was earned.

## Architecture and design

**Backend:** FastAPI. REST for anything not time-sensitive (create
session, generate, edit, publish), one WebSocket per room for live play.
Split into small modules — `retrieval.py`, `quiz_generator.py`,
`session_manager.py`, `ws_manager.py` — so each is testable without a
live socket.

**Confidence scoring is the core of this.** Asking an LLM to self-report
confidence is unreliable — models are bad judges of their own
uncertainty. So each question is scored on two things I can independently
verify instead:
1. Retrieval self-consistency — re-run the same hybrid BM25+TF-IDF+RRF
   retriever (reused from an earlier resume-screening project) using the
   generated question as the query, and check it actually surfaces the
   chunk the model claims it used.
2. Lexical grounding — does the correct answer share real vocabulary with
   the source, or is it a paraphrase loose enough to be invented.

`test_quiz_generator.py` proves this works: a deliberately fabricated
question scores measurably lower than a grounded one — not just that the
pipeline runs.

**Vercel + Render split, not Vercel-native end to end:** serverless
functions don't hold persistent connections, and a live quiz is nothing
but persistent connections. Frontend on Vercel per the brief, backend on
Render for the WebSocket.

**In-memory session state, not Redis or Postgres:** at quiz-night scale —
one process, rooms of a few dozen, a session that lasts one quiz — a
database is ops overhead with no current benefit. `session_manager.py` is
the only file that knows state is in-memory; swapping it out later
touches that one file, not every caller.

**Frontend:** React, TypeScript, Tailwind. The design deliberately skips
Kahoot's bright quiz-show look — the actual subject here is verification,
not a party game — in favor of a survey-instrument visual language (brass
and ink tones), with a confidence dial styled as an analog gauge reused
identically in question review and the post-session report.

## Decision-making

- Chunked source text at 90 words initially. A test against a short
  source caught the real bug: two facts merging into one chunk, silently
  producing fewer questions than requested. Fixed with a smaller,
  quiz-specific chunk size (45 words) — one fact per chunk.
- The WebSocket broadcast never includes the correct answer to anyone,
  host included, even while a question is live — the host UI
  cross-references the full question data it already fetched over REST.
  Kept `ws.py` from needing host-vs-player branching.
- A full integration test driving a real host and player socket through
  an entire session caught something the unit tests didn't: joining a
  room broadcasts the participant list to everyone in it, including the
  joiner. The frontend has to expect that second message right after the
  "joined" reply.
- Groq by default, behind an `LLMProvider` interface rather than a direct
  SDK call — fast enough for live generation, and swapping providers
  later is a new class, not a rewrite.

## GitHub repository

[ADD LINK]

## Deployment

[ADD LINK — see README.md for the Render + Vercel steps]

---

## 3. Product Strategy

### A. If you were building this product, what would you change or add next, and why?

From what's publicly documented — not hands-on yet, so treat this as a
starting point:

- No Linux build. A real gap given how much of the target engineering
  audience runs Linux day to day.
- The published benchmark is Django bug fixes only. I'd want it
  stress-tested on other languages and on greenfield work, not just bug
  fixes, before trusting the token-reduction numbers generalize.
- **[PERSONALIZE AFTER USING IT]** — does approval-gating feel like
  safety or friction under time pressure? Does context survive the switch
  between terminal and IDE extension?

### B. What major UI issues do you dislike, and how do you think they annoy current users?

**Needs real usage — not filling this in with guesses.** Superbrain is
free in beta (macOS/Windows). Questions to answer once there's real usage
to draw on: where did the terminal-first flow break down versus the IDE
extension, did the approval gate build trust or cost time, did anything
feel like it lost context it should've kept. Inventing specifics here
would defeat the point of the question.
