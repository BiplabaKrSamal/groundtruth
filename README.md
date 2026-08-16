# GroundTruth

Live quizzes generated from your own source material, where every question
ships with the passage that grounds it and a confidence score for how well
it holds up — instead of trusting an LLM's word for it.

Built as the open-ended assignment for Open Gigantic's Founding AI Engineer role.

## Why this

Superbrain's whole pitch is trustworthy AI output under real constraints —
context compression that doesn't lose grounding, edits gated behind
approval. A live quiz app is a good small-scale rehearsal of the same
problem: generate content from a source, but don't let the model quietly
invent facts, and give the person in the loop (the host, before anyone
else sees it) a real signal for how much to trust each output before it
ships. Section 2 of the brief steers toward the given examples (quiz app,
FPV game, real-time collab) rather than "build a mini coding agent," so
this leans on the quiz-app framing while still being honest about what
problem it's actually rehearsing.

## How it works

**Generation.** Paste in an article, notes, a transcript, or upload a PDF.
The text is chunked (~45 words each — small enough that one chunk is
usually one fact, not three blended together). An LLM (Groq by default,
swappable — see `backend/app/llm_providers.py`) writes one multiple-choice
question per chunk, told explicitly not to invent anything outside it.

**Confidence, without trusting the model's self-report.** LLMs are known
to be badly calibrated when you just ask "how sure are you." So each
question gets scored two other ways instead:
1. *Retrieval self-consistency* — re-run the same hybrid BM25+TF-IDF+RRF
   retriever (same pattern as the resume-screening agent) using the
   generated question as the query, and check whether it actually surfaces
   the chunk the model claims it used.
2. *Lexical grounding* — does the correct answer share real vocabulary
   with the source passage, or is it a paraphrase loose enough to have
   been made up?

The two are blended (60/40) into one confidence score. `test_quiz_generator.py`
proves this actually separates a grounded question from a fabricated one,
not just that the pipeline runs.

**Live session.** FastAPI WebSocket, one room per quiz, host and players
connect to the same room by a 5-letter code. Host controls pacing (start,
reveal, next); players get a stripped payload with no correct-answer flag
until reveal. Scoring rewards speed, not just correctness, with a streak
bonus.

**Post-session report.** For every question, the host sees the model's
confidence next to what the room actually did with it. Big gaps are the
interesting signal — either the grounding was weaker than it looked, or
the question was so well-known the room aced it regardless.

## Stack and why

- **FastAPI + WebSockets, not Vercel serverless functions, for the
  real-time backend.** Serverless functions don't hold persistent
  connections, and a live quiz is nothing but persistent connections.
  Deployed to Render instead; the frontend is what's on Vercel, per the
  brief.
- **In-memory session store**, not Redis or Postgres. At quiz-night scale
  (one process, rooms of tens of people, sessions that live for the length
  of a session) a database adds ops overhead with no real benefit yet.
  `session_manager.py` is the only file that knows the state is in-memory —
  swapping it for Redis later doesn't touch any caller.
- **Groq by default, behind an `LLMProvider` interface**, not hardcoded.
  Groq's inference speed matters when a host is waiting on question
  generation live. The interface exists so swapping in Anthropic or OpenAI
  is a new class, not a rewrite.
- **BM25+TF-IDF+RRF over a vector DB.** No embedding model to host, no
  extra infra, and it's the same retrieval approach already proven out on
  the resume-screening agent — hybrid lexical retrieval holds up fine at
  the scale of one document's worth of chunks.

## Running it locally

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```
Runs the test suite with `pytest` from inside `backend/`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, defaults to localhost:8000
npm run dev
```

Open two browser windows: host a session from `/`, then join from the
other with the room code.

## Deploying

**Backend → Render.** Either use the included `render.yaml` blueprint
(New → Blueprint, point it at this repo) or create a Web Service manually:
build command `pip install -r backend/requirements.txt`, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`. Set
`GROQ_API_KEY` and `CORS_ORIGINS` (your Vercel URL) in the dashboard.

**Frontend → Vercel.** Import the repo, set the root directory to
`frontend`, add `VITE_API_URL` pointing at the Render backend. The
included `vercel.json` handles the SPA rewrite.

## Tests

23 backend tests: retrieval correctness, the confidence-scoring pipeline
(grounded vs. fabricated), scoring/streak logic, room-code handling, and
one full integration test that drives an entire session — join, start,
answer, reveal, next, end — over a real WebSocket connection, not mocks.

```bash
cd backend && pytest -v
```
