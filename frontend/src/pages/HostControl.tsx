import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfidenceDial } from '../components/ConfidenceDial'
import { CountdownGauge } from '../components/CountdownGauge'
import { Leaderboard } from '../components/Leaderboard'
import { api } from '../lib/api'
import { useQuizSocket } from '../lib/useQuizSocket'
import type { LeaderboardEntry, Question, SessionData, ServerMessage } from '../lib/types'

type RoomPhase = 'lobby' | 'live' | 'between' | 'ended'

export default function HostControl() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const hostToken = sessionId ? localStorage.getItem(`gt_host_${sessionId}`) : null

  const [session, setSession] = useState<SessionData | null>(null)
  const [phase, setPhase] = useState<RoomPhase>('lobby')
  const [participants, setParticipants] = useState<{ nickname: string; score: number }[]>([])
  const [liveQuestionId, setLiveQuestionId] = useState<string | null>(null)
  const [questionIndex, setQuestionIndex] = useState({ index: 0, total: 0 })
  const [startedAt, setStartedAt] = useState<number>(Date.now())
  const [answered, setAnswered] = useState({ answered: 0, total: 0 })
  const [results, setResults] = useState<(ServerMessage & { type: 'results' }) | null>(null)
  const [finalBoard, setFinalBoard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (!sessionId || !hostToken) return
    api.getSession(sessionId, hostToken).then(setSession)
  }, [sessionId, hostToken])

  const params = useMemo<Record<string, string>>(() => {
    const p: Record<string, string> = { role: 'host' }
    if (hostToken) p.host_token = hostToken
    return p
  }, [hostToken])
  const { lastMessage, send, connected } = useQuizSocket(session?.room_code ?? null, params)

  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'participants':
        setParticipants(lastMessage.participants)
        break
      case 'question':
        setLiveQuestionId(lastMessage.question_id)
        setQuestionIndex({ index: lastMessage.index, total: lastMessage.total })
        setStartedAt(Date.now())
        setAnswered({ answered: 0, total: participants.length })
        setPhase('live')
        break
      case 'answer_progress':
        setAnswered(lastMessage)
        break
      case 'results':
        setResults(lastMessage)
        setPhase('between')
        break
      case 'ended':
        setFinalBoard(lastMessage.leaderboard)
        setPhase('ended')
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage])

  const liveQuestion: Question | undefined = session?.questions.find(
    (q) => q.question_id === liveQuestionId,
  )

  if (!hostToken || !session) {
    return (
      <div className="min-h-screen bg-ink text-chalk flex items-center justify-center">
        <p className="font-mono text-paper-dim">Loading room…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink text-chalk px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
              {session.title}
            </p>
            <p className="font-mono text-3xl stamp-code text-brass-bright">{session.room_code}</p>
          </div>
          <span className={`font-mono text-xs ${connected ? 'text-survey-bright' : 'text-signal'}`}>
            {connected ? '● connected' : '○ reconnecting'}
          </span>
        </header>

        {phase === 'lobby' && (
          <section className="flex flex-col gap-6 items-center border border-brass/20 rounded-lg py-16 px-6">
            <p className="font-body text-paper-dim text-center max-w-sm">
              Share the code above. Players join at your GroundTruth link and enter it,
              no account needed.
            </p>
            <p className="font-mono text-sm text-brass-bright">
              {participants.length} joined
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {participants.map((p) => (
                <span key={p.nickname} className="font-body text-sm bg-ink-raised border border-brass/20 rounded-full px-3 py-1">
                  {p.nickname}
                </span>
              ))}
            </div>
            <button
              onClick={() => send({ type: 'start' })}
              disabled={participants.length === 0}
              className="bg-brass hover:bg-brass-bright disabled:opacity-30 text-ink font-body font-semibold rounded px-8 py-3 transition-colors"
            >
              Start quiz
            </button>
          </section>
        )}

        {phase === 'live' && liveQuestion && (
          <section className="flex flex-col gap-6 border border-brass/20 rounded-lg p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <span className="font-mono text-xs text-paper-dim">
                  Question {questionIndex.index + 1} of {questionIndex.total}
                </span>
                <h2 className="font-display text-2xl mt-1">{liveQuestion.prompt}</h2>
              </div>
              <CountdownGauge totalSeconds={liveQuestion.time_limit_seconds} startedAt={startedAt} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {liveQuestion.options.map((opt, i) => (
                <div
                  key={i}
                  className={`rounded px-4 py-3 border font-body text-sm ${
                    opt.is_correct ? 'border-survey-bright/50 text-survey-bright' : 'border-brass/15'
                  }`}
                >
                  {opt.label}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-paper-dim">
                {answered.answered}/{participants.length || answered.total} answered
              </span>
              <button
                onClick={() => send({ type: 'reveal' })}
                className="bg-brass hover:bg-brass-bright text-ink font-body font-semibold rounded px-6 py-3 transition-colors"
              >
                Reveal answer
              </button>
            </div>
          </section>
        )}

        {phase === 'between' && results && (
          <section className="flex flex-col gap-6">
            <div className="border border-brass/20 rounded-lg p-8 flex flex-col gap-5">
              <div className="flex items-center gap-6 flex-wrap">
                <ConfidenceDial value={results.confidence} size={90} label="AI confidence" />
                <ConfidenceDial value={results.correct_rate ?? 0} size={90} label="audience got it right" />
                <p className="font-body text-sm text-paper-dim max-w-xs italic border-l-2 border-brass/30 pl-3">
                  "{results.source_excerpt}"
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {results.tally.map((count, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${i === results.correct_index ? 'bg-survey-bright' : 'bg-brass/30'}`}
                      style={{ height: `${16 + count * 14}px` }}
                    />
                    <span className="font-mono text-xs text-paper-dim">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <Leaderboard entries={results.leaderboard} />
            <button
              onClick={() => send({ type: 'next' })}
              className="bg-brass hover:bg-brass-bright text-ink font-body font-semibold rounded px-6 py-4 self-start transition-colors"
            >
              {questionIndex.index + 1 >= questionIndex.total ? 'Finish quiz' : 'Next question'}
            </button>
          </section>
        )}

        {phase === 'ended' && (
          <section className="flex flex-col gap-6 items-center border border-brass/20 rounded-lg py-12 px-6">
            <p className="font-display text-2xl">Final standings</p>
            <Leaderboard entries={finalBoard} />
            <button
              onClick={() => navigate(`/host/${sessionId}/analytics`)}
              className="font-mono text-sm text-brass-bright hover:underline"
            >
              view question-by-question analytics →
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
