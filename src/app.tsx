import { type Component, Suspense } from "solid-js";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import Navigation from "~/lib/components/Navigation";
import LoadingSpinner from "~/lib/components/LoadingSpinner";
import PWAProvider from "~/lib/components/PWAProvider";

const App: Component = () => {
  return (
    <Router
      root={(props) => (
        <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
          <Suspense fallback={<LoadingSpinner />}>
            <main class="pt-16 pb-20 md:pt-0 md:pb-0 md:pl-64">{props.children}</main>
          </Suspense>
          <Navigation />
          <PWAProvider />
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  );
};

export default App;
