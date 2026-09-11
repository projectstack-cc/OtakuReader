import { Component } from "solid-js";

const LoadingSpinner: Component = () => {
  return (
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default LoadingSpinner;
