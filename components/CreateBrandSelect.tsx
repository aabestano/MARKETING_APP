"use client";

import { useStore } from "@/lib/store";
import { selectedCreateBookId } from "@/lib/brand-scope";
import { uiCopy } from "@/lib/ui-copy";

export function chooseBrandBook(id: string | null) {
  const state = useStore.getState();
  state.updateSettings({ createBrandBookId: id });
  state.updateWorkspace({ brandBookId: id });
}

export function useBrandChoice() {
  const books = useStore((s) => s.brandBooks);
  const settingsId = useStore((s) => s.settings.createBrandBookId);
  const workspaceId = useStore((s) => s.workspace.brandBookId);
  const known = new Set(books.map((book) => book.id));
  const raw = selectedCreateBookId(settingsId, workspaceId);
  const selected = raw && known.has(raw) ? raw : null;
  return { books, selected, select: chooseBrandBook };
}

/** Shared brand book for Idea Generator, Idea Studio, and Design Studio. */
export function CreateBrandSelect() {
  const { books, selected, select } = useBrandChoice();
  const overrides = useStore((s) => s.settings.copyOverrides);
  if (books.length === 0) {
    return <p className="ml-auto shrink-0 py-2 text-[11px] text-slate-500">Add a brand book to limit generation to one book.</p>;
  }
  return (
    <label className="ml-auto flex shrink-0 items-center gap-2 py-2 text-xs text-slate-400" htmlFor="create-brand-book">
      {uiCopy("brand.create", overrides)}
      <select id="create-brand-book" className="input w-auto max-w-[14rem] py-1 text-xs" value={selected ?? ""} onChange={(e) => select(e.target.value || null)}>
        <option value="">{uiCopy("brand.all", overrides)}</option>
        {books.map((book) => (
          <option key={book.id} value={book.id}>
            {book.name}
          </option>
        ))}
      </select>
    </label>
  );
}
