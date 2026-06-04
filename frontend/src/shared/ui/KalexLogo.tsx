/**
 * Kalex brand lockup: the "Kalex" wordmark with a small caption spelling out the
 * initials — K (Kim & Chang), A (AI), L (Legal), E (Explorer). The final
 * X (Transformation·전환) lives in the name itself ("KaleX"), so the caption stays
 * short. Monochrome (ink) to fit the minimal tone.
 */
export function KalexLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-col leading-none ${className}`}>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Kalex</span>
      <span className="mt-1.5 text-[10px] tracking-wide text-ink-3 whitespace-nowrap">
        K&amp;C AI Legal Explorer
      </span>
    </span>
  );
}
