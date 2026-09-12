import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { classNames } from "~/lib/utils/helpers";

interface PageImageProps {
  src: string;
  alt: string;
  page: number;
  fit: "width" | "height" | "original";
  isActive?: boolean;
  onLoad?: () => void;
}

const FIT_STYLES: Record<PageImageProps["fit"], { objectFit: string; width: string; height: string; maxHeight: string }> = {
  width: { objectFit: "contain", width: "100%", height: "auto", maxHeight: "none" },
  height: { objectFit: "contain", width: "auto", height: "100%", maxHeight: "100vh" },
  original: { objectFit: "none", width: "auto", height: "auto", maxHeight: "none" },
};

const PageImage: Component<PageImageProps> = (props) => {
  let imgRef: HTMLImageElement | undefined;
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal(false);

  const fitStyles = () => FIT_STYLES[props.fit];

  onMount(() => {
    if (imgRef?.complete) {
      setLoaded(true);
      props.onLoad?.();
    }
  });

  const imgClass = () =>
    classNames(
      "transition-opacity duration-300",
      loaded() ? "opacity-100" : "opacity-0",
    );

  const imgStyle = () => {
    const s = fitStyles();
    const style: Record<string, string> = {
      "object-fit": s.objectFit,
      width: s.width,
      height: s.height,
      "max-height": s.maxHeight === "none" ? "none" : s.maxHeight,
      "user-select": "none",
      "-webkit-user-drag": "none",
      display: "block",
    };
    if (props.fit === "original") {
      style["max-width"] = "none";
    }
    return style;
  };

  return (
    <div
      class="relative w-full bg-black flex items-center justify-center overflow-auto"
      style={{ "min-height": props.fit === "width" ? "100vh" : "100vh" }}
    >
      <img
        ref={imgRef}
        src={props.src}
        alt={props.alt}
        loading={props.isActive ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => {
          setLoaded(true);
          props.onLoad?.();
        }}
        onError={() => setError(true)}
        class={imgClass()}
        style={imgStyle()}
      />

      <Show when={!loaded() && !error()}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="flex flex-col items-center justify-center p-8 text-center">
          <svg class="w-12 h-12 text-[var(--text-muted)] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p class="text-sm text-[var(--text-muted)]">Failed to load image</p>
          <p class="text-xs text-[var(--text-muted)] mt-1 break-all max-w-xs">{props.src}</p>
        </div>
      </Show>

      <div class="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        {props.page}
      </div>
    </div>
  );
};

export default PageImage;
