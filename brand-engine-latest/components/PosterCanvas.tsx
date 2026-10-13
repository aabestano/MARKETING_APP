"use client";

import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { mmToPx, trimPx } from "@/lib/poster-sizes";
import { orientationOf } from "@/lib/poster-prompt";
import type { PosterSection, PosterSize, PosterSpec, PosterStep, PosterTheme } from "@/lib/poster-types";

export interface PosterCanvasProps {
  spec: PosterSpec;
  size: PosterSize;
  fontStack: string;
  logoSrc?: string;
  illustrationSrc?: string;
  illustrationPending?: boolean;
  qrSrc?: string;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return 0;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export const readableOn = (bg: string) => (luminance(bg) > 0.42 ? "#0f172a" : "#ffffff");

const MIN_FIT = 0.4;

export const PosterCanvas = forwardRef<HTMLDivElement, PosterCanvasProps>(function PosterCanvas(
  { spec, size, fontStack, logoSrc, illustrationSrc, illustrationPending, qrSrc },
  ref,
) {
  const { w: trimW, h: trimH } = trimPx(size);
  const bleed = Math.round(mmToPx(size.bleedMm));
  const W = trimW + 2 * bleed;
  const H = trimH + 2 * bleed;
  const u = Math.sqrt(trimW * trimH) / 100;
  const landscape = orientationOf(trimW, trimH) === "landscape";
  const t = spec.theme;

  const bodyRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [fontTick, setFontTick] = useState(0);
  const sigRef = useRef("");

  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => alive && setFontTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [fontStack]);

  const sig = useMemo(
    () => JSON.stringify([spec, W, H, fontStack, !!illustrationSrc, !!illustrationPending, !!logoSrc, !!qrSrc, fontTick]),
    [spec, W, H, fontStack, illustrationSrc, illustrationPending, logoSrc, qrSrc, fontTick],
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (sigRef.current !== sig) {
      sigRef.current = sig;
      if (fit !== 1) {
        setFit(1);
        return;
      }
    }
    if (body.scrollHeight > body.clientHeight + 1 && fit > MIN_FIT) setFit((f) => Math.max(MIN_FIT, f * 0.93));
  }, [sig, fit]);

  const fs = (n: number) => `${(n * u * fit).toFixed(2)}px`;
  const gap = (n: number) => `${(n * u * (0.55 + 0.45 * fit)).toFixed(2)}px`;
  const padX = bleed + 3.2 * u;

  const root: CSSProperties = {
    width: W,
    height: H,
    background: t.background,
    color: t.text,
    fontFamily: fontStack,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
    lineHeight: 1.3,
  };

  const hasLead = !!(logoSrc || spec.header.brandName || spec.header.tagline);
  const showIllustration = !!illustrationSrc || !!illustrationPending;

  const sections = (
    <div style={{ display: "flex", flexDirection: "column", gap: gap(1.9), minWidth: 0, flex: landscape ? 1 : "0 0 auto" }}>
      {spec.sections.map((s, i) => (
        <SectionView key={i} section={s} theme={t} fs={fs} gap={gap} />
      ))}
    </div>
  );

