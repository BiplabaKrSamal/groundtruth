import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CountdownGauge } from '../components/CountdownGauge'
import { Leaderboard } from '../components/Leaderboard'
import { useQuizSocket } from '../lib/useQuizSocket'
import type { LeaderboardEntry } from '../lib/types'

type PlayPhase = 'waiting' | 'live' | 'answered' | 'results' | 'ended'

const OPTION_STYLES = [
  'bg-brass/15 border-brass hover:bg-brass/25',
  'bg-survey/20 border-survey-bright hover:bg-survey/30',
  'bg-signal/15 border-signal hover:bg-signal/25',
  'bg-paper/10 border-paper-dim hover:bg-paper/20',
]

export default function Play() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('gt_nickname')

  const [phase, setPhase] = useState<PlayPhase>('waiting')
  const [question, setQuestion] = useState<{ prompt: string; options: string[]; total: number; index: number; time_limit_seconds: number } | null>(null)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [selected, setSelected] = useState<number | null>(null)
  const [lastCorrectIndex, setLastCorrectIndex] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const hasJoined = useRef(false)

  const { lastMessage, send, connected } = useQuizSocket(roomCode ?? null, {})

  useEffect(() => {
    if (!nickname) navigate('/join')
  }, [nickname, navigate])

  useEffect(() => {
    if (connected && !hasJoined.current && nickname) {
      send({ type: 'join', nickname })
      hasJoined.current = true
    }
  }, [connected, nickname, send])

  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'question':
        setQuestion(lastMessage)
        setStartedAt(Date.now())
        setSelected(null)
        setLastCorrectIndex(null)
        setPhase('live')
        break
      case 'results': {
        setLastCorrectIndex(lastMessage.correct_index)
        const mine = lastMessage.leaderboard.find((e) => e.nickname === nickname)
        if (mine) setScore(mine.score)
        setLeaderboard(lastMessage.leaderboard)
        setPhase('results')
        break
      }
      case 'ended':
        setLeaderboard(lastMessage.leaderboard)
        setPhase('ended')
        break
    }
  }, [lastMessage, nickname])

  function answer(index: number) {
    if (phase !== 'live') return
    setSelected(index)
    setPhase('answered')
    send({ type: 'answer', option_index: index })
  }

  if (!nickname) return null

  return (
    <div className="min-h-screen bg-ink text-chalk flex flex-col">
      <header className="px-5 py-3 flex items-center justify-between border-b border-brass/15">
        <span className="font-body text-sm text-paper-dim">{nickname}</span>
        <span className="font-mono text-sm text-brass-bright">{score} pts</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 gap-6">
        {phase === 'waiting' && (
          <div className="text-center flex flex-col items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-survey-bright animate-pulse" />
            <p className="font-display text-2xl">You're in</p>
            <p className="font-body text-paper-dim text-sm">Waiting for the host to start…</p>
          </div>
        )}

        {(phase === 'live' || phase === 'answered') && question && (
          <div className="w-full max-w-md flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-paper-dim">
                {question.index + 1} / {question.total}
              </span>
              <CountdownGauge
                totalSeconds={question.time_limit_seconds}
                startedAt={startedAt}
                size={64}
              />
            </div>
            <h2 className="font-display text-2xl leading-snug text-center">{question.prompt}</h2>
            <div className="grid grid-cols-1 gap-3">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={phase === 'answered'}
                  className={`text-left font-body px-5 py-4 rounded-lg border-2 transition-colors disabled:cursor-not-allowed ${OPTION_STYLES[i]} ${
                    selected === i ? 'ring-2 ring-chalk' : ''
                  } ${phase === 'answered' && selected !== i ? 'opacity-40' : ''}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {phase === 'answered' && (
              <p className="font-mono text-xs text-center text-paper-dim">
                answer locked in — waiting on the rest of the room
              </p>
            )}
          </div>
        )}

        {phase === 'results' && question && (
          <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
            <p
              className={`font-display text-3xl ${
                selected === lastCorrectIndex ? 'text-survey-bright' : 'text-signal'
              }`}
            >
              {selected === lastCorrectIndex ? 'Correct' : 'Not quite'}
            </p>
            {selected !== lastCorrectIndex && lastCorrectIndex !== null && (
              <p className="font-body text-paper-dim">
                Correct answer: <span className="text-chalk">{question.options[lastCorrectIndex]}</span>
              </p>
            )}
            <Leaderboard entries={leaderboard} highlight={nickname} />
          </div>
        )}

        {phase === 'ended' && (
          <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
            <p className="font-display text-3xl">That's the quiz</p>
            <Leaderboard entries={leaderboard} highlight={nickname} />
          </div>
        )}
      </main>
    </div>
  )
}
