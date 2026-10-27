"use client";

import type { Diet } from "@/lib/diet";
import { DietMark } from "./DietMark";

/** All / Veg / Non-veg, for the recipe list and the ingredient library. */
export function DietFilter({ value, onChange }: { value: "" | Diet; onChange: (value: "" | Diet) => void }) {
  const options: ["" | Diet, string][] = [
    ["", "All"],
    ["veg", "Veg"],
    ["nonveg", "Non-veg"],
  ];
  return (
    <div className="seg self-start" role="radiogroup" aria-label="Veg or non-veg">
      {options.map(([key, label]) => (
        <button
          key={key || "all"}
          type="button"
          role="radio"
          aria-checked={value === key}
          className="seg-item inline-flex items-center gap-1.5"
          data-active={value === key}
          onClick={() => onChange(key)}
        >
          {key && <DietMark diet={key} size={12} />}
          {label}
        </button>
      ))}
    </div>
  );
}
