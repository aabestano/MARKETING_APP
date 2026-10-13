"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STORAGE_ERROR_EVENT, createIdbStorage } from "./idb";
import { normalizePurposes } from "./assets";
import { applyLabelMigration } from "./label-migration";
import { applyImport, type ImportMode, type WorkspaceData } from "./workspace-io";
import { DEFAULT_SIZE } from "./poster-sizes";
import { syncLifecycle } from "./pipeline";
import type { Campaign, IdeaCard, IdeaResource, PipelineItem, StudioState } from "./idea-types";
import type { PosterWorkspace, SavedPoster } from "./poster-types";
import type {
  BlastCategory,
  DesignMode,
  BrandAsset,
  BrandBook,
  BrandTokens,
  ReferenceImage,
  SavedBlast,
  Settings,
  TabId,
  Theme,
  ViewMode,
  Workspace,
} from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export { STORAGE_ERROR_EVENT };

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  mailerProvider: "resend",
  mailerApiKey: "",
  fromName: "",
  fromEmail: "",
  testRecipient: "",
};

export const EMPTY_POSTER: PosterWorkspace = {
  prompt: "",
  spec: null,
  size: DEFAULT_SIZE,
  illustrationMode: "auto",
  source: null,
  warnings: [],
  savedId: null,
  pipelineId: null,
};

const EMPTY_WORKSPACE: Workspace = {
  blueprint: "",
  brandBookId: null,
  directives: "",
  mjml: "",
  html: "",
  viewMode: "preview",
  source: null,
  warnings: [],
  pipelineId: null,
};

interface AppState {
  theme: Theme;
  designMode: DesignMode;
  poster: PosterWorkspace;
  posters: SavedPoster[];
  ideaBase: IdeaResource[];
  pipeline: PipelineItem[];
  generatedIdeas: IdeaCard[];
  studio: StudioState;
  referenceImages: ReferenceImage[];
  activeTab: TabId;
  brandBooks: BrandBook[];
  assets: BrandAsset[];
  blasts: SavedBlast[];
  settings: Settings;
  workspace: Workspace;

  setTab: (tab: TabId) => void;
  setDesignMode: (mode: DesignMode) => void;
  updatePoster: (patch: Partial<PosterWorkspace>) => void;
  resetPoster: () => void;
  savePoster: (poster: Omit<SavedPoster, "id" | "createdAt" | "updatedAt">) => SavedPoster;
  patchSavedPoster: (id: string, patch: Partial<Pick<SavedPoster, "name" | "spec" | "size" | "prompt" | "thumbnail">>) => void;
  deletePoster: (id: string) => void;

  addResource: (resource: Omit<IdeaResource, "id" | "dateAdded">) => IdeaResource;
  updateResource: (id: string, patch: Partial<IdeaResource>) => void;
  deleteResource: (id: string) => void;
  loadSampleResources: (resources: IdeaResource[]) => void;
  setGeneratedIdeas: (ideas: IdeaCard[]) => void;
  schedule: (idea: IdeaCard, date: string, campaign?: Campaign) => PipelineItem;
  updatePipelineItem: (id: string, patch: Partial<Omit<PipelineItem, "id">>) => void;
  removePipelineItem: (id: string) => void;
  syncPipeline: () => void;
  importIdeate: (data: { ideaBase: IdeaResource[]; pipeline: PipelineItem[] }) => { resources: number; items: number };
  setStudio: (patch: Partial<StudioState>) => void;
  updateCampaign: (updater: (c: Campaign) => Campaign) => void;
  linkDesign: (pipelineId: string, link: { blastId?: string; posterId?: string }) => void;
  unlinkDesign: (pipelineId: string, link: { blastId?: string; posterId?: string }) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  updateBrandTokens: (bookId: string, tokens: BrandTokens) => void;
  addReferenceImage: (image: Omit<ReferenceImage, "id">) => ReferenceImage;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  createBrandBook: (name: string) => BrandBook;
  deleteBrandBook: (id: string) => void;
  addAsset: (asset: Omit<BrandAsset, "id" | "createdAt" | "purposes"> & { purposes?: BrandAsset["purposes"] }) => BrandAsset;
  updateAsset: (id: string, patch: Partial<BrandAsset>) => void;
  importWorkspace: (data: WorkspaceData, mode: ImportMode) => void;
  deleteAsset: (id: string) => void;
  saveBlast: (blast: Omit<SavedBlast, "id" | "createdAt" | "updatedAt">) => SavedBlast;
  updateBlast: (id: string, patch: Partial<Pick<SavedBlast, "html" | "mjml" | "name" | "subject" | "category">>) => void;
  deleteBlast: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateWorkspace: (patch: Partial<Workspace>) => void;
  setViewMode: (mode: ViewMode) => void;
  resetWorkspace: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      designMode: "email",
      poster: EMPTY_POSTER,
      posters: [],
      ideaBase: [],
      pipeline: [],
      generatedIdeas: [],
      studio: { campaign: null, pipelineId: null },
      referenceImages: [],
      activeTab: "brands",
      brandBooks: [],
      assets: [],
      blasts: [],
      settings: DEFAULT_SETTINGS,
      workspace: EMPTY_WORKSPACE,

