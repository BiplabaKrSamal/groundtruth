from app.llm_providers import LLMProvider
from app.models import Question, QuestionOption, SourceChunk
from app.retrieval import HybridRetriever, chunk_text

SYSTEM_PROMPT = """You write live-quiz questions strictly from the excerpts you're given.
Rules:
- Every question must be answerable using only the text in its excerpt.
- Never invent facts, numbers, or names that aren't in the excerpt.
- Write exactly 4 options, exactly one correct.
- Wrong options must be plausible, not silly, and not contradicted by the excerpt.
- Keep the question under 25 words.
Return JSON: {"questions": [{"chunk_id": str, "prompt": str, "options": [str,str,str,str], "correct_index": int}]}"""


def _select_chunks(chunks: list[SourceChunk], count: int) -> list[SourceChunk]:
    if len(chunks) <= count:
        return chunks
    step = len(chunks) / count
    return [chunks[int(i * step)] for i in range(count)]


def _lexical_overlap(a: str, b: str) -> float:
    words_a = {w.lower() for w in a.split() if len(w) > 3}
    words_b = {w.lower() for w in b.split() if len(w) > 3}
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a)


async def generate_quiz(
    source_text: str,
    llm: LLMProvider,
    question_count: int = 8,
    time_limit_seconds: int = 20,
) -> list[Question]:
    # Smaller chunks than the retriever's general-purpose default: a quiz
    # question should hang off one fact, not a paragraph that blends several.
    chunks = chunk_text(source_text, target_words=45)
    if not chunks:
        return []

    target_chunks = _select_chunks(chunks, question_count)
    excerpts = "\n\n".join(f"[{c.chunk_id}] {c.text}" for c in target_chunks)

    result = await llm.complete_json(
        SYSTEM_PROMPT,
        f"Write one question per excerpt below.\n\n{excerpts}",
    )

    retriever = HybridRetriever(chunks)
    chunk_by_id = {c.chunk_id: c for c in chunks}
    questions: list[Question] = []

    for raw in result.get("questions", []):
        claimed_chunk = chunk_by_id.get(raw.get("chunk_id"))
        if claimed_chunk is None or not raw.get("options") or len(raw["options"]) != 4:
            continue

        correct_idx = raw.get("correct_index", 0)
        options = [
            QuestionOption(label=opt, is_correct=(i == correct_idx))
            for i, opt in enumerate(raw["options"])
        ]

        # Independent grounding check: does re-running retrieval on the
        # generated question actually surface the chunk the model claims
        # it used? This is the self-consistency half of the confidence score.
        retrieved = retriever.search(raw["prompt"], top_k=3)
        retrieval_score = next(
            (score for chunk, score in retrieved if chunk.chunk_id == claimed_chunk.chunk_id),
            0.0,
        )

        # Lexical grounding check: does the correct option actually share
        # vocabulary with the source excerpt, or is it a paraphrase so loose
        # it could be fabricated? Independent of the retrieval signal above.
        correct_text = raw["options"][correct_idx]
        lexical_score = _lexical_overlap(correct_text, claimed_chunk.text)

        confidence = round(0.6 * retrieval_score + 0.4 * lexical_score, 3)

        questions.append(
            Question(
                prompt=raw["prompt"],
                options=options,
                confidence=confidence,
                source_chunk_ids=[claimed_chunk.chunk_id],
                source_excerpt=claimed_chunk.text,
                time_limit_seconds=time_limit_seconds,
            )
        )

    return questions
