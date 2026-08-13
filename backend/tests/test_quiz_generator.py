import pytest

from app.llm_providers import LLMProvider
from app.quiz_generator import generate_quiz

SOURCE = """
The Wright brothers achieved the first powered, controlled flight of a
heavier-than-air aircraft near Kitty Hawk, North Carolina, on December 17,
1903. The flight lasted 12 seconds and covered 120 feet.

Orville Wright was the pilot for that first flight, while his brother
Wilbur ran alongside the wing to help stabilize the aircraft at takeoff.
"""


class FakeLLM(LLMProvider):
    """Returns a well-grounded question for the first chunk it sees and a
    fabricated, ungrounded one for the second, so the confidence pipeline
    has something real to distinguish."""

    async def complete_json(self, system: str, user: str) -> dict:
        return {
            "questions": [
                {
                    "chunk_id": "c0",
                    "prompt": "Where did the Wright brothers' first powered flight take place?",
                    "options": ["Kitty Hawk, North Carolina", "Dayton, Ohio", "Kill Devil Hills, Virginia", "Paris, France"],
                    "correct_index": 0,
                },
                {
                    "chunk_id": "c1",
                    "prompt": "What was the top altitude reached during the flight?",
                    "options": ["10,000 feet", "500 feet", "50 feet", "12 feet"],
                    "correct_index": 2,  # not actually supported by the source
                },
            ]
        }


@pytest.mark.asyncio
async def test_generate_quiz_returns_questions_with_confidence():
    questions = await generate_quiz(SOURCE, FakeLLM(), question_count=2)
    assert len(questions) == 2
    assert all(0 <= q.confidence <= 1 for q in questions)


@pytest.mark.asyncio
async def test_grounded_question_scores_higher_than_fabricated_one():
    questions = await generate_quiz(SOURCE, FakeLLM(), question_count=2)
    grounded = next(q for q in questions if q.source_chunk_ids == ["c0"])
    fabricated = next(q for q in questions if q.source_chunk_ids == ["c1"])
    assert grounded.confidence > fabricated.confidence


@pytest.mark.asyncio
async def test_empty_source_returns_no_questions():
    questions = await generate_quiz("", FakeLLM())
    assert questions == []
