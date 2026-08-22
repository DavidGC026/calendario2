import { cn } from "@/lib/utils"

type DvgMarkProps = {
  className?: string
  decorative?: boolean
}

export function DvgMark({ className, decorative = true }: DvgMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "DVGuzmán"}
    >
      <defs>
        <linearGradient id="dvg-mark-surface" x1="8" y1="5" x2="56" y2="59">
          <stop stopColor="#C7353E" />
          <stop offset="1" stopColor="#790F16" />
        </linearGradient>
      </defs>
      <rect x="4" y="7" width="56" height="53" rx="14" fill="url(#dvg-mark-surface)" />
      <rect x="5" y="8" width="54" height="51" rx="13" fill="none" stroke="#E7C66A" strokeOpacity=".72" />
      <path d="M5 22h54" stroke="#E7C66A" strokeWidth="3" />
      <path d="M19 4v9M45 4v9" stroke="#E7C66A" strokeWidth="5" strokeLinecap="round" />
      <text
        x="32"
        y="45"
        fill="#FFF9E8"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="17"
        fontWeight="800"
        letterSpacing="-1"
        textAnchor="middle"
      >
        DVG
      </text>
    </svg>
  )
}
