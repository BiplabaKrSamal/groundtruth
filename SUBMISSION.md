# Founding AI Engineer Assignment - GroundTruth

Biplaba Kr Samal
GitHub: https://github.com/BiplabaKrSamal/groundtruth
Live: https://groundtruth-zeta-flax.vercel.app

## What I built and why

The brief gives three examples (quiz app, FPV game, real-time collab app) but says going somewhere else entirely is fine too. I went with the quiz app on purpose, not as the safe pick. Superbrain's whole thing is compressing context without losing grounding, and gating edits behind approval, which is really a trust problem: how do you let a system act or generate on your behalf and still be able to check its work. A quiz generator has the same problem at a much smaller scale. Ask an LLM to write questions from a document and it'll happily invent a fact that isn't actually in there.

So GroundTruth: paste in a document, or upload a PDF, and it builds a live multiplayer quiz where every question is tied back to the exact passage it came from, plus a confidence score for how well that grounding actually holds up. Host reviews and edits before it goes live. After the quiz there's a report comparing what the model was confident about against what the room actually got right, which turned out to be the part I like most, since it's the closest thing to checking whether that confidence was deserved.

## Architecture and design

Backend is FastAPI. REST for anything that isn't time sensitive (create a session, generate, edit, publish), one WebSocket per room for everything live. Split it into small modules (retrieval.py, quiz_generator.py, session_manager.py, ws_manager.py), mainly so each piece is testable without needing a socket open.

Confidence scoring is where most of the thought went. The obvious move is asking the LLM how confident it is, but that's known to be unreliable, models aren't great judges of their own uncertainty. So each question gets scored two other ways instead, things I can actually check:

1. Take the question the model wrote and run it back through the retriever (same hybrid BM25+TF-IDF+RRF setup from an earlier resume-screening project). If the retriever can't independently find its way back to the chunk the model claims it used, that's a real signal something's off.
2. Check whether the correct answer actually shares vocabulary with the source, or whether it's a paraphrase loose enough that it could've been made up.

`test_quiz_generator.py` proves this does something real: feed it a source, ask for one grounded question and one deliberately fabricated one, and the fabricated one scores lower. Not just that the pipeline runs, that it actually tells the two apart.

On hosting, the brief wants this on Vercel and the frontend is. But Vercel's serverless functions don't hold a persistent connection, and a live quiz is basically nothing but persistent connections, so the backend sits on Render instead. Could've reached for something like Pusher to stay fully inside Vercel's model, but that felt like adding an external dependency just to avoid a second host, when WebSockets already solve this on their own.

Session state lives in memory, not Redis or Postgres. At the scale this actually runs at (one process, a few dozen people in a room, a session that lasts the length of one quiz) a database is ops overhead I don't need yet. `session_manager.py` is the only file that knows state lives in memory, so if that has to change later it's one file, not every caller.

Frontend is React, TypeScript, Tailwind. Skipped the bright Kahoot quiz-show look on purpose. The actual subject here is verification and trust, not a party game, so it leans on a survey-instrument look instead: brass and ink tones, a confidence dial styled like an analog gauge that shows up both in question review and in the post-session report.

## Decision-making

Chunking started at 90 words, a fine default for retrieval generally. A test against a short source caught the actual bug though: two separate facts were merging into one chunk, so the generator quietly produced fewer questions than asked for. Fixed it with a smaller, quiz-specific chunk size (45 words) since a question should hang off one fact, not a paragraph blending a few together.

Went back and forth on whether the host should see the correct answer live, while a question's running, or only at reveal. Landed on the WebSocket never sending the answer key to anyone, host included, and the host UI just cross-references the full question data it already pulled over REST when the page loaded. Simplified `ws.py` a fair bit since it doesn't need host vs player branching in the payload anymore.

Wrote a full integration test that opens a real host socket and a real player socket and drives a whole session end to end. It caught something the unit tests missed: joining a room broadcasts the participant list to everyone already in it, including whoever just joined, so the frontend has to expect that second message right after the "joined" reply, not just the reply on its own. Wouldn't have caught that without testing the actual protocol instead of the functions underneath it.

Groq is the default provider but sits behind an `LLMProvider` interface rather than being called directly. Partly because Groq's fast enough for live generation, partly because the role mentions understanding tradeoffs across providers, so swapping to Anthropic or OpenAI later means adding a class, not rewriting anything.

## GitHub repository

https://github.com/BiplabaKrSamal/groundtruth

https://groundtruth-zeta-flax.vercel.app

Backend API: https://groundtruth-api-bu7u.onrender.com

---

## Product strategy

### A. If you were building this product, what would you change or add next, and why?

Some of this comes from what's publicly documented rather than from actually using it, so treat it as a starting point:

- No Linux build. Docs list macOS and Windows only, which feels like a real gap given how much of the backend and infra crowd this is aimed at runs Linux day to day.
- The published benchmark is Django bug fixes only. Fine for an honest comparison against Claude Code, but narrow. I'd want to see it run against other languages and against greenfield work, not just bug fixes, before trusting that the token numbers hold up generally.
- [fill in after actually using it] Does the approval gating feel like safety or friction once there's real time pressure. Does context survive switching between the terminal and the IDE extension, or does it feel disjointed.

### B. What major UI issues do you dislike, and how do you think they annoy current users?

Leaving this one mostly blank on purpose. Superbrain's free during beta on Mac and Windows, and the honest answer here only comes from actually running it against a real repo for a real task, not from guessing. Once there's real usage behind it: where did the terminal flow feel natural versus where I reached for the IDE extension instead, did the approval gate ever get in the way or did it build trust, did anything feel like it lost context it should've kept. Making up specific complaints here would kind of defeat the point of asking, they want to see how I think, not read a polished but invented answer.
