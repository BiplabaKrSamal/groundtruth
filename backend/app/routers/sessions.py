import io

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader

from app.config import settings
from app.llm_providers import get_llm_provider
from app.models import QuestionOption, SessionPhase
from app.quiz_generator import generate_quiz
from app.session_manager import store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CreateSessionBody(BaseModel):
    title: str
    source_text: str


class GenerateBody(BaseModel):
    question_count: int = 8


class QuestionEdit(BaseModel):
    question_id: str
    prompt: str
    options: list[QuestionOption]


class UpdateQuestionsBody(BaseModel):
    questions: list[QuestionEdit]


def _require_host(session_id: str, host_token: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    if session.host_token != host_token:
        raise HTTPException(403, "Invalid host token")
    return session


@router.post("")
def create_session(body: CreateSessionBody):
    session = store.create(body.title, body.source_text)
    return session


@router.post("/{session_id}/upload-pdf")
async def upload_pdf(session_id: str, host_token: str, file: UploadFile):
    session = _require_host(session_id, host_token)
    raw = await file.read()
    reader = PdfReader(io.BytesIO(raw))
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise HTTPException(422, "Couldn't extract text from that PDF")
    session.source_text = text
    return {"source_text": text}


@router.post("/{session_id}/generate")
async def generate(session_id: str, host_token: str, body: GenerateBody):
    session = _require_host(session_id, host_token)
    if not session.source_text.strip():
        raise HTTPException(422, "Add source material before generating questions")

    count = max(3, min(settings.max_questions_per_quiz, body.question_count))
    llm = get_llm_provider()
    questions = await generate_quiz(
        session.source_text,
        llm,
        question_count=count,
        time_limit_seconds=settings.question_time_limit_seconds,
    )
    if not questions:
        raise HTTPException(422, "Couldn't generate grounded questions from that source")

    session.questions = questions
    return session


@router.put("/{session_id}/questions")
def update_questions(session_id: str, host_token: str, body: UpdateQuestionsBody):
    session = _require_host(session_id, host_token)
    by_id = {q.question_id: q for q in session.questions}
    for edit in body.questions:
        if edit.question_id in by_id:
            by_id[edit.question_id].prompt = edit.prompt
            by_id[edit.question_id].options = edit.options
    return session


@router.delete("/{session_id}/questions/{question_id}")
def delete_question(session_id: str, question_id: str, host_token: str):
    session = _require_host(session_id, host_token)
    session.questions = [q for q in session.questions if q.question_id != question_id]
    return session


@router.post("/{session_id}/publish")
def publish(session_id: str, host_token: str):
    session = _require_host(session_id, host_token)
    if not session.questions:
        raise HTTPException(422, "Generate at least one question first")
    session.phase = SessionPhase.LOBBY
    return session


@router.get("/{session_id}")
def get_session(session_id: str, host_token: str):
    return _require_host(session_id, host_token)


@router.get("/by-room/{room_code}")
def get_by_room_code(room_code: str):
    session = store.get_by_room_code(room_code)
    if session is None:
        raise HTTPException(404, "No session with that room code")
    return {
        "session_id": session.session_id,
        "title": session.title,
        "phase": session.phase,
        "participant_count": len(session.participants),
    }
