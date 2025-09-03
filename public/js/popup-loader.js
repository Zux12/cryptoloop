// public/js/popup-loader.js
(function () {
  const SHOW_DELAY_MS = 1500; // 1.5 seconds

  function createOverlay(src) {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'presentation');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';

    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = 'Security Warning';
    frame.style.width = 'min(720px, 96vw)';
    frame.style.height = 'min(520px, 90vh)';
    frame.style.border = '0';
    frame.style.borderRadius = '18px';
    frame.style.boxShadow = '0 25px 80px rgba(0,0,0,0.65)';
    frame.setAttribute('aria-modal', 'true');

    // Close on overlay click (outside frame)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // Close on ESC
    function onKey(e) {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    }
    document.addEventListener('keydown', onKey);

    function closeOverlay() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      // Restore scroll
      document.documentElement.style.overflow = '';
    }

    // Listen to iframe message to close
    window.addEventListener('message', (ev) => {
      if (ev && ev.data && ev.data.type === 'POPUP_CLOSE') {
        closeOverlay();
      }
    });

    overlay.appendChild(frame);
    return { overlay, closeOverlay };
  }

  function showPopup() {
    // Prevent double-show
    if (document.querySelector('#scam-warning-overlay')) return;

    const { overlay } = createOverlay('/public/popup/popup.html');
    overlay.id = 'scam-warning-overlay';
    document.body.appendChild(overlay);

    // Disable page scroll while open
    document.documentElement.style.overflow = 'hidden';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(showPopup, SHOW_DELAY_MS);
    });
  } else {
    setTimeout(showPopup, SHOW_DELAY_MS);
  }
})();
