# Founding AI Engineer Assignment — GroundTruth

**Biplaba Kr Samal** · [GitHub repo — ADD LINK] · [Live app — ADD LINK]

---

## What I built, and why

The brief gave three examples — a live quiz/polling app, an FPV game, a
real-time collaborative app — and was pretty explicit that going somewhere
else entirely was also fine. I stuck with the quiz app, but not because it
was the safe pick. The reason is Superbrain's whole premise: TokenFold is
about compressing context without losing grounding, and edits only land
after approval. That's a trust problem — how do you let a system act on
your behalf while still being able to check its work.

A quiz generator has the same shape at a much smaller scale. Give an LLM a
source document and ask it to generate questions, and it will happily
invent a plausible-sounding fact that isn't actually in the text — same
failure mode, different domain. So instead of just wrapping an LLM in a
Kahoot clone, the actual thing I wanted to build was: can I make an AI
content-generation pipeline that's honest about what it doesn't know,
grounded in a way I can verify instead of just trusting the model's word,
with a human (the host) reviewing before anything goes live. That's
GroundTruth.

Concretely: paste in an article, a set of notes, a transcript, whatever —
or upload a PDF — and it generates a live multiplayer quiz where every
question is tied back to the exact passage it came from, with a confidence
score on how well-grounded it actually is. Host reviews and can edit or
delete anything before going live. Room code, real-time play, leaderboard,
and afterward a report comparing what the model was confident about
against what the room actually got right — which is honestly the part I
find most useful, because it's the closest thing to closing the loop on
"was the AI's confidence deserved."

## Architecture and design

**Backend** is FastAPI. REST for the parts that aren't time-sensitive
(create a session, generate questions, edit them, publish), a single
WebSocket endpoint per room for everything live (start, answer, reveal,
next). I split it into small, single-purpose modules rather than one big
`main.py` — `retrieval.py`, `quiz_generator.py`, `session_manager.py`,
`ws_manager.py` — mostly because I wanted each piece testable on its own
without spinning up a socket.

**The confidence score is the part I spent the most time on**, because
the obvious approach — ask the LLM "on a scale of 1-10, how confident are
you" — is known to be badly calibrated. Models are bad judges of their own
uncertainty. So instead of trusting a self-report, I built it out of two
independent signals I can actually verify:

1. Take the question the model generated, and run it back through a
   retriever (I reused the hybrid BM25+TF-IDF+RRF approach from an earlier
   project — I keep coming back to this pattern because it's cheap, has no
   embedding-model dependency, and holds up fine at this scale). If the
   retriever, given only the question text, can't independently find its
   way back to the chunk the model claims it used, that's a real signal
   something's off.
2. Check whether the correct answer text actually shares vocabulary with
   the source chunk, or whether it's a paraphrase loose enough to have
   been hallucinated.

Neither signal alone is that trustworthy, which is exactly why I didn't
pick one — same reasoning as using BM25+TF-IDF+RRF for retrieval instead
of just one method. I wrote a test that proves this actually works, not
just that it runs: I feed the generator a source about the Wright
brothers, ask for one genuinely grounded question and one I've deliberately
made the fake LLM fabricate (a made-up altitude figure that's nowhere in
the source), and assert the fabricated one scores measurably lower. That
test is the actual proof this does something, versus just returning a
plausible-looking number.

**Why FastAPI/WebSockets on Render instead of building this Vercel-native
end to end:** the brief asks for the app hosted on Vercel, and it is — the
frontend. But Vercel's serverless functions don't hold persistent
connections, and a live quiz is nothing but persistent connections. I
could've reached for something like Pusher or a hosted realtime service to
stay fully within Vercel's model, but that's an external dependency doing
something WebSockets do natively, for a problem I already know how to
solve directly. Splitting frontend (Vercel) and backend (Render) is a very
standard pattern and felt like the honest answer rather than contorting
the architecture to avoid a second host.

**Why in-memory session state, not Redis or Postgres:** at the scale this
actually runs at — one process, rooms of a few dozen people, a session
that lives for the length of one live quiz — a database adds ops overhead
without solving a real problem yet. `session_manager.py` is the only file
that knows state lives in memory. If this needed to survive a server
restart or scale past one process, that's the one file that changes, not
every caller.

