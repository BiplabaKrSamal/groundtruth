import { useEffect, useState } from 'react'
import { GAUGE_START_ANGLE as START_ANGLE, GAUGE_END_ANGLE as END_ANGLE, describeArc } from '../lib/gauge'

interface CountdownGaugeProps {
  totalSeconds: number
  startedAt: number // ms epoch
  size?: number
  onComplete?: () => void
}


export function CountdownGauge({ totalSeconds, startedAt, size = 88, onComplete }: CountdownGaugeProps) {
  const [remaining, setRemaining] = useState(totalSeconds)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000
      const left = Math.max(0, totalSeconds - elapsed)
      setRemaining(left)
      if (left <= 0) onComplete?.()
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [totalSeconds, startedAt, onComplete])

  const fraction = remaining / totalSeconds
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const sweep = START_ANGLE + fraction * (END_ANGLE - START_ANGLE)
  const urgent = remaining <= totalSeconds * 0.25

  return (
    <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
      <path
        d={describeArc(cx, cy, r, START_ANGLE, END_ANGLE)}
        fill="none"
        stroke="#DFD8C6"
        strokeOpacity={0.15}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
      />
      <path
        d={describeArc(cx, cy, r, START_ANGLE, sweep)}
        fill="none"
        stroke={urgent ? '#C1462F' : '#D2AB74'}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
        style={{ transition: 'stroke 0.3s ease' }}
      />
      <text
        x={cx}
        y={cy + size * 0.05}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={size * 0.26}
        fontWeight={600}
        fill="#F7F3EA"
      >
        {Math.ceil(remaining)}
      </text>
    </svg>
  )
}
