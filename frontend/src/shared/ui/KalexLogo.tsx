/**
 * Kalex brand mark.
 *
 * A geometric "K" monogram whose upper arm turns into a forward/upward arrow —
 * signalling Explorer (탐색) and Transformation (전환·혁신), the leap of AI.
 * Monochrome (ink) to fit the minimal tone. The K&C / Legal meaning lives in
 * the name + product context rather than literal iconography.
 */
function KalexMark({ className = "w-[22px] h-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* spine */}
        <path d="M6 4v16" />
        {/* lower leg */}
        <path d="M6.5 12 15.5 20.5" />
        {/* upper arm rising into a forward arrow */}
        <path d="M6.5 12 16.5 4.5" />
        <path d="M11.5 4.5 16.5 4.5 16.5 9.5" />
      </g>
    </svg>
  );
}

export function KalexLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-ink ${className}`}>
      <KalexMark />
      <span className="text-[15px] font-semibold tracking-tight">Kalex</span>
    </span>
  );
}
