import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfidenceDial } from '../components/ConfidenceDial'
import { api } from '../lib/api'
import type { Question, SessionData } from '../lib/types'

export default function HostReview() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const hostToken = sessionId ? localStorage.getItem(`gt_host_${sessionId}`) : null

  const [session, setSession] = useState<SessionData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId || !hostToken) return
    api
      .getSession(sessionId, hostToken)
      .then((data) => {
        setSession(data)
        setQuestions(data.questions)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId, hostToken])

  function updatePrompt(qid: string, prompt: string) {
    setQuestions((qs) => qs.map((q) => (q.question_id === qid ? { ...q, prompt } : q)))
  }

  function updateOption(qid: string, idx: number, label: string) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.question_id === qid
          ? { ...q, options: q.options.map((o, i) => (i === idx ? { ...o, label } : o)) }
          : q,
      ),
    )
  }

  function setCorrect(qid: string, idx: number) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.question_id === qid
          ? { ...q, options: q.options.map((o, i) => ({ ...o, is_correct: i === idx })) }
          : q,
      ),
    )
  }

  async function removeQuestion(qid: string) {
    if (!sessionId || !hostToken) return
    await api.deleteQuestion(sessionId, hostToken, qid)
    setQuestions((qs) => qs.filter((q) => q.question_id !== qid))
  }

  async function goLive() {
    if (!sessionId || !hostToken) return
    setPublishing(true)
    setError('')
    try {
      await api.updateQuestions(sessionId, hostToken, questions)
      await api.publish(sessionId, hostToken)
      navigate(`/host/${sessionId}/control`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish')
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink text-chalk flex items-center justify-center">
        <p className="font-mono text-paper-dim">Loading session…</p>
      </div>
    )
  }

  if (!hostToken || !session) {
    return (
      <div className="min-h-screen bg-ink text-chalk flex items-center justify-center px-6 text-center">
        <p className="font-body text-paper-dim">
          Can't find a host session here. Start a new one from the home page.
        </p>
      </div>
    )
  }

  const avgConfidence =
    questions.reduce((sum, q) => sum + q.confidence, 0) / (questions.length || 1)

  return (
    <div className="min-h-screen bg-ink text-chalk px-6 py-12">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass-bright">
              Review before you go live
            </span>
            <h1 className="font-display text-3xl mt-1">{session.title}</h1>
            <p className="font-body text-sm text-paper-dim mt-1">
              {questions.length} questions · edit anything that looks off, drop what doesn't hold up.
            </p>
          </div>
          <ConfidenceDial value={avgConfidence} size={100} label="avg grounding" />
        </div>

        {error && <p className="text-signal font-body text-sm">{error}</p>}

        <div className="flex flex-col gap-5">
          {questions.map((q, qi) => (
            <div
              key={q.question_id}
              className="border border-brass/20 rounded-lg p-5 bg-ink-raised flex gap-5 flex-col sm:flex-row"
            >
              <ConfidenceDial value={q.confidence} size={84} />
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-xs text-paper-dim pt-2">Q{qi + 1}</span>
                  <textarea
                    value={q.prompt}
                    onChange={(e) => updatePrompt(q.question_id, e.target.value)}
                    rows={2}
                    className="flex-1 bg-transparent font-body text-lg leading-snug resize-none outline-none border-b border-transparent focus:border-brass/40"
                  />
                  <button
                    onClick={() => removeQuestion(q.question_id)}
                    className="font-mono text-xs text-signal hover:underline pt-2 shrink-0"
                  >
                    remove
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-2 rounded px-3 py-2 border cursor-pointer ${
                        opt.is_correct
                          ? 'border-survey-bright bg-survey/15'
                          : 'border-brass/15 hover:border-brass/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${q.question_id}`}
                        checked={opt.is_correct}
                        onChange={() => setCorrect(q.question_id, oi)}
                        className="accent-survey-bright"
                      />
                      <input
                        value={opt.label}
                        onChange={(e) => updateOption(q.question_id, oi, e.target.value)}
                        className="bg-transparent font-body text-sm flex-1 outline-none"
                      />
                    </label>
                  ))}
                </div>
                <p className="font-body text-xs text-paper-dim italic border-l-2 border-brass/30 pl-3">
                  "{q.source_excerpt}"
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={goLive}
          disabled={publishing || questions.length === 0}
          className="bg-brass hover:bg-brass-bright disabled:opacity-30 text-ink font-body font-semibold rounded px-6 py-4 self-start transition-colors"
        >
          {publishing ? 'Opening the room…' : 'Open the room'}
        </button>
      </div>
    </div>
  )
}
