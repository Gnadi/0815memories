export default function FamilyIllustration() {
  return (
    <svg viewBox="0 0 500 400" className="w-full" role="img" aria-label="Family gathering illustration">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4A460" />
          <stop offset="60%" stopColor="#DEB887" />
          <stop offset="100%" stopColor="#D2B48C" />
        </linearGradient>
        <linearGradient id="tableGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5E3C" />
          <stop offset="100%" stopColor="#6B3F1F" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="500" height="400" fill="url(#skyGrad)" />

      {/* Window glow */}
      <rect x="150" y="30" width="200" height="150" rx="8" fill="#FFD700" opacity="0.3" />
      <rect x="160" y="40" width="80" height="60" rx="4" fill="#FFA500" opacity="0.4" />
      <rect x="260" y="40" width="80" height="60" rx="4" fill="#FFA500" opacity="0.4" />

      {/* Bookshelf left */}
      <rect x="10" y="40" width="80" height="200" rx="4" fill="#6B3F1F" opacity="0.4" />
      <rect x="18" y="55" width="64" height="12" rx="2" fill="#8B5E3C" opacity="0.5" />
      <rect x="18" y="75" width="64" height="12" rx="2" fill="#A0522D" opacity="0.5" />
      <rect x="18" y="95" width="64" height="12" rx="2" fill="#8B5E3C" opacity="0.5" />
      <rect x="18" y="115" width="64" height="12" rx="2" fill="#CD853F" opacity="0.4" />

      {/* Table */}
      <ellipse cx="250" cy="310" rx="210" ry="35" fill="url(#tableGrad)" />

      {/* Plates */}
      <ellipse cx="150" cy="300" rx="22" ry="7" fill="#FFFDF9" opacity="0.8" />
      <ellipse cx="250" cy="295" rx="22" ry="7" fill="#FFFDF9" opacity="0.8" />
      <ellipse cx="350" cy="300" rx="22" ry="7" fill="#FFFDF9" opacity="0.8" />

      {/* Person 1 - left */}
      <circle cx="120" cy="210" r="22" fill="#D2691E" />
      <ellipse cx="120" cy="260" rx="25" ry="35" fill="#CD853F" />

      {/* Person 2 - left center */}
      <circle cx="200" cy="200" r="24" fill="#8B4513" />
      <ellipse cx="200" cy="252" rx="27" ry="38" fill="#A0522D" />

      {/* Person 3 - center (child) */}
      <circle cx="250" cy="225" r="18" fill="#DEB887" />
      <ellipse cx="250" cy="265" rx="18" ry="28" fill="#D2B48C" />

      {/* Person 4 - right center */}
      <circle cx="300" cy="200" r="24" fill="#CD853F" />
      <ellipse cx="300" cy="252" rx="27" ry="38" fill="#8B4513" />

      {/* Person 5 - right */}
      <circle cx="380" cy="210" r="22" fill="#A0522D" />
      <ellipse cx="380" cy="260" rx="25" ry="35" fill="#D2691E" />

      {/* String lights */}
      <path d="M50,120 Q150,90 250,120 Q350,90 450,120" fill="none" stroke="#FFD700" strokeWidth="2" />
      <circle cx="100" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="150" cy="105" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="200" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="250" cy="118" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="300" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="350" cy="105" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="400" cy="112" r="5" fill="#FFD700" opacity="0.8" />

      {/* Warm glow overlay */}
      <rect width="500" height="400" fill="#FFA500" opacity="0.08" />
    </svg>
  )
}
