// The village at the foot of the board: snowy hills, firs, houses with their
// windows lit, and a church. Drawn here rather than shipped as an image, so it
// costs no request and stays sharp at any width; it is wider than most
// boards and is cut at the sides rather than squeezed.
const HOUSES = [
  { x: 40, w: 26, h: 14, roof: 11 },
  { x: 96, w: 20, h: 11, roof: 9 },
  { x: 236, w: 28, h: 15, roof: 12 },
  { x: 318, w: 22, h: 12, roof: 10 },
  { x: 446, w: 26, h: 14, roof: 11 },
  { x: 540, w: 20, h: 11, roof: 9 },
]
const FIRS = [14, 22, 82, 136, 152, 210, 284, 300, 372, 420, 492, 512, 580, 596]
const GROUND = 52

function House({ x, w, h, roof }) {
  const top = GROUND - h
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill="#0f1a2c" />
      <polygon points={`${x - 3},${top + 1} ${x + w / 2},${top - roof} ${x + w + 3},${top + 1}`} fill="#13213a" />
      <polyline points={`${x - 3},${top + 1} ${x + w / 2},${top - roof} ${x + w + 3},${top + 1}`} fill="none" stroke="#eef3fb" strokeWidth="2" strokeLinejoin="round" />
      <rect x={x + 4} y={top + 4} width="5" height="5" fill="#ffd36b" />
      <rect x={x + w - 9} y={top + 4} width="5" height="5" fill="#ffcf5c" opacity="0.8" />
    </g>
  )
}

function Fir({ x }) {
  return (
    <g>
      <polygon points={`${x - 6},${GROUND} ${x},${GROUND - 20} ${x + 6},${GROUND}`} fill="#163a2b" />
      <polygon points={`${x - 4},${GROUND - 8} ${x},${GROUND - 20} ${x + 4},${GROUND - 8}`} fill="#eef3fb" opacity="0.55" />
    </g>
  )
}

export default function AdventScene({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 620 64" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path d="M0 40 Q80 24 170 36 T340 32 T520 30 T620 38 V64 H0Z" fill="#1d3150" opacity="0.8" />
      {FIRS.map((x) => <Fir key={x} x={x} />)}
      {HOUSES.map((house) => <House key={house.x} {...house} />)}
      <g>
        <rect x="176" y="30" width="22" height="22" fill="#0f1a2c" />
        <rect x="182" y="14" width="10" height="17" fill="#0f1a2c" />
        <polygon points="180,15 187,0 194,15" fill="#13213a" />
        <polyline points="180,15 187,0 194,15" fill="none" stroke="#eef3fb" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M184 22 a3 3 0 0 1 6 0 V27 H184Z" fill="#ffd36b" />
        <path d="M182 40 a5 5 0 0 1 10 0 V52 H182Z" fill="#ffcf5c" opacity="0.85" />
      </g>
      <path d="M0 54 Q90 46 190 52 T400 50 T620 52 V64 H0Z" fill="#eef3fb" />
    </svg>
  )
}
