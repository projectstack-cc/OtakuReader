import { Component, For, Show } from "solid-js";
import { A, useNavigate, useLocation } from "@solidjs/router";
import SearchBar from "~/lib/components/SearchBar";

interface NavItem {
  label: string;
  href: string;
  icon: (props: { class?: string }) => import("solid-js").JSX.Element;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Search",
    href: "/search",
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    label: "Favorites",
    href: "/favorites",
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const Navigation: Component = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <aside class="sidebar flex-col p-4">
        <div class="mb-6 px-2">
          <A href="/" class="block">
            <h1 class="text-2xl font-bold text-[var(--accent-light)] tracking-tight">OtakuReader</h1>
            <p class="text-xs text-[var(--text-muted)] mt-1">Manga Aggregator</p>
          </A>
        </div>
        <div class="px-2 mb-4">
          <SearchBar
            placeholder="Quick search..."
            debounceMs={300}
            compact
            onSearch={(q) => q && navigate(`/search?q=${encodeURIComponent(q)}`)}
          />
        </div>
        <nav class="flex-1 space-y-1">
          <For each={navItems}>
            {(item) => {
              const isActive = () => location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <A
                  href={item.href}
                  class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                  classList={{
                    "bg-[var(--bg-elevated)] text-[var(--accent-light)]": isActive(),
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": !isActive(),
                  }}
                >
                  <item.icon class="w-5 h-5" />
                  <span>{item.label}</span>
                </A>
              );
            }}
          </For>
        </nav>
        <div class="mt-auto pt-4 border-t border-[var(--border)]">
          <p class="text-xs text-[var(--text-muted)] text-center">OtakuReader v0.1.0</p>
        </div>
      </aside>

      <div class="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--bg-secondary)]/90 backdrop-blur-sm border-b border-[var(--border)] px-4 py-2">
        <SearchBar
          placeholder="Search manga..."
          debounceMs={300}
          compact
          onSearch={(q) => q && navigate(`/search?q=${encodeURIComponent(q)}`)}
        />
      </div>

      <nav class="tab-bar md:hidden" style={{ top: "48px", height: "calc(64px + 48px)" }}>
        <For each={navItems}>
          {(item) => {
            const isActive = () => location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
            return (
              <A
                href={item.href}
                class="flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors"
                classList={{
                  "text-[var(--accent-light)]": isActive(),
                  "text-[var(--text-muted)]": !isActive(),
                }}
              >
                <item.icon class="w-5 h-5" />
                <span>{item.label}</span>
              </A>
            );
          }}
        </For>
      </nav>
    </>
  );
};

export default Navigation;
