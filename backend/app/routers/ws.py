from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.session_manager import store
from app.ws_manager import manager

router = APIRouter()


def _public_question(session, index: int) -> dict:
    q = session.questions[index]
    return {
        "type": "question",
        "index": index,
        "total": len(session.questions),
        "question_id": q.question_id,
        "prompt": q.prompt,
        "options": [o.label for o in q.options],
        "time_limit_seconds": q.time_limit_seconds,
    }


def _results_payload(session) -> dict:
    q = session.questions[session.current_question_index]
    tally = [0, 0, 0, 0]
    for a in session.answers:
        if a.question_id == q.question_id and 0 <= a.option_index < 4:
            tally[a.option_index] += 1
    return {
        "type": "results",
        "question_id": q.question_id,
        "correct_index": next(i for i, o in enumerate(q.options) if o.is_correct),
        "tally": tally,
        "correct_rate": q.correct_rate,
        "confidence": q.confidence,
        "source_excerpt": q.source_excerpt,
        "leaderboard": [
            {"nickname": p.nickname, "score": p.score, "streak": p.streak}
            for p in store.leaderboard(session)
        ],
    }


def _participants_payload(session) -> dict:
    return {
        "type": "participants",
        "participants": [
            {"participant_id": p.participant_id, "nickname": p.nickname, "score": p.score}
            for p in session.participants.values()
        ],
    }


@router.websocket("/ws/{room_code}")
async def room_socket(websocket: WebSocket, room_code: str):
    session = store.get_by_room_code(room_code)
    if session is None:
        await websocket.close(code=4004)
        return

    role = websocket.query_params.get("role", "player")
    host_token = websocket.query_params.get("host_token")
    is_host = role == "host" and host_token == session.host_token

    await manager.connect(room_code, websocket)
    participant_id: str | None = websocket.query_params.get("participant_id")

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            if msg_type == "join" and not is_host:
                participant = store.add_participant(session, msg.get("nickname", "Player"))
                participant_id = participant.participant_id
                await websocket.send_json({"type": "joined", "participant_id": participant_id})
                await manager.broadcast(room_code, _participants_payload(session))

            elif msg_type == "start" and is_host:
                store.start_next_question(session)
                await manager.broadcast(room_code, _public_question(session, session.current_question_index))

            elif msg_type == "answer" and participant_id and not is_host:
                store.record_answer(session, participant_id, msg.get("option_index", -1))
                answered = len({a.participant_id for a in session.answers
                                if a.question_id == session.questions[session.current_question_index].question_id})
                await manager.broadcast(room_code, {
                    "type": "answer_progress",
                    "answered": answered,
                    "total": len(session.participants),
                })

            elif msg_type == "reveal" and is_host:
                store.close_question(session)
                await manager.broadcast(room_code, _results_payload(session))

            elif msg_type == "next" and is_host:
                has_more = store.start_next_question(session)
                if has_more:
                    await manager.broadcast(room_code, _public_question(session, session.current_question_index))
                else:
                    await manager.broadcast(room_code, {
                        "type": "ended",
                        "leaderboard": [
                            {"nickname": p.nickname, "score": p.score}
                            for p in store.leaderboard(session)
                        ],
                    })

    except WebSocketDisconnect:
        manager.disconnect(room_code, websocket)
        if not is_host:
            await manager.broadcast(room_code, _participants_payload(session))
