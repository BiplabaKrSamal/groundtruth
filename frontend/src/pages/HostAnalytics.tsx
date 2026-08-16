import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfidenceDial } from '../components/ConfidenceDial'
import { api } from '../lib/api'
import type { SessionData } from '../lib/types'

export default function HostAnalytics() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const hostToken = sessionId ? localStorage.getItem(`gt_host_${sessionId}`) : null
  const [session, setSession] = useState<SessionData | null>(null)

  useEffect(() => {
    if (!sessionId || !hostToken) return
    api.getSession(sessionId, hostToken).then(setSession)
  }, [sessionId, hostToken])

  if (!session) {
    return (
      <div className="min-h-screen bg-ink text-chalk flex items-center justify-center">
        <p className="font-mono text-paper-dim">Loading…</p>
      </div>
    )
  }

  const answered = session.questions.filter((q) => q.correct_rate !== null)
  const surprises = [...answered].sort(
    (a, b) => Math.abs(b.confidence - (b.correct_rate ?? 0)) - Math.abs(a.confidence - (a.correct_rate ?? 0)),
  )

  return (
    <div className="min-h-screen bg-ink text-chalk px-6 py-12">
      <div className="max-w-3xl mx-auto flex flex-col gap-10">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass-bright">
            Session report
          </span>
          <h1 className="font-display text-3xl mt-1">{session.title}</h1>
          <p className="font-body text-sm text-paper-dim mt-2 max-w-lg">
            Where the model's grounding confidence and what actually happened in the
            room agree, the question earned its trust. Where they diverge, that's
            worth a second look before you reuse it.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {surprises.map((q) => {
            const gap = q.confidence - (q.correct_rate ?? 0)
            return (
              <div
                key={q.question_id}
                className="border border-brass/20 rounded-lg p-5 flex flex-col sm:flex-row gap-5 bg-ink-raised"
              >
                <div className="flex gap-4">
                  <ConfidenceDial value={q.confidence} size={76} label="AI said" />
                  <ConfidenceDial value={q.correct_rate ?? 0} size={76} label="room got right" />
                </div>
                <div className="flex-1">
                  <p className="font-body">{q.prompt}</p>
                  <p
                    className={`font-mono text-xs mt-2 ${
                      Math.abs(gap) > 0.35 ? 'text-signal' : 'text-paper-dim'
                    }`}
                  >
                    {Math.abs(gap) > 0.35
                      ? gap > 0
                        ? 'model was more confident than the room performed, worth rechecking the grounding'
                        : 'room did better than the model expected, likely an easy, well-known fact'
                      : 'confidence roughly tracked outcome'}
                  </p>
                </div>
              </div>
            )
          })}
          {answered.length === 0 && (
            <p className="font-body text-paper-dim text-sm">
              No questions were answered in this session yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
