export function ThemedPageBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none select-none transition-colors duration-300"
      style={{ background: "var(--bg-overlay)" }}
    />
  );
}
