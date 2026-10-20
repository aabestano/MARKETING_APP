"use client";

import { ArrowDown, ArrowUp, BookOpen, Boxes, CalendarDays, Library, Mail, Moon, Settings2, Sparkles, Sun, Zap } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { modelLabel, type SectionId } from "@/lib/types";
import { displayAppName } from "@/lib/app-name";
import { moveSection, orderedSectionIds, orderedSections, orderedTabs, sectionOf } from "@/lib/nav";
import { uiCopy } from "@/lib/ui-copy";
import type { ServerStatus } from "./AppShell";

const SECTION_ICONS: Record<SectionId, typeof Boxes> = { plan: CalendarDays, create: Sparkles, library: Library };

export function Sidebar({
  status,
  guideOpen,
  onOpenGuide,
  onCloseGuide,
  onOpenSettings,
}: {
  status: ServerStatus | null;
  guideOpen: boolean;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onOpenSettings: () => void;
}) {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);
  const settings = useStore((s) => s.settings);
  const upcoming = useStore((s) => s.pipeline.filter((i) => i.status === "Scheduled").length);
  const bookCount = useStore((s) => s.brandBooks.length);
  const activeSection = sectionOf(activeTab).id;
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const appName = displayAppName(settings.displayName);
  const sections = orderedSections(settings.sectionOrder);
  const shiftSection = (id: SectionId, dir: -1 | 1) => {
    const ids = orderedSectionIds(settings.sectionOrder);
    const next = moveSection(ids, id, dir);
    if (next === ids) return;
    useStore.getState().updateSettings({ sectionOrder: next });
  };
  const geminiReady = !!settings.geminiApiKey || !!status?.gemini;
  const mailerReady = !!settings.mailerApiKey || !!status?.mailers[settings.mailerProvider];
  const model = settings.geminiModel || status?.geminiModel || "gemini-2.5-flash";

  return (
    <aside className="sidebar-scope flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-700 to-emerald-800">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-slate-100" title={appName}>{appName}</div>
          <div className="text-[11px] text-slate-500">
            <span className="text-emerald-400">·</span> Ideas to designs
          </div>
        </div>
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={theme === "light"}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 transition hover:bg-slate-900 hover:text-white"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-visible" aria-label="Primary">
        {sections.map((section, i) => {
          const Icon = SECTION_ICONS[section.id];
          const active = !guideOpen && activeSection === section.id;
          const count = section.id === "plan" ? upcoming : section.id === "library" ? bookCount : null;
          const label = uiCopy(section.labelKey, settings.copyOverrides);
          const hint = uiCopy(section.hintKey, settings.copyOverrides);
          return (
            <div
              key={section.id}
              className={clsx(
                "group flex min-w-fit items-center gap-1 rounded-md border px-2 py-1.5 transition",
                active
                  ? "border-blue-500/40 bg-blue-500/10 text-white"
                  : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200",
              )}
            >
              <button
                onClick={() => {
                  onCloseGuide();
                  if (activeSection === section.id) return;
                  const first = orderedTabs(section.id, settings.tabOrder)[0];
                  if (first) setTab(first.id);
                }}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left"
              >
                <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                    {label}
                  </span>
                  <span className="hidden text-[11px] text-slate-500 md:block">{hint}</span>
                </span>
                {count !== null && count > 0 && (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-1.5 text-[11px] text-slate-300">{count}</span>
                )}
              </button>
              {active && (
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={`${uiCopy("nav.moveUp", settings.copyOverrides)} ${label}`}
                    title={uiCopy("nav.moveUp", settings.copyOverrides)}
                    disabled={i === 0}
                    onClick={() => shiftSection(section.id, -1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${uiCopy("nav.moveDown", settings.copyOverrides)} ${label}`}
                    title={uiCopy("nav.moveDown", settings.copyOverrides)}
                    disabled={i === sections.length - 1}
                    onClick={() => shiftSection(section.id, 1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={onOpenGuide}
          aria-pressed={guideOpen}
          className={clsx(
            "w-full rounded-md border p-3 text-left transition",
            guideOpen ? "border-blue-500/40 bg-blue-500/10 text-white" : "border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800/70",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className={clsx("h-4 w-4", guideOpen ? "text-blue-400" : "text-slate-400")} /> How to Use IDEAte
          </div>
          <p className="mt-1 text-[11px] text-slate-500">First-time setup and the three sections.</p>
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full rounded-md border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-slate-700 hover:bg-slate-800/70"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Settings2 className="h-4 w-4 text-slate-400" /> {uiCopy("settings.api", settings.copyOverrides)}
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-500">
                <Zap className="h-3 w-3" /> Gemini
              </dt>
              <dd className="flex min-w-0 items-center gap-1.5 text-slate-300">
                <span className="truncate">{modelLabel(model)}</span>
                <span
                  title={geminiReady ? "API key configured" : "No API key — offline template mode"}
                  className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", geminiReady ? "bg-emerald-400" : "bg-amber-400")}
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-500">
                <Mail className="h-3 w-3" /> Mailer
              </dt>
              <dd className="flex items-center gap-1.5 text-slate-300">
                <span className="capitalize">{settings.mailerProvider}</span>
                <span className={clsx("rounded px-1 text-[10px] font-medium", mailerReady ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
                  {mailerReady ? "Ready" : "Not set"}
                </span>
              </dd>
            </div>
          </dl>
        </button>
      </div>
    </aside>
  );
}
