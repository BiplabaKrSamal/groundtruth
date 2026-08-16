import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Join() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!roomCode.trim() || !nickname.trim()) return
    setChecking(true)
    setError('')
    try {
      await api.getByRoomCode(roomCode.trim().toUpperCase())
      sessionStorage.setItem('gt_nickname', nickname.trim())
      navigate(`/play/${roomCode.trim().toUpperCase()}`)
    } catch {
      setError("Can't find a room with that code")
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink bg-contour text-chalk flex items-center justify-center px-6">
      <form onSubmit={handleJoin} className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center mb-2">
          <h1 className="font-display text-3xl">Join a session</h1>
          <p className="font-body text-paper-dim text-sm mt-1">
            Ask your host for the 5-letter room code.
          </p>
        </div>

        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={5}
          placeholder="ROOM CODE"
          className="stamp-code text-center text-2xl bg-ink-raised border border-brass/30 rounded px-4 py-4 focus:border-brass-bright outline-none uppercase"
        />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="Your name"
          className="font-body text-center bg-ink-raised border border-brass/25 rounded px-4 py-3 focus:border-brass-bright outline-none"
        />
        {error && <p className="text-signal font-body text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={checking || !roomCode.trim() || !nickname.trim()}
          className="bg-survey hover:bg-survey-bright disabled:opacity-30 text-chalk font-body font-semibold rounded px-6 py-4 transition-colors"
        >
          {checking ? 'Checking…' : 'Join'}
        </button>
      </form>
    </div>
  )
}
