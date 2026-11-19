// Typed extension points for what the Kinsta backup ZIP adds. Nothing here is implemented:
// the ZIP has not been supplied, and the planner/applier must keep working without it.
// See docs/wordpress-import.md ("What the Kinsta ZIP adds") for the intended use of each hook.

/** An upload read out of `public/wp-content/uploads/` in a verified archive. */
export type UploadedFile = { relativePath: string; bytes: Uint8Array; sha256: string };

/** TODO(kinsta-zip): supply original media bytes so reference-only Media records can become real uploads. */
export interface MediaBytesProvider {
  /** Return the verified original for an attachment, or null when the archive does not hold it. Must not touch the network. */
  find(attachment: { wpId: number; sourceFile: string | undefined; sourceUrl: string }): Promise<UploadedFile | null>;
}

/**
 * TODO(kinsta-zip): once media bytes are imported, links to the old site's uploads (`/wp-content/uploads/...`, reported as
 * `oldSiteUploadLinks` by the planner) can be rewritten to the local Media record. The planner reports them now and flags
 * the documents `unresolved-links` (non-blocking); it never rewrites a link without a verified local file.
 */
export interface UploadLinkRewriter {
  /** Return the public path of the local copy (for example `/api/media/file/name.jpg`) of an old upload path, or null when none exists. Must not touch the network. */
  rewrite(oldUploadPath: string): { mediaWpId: number; publicPath: string } | null;
}

export type WpMenu = { slug: string; items: { title: string; target: string; parent: number | null; order: number }[] };
/** TODO(kinsta-zip): tables only the SQL dump holds (menus, term relationships, plugin options, redirects plugin rules). */
export interface DatabaseTableProvider {
  menus(): Promise<WpMenu[]>;
  /** Plugin settings by option name; callers must allowlist options and never persist secrets. */
  pluginOption(name: string): Promise<unknown>;
}

export interface ExtensionHooks {
  media: MediaBytesProvider | null;
  uploadLinks: UploadLinkRewriter | null;
  database: DatabaseTableProvider | null;
  /** Static status block written to the plan summary so reports always say what is still deferred. */
  status(): { mediaBytes: string; menus: string; pluginSettings: string; uploadLinkRewrite: string };
}

export const noExtensions: ExtensionHooks = {
  media: null,
  uploadLinks: null,
  database: null,
  status: () => ({ mediaBytes: 'todo-kinsta-zip', menus: 'todo-kinsta-zip', pluginSettings: 'todo-kinsta-zip', uploadLinkRewrite: 'todo-kinsta-zip' }),
};
