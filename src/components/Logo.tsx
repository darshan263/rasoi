/**
 * The Rasoi mark: a steaming pot on a tomato tile, with a basil-green lid knob. Drawn inline
 * so it follows the theme tokens; `public/icon.svg` is the same drawing with fixed colours.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: "var(--accent)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none">
        <path
          d="M9 3.5c-.8.9-.8 1.9 0 2.8M12 3c-.8.9-.8 1.9 0 2.8M15 3.5c-.8.9-.8 1.9 0 2.8"
          stroke="var(--accent-text)"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <path d="M5 10.5h14v5.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5.5Z" fill="var(--accent-text)" />
        <path d="M3 10.5h18" stroke="var(--accent-text)" strokeWidth={1.8} strokeLinecap="round" />
        <circle cx="12" cy="8.6" r="1.3" fill="var(--warm)" />
      </svg>
    </span>
  );
}
