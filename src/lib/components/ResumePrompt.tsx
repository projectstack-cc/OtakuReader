import { Component, Show } from "solid-js";
import { readerActions } from "~/lib/stores/reader";

interface ResumePromptProps {
  mangaId: string;
  chapterId: string;
  page: number;
  onResume: () => void;
  onStartOver: () => void;
}

const ResumePrompt: Component<ResumePromptProps> = (props) => {
  return (
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        class="rounded-2xl p-6 md:p-8 max-w-sm w-full mx-4"
        style={{
          "background": "var(--bg-secondary)",
          "box-shadow": "6px 6px 12px rgba(10,10,22,0.7), -6px -6px 12px rgba(46,46,72,0.5)",
        }}
      >
        <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-1 text-center">
          Resume Reading?
        </h3>
        <p class="text-sm text-[var(--text-secondary)] text-center mb-6">
          You left off at page {props.page + 1}. Would you like to continue or start over?
        </p>
        <div class="flex gap-3">
          <button
            onClick={() => {
              readerActions.clearReadingPosition(props.mangaId, props.chapterId);
              props.onStartOver();
            }}
            class="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              "background": "var(--bg-secondary)",
              "box-shadow": "4px 4px 8px rgba(10,10,22,0.7), -4px -4px 8px rgba(46,46,72,0.5)",
              "color": "var(--text-secondary)",
            }}
          >
            Start Over
          </button>
          <button
            onClick={props.onResume}
            class="flex-1 py-3 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] transition-colors"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumePrompt;
