# Founding AI Engineer Assignment - GroundTruth

Biplaba Kr Samal

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

## Deployment

https://groundtruth-zeta-flax.vercel.app

Backend API (Render): [https://groundtruth-api-bu7u.onrender.com](https://groundtruth-api-bu7u.onrender.com/api/health)

---

## Product strategy

### A. If you were building this product, what would you change or add next, and why?

*(From actually using Superbrain on Windows, testing it directly against its own stated capabilities.)*

Testing it turned up the same underlying gap in three separate places — the incomplete multi-file edit, the missed dependency, and the wrong library, all described below in Part B — which is enough to call it a pattern rather than a one-off. None of the three came with any signal that something was incomplete; it just presents partial work as finished. That's the fix I'd prioritize: whatever it doesn't fully do, or doesn't fully check, needs to say so, instead of looking identical to a complete result.

Second: the approval gap, also below, has the same shape. Everything above is an output-quality problem you'd catch by reviewing the work. This is different in kind — the review step itself doesn't fully cover what it claims to, so there's no reliable point left to catch it. I'd fix this one first: a product built entirely around developer control doesn't get to have that exact mechanism be the unreliable part.

Third, and this one's more of a longer-term bet than a fix: the missed dependency looks like it could be a TokenFold problem specifically, not just an agent one. If TokenFold didn't surface the file containing that dependency when it built context for the task, that's a context-selection gap rather than a reporting one — I didn't have visibility into what TokenFold actually pulled in, so I can't confirm that's what happened, but it's consistent with what I saw. Continued work on what TokenFold decides is relevant, not just how much it compresses, seems like the natural next investment, since that's the exact mechanism the whole product is built around.

### B. What major UI issues do you dislike, and how do you think they annoy current users?

Running the Windows installer elevated (right-click → Run as Administrator) throws a warning that the User Installer isn't meant to run as admin, and points to a separate System Installer for all-users installs — except that System Installer isn't visible as its own option anywhere on the download page itself, only referenced from inside this dialog. The bigger problem isn't the warning, it's that it's a click-through: "Are you sure you want to continue?" That should be blocked outright, not left for the user to click past — a coding agent needs API keys and repo access to function at all, so install-time permissions aren't a cosmetic detail. I did click through: it installed and ran fine at first launch. I didn't check whether auto-update still works afterward, though, and that's really the part worth verifying — that's the kind of thing an elevated install breaks quietly, later rather than right away.

Asked it to refactor across a large set of files — the kind of thing their own "Multi-file execution" pitch promises stays "structurally consistent across the codebase." It finished looking completely normal, no error, nothing flagged. Only some of the files had actually been touched. There's no moment where anything visibly goes wrong, so there's nothing prompting you to double check — you'd only catch it by re-reading your own diff, which defeats a chunk of the point of handing the work off in the first place.

I also asked it to reason through a change's impact — exactly the "dependency chains... system-level impact" pitch from their capabilities page — and it missed a real dependency the change would have affected. Same shape as the file-edit issue above: it wasn't wrong about what it did check, it just didn't check everything, and nothing signaled that anything was left out. You'd only catch it by already knowing the codebase well enough to spot what it missed yourself.

Working in an existing pipeline, it reached for a new library instead of the one already used for that exact purpose elsewhere in the codebase — probably the sharpest example of the same pattern, since this one isn't a subjective style call. The existing dependency was sitting right there in the manifest. "Adapts to your... repository conventions" is one of the more specific, checkable claims on their capabilities page, and reusing what's already installed is about as basic as that gets. Now there are two libraries doing the same job in one codebase — the kind of small inconsistency that compounds, and makes a codebase look less like one team wrote it the longer it goes unnoticed.

The one that matters most, though, isn't another instance of that pattern — it's the mechanism that's supposed to catch all of the above. "No file changes happen without approval... reviewable and controllable by the developer" is their own language for the approval layer. I approved one specific change, and two other files were modified along with it that weren't part of what the approval actually showed me. Everything else on this list is an output-quality problem you'd catch by reviewing the work. This one's different: the review step itself is what's incomplete, so there's nothing left in the workflow to catch it.
