"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { BrandBooks } from "./BrandBooks";
import { DesignStudio } from "./DesignStudio";
import { DesignRepository } from "./DesignRepository";
import { IdeaBase } from "./IdeaBase";
import { IdeaGenerator } from "./IdeaGenerator";
import { IdeaStudio } from "./IdeaStudio";
import { Calendar } from "./Calendar";
import { HowToGuide } from "./HowToGuide";
import { SubTabs } from "./SubTabs";
import { displayAppName } from "@/lib/app-name";
import { buildFontFaceCss } from "@/lib/fonts";
import { ToastProvider } from "./ui";
import { useStore } from "@/lib/store";
import type { MailerProvider } from "@/lib/types";

export interface ServerStatus {
  gemini: boolean;
  flux?: boolean;
  geminiModel: string | null;
  mailers: Record<MailerProvider, boolean>;
}

export function AppShell() {
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const activeTab = useStore((s) => s.activeTab);
  const theme = useStore((s) => s.theme);
  const displayName = useStore((s) => s.settings.displayName);

  useEffect(() => {
    document.title = `${displayAppName(displayName)} · Ideas to designs`;
  }, [displayName]);

  useEffect(() => {
    document.documentElement.className = theme === "light" ? "light" : "dark";
    if (hydrated) {
      try {
        localStorage.setItem("brand-engine-theme", theme);
      } catch {
        /* theme mirror is best-effort */
      }
    }
  }, [theme, hydrated]);

  const assets = useStore((s) => s.assets);
  useEffect(() => {
    let el = document.getElementById("brand-fonts") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "brand-fonts";
      document.head.appendChild(el);
    }
    el.textContent = buildFontFaceCss(assets);
  }, [assets]);

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).finally(() => {
      useStore.getState().syncPipeline();
      setHydrated(true);
    });
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-slate-950 md:h-screen md:flex-row md:overflow-hidden">
        <Sidebar
          status={status}
          guideOpen={guideOpen}
          onOpenGuide={() => setGuideOpen(true)}
          onCloseGuide={() => setGuideOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-hidden">
          {guideOpen ? (
            <HowToGuide onOpenSettings={() => setSettingsOpen(true)} />
          ) : (
            <>
              <SubTabs />
              <div className="min-h-0 flex-1">
                {!hydrated ? (
                  <div className="flex h-full items-center justify-center p-10 text-sm text-slate-500">Loading workspace…</div>
                ) : (
                  <>
                    {activeTab === "idea-base" && <IdeaBase status={status} onOpenSettings={() => setSettingsOpen(true)} />}
                    {activeTab === "brands" && <BrandBooks />}
                    {activeTab === "idea-generator" && <IdeaGenerator status={status} onOpenSettings={() => setSettingsOpen(true)} />}
                    {activeTab === "idea-studio" && <IdeaStudio />}
                    {activeTab === "design-studio" && <DesignStudio status={status} onOpenSettings={() => setSettingsOpen(true)} />}
                    {activeTab === "calendar" && <Calendar />}
                    {activeTab === "repository" && <DesignRepository />}
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {settingsOpen && <SettingsModal status={status} onClose={() => setSettingsOpen(false)} />}
    </ToastProvider>
  );
}
