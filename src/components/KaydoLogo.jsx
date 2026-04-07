/**
 * Kaydo logo mark — K + a letterforms forming a house silhouette.
 * Kaya (Swahili: home) + Dom (Slavic: home)
 */
export default function KaydoLogo({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left roof slope — terracotta */}
      <line x1="50" y1="6" x2="6" y2="38" stroke="#C25A2E" strokeWidth="7.5" strokeLinecap="round" />
      {/* K vertical bar / left wall — terracotta */}
      <line x1="6" y1="38" x2="6" y2="92" stroke="#C25A2E" strokeWidth="7.5" strokeLinecap="round" />
      {/* K upper arm — terracotta */}
      <line x1="6" y1="63" x2="36" y2="38" stroke="#C25A2E" strokeWidth="6.5" strokeLinecap="round" />
      {/* K lower leg — terracotta */}
      <line x1="6" y1="63" x2="43" y2="92" stroke="#C25A2E" strokeWidth="6.5" strokeLinecap="round" />
      {/* 'a' arch — sage green */}
      <path
        d="M 34 92 L 34 57 Q 34 10 60 10 Q 91 10 91 56 L 91 92"
        stroke="#8B9E7E"
        strokeWidth="6.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Counter dot — cream */}
      <circle cx="60" cy="36" r="6.5" fill="#F5E6C8" />
    </svg>
  )
}
