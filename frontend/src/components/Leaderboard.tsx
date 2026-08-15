import type { LeaderboardEntry } from '../lib/types'

export function Leaderboard({ entries, highlight }: { entries: LeaderboardEntry[]; highlight?: string }) {
  return (
    <ol className="flex flex-col gap-2 w-full max-w-md">
      {entries.map((entry, i) => (
        <li
          key={entry.nickname + i}
          className={`flex items-center justify-between rounded px-4 py-3 border ${
            entry.nickname === highlight
              ? 'border-brass-bright bg-brass/10'
              : 'border-brass/15 bg-ink-raised'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-paper-dim w-5">{i + 1}</span>
            <span className="font-body font-medium">{entry.nickname}</span>
            {!!entry.streak && entry.streak > 1 && (
              <span className="font-mono text-xs text-brass-bright">×{entry.streak}</span>
            )}
          </div>
          <span className="font-mono font-semibold tabular-nums">{entry.score}</span>
        </li>
      ))}
      {entries.length === 0 && (
        <p className="text-paper-dim text-sm font-body">No one's scored yet.</p>
      )}
    </ol>
  )
}
