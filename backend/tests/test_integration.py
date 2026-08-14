from fastapi.testclient import TestClient

from app.main import app
from app.models import QuestionOption
from app.session_manager import store

client = TestClient(app)


def _seed_session_with_question():
    resp = client.post("/api/sessions", json={"title": "Space Facts", "source_text": "Mars is red."})
    session_data = resp.json()
    session = store.get(session_data["session_id"])
    session.questions = [
        session.questions[0] if session.questions else None
    ] or []
    from app.models import Question
    session.questions = [
        Question(
            prompt="What color is Mars?",
            options=[
                QuestionOption(label="Red", is_correct=True),
                QuestionOption(label="Blue"),
                QuestionOption(label="Green"),
                QuestionOption(label="Yellow"),
            ],
            confidence=0.95,
            source_chunk_ids=["c0"],
            source_excerpt="Mars is red.",
        )
    ]
    return session_data


def test_create_session_returns_room_code():
    resp = client.post("/api/sessions", json={"title": "T", "source_text": "some source"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["room_code"]) == 5
    assert body["phase"] == "draft"


def test_publish_requires_questions():
    resp = client.post("/api/sessions", json={"title": "T", "source_text": "s"})
    body = resp.json()
    resp2 = client.post(
        f"/api/sessions/{body['session_id']}/publish",
        params={"host_token": body["host_token"]},
    )
    assert resp2.status_code == 422


def test_publish_wrong_host_token_rejected():
    session_data = _seed_session_with_question()
    resp = client.post(
        f"/api/sessions/{session_data['session_id']}/publish",
        params={"host_token": "not-the-real-token"},
    )
    assert resp.status_code == 403


def test_full_round_trip_over_websocket():
    session_data = _seed_session_with_question()
    session_id = session_data["session_id"]
    host_token = session_data["host_token"]

    publish = client.post(f"/api/sessions/{session_id}/publish", params={"host_token": host_token})
    room_code = publish.json()["room_code"]

    with client.websocket_connect(f"/ws/{room_code}?role=host&host_token={host_token}") as host_ws:
        with client.websocket_connect(f"/ws/{room_code}?role=player") as player_ws:
            player_ws.send_json({"type": "join", "nickname": "Ada"})
            joined = player_ws.receive_json()
            assert joined["type"] == "joined"
            participant_id = joined["participant_id"]

            # the join broadcast reaches everyone in the room, including the
            # player who just joined, so both sockets drain a copy
            participants_update_host = host_ws.receive_json()
            participants_update_player = player_ws.receive_json()
            assert participants_update_host["type"] == "participants"
            assert participants_update_host["participants"][0]["nickname"] == "Ada"
            assert participants_update_player["type"] == "participants"

            host_ws.send_json({"type": "start"})
            question_host = host_ws.receive_json()
            question_player = player_ws.receive_json()
            assert question_host["type"] == "question"
            assert question_player["prompt"] == "What color is Mars?"
            assert "options" in question_player
            assert all("is_correct" not in str(o) for o in [question_player])  # no leaked answer key

            player_ws.send_json({"type": "answer", "option_index": 0})
            progress_host = host_ws.receive_json()
            progress_player = player_ws.receive_json()
            assert progress_host["type"] == "answer_progress"
            assert progress_host["answered"] == 1
            assert progress_player["answered"] == 1

            host_ws.send_json({"type": "reveal"})
            results_host = host_ws.receive_json()
            results_player = player_ws.receive_json()
            assert results_host["type"] == "results"
            assert results_host["correct_index"] == 0
            assert results_host["leaderboard"][0]["nickname"] == "Ada"
            assert results_player["leaderboard"][0]["score"] > 0

            host_ws.send_json({"type": "next"})
            ended_host = host_ws.receive_json()
            ended_player = player_ws.receive_json()
            assert ended_host["type"] == "ended"
            assert ended_player["leaderboard"][0]["nickname"] == "Ada"

    session = store.get(session_id)
    assert session.phase == "ended"
    assert len(session.answers) == 1
