import { type Component, Suspense } from "solid-js";
import Navigation from "~/lib/components/Navigation";
import LoadingSpinner from "~/lib/components/LoadingSpinner";
import PWAProvider from "~/lib/components/PWAProvider";

const App: Component = () => {
  return (
    <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
      <Suspense fallback={<LoadingSpinner />}>
        <main class="pb-20 md:pb-0 md:pl-64">
          <slot />
        </main>
      </Suspense>
      <Navigation />
      <PWAProvider />
    </div>
  );
};

export default App;
