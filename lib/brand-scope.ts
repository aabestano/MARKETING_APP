/** Missing or "all" means the file is available to every brand book. */
export const ALL_BRAND_BOOKS = "all";

export function brandScopeOf(value?: string | null): string {
  if (!value || value === ALL_BRAND_BOOKS) return ALL_BRAND_BOOKS;
  return value;
}

/**
 * A file matches the book selected in Create when it is tagged for every book, or for that book.
 * No selected book does not hide the library.
 */
export function matchesBrandBook(scope: string | null | undefined, bookId: string | null | undefined): boolean {
  if (!bookId) return true;
  const tag = brandScopeOf(scope);
  return tag === ALL_BRAND_BOOKS || tag === bookId;
}

/**
 * An asset belongs to a brand book when it was uploaded there, marked available to every book,
 * or saved before tagging existed (that missing flag stays available to every book).
 * `sharedWithAll: false` limits it to the book it was added to.
 */
export function assetForBook(asset: { bookId: string; sharedWithAll?: boolean }, bookId: string): boolean {
  if (asset.bookId === bookId) return true;
  if (asset.sharedWithAll === false) return false;
  return true;
}

export function toggleSharedBook(ids: string[] | undefined, bookId: string, on: boolean): string[] {
  const next = new Set(ids ?? []);
  if (on) next.add(bookId);
  else next.delete(bookId);
  return [...next];
}

export function designsForBook<T extends { sharedBookIds?: string[] }>(items: T[], bookId: string): T[] {
  return items.filter((item) => item.sharedBookIds?.includes(bookId));
}

/** The brand book Create should use. An explicit empty choice stays empty. */
export function selectedCreateBookId(settingsId: string | null | undefined, workspaceId: string | null | undefined): string | null {
  if (settingsId === null) return null;
  return settingsId || workspaceId || null;
}
