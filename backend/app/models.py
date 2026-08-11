import time
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class SessionPhase(str, Enum):
    DRAFT = "draft"          # source uploaded, questions being generated/edited
    LOBBY = "lobby"          # room open, participants joining
    LIVE = "live"            # a question is active
    BETWEEN = "between"      # showing results, waiting for host to advance
    ENDED = "ended"


class SourceChunk(BaseModel):
    chunk_id: str
    text: str
    position: int


class QuestionOption(BaseModel):
    label: str
    is_correct: bool = False


class Question(BaseModel):
    question_id: str = Field(default_factory=lambda: new_id("q"))
    prompt: str
    options: list[QuestionOption]
    confidence: float  # 0-1, how well the source material grounds this question
    source_chunk_ids: list[str]
    source_excerpt: str
    time_limit_seconds: int = 20
    # filled in once the session runs
    correct_rate: Optional[float] = None
    avg_answer_ms: Optional[float] = None


class Participant(BaseModel):
    participant_id: str = Field(default_factory=lambda: new_id("p"))
    nickname: str
    score: int = 0
    streak: int = 0
    joined_at: float = Field(default_factory=time.time)


class AnswerRecord(BaseModel):
    participant_id: str
    question_id: str
    option_index: int
    correct: bool
    answer_ms: int


class QuizSession(BaseModel):
    session_id: str = Field(default_factory=lambda: new_id("s"))
    room_code: str
    host_token: str = Field(default_factory=lambda: uuid.uuid4().hex)
    title: str = "Untitled session"
    source_text: str = ""
    chunks: list[SourceChunk] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
    participants: dict[str, Participant] = Field(default_factory=dict)
    answers: list[AnswerRecord] = Field(default_factory=list)
    phase: SessionPhase = SessionPhase.DRAFT
    current_question_index: int = -1
    current_question_started_at: Optional[float] = None
    created_at: float = Field(default_factory=time.time)
