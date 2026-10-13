import type { TipIcon } from "@/lib/poster-types";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Inline vector icons so PNG, PDF, and Vector PDF capture the same shapes as the preview. */
export function TipIcon({ name }: { name: TipIcon }) {
  if (name === "none") return null;
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      {name === "lightbulb" && (
        <>
          <path {...stroke} d="M9 18h6" />
          <path {...stroke} d="M10 22h4" />
          <path {...stroke} d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
        </>
      )}
      {name === "drop" && <path {...stroke} d="M12 2.7s6.5 6.6 6.5 10.6a6.5 6.5 0 0 1-13 0C5.5 9.3 12 2.7 12 2.7z" />}
      {name === "sun" && (
        <>
          <circle {...stroke} cx="12" cy="12" r="4" />
          <path {...stroke} d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </>
      )}
      {name === "heart-pulse" && (
        <>
          <path {...stroke} d="M19.2 13.6 12 20.2l-7.2-6.6a5 5 0 0 1 7.2-6.9 5 5 0 0 1 7.2 6.9z" />
          <path {...stroke} d="M3 12.2h4.2l1.6-2.4 2.2 4.4 1.8-2.8h8.2" />
        </>
      )}
      {name === "pill" && (
        <>
          <path {...stroke} d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
          <path {...stroke} d="m8.5 8.5 7 7" />
        </>
      )}
    </svg>
  );
}
