import random
import string
import time

from app.models import AnswerRecord, Participant, QuizSession, SessionPhase

ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


class SessionStore:
    """Room-code-indexed session state.

    In-memory by design for the MVP — a single-process deploy is fine at
    quiz-night scale. The store is the only place that knows that; swapping
    to Redis later means changing this file, not every caller.
    """

    def __init__(self):
        self._sessions: dict[str, QuizSession] = {}
        self._by_room_code: dict[str, str] = {}

    def _generate_room_code(self) -> str:
        while True:
            code = "".join(random.choices(ROOM_CODE_ALPHABET, k=5))
            if code not in self._by_room_code:
                return code

    def create(self, title: str, source_text: str) -> QuizSession:
        session = QuizSession(
            room_code=self._generate_room_code(),
            title=title,
            source_text=source_text,
        )
        self._sessions[session.session_id] = session
        self._by_room_code[session.room_code] = session.session_id
        return session

    def get(self, session_id: str) -> QuizSession | None:
        return self._sessions.get(session_id)

    def get_by_room_code(self, room_code: str) -> QuizSession | None:
        session_id = self._by_room_code.get(room_code.upper())
        return self._sessions.get(session_id) if session_id else None

    def add_participant(self, session: QuizSession, nickname: str) -> Participant:
        participant = Participant(nickname=nickname)
        session.participants[participant.participant_id] = participant
        return participant

    def start_next_question(self, session: QuizSession) -> bool:
        if session.current_question_index + 1 >= len(session.questions):
            session.phase = SessionPhase.ENDED
            return False
        session.current_question_index += 1
        session.current_question_started_at = time.time()
        session.phase = SessionPhase.LIVE
        return True

    def record_answer(
        self, session: QuizSession, participant_id: str, option_index: int
    ) -> AnswerRecord | None:
        if session.phase != SessionPhase.LIVE:
            return None
        question = session.questions[session.current_question_index]
        already = any(
            a.participant_id == participant_id and a.question_id == question.question_id
            for a in session.answers
        )
        if already:
            return None

        elapsed_ms = int((time.time() - session.current_question_started_at) * 1000)
        correct = question.options[option_index].is_correct if 0 <= option_index < len(question.options) else False

        record = AnswerRecord(
            participant_id=participant_id,
            question_id=question.question_id,
            option_index=option_index,
            correct=correct,
            answer_ms=elapsed_ms,
        )
        session.answers.append(record)

        participant = session.participants[participant_id]
        if correct:
            speed_bonus = max(0, question.time_limit_seconds * 1000 - elapsed_ms)
            participant.score += 500 + int(speed_bonus / 20)
            participant.streak += 1
        else:
            participant.streak = 0

        return record

    def close_question(self, session: QuizSession) -> None:
        question = session.questions[session.current_question_index]
        relevant = [a for a in session.answers if a.question_id == question.question_id]
        if relevant:
            question.correct_rate = sum(1 for a in relevant if a.correct) / len(relevant)
            question.avg_answer_ms = sum(a.answer_ms for a in relevant) / len(relevant)
        session.phase = SessionPhase.BETWEEN

    def leaderboard(self, session: QuizSession) -> list[Participant]:
        return sorted(session.participants.values(), key=lambda p: -p.score)


store = SessionStore()
