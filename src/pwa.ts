/** Register the offline service worker for production / Pages installs. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Vite replaces this at build time. Dev server should not claim the page.
  if (!import.meta.env.PROD) {
    return;
  }

  const register = () => {
    const swUrl = new URL('sw.js', document.baseURI).href;
    void navigator.serviceWorker.register(swUrl, { scope: './' }).catch(() => {
      // Offline install is best-effort; never block gameplay.
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
