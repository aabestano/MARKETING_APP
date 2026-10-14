"use client";

import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FINE_PRINT_SCALE, HERO_RATIO, MIN_FIT, isBlockHidden, isSectionKey, layoutOf, sectionIndex, type HeroSize, type PosterBlockKey } from "@/lib/poster-blocks";
import { mmToPx, trimPx } from "@/lib/poster-sizes";
import type { PosterSection, PosterSize, PosterSpec, PosterStep, PosterTheme } from "@/lib/poster-types";
import { posterLayerName } from "@/lib/poster-svg";
import { TipIcon } from "./TipIcon";

export interface PosterCanvasProps {
  spec: PosterSpec;
  size: PosterSize;
  fontStack: string;
  logoSrc?: string;
  secondLogoSrc?: string;
  illustrationSrc?: string;
  illustrationPending?: boolean;
  qrSrc?: string;
  heroSize?: HeroSize;
  onOverflow?: (overflowing: boolean) => void;
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

export const PosterCanvas = forwardRef<HTMLDivElement, PosterCanvasProps>(function PosterCanvas(
  { spec, size, fontStack, logoSrc, secondLogoSrc, illustrationSrc, illustrationPending, qrSrc, heroSize = "m", onOverflow },
  ref,
) {
  const { w: trimW, h: trimH } = trimPx(size);
  const bleed = Math.round(mmToPx(size.bleedMm));
  const W = trimW + 2 * bleed;
  const H = trimH + 2 * bleed;
  const u = Math.sqrt(trimW * trimH) / 100;
  const t = spec.theme;
  const heroPx = Math.round(trimH * HERO_RATIO[heroSize]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;
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
    () => JSON.stringify([spec, W, H, heroPx, fontStack, !!illustrationSrc, !!illustrationPending, !!logoSrc, !!secondLogoSrc, !!qrSrc, fontTick]),
    [spec, W, H, heroPx, fontStack, illustrationSrc, illustrationPending, logoSrc, secondLogoSrc, qrSrc, fontTick],
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
    const overflowing = body.scrollHeight > body.clientHeight + 1;
    if (overflowing && fit > MIN_FIT) setFit((f) => Math.max(MIN_FIT, f * 0.93));
    onOverflowRef.current?.(fit <= MIN_FIT + 0.001 && overflowing);
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

  const layout = layoutOf(spec);
  const fine = (n: number) => n * FINE_PRINT_SCALE;

  const visible = (key: PosterBlockKey) => {
    if (isBlockHidden(spec, key)) return false;
    if (key === "brand") return !!(logoSrc || secondLogoSrc || spec.header.brandName || spec.header.tagline || spec.header.pill);
    if (key === "headline") return !!spec.headline.trim();
    if (key === "subheading") return !!spec.subheading?.trim();
    if (key === "illustration") return !!illustrationSrc || !!illustrationPending;
    if (key === "cta") return !!spec.cta;
    if (key === "footer") return !!(spec.footer?.text || spec.footer?.disclaimer);
    if (!isSectionKey(key)) return false;
    return !!spec.sections[sectionIndex(key)];
  };

  const shell = (key: string, isFirst: boolean, isLast: boolean, node: ReactNode, extra?: CSSProperties): ReactNode => (
    <div
      key={key}
      data-poster-block={key}
      data-layer={posterLayerName(spec, key)}
      style={{
        flex: "0 0 auto",
        minWidth: 0,
        padding: `${isFirst ? bleed + 1.4 * u : 0}px ${padX}px ${isLast ? bleed + 1.6 * u : 0}px`,
        ...extra,
      }}
    >
      {node}
    </div>
  );

  const bannerCopy = (key: PosterBlockKey): { primary?: string; secondary?: string } | null => {
    if (key === "brand") {
      if (!spec.header.brandName && !spec.header.tagline) return null;
      return { primary: spec.header.brandName, secondary: spec.header.tagline };
    }
    if (key === "headline") return spec.headline.trim() ? { primary: spec.headline } : null;
    if (key === "subheading") return spec.subheading?.trim() ? { primary: spec.subheading } : null;
    if (!isSectionKey(key)) return null;
    const section = spec.sections[sectionIndex(key)];
    if (!section || section.type !== "callout") return null;
    if (!section.title && !section.body.trim()) return null;
    return { primary: section.title, secondary: section.body };
  };

  const slotStyle = (slot: number): CSSProperties => {
    if (slot === 0) return { fontWeight: 800, fontSize: fs(2.1), letterSpacing: "0.02em", lineHeight: 1.2 };
    if (slot === 1) return { fontWeight: 800, fontSize: fs(4.6), lineHeight: 1.06, letterSpacing: "-0.01em" };
    if (slot === 2) return { fontWeight: 500, fontSize: fs(1.9), lineHeight: 1.28 };
    return { fontWeight: 400, fontSize: fs(fine(1.35)), lineHeight: 1.3, opacity: 0.94 };
  };

  const logoPlate = (src: string, alt: string) => (
    <div style={{ background: "#fff", borderRadius: 0.9 * u, padding: `${0.55 * u}px ${1 * u}px`, display: "flex", lineHeight: 0, flex: "0 0 auto" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ height: 4.2 * u, width: "auto", maxWidth: secondLogoSrc ? 18 * u : 28 * u, objectFit: "contain" }} crossOrigin="anonymous" />
    </div>
  );

  const brandLockup = (inBanner: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 * u }}>
      <div style={{ display: "flex", alignItems: "center", gap: gap(1.1), minWidth: 0, flexWrap: "wrap" }}>
        {(logoSrc || secondLogoSrc) && (
          <div style={{ display: "flex", alignItems: "center", gap: gap(0.7), flex: "0 0 auto" }}>
            {logoSrc && logoPlate(logoSrc, spec.header.brandName ?? "Logo")}
            {secondLogoSrc && logoPlate(secondLogoSrc, "Second logo")}
          </div>
        )}
        {spec.header.brandName && <div style={{ fontWeight: 800, fontSize: fs(2.1), letterSpacing: "0.02em" }}>{spec.header.brandName}</div>}
        {spec.header.pill && (
          <span
            data-poster-pill
            style={{
              display: "inline-block",
              background: inBanner ? t.onPrimary : t.primary,
              color: inBanner ? t.primary : t.onPrimary,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: fs(fine(1.15)),
              lineHeight: 1.2,
              padding: `${0.28 * u}px ${1.05 * u}px`,
            }}
          >
            {spec.header.pill}
          </span>
        )}
      </div>
      {spec.header.tagline && (
        <div style={{ fontSize: fs(fine(1.3)), opacity: inBanner ? 0.9 : 1, color: inBanner ? undefined : t.muted, textAlign: "right" }}>{spec.header.tagline}</div>
      )}
    </div>
  );

  const bannerSlot = (key: PosterBlockKey, slot: number): ReactNode => {
    if (isBlockHidden(spec, key)) return null;
    if (key === "brand" && (logoSrc || secondLogoSrc || spec.header.brandName || spec.header.tagline || spec.header.pill)) {
      return (
        <div key={`${key}-${slot}`} data-poster-block={key} data-layer={posterLayerName(spec, key)}>
          {brandLockup(true)}
        </div>
      );
    }
    const copy = bannerCopy(key);
    if (!copy) return null;
    return (
      <div key={`${key}-${slot}`} data-poster-block={key} data-layer={posterLayerName(spec, key)} style={slotStyle(slot)}>
        {copy.primary && <div style={{ whiteSpace: "pre-line", textWrap: key === "headline" ? "balance" : undefined }}>{copy.primary}</div>}
        {copy.secondary && (
          <div style={{ whiteSpace: "pre-line", marginTop: copy.primary ? gap(0.35) : 0, fontWeight: 400, fontSize: slot === 0 ? fs(fine(1.3)) : undefined, opacity: 0.94 }}>
            {copy.secondary}
          </div>
        )}
      </div>
    );
  };

  const outside = (key: PosterBlockKey, isFirst: boolean, isLast: boolean): ReactNode => {
    if (key === "brand") {
      return shell(key, isFirst, isLast, brandLockup(false));
    }
    if (key === "headline") {
      return shell(
        key,
        isFirst,
        isLast,
        <h1 style={{ margin: 0, fontWeight: 800, fontSize: fs(4.6), lineHeight: 1.06, letterSpacing: "-0.01em", color: t.text, textWrap: "balance" }}>{spec.headline}</h1>,
      );
    }
    if (key === "subheading") {
      return shell(key, isFirst, isLast, <p style={{ margin: 0, fontSize: fs(1.9), lineHeight: 1.28, color: t.text }}>{spec.subheading}</p>);
    }
    if (key === "illustration") {
      return shell(
        key,
        isFirst,
        isLast,
        <div style={{ position: "relative", height: heroPx, borderRadius: 1.4 * u, overflow: "hidden" }}>
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
        </div>,
      );
    }
    if (key === "cta" && spec.cta) {
      return shell(
        key,
        isFirst,
        isLast,
        <div style={{ display: "flex", alignItems: "center", gap: gap(2) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: gap(0.7), minWidth: 0, flex: 1 }}>
            <div
              data-poster-block="button"
              data-layer="Button"
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
              <div data-qr-destination style={{ fontSize: fs(fine(1.35)), color: t.muted, wordBreak: "break-all" }}>
                {spec.cta.url.replace(/^https?:\/\//, "")}
              </div>
            )}
          </div>
          {spec.cta.showQr && qrSrc && (
            <div data-poster-block="qr" data-layer="QR code" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: gap(0.45), flex: "0 0 auto", maxWidth: 16 * u }}>
              <div style={{ background: "#fff", padding: 0.8 * u, borderRadius: 0.8 * u, lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR code" style={{ width: 8.5 * u * Math.max(fit, 0.7), height: 8.5 * u * Math.max(fit, 0.7) }} />
              </div>
              {spec.cta.qrCaption && (
                <div data-qr-caption style={{ fontSize: fs(fine(1.15)), color: t.muted, textAlign: "center", lineHeight: 1.25 }}>
                  {spec.cta.qrCaption}
                </div>
              )}
            </div>
          )}
        </div>,
      );
    }
    if (key === "footer") {
      return shell(
        key,
        isFirst,
        isLast,
        <div style={{ display: "flex", flexDirection: "column", gap: gap(0.5), paddingTop: gap(0.7) }}>
          {spec.footer?.text && <div style={{ fontSize: fs(fine(1.3)), fontWeight: 600, whiteSpace: "pre-line" }}>{spec.footer.text}</div>}
          {spec.footer?.disclaimer && <div style={{ fontSize: fs(fine(0.98)), color: t.muted, lineHeight: 1.35, whiteSpace: "pre-line" }}>{spec.footer.disclaimer}</div>}
        </div>,
        { borderTop: `${Math.max(1, u * 0.12)}px solid ${t.muted}33` },
      );
    }
    if (isSectionKey(key)) {
      const section = spec.sections[sectionIndex(key)];
      if (!section) return null;
      return shell(key, isFirst, isLast, <SectionView section={section} theme={t} fs={fs} gap={gap} />);
    }
    return null;
  };

  const flow = layout.order.filter((item) => (item === "banner" ? layout.banner.some((key) => !isBlockHidden(spec, key)) : visible(item)));

  return (
    <div ref={ref} data-poster-root style={root}>
      <div
        ref={bodyRef}
        style={{
          flex: "1 1 0",
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: gap(1.8),
        }}
      >
        {flow.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === flow.length - 1;
          if (item !== "banner") return outside(item, isFirst, isLast);
          return (
            <div
              key="banner"
              data-poster-block="banner"
              data-layer={posterLayerName(spec, "banner")}
              style={{
                flex: "0 0 auto",
                minHeight: 6 * u,
                background: t.primary,
                color: t.onPrimary,
                padding: `${isFirst ? bleed + 2.4 * u : 2.2 * u}px ${padX}px ${isLast ? bleed + 2.2 * u : 2.4 * u}px`,
                display: "flex",
                flexDirection: "column",
                gap: gap(1.1),
              }}
            >
              {layout.banner.map((key, slot) => bannerSlot(key, slot))}
            </div>
          );
        })}
      </div>
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

  if (section.type === "tips") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: gap(1) }}>
        {title}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: gap(1) }}>
          {section.items.map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: gap(0.8), alignItems: "flex-start", background: theme.surface, borderRadius: fsNum(fs, 1), padding: gap(1), minWidth: 0 }}>
              {tip.icon !== "none" && (
                <span data-tip-icon={tip.icon} style={{ color: theme.primary, flex: "0 0 auto", width: fs(2.2), height: fs(2.2) }}>
                  <TipIcon name={tip.icon} />
                </span>
              )}
              <span style={{ fontSize: fs(1.45), lineHeight: 1.35, minWidth: 0, overflowWrap: "anywhere" }}>{tip.text}</span>
            </div>
          ))}
        </div>
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
    <span style={{ fontSize: fs(1.15 * FINE_PRINT_SCALE), border: `${fs(0.15)} solid ${color}`, color: readableOn("#ffffff"), borderRadius: 999, padding: `${fs(0.2)} ${gap(0.9)}` }}>
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
