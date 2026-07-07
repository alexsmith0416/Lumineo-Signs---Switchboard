// Lumineo Signs ray-mark logo — red square with white rays fanning from the
// bottom-left. Ported verbatim from Sign Builder Pro (`apps/sign-builder`)
// so this sub-app's brand matches the rest of the Lumineo code-app fleet.

export function RayMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden>
      <rect width="88" height="88" fill="#E8151B" rx="6" />
      <line x1="3" y1="85" x2="90" y2="4"  stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="88" y2="20" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="82" y2="36" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="72" y2="52" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="58" y2="66" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="40" y2="76" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="85" x2="20" y2="82" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
