import { Component, createSignal, createEffect, onCleanup, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";

interface SearchBarProps {
  placeholder?: string;
  debounceMs?: number;
  onSearch?: (query: string) => void;
  href?: string;
  compact?: boolean;
}

const SearchBar: Component<SearchBarProps> = (props) => {
  const [value, setValue] = createSignal("");
  const navigate = useNavigate();
  let debounceTimer: number | undefined;

  const handleInput = (v: string) => {
    setValue(v);
    if (props.onSearch) {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        props.onSearch?.(v.trim());
      }, props.debounceMs ?? 300);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      clearTimeout(debounceTimer);
      const trimmed = value().trim();
      if (trimmed) {
        if (props.href) {
          navigate(`${props.href}?q=${encodeURIComponent(trimmed)}`);
        }
        props.onSearch?.(trimmed);
      }
    }
  };

  const handleClear = () => {
    clearTimeout(debounceTimer);
    setValue("");
    props.onSearch?.("");
  };

  onCleanup(() => clearTimeout(debounceTimer));

  return (
    <div class="relative">
      <input
        type="text"
        value={value()}
        onInput={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder ?? "Search manga..."}
        class={[
          "w-full px-4 py-2.5 pl-10 pr-9 neumorphic-input text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all",
          props.compact ? "text-sm py-2" : "",
        ].join(" ")}
      />
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <Show when={value().length > 0}>
        <button
          onClick={handleClear}
          class="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Clear search"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </Show>
    </div>
  );
};

export default SearchBar;
