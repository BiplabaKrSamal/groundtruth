# GroundTruth

Live quizzes generated from your own source material — every question
ships with the passage that grounds it and a confidence score for how
well it holds up, instead of just trusting the LLM's word for it.

Built for Open Gigantic's Founding AI Engineer assignment. Full writeup
and reasoning: [SUBMISSION.md](./SUBMISSION.md).

## How it works

- **Generate** — paste text or upload a PDF. It's chunked (~45 words,
  roughly one fact per chunk) and an LLM writes one question per chunk,
  grounded only in that chunk.
- **Score confidence independently of the model's self-report** — LLM
  self-reported confidence is unreliable, so instead: re-run retrieval
  (BM25+TF-IDF+RRF) using the generated question and check it surfaces
  the source chunk it claims to use, and check the answer shares real
  vocabulary with that source. Blended 60/40. `test_quiz_generator.py`
  proves a fabricated question scores measurably lower than a grounded
  one.
- **Review** — host edits or deletes questions before publishing.
- **Play** — FastAPI WebSocket, one room per quiz, 5-letter join code.
  Scoring rewards speed and streaks, not just correctness.
- **Report** — confidence vs. actual audience performance, per question.

## Stack

- FastAPI + WebSockets, not Vercel serverless functions, for the
  real-time backend — deployed to Render; frontend on Vercel per the
  brief.
- In-memory session store — quiz-night scale doesn't need a database yet;
  `session_manager.py` is the only file that would change if it did.
- Groq by default, behind an `LLMProvider` interface — fast for live
  generation, swappable without touching the generation code.
- BM25+TF-IDF+RRF, not a vector DB — same retrieval pattern as an earlier
  resume-screening project, no embedding infra needed at this scale.

## Running it locally

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```
Test suite: `pytest` from inside `backend/`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, defaults to localhost:8000
npm run dev
```

Open two browser windows: host a session from `/`, join from the other
with the room code.

## Deploying

**Backend → Render.** Use the included `render.yaml` blueprint (New →
Blueprint, point it at this repo), or create a Web Service manually:
build command `pip install -r backend/requirements.txt`, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`. Set
`GROQ_API_KEY` and `CORS_ORIGINS` (your Vercel URL) in the dashboard.

**Frontend → Vercel.** Import the repo, root directory `frontend`, add
`VITE_API_URL` pointing at the Render backend. `vercel.json` handles the
SPA rewrite.

## Tests

17 backend tests: retrieval correctness, the confidence-scoring pipeline
(grounded vs. fabricated), scoring/streak logic, room-code handling, and
one full integration test driving an entire session — join, start,
answer, reveal, next, end — over a real WebSocket connection, not mocks.

```bash
cd backend && pytest -v
```
