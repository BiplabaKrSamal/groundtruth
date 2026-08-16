# GroundTruth

Live quizzes generated from your own source material. Every question ships with the passage that grounds it and a confidence score for how well that grounding holds up, instead of just trusting the LLM's word for it.

Built for Open Gigantic's Founding AI Engineer assignment. Full writeup and reasoning is in [SUBMISSION.md](./SUBMISSION.md).

## How it works

Paste in text or upload a PDF and it gets chunked, roughly 45 words each, small enough that one chunk is usually one fact instead of three blended together. An LLM writes one question per chunk, grounded only in that chunk.

Confidence scoring doesn't trust the model's own self-report, since LLMs are known to be badly calibrated when you just ask "how sure are you." Instead each question gets checked two other ways: rerun retrieval (BM25+TF-IDF+RRF) using the generated question and see if it actually surfaces the source chunk it claims to use, and check whether the answer shares real vocabulary with that source or if it's a loose enough paraphrase to have been invented. Blended 60/40 into one score. `test_quiz_generator.py` proves a fabricated question actually scores lower than a grounded one, not just that the code runs.

Host reviews and edits or deletes questions before publishing. Then it's a FastAPI WebSocket, one room per quiz, players join with a 5-letter code. Scoring rewards speed and streaks, not just correctness. Afterward there's a report comparing confidence against how the room actually did on each question.

## Stack

FastAPI and WebSockets for the real-time backend, not Vercel serverless functions, since those don't hold persistent connections and a live quiz is basically nothing but persistent connections. Deployed to Render, frontend's on Vercel per the brief.

Session store is in memory, not Redis or Postgres. Quiz-night scale doesn't need a database yet, and `session_manager.py` is the only file that would need to change if that does become a problem later.

Groq is the default LLM provider, sitting behind an `LLMProvider` interface so it's not hardcoded in. Fast enough for live generation, and swapping providers later is a new class instead of a rewrite.

Retrieval is BM25+TF-IDF+RRF, not a vector DB. No embedding model to host, no extra infra, and it's the same pattern already proven out on an earlier resume-screening project.

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

Open two browser windows, host a session from `/`, join from the other with the room code.

## Deploying

**Backend on Render.** Use the included `render.yaml` blueprint (New, Blueprint, point it at this repo), or set up a Web Service manually with build command `pip install -r backend/requirements.txt` and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`. Set `GROQ_API_KEY` and `CORS_ORIGINS` in the dashboard.

**Frontend on Vercel.** Import the repo, root directory `frontend`, add `VITE_API_URL` pointing at the Render backend. `vercel.json` already handles the SPA rewrite.

## Tests

17 backend tests covering retrieval correctness, the confidence-scoring pipeline (grounded vs fabricated), scoring and streak logic, room-code handling, and one full integration test that drives an entire session, join through end, over a real WebSocket connection instead of mocks.

```bash
cd backend && pytest -v
```
