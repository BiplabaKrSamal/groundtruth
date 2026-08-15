import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ink bg-contour flex flex-col items-center justify-center px-6 py-16 text-chalk">
      <div className="w-full max-w-xl flex flex-col items-center text-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-brass flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-brass-bright" />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-medium tracking-tight">
            GroundTruth
          </h1>
          <p className="font-body text-paper-dim text-base sm:text-lg max-w-md leading-relaxed">
            Live quizzes the AI can't make up. Paste in your source, and every
            question ships with the passage that grounds it and a confidence
            reading on how well it holds up.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 w-full">
          <button
            onClick={() => navigate('/host/new')}
            className="group border border-brass/30 rounded-lg px-6 py-8 text-left hover:border-brass-bright hover:bg-brass/5 transition-colors"
          >
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-brass-bright">
              Run a session
            </span>
            <p className="font-display text-2xl mt-2">Host</p>
            <p className="font-body text-sm text-paper-dim mt-2">
              Drop in a document or topic, review the generated questions, go live.
            </p>
          </button>

          <button
            onClick={() => navigate('/join')}
            className="group border border-survey/40 rounded-lg px-6 py-8 text-left hover:border-survey-bright hover:bg-survey/10 transition-colors"
          >
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-survey-bright">
              Have a code
            </span>
            <p className="font-display text-2xl mt-2">Join</p>
            <p className="font-body text-sm text-paper-dim mt-2">
              Enter the room code from your host and play along live.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
