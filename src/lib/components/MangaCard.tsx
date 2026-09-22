import { Component, Show } from "solid-js";
import { A } from "@solidjs/router";
import { classNames, encodeId } from "~/lib/utils/helpers";

interface MangaCardProps {
  id: string;
  title: string;
  coverUrl?: string;
  description?: string;
  score?: number;
  href?: string;
}

const MangaCard: Component<MangaCardProps> = (props) => {
  const href = () => props.href || `/manga/${encodeId(props.id)}`;

  return (
    <A href={href()} class="manga-card block group">
      <div class="relative aspect-[3/4] overflow-hidden bg-[var(--bg-tertiary)]">
        <Show
          when={props.coverUrl}
          fallback={
            <div class="w-full h-full flex items-center justify-center">
              <svg class="w-12 h-12 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          }
        >
          <img
            src={props.coverUrl}
            alt={props.title}
            loading="lazy"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Show>
        <Show when={props.score !== undefined}>
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-[var(--accent-light)] text-xs font-bold px-2 py-1 rounded-lg">
            {props.score?.toFixed(1)}
          </div>
        </Show>
      </div>
      <div class="p-3">
        <h3 class="font-semibold text-sm text-[var(--text-primary)] line-clamp-2 leading-snug">
          {props.title}
        </h3>
        <Show when={props.description}>
          <p class="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
            {props.description}
          </p>
        </Show>
      </div>
    </A>
  );
};

export default MangaCard;
