interface ConfidenceDialProps {
  value: number // 0 to 1
  size?: number
  label?: string
}

const START_ANGLE = -120
const END_ANGLE = 120

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

function tierColor(value: number) {
  if (value >= 0.7) return '#5C8570' // survey-bright
  if (value >= 0.4) return '#D2AB74' // brass-bright
  return '#C1462F' // signal
}

export function ConfidenceDial({ value, size = 120, label }: ConfidenceDialProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  const needleAngle = START_ANGLE + clamped * (END_ANGLE - START_ANGLE)
  const needleTip = polarToCartesian(cx, cy, r * 0.82, needleAngle)
  const color = tierColor(clamped)

  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
        <path
          d={describeArc(cx, cy, r, START_ANGLE, END_ANGLE)}
          fill="none"
          stroke="#DFD8C6"
          strokeOpacity={0.15}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
        />
        <path
          d={describeArc(cx, cy, r, START_ANGLE, needleAngle)}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
        />
        {ticks.map((t) => {
          const angle = START_ANGLE + t * (END_ANGLE - START_ANGLE)
          const inner = polarToCartesian(cx, cy, r * 0.86, angle)
          const outer = polarToCartesian(cx, cy, r * 1.02, angle)
          return (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#B08D57"
              strokeOpacity={0.5}
              strokeWidth={1.5}
            />
          )
        })}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size * 0.03} fill={color} />
        <text
          x={cx}
          y={cy - size * 0.06}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={size * 0.19}
          fontWeight={600}
          fill="#F7F3EA"
        >
          {Math.round(clamped * 100)}
        </text>
      </svg>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim">
          {label}
        </span>
      )}
    </div>
  )
}
