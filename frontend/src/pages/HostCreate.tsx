import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function HostCreate() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [questionCount, setQuestionCount] = useState(8)
  const [status, setStatus] = useState<'idle' | 'creating' | 'generating' | 'error'>('idle')
  const [error, setError] = useState('')

  const wordCount = sourceText.trim().split(/\s+/).filter(Boolean).length
  const canGenerate = title.trim().length > 0 && wordCount >= 40 && status === 'idle'

  async function handlePdf(file: File) {
    setStatus('creating')
    setError('')
    try {
      const session = await api.createSession(title || file.name.replace('.pdf', ''), '')
      localStorage.setItem(`gt_host_${session.session_id}`, session.host_token)
      const { source_text } = await api.uploadPdf(session.session_id, session.host_token, file)
      setSourceText(source_text)
      setStatus('idle')
      sessionStorage.setItem('gt_pending_session', session.session_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that PDF')
      setStatus('error')
    }
  }

  async function handleGenerate() {
    setStatus('creating')
    setError('')
    try {
      let sessionId = sessionStorage.getItem('gt_pending_session')
      let hostToken = sessionId ? localStorage.getItem(`gt_host_${sessionId}`) : null

      if (!sessionId || !hostToken) {
        const session = await api.createSession(title, sourceText)
        sessionId = session.session_id
        hostToken = session.host_token
        localStorage.setItem(`gt_host_${sessionId}`, hostToken)
      }

      setStatus('generating')
      await api.generateQuestions(sessionId, hostToken!, questionCount)
      sessionStorage.removeItem('gt_pending_session')
      navigate(`/host/${sessionId}/review`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-ink text-chalk px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass-bright">
            New session
          </span>
          <h1 className="font-display text-3xl mt-1">What's this quiz about?</h1>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-paper-dim">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chapter 4: Cellular Respiration"
            className="bg-ink-raised border border-brass/25 rounded px-4 py-3 font-body focus:border-brass-bright outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-paper-dim">
              Source material
            </span>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-mono text-xs text-brass-bright hover:underline"
            >
              upload a PDF instead
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])}
            />
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste an article, a set of notes, a transcript — anything with real facts in it."
            rows={10}
            className="bg-ink-raised border border-brass/25 rounded px-4 py-3 font-body leading-relaxed focus:border-brass-bright outline-none resize-none"
          />
          <span className="font-mono text-xs text-paper-dim self-end">
            {wordCount} words {wordCount < 40 && wordCount > 0 && '— add a bit more for good grounding'}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-paper-dim">
            Questions to generate: {questionCount}
          </span>
          <input
            type="range"
            min={3}
            max={12}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="accent-brass"
          />
        </label>

        {error && <p className="text-signal font-body text-sm">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="bg-brass hover:bg-brass-bright disabled:opacity-30 disabled:cursor-not-allowed text-ink font-body font-semibold rounded px-6 py-4 transition-colors"
        >
          {status === 'generating'
            ? 'Grounding questions in your source…'
            : status === 'creating'
              ? 'Working…'
              : 'Generate questions'}
        </button>
      </div>
    </div>
  )
}