  const illustration = showIllustration ? (
    <div
      style={{
        position: "relative",
        flex: landscape ? "0 0 40%" : "1 1 0",
        minHeight: landscape ? 0 : 11 * u,
        minWidth: 0,
        borderRadius: 1.4 * u,
        overflow: "hidden",
      }}
    >
      {illustrationSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustrationSrc} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `${Math.max(1, u * 0.2)}px dashed ${t.primary}55`,
            borderRadius: 1.4 * u,
            color: t.muted,
            fontSize: fs(1.3),
          }}
        >
          Drawing illustration…
        </div>
      )}
    </div>
  ) : null;

  const cta = spec.cta ? (
    <div style={{ display: "flex", alignItems: "center", gap: gap(2), flex: "0 0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: gap(0.7), minWidth: 0, flex: 1 }}>
        <div
          style={{
            alignSelf: "flex-start",
            background: t.accent,
            color: readableOn(t.accent),
            fontWeight: 800,
            fontSize: fs(2),
            padding: `${(1 * u * fit).toFixed(2)}px ${(2.4 * u * fit).toFixed(2)}px`,
            borderRadius: 1.2 * u,
          }}
        >
          {spec.cta.label}
        </div>
        {spec.cta.url && (
          <div style={{ fontSize: fs(1.35), color: t.muted, wordBreak: "break-all" }}>{spec.cta.url.replace(/^https?:\/\//, "")}</div>
        )}
      </div>
      {spec.cta.showQr && qrSrc && (
        <div style={{ background: "#fff", padding: 0.8 * u, borderRadius: 0.8 * u, flex: "0 0 auto", lineHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="QR code" style={{ width: 8.5 * u * Math.max(fit, 0.7), height: 8.5 * u * Math.max(fit, 0.7) }} />
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={ref} data-poster-root style={root}>
      <div
        style={{
          background: t.primary,
          color: t.onPrimary,
          padding: `${bleed + 2.4 * u}px ${padX}px ${2.6 * u}px`,
          display: "flex",
          flexDirection: "column",
          gap: gap(1.2),
          flex: "0 0 auto",
        }}
      >
        {hasLead && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 * u }}>
            {logoSrc ? (
              <div style={{ background: "#fff", borderRadius: 0.9 * u, padding: `${0.7 * u}px ${1.2 * u}px`, display: "flex", lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt={spec.header.brandName ?? "Logo"} style={{ height: 4.2 * u, width: "auto", maxWidth: 28 * u, objectFit: "contain" }} crossOrigin="anonymous" />
              </div>
            ) : (
              <div style={{ fontWeight: 800, fontSize: fs(2.1), letterSpacing: "0.02em" }}>{spec.header.brandName}</div>
            )}
            {spec.header.tagline && <div style={{ fontSize: fs(1.3), opacity: 0.9, textAlign: "right" }}>{spec.header.tagline}</div>}
          </div>
        )}
        <h1 style={{ margin: 0, fontWeight: 800, fontSize: fs(4.6), lineHeight: 1.06, letterSpacing: "-0.01em" }}>{spec.headline}</h1>
        {spec.subheading && <p style={{ margin: 0, fontSize: fs(1.9), lineHeight: 1.28, opacity: 0.94 }}>{spec.subheading}</p>}
      </div>

      <div
        ref={bodyRef}
        style={{
          flex: "1 1 0",
          minHeight: 0,
          overflow: "hidden",
          padding: `${2.4 * u}px ${padX}px ${1.2 * u}px`,
          display: "flex",
          flexDirection: landscape ? "row" : "column",
          gap: gap(2.2),
          justifyContent: showIllustration || landscape ? undefined : "space-between",
        }}
      >
        {landscape ? (
          <>
            {illustration}
            <div style={{ display: "flex", flexDirection: "column", gap: gap(2), flex: 1, minWidth: 0, justifyContent: "space-between" }}>
              {sections}
              {cta}
            </div>
          </>
        ) : (
          <>
            {illustration}
            {sections}
            {cta}
          </>
        )}
      </div>

      {(spec.footer?.text || spec.footer?.disclaimer) && (
        <div
          style={{
            flex: "0 0 auto",
            padding: `${1.2 * u}px ${padX}px ${bleed + 1.8 * u}px`,
            borderTop: `${Math.max(1, u * 0.12)}px solid ${t.muted}33`,
            display: "flex",
            flexDirection: "column",
            gap: gap(0.5),
          }}
        >
          {spec.footer?.text && <div style={{ fontSize: fs(1.3), fontWeight: 600, whiteSpace: "pre-line" }}>{spec.footer.text}</div>}
          {spec.footer?.disclaimer && <div style={{ fontSize: fs(0.98), color: t.muted, lineHeight: 1.35, whiteSpace: "pre-line" }}>{spec.footer.disclaimer}</div>}
        </div>
      )}
      {!(spec.footer?.text || spec.footer?.disclaimer) && <div style={{ flex: "0 0 auto", height: bleed + 1.8 * u }} />}
    </div>
  );
});

type Fs = (n: number) => string;

function SectionTitle({ children, fs, color }: { children: ReactNode; fs: Fs; color: string }) {
  return <div style={{ fontWeight: 800, fontSize: fs(1.9), color, letterSpacing: "-0.005em" }}>{children}</div>;
}

function SectionView({ section, theme, fs, gap }: { section: PosterSection; theme: PosterTheme; fs: Fs; gap: Fs }) {
  const title = section.title ? <SectionTitle fs={fs} color={theme.primary}>{section.title}</SectionTitle> : null;

  if (section.type === "steps") {
    const flow = section.style === "flowchart";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: gap(1.1) }}>
        {title}
        {flow ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
            {section.items.map((step, i) => (
              <FlowStep key={i} step={step} index={i} last={i === section.items.length - 1} theme={theme} fs={fs} gap={gap} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gridAutoFlow: "row", gap: gap(1) }}>
            {section.items.map((step, i) => (
              <div
                key={i}
                style={{ background: theme.surface, borderRadius: fsNum(fs, 1.1), padding: gap(1.2), display: "flex", gap: gap(1.1), alignItems: "flex-start", gridColumn: "1 / -1" }}
              >
                <NumberBadge n={i + 1} theme={theme} fs={fs} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: fs(1.6) }}>{step.label}</div>
                  {step.detail && <div style={{ fontSize: fs(1.28), color: theme.muted, marginTop: 2 }}>{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section.type === "bullets") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: gap(1) }}>
        {title}
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: gap(0.8) }}>
          {section.items.map((item, i) => (
            <li key={i} style={{ display: "flex", gap: gap(1), alignItems: "flex-start", fontSize: fs(1.55) }}>
              <span style={{ flex: "0 0 auto", width: fs(0.9), height: fs(0.9), marginTop: fs(0.45), borderRadius: "50%", background: theme.accent }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.type === "callout") {
    return (
      <div style={{ background: theme.surface, borderLeft: `${fs(0.6)} solid ${theme.accent}`, borderRadius: fsNum(fs, 1), padding: gap(1.5) }}>
        {section.title && <div style={{ fontWeight: 800, fontSize: fs(1.55), color: theme.primary, marginBottom: 3 }}>{section.title}</div>}
        <div style={{ fontSize: fs(1.5), whiteSpace: "pre-line" }}>{section.body}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: gap(1) }}>
      {title}
      <div style={{ display: "flex", gap: gap(1.2), flexWrap: "wrap" }}>
        {section.items.map((it, i) => (
          <div key={i} style={{ flex: "1 1 0", minWidth: fs(9), background: theme.surface, borderRadius: fsNum(fs, 1), padding: gap(1.3), textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: fs(3.4), color: theme.primary, lineHeight: 1.05 }}>{it.value}</div>
            <div style={{ fontSize: fs(1.25), color: theme.muted, marginTop: 3 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const fsNum = (fs: Fs, n: number) => parseFloat(fs(n));

function NumberBadge({ n, theme, fs }: { n: number; theme: PosterTheme; fs: Fs }) {
  return (
    <div
      style={{
        flex: "0 0 auto",
        width: fs(3),
        height: fs(3),
        borderRadius: "50%",
        background: theme.primary,
        color: theme.onPrimary,
        fontWeight: 800,
        fontSize: fs(1.5),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n}
    </div>
  );
}

function FlowStep({ step, index, last, theme, fs, gap }: { step: PosterStep; index: number; last: boolean; theme: PosterTheme; fs: Fs; gap: Fs }) {
  const decision = !!step.decision;
  return (
    <>
      <div
        style={{
          background: theme.surface,
          border: `${fs(0.22)} ${decision ? "dashed" : "solid"} ${decision ? theme.accent : theme.primary}`,
          borderRadius: fsNum(fs, 1.3),
          padding: gap(1.15),
          display: "flex",
          gap: gap(1.1),
          alignItems: "center",
        }}
      >
        <NumberBadge n={index + 1} theme={theme} fs={fs} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: fs(1.6) }}>
            {step.label}
            {decision && <span style={{ color: theme.accent }}> ?</span>}
          </div>
          {step.detail && <div style={{ fontSize: fs(1.25), color: theme.muted, marginTop: 2 }}>{step.detail}</div>}
          {decision && (
            <div style={{ display: "flex", gap: gap(0.8), flexWrap: "wrap", marginTop: gap(0.7) }}>
              {step.decision?.yes && <Branch label="Yes" text={step.decision.yes} color={theme.primary} fs={fs} gap={gap} />}
              {step.decision?.no && <Branch label="No" text={step.decision.no} color={theme.accent} fs={fs} gap={gap} />}
            </div>
          )}
        </div>
      </div>
      {!last && <Arrow color={theme.primary} fs={fs} />}
    </>
  );
}

function Branch({ label, text, color, fs, gap }: { label: string; text: string; color: string; fs: Fs; gap: Fs }) {
  return (
    <span style={{ fontSize: fs(1.15), border: `${fs(0.15)} solid ${color}`, color: readableOn("#ffffff"), borderRadius: 999, padding: `${fs(0.2)} ${gap(0.9)}` }}>
      <b style={{ color }}>{label}:</b> {text}
    </span>
  );
}

function Arrow({ color, fs }: { color: string; fs: Fs }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: fs(2.2) }} aria-hidden>
      <div style={{ flex: 1, width: fs(0.22), background: color }} />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${fs(0.7)} solid transparent`,
          borderRight: `${fs(0.7)} solid transparent`,
          borderTop: `${fs(0.9)} solid ${color}`,
        }}
      />
    </div>
  );
}
