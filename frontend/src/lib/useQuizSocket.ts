import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from './api'
import type { ServerMessage } from './types'

export function useQuizSocket(roomCode: string | null, params: Record<string, string>) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    if (!roomCode) return

    const socket = new WebSocket(wsUrl(roomCode, paramsRef.current))
    socketRef.current = socket

    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data))
      } catch {
        // ignore malformed frames
      }
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  const send = useCallback((message: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  return { connected, lastMessage, send }
}
