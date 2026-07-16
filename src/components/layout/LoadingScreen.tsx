export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>App wird geladen …</p>
    </main>
  );
}
