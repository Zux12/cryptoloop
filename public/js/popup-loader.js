// public/js/popup-loader.js
(function () {
  const SHOW_DELAY_MS = 1500; // 1.5 seconds

  // Try common locations for popup.html regardless of where login.html is served from.
  const candidatePopupPaths = [
    '/public/popup/popup.html',
    '/popup/popup.html',
    'popup/popup.html',
    './popup/popup.html'
  ];

  // Utility: find first URL that returns 200-299
  async function findExisting(urls) {
    for (const u of urls) {
      try {
        const res = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) return u;
      } catch (e) {
        // ignore and keep trying
      }
    }
    return null;
  }

  function createOverlay(src) {
    const overlay = document.createElement('div');
    overlay.id = 'scam-warning-overlay';
    overlay.setAttribute('role', 'presentation');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(2px)',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    });

    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = 'Security Warning';
    Object.assign(frame.style, {
      width: 'min(720px, 96vw)',
      height: 'min(520px, 90vh)',
      border: '0',
      borderRadius: '18px',
      boxShadow: '0 25px 80px rgba(0,0,0,0.65)'
    });
    frame.setAttribute('aria-modal', 'true');

    // Close on overlay click outside iframe
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });

    // ESC to close
    function onKey(e) {
      if (e.key === 'Escape') closeOverlay();
    }
    document.addEventListener('keydown', onKey);

    // Message from iframe to close
    function onMsg(ev) {
      if (ev && ev.data && ev.data.type === 'POPUP_CLOSE') {
        closeOverlay();
      }
    }
    window.addEventListener('message', onMsg);

    function closeOverlay() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMsg);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.documentElement.style.overflow = '';
    }

    overlay.appendChild(frame);
    return overlay;
  }

  async function showPopup() {
    // Prevent double show
    if (document.getElementById('scam-warning-overlay')) return;

    const found = await findExisting(candidatePopupPaths);
    if (!found) {
      console.warn('[popup-loader] Could not find popup.html at any known path:', candidatePopupPaths);
      return;
    }

    const overlay = createOverlay(found);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
  }

  function start() {
    setTimeout(showPopup, SHOW_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
