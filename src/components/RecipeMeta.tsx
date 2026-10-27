import { IconClock, IconUsers } from "./Icons";

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Time and servings, as small muted facts. Renders nothing when none are known. */
export function RecipeMeta({
  prepMinutes,
  cookMinutes,
  servings,
  className = "",
}: {
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  className?: string;
}) {
  const total = (prepMinutes ?? 0) + (cookMinutes ?? 0);
  if (!total && !servings) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`} style={{ color: "var(--text-muted)" }}>
      {total > 0 && (
        <span className="inline-flex items-center gap-1">
          <IconClock size={14} />
          {formatMinutes(total)}
        </span>
      )}
      {servings ? (
        <span className="inline-flex items-center gap-1">
          <IconUsers size={14} />
          Serves {servings}
        </span>
      ) : null}
    </span>
  );
}
