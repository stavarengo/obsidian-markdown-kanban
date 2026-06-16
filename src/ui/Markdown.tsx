import { useEffect, useRef } from "react";
import { useRepo } from "./context";

interface Props {
  markdown: string;
  /** The note path — resolves internal links/embeds relative to it. */
  sourcePath: string;
  className?: string;
}

/**
 * Renders markdown through the repo's engine (Obsidian's MarkdownRenderer in the vault, plain text
 * in tests). The effect registers the repo's cleanup synchronously, so the managed Component is
 * always unloaded on unmount or when the markdown/path changes — no leaked Components.
 */
export function Markdown({ markdown, sourcePath, className }: Props) {
  const repo = useRepo();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    return repo.renderMarkdown(ref.current, markdown, sourcePath);
  }, [repo, markdown, sourcePath]);
  return <div ref={ref} className={className} />;
}
