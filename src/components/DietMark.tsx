import { DIET_LABELS, type Diet } from "@/lib/diet";

/**
 * The Indian food-packet mark: a green square with a dot for veg, a brown square with a
 * triangle for non-veg. `label` adds the word beside it.
 */
export function DietMark({ diet, size = 14, label = false }: { diet: Diet; size?: number; label?: boolean }) {
  const color = diet === "veg" ? "var(--veg)" : "var(--nonveg)";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" title={DIET_LABELS[diet]}>
      <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={DIET_LABELS[diet]}>
        <rect x="1" y="1" width="14" height="14" rx="2" fill="var(--bg-elevated)" stroke={color} strokeWidth="1.6" />
        {diet === "veg" ? <circle cx="8" cy="8" r="3.6" fill={color} /> : <path d="M8 3.8 12.2 11.6H3.8Z" fill={color} />}
      </svg>
      {label && (
        <span className="text-xs font-semibold" style={{ color }}>
          {DIET_LABELS[diet]}
        </span>
      )}
    </span>
  );
}
