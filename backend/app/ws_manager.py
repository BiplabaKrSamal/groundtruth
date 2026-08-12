from fastapi import WebSocket


class RoomConnectionManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, room_code: str, socket: WebSocket) -> None:
        await socket.accept()
        self._rooms.setdefault(room_code, []).append(socket)

    def disconnect(self, room_code: str, socket: WebSocket) -> None:
        connections = self._rooms.get(room_code, [])
        if socket in connections:
            connections.remove(socket)
        if not connections and room_code in self._rooms:
            del self._rooms[room_code]

    async def broadcast(self, room_code: str, message: dict) -> None:
        dead: list[WebSocket] = []
        for socket in self._rooms.get(room_code, []):
            try:
                await socket.send_json(message)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(room_code, socket)


manager = RoomConnectionManager()