      setTab: (activeTab) => set({ activeTab }),
      setDesignMode: (designMode) => set({ designMode }),
      updatePoster: (patch) => set((s) => ({ poster: { ...s.poster, ...patch } })),
      resetPoster: () => set((s) => ({ poster: { ...EMPTY_POSTER, size: s.poster.size, illustrationMode: s.poster.illustrationMode } })),
      savePoster: (poster) => {
        const now = Date.now();
        const full: SavedPoster = { ...poster, id: uid(), createdAt: now, updatedAt: now };
        set((s) => ({ posters: [full, ...s.posters] }));
        return full;
      },
      patchSavedPoster: (id, patch) =>
        set((s) => ({ posters: s.posters.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) })),
      deletePoster: (id) =>
        set((s) => ({
          posters: s.posters.filter((p) => p.id !== id),
          pipeline: s.pipeline.map((i) => (i.posterIds?.includes(id) ? { ...i, posterIds: i.posterIds.filter((x) => x !== id) } : i)),
        })),

      addResource: (resource) => {
        const full: IdeaResource = { ...resource, id: "res_" + uid().slice(0, 8), dateAdded: new Date().toISOString() };
        set((s) => ({ ideaBase: [full, ...s.ideaBase] }));
        return full;
      },
      updateResource: (id, patch) => set((s) => ({ ideaBase: s.ideaBase.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteResource: (id) => set((s) => ({ ideaBase: s.ideaBase.filter((r) => r.id !== id) })),
      loadSampleResources: (resources) =>
        set((s) => ({ ideaBase: [...resources.filter((r) => !s.ideaBase.some((x) => x.id === r.id)), ...s.ideaBase] })),
      setGeneratedIdeas: (generatedIdeas) => set({ generatedIdeas }),
      schedule: (idea, date, campaign) => {
        const item: PipelineItem = { id: "pipe_" + uid().slice(0, 8), scheduledDate: date, status: "Scheduled", ideaData: { ...idea }, campaign };
        set((s) => ({ pipeline: syncLifecycle([...s.pipeline, item]) }));
        return item;
      },
      updatePipelineItem: (id, patch) => set((s) => ({ pipeline: syncLifecycle(s.pipeline.map((i) => (i.id === id ? { ...i, ...patch } : i))) })),
      removePipelineItem: (id) =>
        set((s) => ({
          pipeline: s.pipeline.filter((i) => i.id !== id),
          studio: s.studio.pipelineId === id ? { ...s.studio, pipelineId: null } : s.studio,
        })),
      syncPipeline: () =>
        set((s) => {
          const next = syncLifecycle(s.pipeline);
          return next === s.pipeline ? s : { pipeline: next };
        }),
      importIdeate: (data) => {
        let resources = 0;
        let items = 0;
        set((s) => {
          const haveRes = new Set(s.ideaBase.map((r) => r.id));
          const haveItems = new Set(s.pipeline.map((i) => i.id));
          const newRes = data.ideaBase.filter((r) => !haveRes.has(r.id));
          const newItems = data.pipeline.filter((i) => !haveItems.has(i.id));
          resources = newRes.length;
          items = newItems.length;
          return { ideaBase: [...s.ideaBase, ...newRes], pipeline: syncLifecycle([...s.pipeline, ...newItems]) };
        });
        return { resources, items };
      },
      setStudio: (patch) => set((s) => ({ studio: { ...s.studio, ...patch } })),
      updateCampaign: (updater) =>
        set((s) => {
          if (!s.studio.campaign) return s;
          return { studio: { ...s.studio, campaign: updater(s.studio.campaign) } };
        }),
      linkDesign: (pipelineId, link) =>
        set((s) => ({
          pipeline: s.pipeline.map((i) => {
            if (i.id !== pipelineId) return i;
            const blastIds = link.blastId && !i.blastIds?.includes(link.blastId) ? [...(i.blastIds ?? []), link.blastId] : i.blastIds;
            const posterIds = link.posterId && !i.posterIds?.includes(link.posterId) ? [...(i.posterIds ?? []), link.posterId] : i.posterIds;
            return { ...i, blastIds, posterIds };
          }),
        })),
      unlinkDesign: (pipelineId, link) =>
        set((s) => ({
          pipeline: s.pipeline.map((i) =>
            i.id !== pipelineId
              ? i
              : {
                  ...i,
                  blastIds: link.blastId ? i.blastIds?.filter((x) => x !== link.blastId) : i.blastIds,
                  posterIds: link.posterId ? i.posterIds?.filter((x) => x !== link.posterId) : i.posterIds,
                },
          ),
        })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      updateBrandTokens: (bookId, tokens) =>
        set((s) => ({
          brandBooks: s.brandBooks.map((b) => (b.id === bookId ? { ...b, tokens: { ...b.tokens, ...tokens } } : b)),
        })),

      addReferenceImage: (image) => {
        const full: ReferenceImage = { ...image, id: uid() };
        set((s) => ({ referenceImages: [...s.referenceImages.slice(-2), full] }));
        return full;
      },
      removeReferenceImage: (id) => set((s) => ({ referenceImages: s.referenceImages.filter((r) => r.id !== id) })),
      clearReferenceImages: () => set({ referenceImages: [] }),

      createBrandBook: (name) => {
        const trimmed = name.trim();
        const existing = get().brandBooks.find((b) => b.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const book: BrandBook = { id: uid(), name: trimmed, createdAt: Date.now() };
        set((s) => ({ brandBooks: [...s.brandBooks, book] }));
        return book;
      },

      deleteBrandBook: (id) =>
        set((s) => ({
          brandBooks: s.brandBooks.filter((b) => b.id !== id),
          assets: s.assets.filter((a) => a.bookId !== id),
          workspace: s.workspace.brandBookId === id ? { ...s.workspace, brandBookId: null } : s.workspace,
        })),

      addAsset: (asset) => {
        const full: BrandAsset = { ...asset, purposes: normalizePurposes(asset.purposes), id: uid(), createdAt: Date.now() };
        set((s) => ({ assets: [...s.assets, full] }));
        return full;
      },

      updateAsset: (id, patch) =>
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === id ? { ...a, ...patch, purposes: normalizePurposes("purposes" in patch ? patch.purposes : a.purposes) } : a,
          ),
        })),

      importWorkspace: (data, mode) =>
        set((s) => {
          const next = applyImport(
            { brandBooks: s.brandBooks, assets: s.assets, blasts: s.blasts, posters: s.posters, ideaBase: s.ideaBase, pipeline: s.pipeline },
            data,
            mode,
          );
          const bookIds = new Set(next.brandBooks.map((b) => b.id));
          return {
            ...next,
            pipeline: syncLifecycle(next.pipeline),
            settings: mode === "replace" ? { ...s.settings, ...data.settings } : s.settings,
            theme: mode === "replace" ? data.theme : s.theme,
            workspace:
              s.workspace.brandBookId && !bookIds.has(s.workspace.brandBookId) ? { ...s.workspace, brandBookId: null } : s.workspace,
          };
        }),

      deleteAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

      saveBlast: (blast) => {
        const now = Date.now();
        const full: SavedBlast = { ...blast, id: uid(), createdAt: now, updatedAt: now };
        set((s) => ({ blasts: [full, ...s.blasts] }));
        return full;
      },

      updateBlast: (id, patch) =>
        set((s) => ({
          blasts: s.blasts.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b)),
        })),

      deleteBlast: (id) =>
        set((s) => ({
          blasts: s.blasts.filter((b) => b.id !== id),
          pipeline: s.pipeline.map((i) => (i.blastIds?.includes(id) ? { ...i, blastIds: i.blastIds.filter((x) => x !== id) } : i)),
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateWorkspace: (patch) => set((s) => ({ workspace: { ...s.workspace, ...patch } })),
      setViewMode: (viewMode) => set((s) => ({ workspace: { ...s.workspace, viewMode } })),
      resetWorkspace: () => set({ workspace: EMPTY_WORKSPACE }),
    }),
    {
      name: "brand-engine-app2-v1",
      version: 4,
      storage: createJSONStorage(() => createIdbStorage()),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { assets?: BrandAsset[]; activeTab?: string };
        if (state.activeTab === "generator") state.activeTab = "design-studio";
        if (Array.isArray(state.assets)) {
          state.assets = state.assets.map((a) => ({ ...a, purposes: normalizePurposes(a.purposes) }));
        }
        return applyLabelMigration(state) as unknown as AppState;
      },
      skipHydration: true,
      partialize: (s) => ({
        theme: s.theme,
        designMode: s.designMode,
        poster: s.poster,
        posters: s.posters,
        ideaBase: s.ideaBase,
        pipeline: s.pipeline,
        generatedIdeas: s.generatedIdeas,
        studio: s.studio,
        activeTab: s.activeTab,
        brandBooks: s.brandBooks,
        assets: s.assets,
        blasts: s.blasts,
        settings: s.settings,
        workspace: s.workspace,
      }),
    },
  ),
);

/** Promo = emerald #10B981, Non-promo = purple #6366F1, Seasonal = amber #F59E0B. */
export const CATEGORY_STYLES: Record<BlastCategory, string> = {
  Promotional: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  Educational: "border-indigo-500/50 bg-indigo-500/10 text-indigo-400",
  Seasonal: "border-amber-500/50 bg-amber-500/10 text-amber-400",
};

export const CATEGORY_LABELS: Record<BlastCategory, string> = {
  Promotional: "Promotional",
  Educational: "Educational",
  Seasonal: "Seasonal",
};