**Frontend** is React + TypeScript + Tailwind, deliberately not built
around Kahoot's bright-primary-colors quiz-show look. The actual subject
of this product is verification and trust, not a party game, so the
design leans on a survey/calibration-instrument visual language instead —
brass and ink tones, a confidence dial styled like an analog gauge that's
the same component used both when reviewing questions pre-launch and in
the post-session report. It's not just decoration: the dial is the one
piece of UI that has to show up in both places and mean the same thing
each time.

## Decision-making

A few concrete decisions, and where I changed course:

- I originally chunked source text at 90 words (a reasonable default for
  general retrieval). Testing against a short source revealed the actual
  bug: two distinct facts were getting merged into one chunk, so the
  generator silently produced fewer questions than asked for. Fixed by
  using a smaller, quiz-specific chunk size (45 words) — a quiz question
  should hang off one fact, not a paragraph blending several. This came
  from a failing test, not from guessing.
- I debated whether the host should see the correct answer live, while a
  question is running, or only at reveal. Went with: the WebSocket
  broadcast never includes the answer key to anyone, host included — the
  host UI cross-references the full question data it already has from the
  initial REST fetch. This meant the backend doesn't need host-vs-player
  branching in the broadcast payload, which simplified `ws.py`
  meaningfully.
- I wrote a full integration test that opens a real host socket and a
  real player socket against the actual FastAPI app and drives an entire
  session end to end. It caught something the unit tests didn't: joining
  a room broadcasts the participant list to everyone in the room,
  including the player who just joined — which means the frontend
  WebSocket handler has to expect that second message right after the
  direct "joined" reply, not just the reply itself. Would not have caught
  this without testing the actual protocol, not just the functions
  underneath it.
- Provider choice: Groq by default, but behind an `LLMProvider` interface
  rather than calling the SDK directly from the generation code. The job
  posting specifically mentions understanding trade-offs across frontier
  providers — Groq for generation speed when a host is waiting live,
  architected so swapping to Anthropic or OpenAI is a new class, not a
  rewrite.

## GitHub repository

[ADD LINK — push this repo, history is already staged as 23 commits
across the actual build order, nothing squashed]

## Deployment

[ADD LINK — see README.md for the exact Render + Vercel steps]

---

## 3. Product Strategy

### A. If you were building this product, what would you change or add next, and why?

Some of this is informed by what's publicly documented about Superbrain
rather than hands-on use, so treat it as a starting point to sharpen once
I've actually spent time in the product:

- **No Linux build.** Public docs list macOS and Windows only. A large
  share of the backend/infra engineers Open Gigantic would want using
  this day to day run Linux, especially anyone working server-side. That
  seems like a real gap for a dev tool, not a minor one.
- **The published benchmark is Django bug fixes only.** Good for an
  honest apples-to-apples comparison against Claude Code, but narrow. I'd
  want to see it stress-tested against a wider spread of languages and
  problem types — greenfield feature work, not just bug fixes — before
  trusting the 60-80% token-reduction claim generalizes.
- **[PERSONALIZE AFTER USING IT]** — once I've actually run it against a
  real repo: does the approval-gating feel like a safety net or friction
  under time pressure? Does the terminal-first, IDE-via-extension model
  feel coherent, or does context get lost switching between the two?

### B. What major UI issues do you dislike, and how do you think they annoy current users?

**This section needs to come from actually using the product — I'm not
filling it in with guesses.** Superbrain is free during its beta
(macOS/Windows) — download it, run it against a real repo for a real
task, and write what actually happened. A few honest starting questions
to answer once there's real usage to draw on:

- Where did the terminal-first flow feel natural, and where did you
  reach for the IDE extension instead — and why, in the moment?
- Did the approval-gate on file changes ever break your flow, or did it
  build trust? Specific moments, not a general impression.
- Any place the tool felt like it lost context it should've kept, or
  compressed something it shouldn't have?

Fabricating specific UI complaints here would defeat the actual point of
this question — they explicitly said they want to see how you think, and
a real, slightly rough observation from actually using it beats a
polished but invented one.
