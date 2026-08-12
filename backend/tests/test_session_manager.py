from app.models import Question, QuestionOption
from app.session_manager import SessionStore


def make_question():
    return Question(
        prompt="What color is the sky?",
        options=[
            QuestionOption(label="Blue", is_correct=True),
            QuestionOption(label="Green"),
            QuestionOption(label="Red"),
            QuestionOption(label="Purple"),
        ],
        confidence=0.9,
        source_chunk_ids=["c0"],
        source_excerpt="The sky appears blue.",
    )


def test_room_codes_are_unique_and_uppercase():
    store = SessionStore()
    codes = {store.create(f"t{i}", "source").room_code for i in range(50)}
    assert len(codes) == 50
    assert all(code == code.upper() for code in codes)


def test_get_by_room_code_is_case_insensitive():
    store = SessionStore()
    session = store.create("t", "source")
    found = store.get_by_room_code(session.room_code.lower())
    assert found is not None
    assert found.session_id == session.session_id


def test_scoring_rewards_speed_and_correctness():
    store = SessionStore()
    session = store.create("t", "source")
    session.questions = [make_question()]
    fast = store.add_participant(session, "fast")
    slow = store.add_participant(session, "slow")
    store.start_next_question(session)

    session.current_question_started_at -= 1  # fast answered ~1s in
    store.record_answer(session, fast.participant_id, 0)

    session.current_question_started_at -= 18  # slow answered ~18s in (backdate more)
    store.record_answer(session, slow.participant_id, 0)

    assert fast.score > slow.score
    assert fast.streak == 1


def test_wrong_answer_resets_streak():
    store = SessionStore()
    session = store.create("t", "source")
    session.questions = [make_question()]
    p = store.add_participant(session, "p")
    p.streak = 3
    store.start_next_question(session)
    store.record_answer(session, p.participant_id, 1)  # wrong option
    assert p.streak == 0
    assert p.score == 0


def test_duplicate_answer_ignored():
    store = SessionStore()
    session = store.create("t", "source")
    session.questions = [make_question()]
    p = store.add_participant(session, "p")
    store.start_next_question(session)
    store.record_answer(session, p.participant_id, 0)
    first_score = p.score
    store.record_answer(session, p.participant_id, 0)
    assert p.score == first_score


def test_start_next_question_ends_session_when_exhausted():
    store = SessionStore()
    session = store.create("t", "source")
    session.questions = [make_question()]
    assert store.start_next_question(session) is True
    assert store.start_next_question(session) is False
    from app.models import SessionPhase
    assert session.phase == SessionPhase.ENDED
