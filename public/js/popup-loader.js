// public/js/popup-loader.js
(function () {
  const SHOW_DELAY_MS = 1500;

  // Likely locations for popup.html depending on how static is served
  const candidatePopupPaths = [
    '/popup/popup.html',        // <-- most common when 'public' is static root
    '/public/popup/popup.html',
    'popup/popup.html',
    './popup/popup.html'
  ];

  // Language pack (used by fallback UI)
  const T = {
    en: {
      title: "This website is NOT a real trading platform.",
      sub: "If you reached this page via an offer or message, you may have been targeted by a scam.",
      p1: "Warning: This site is a decoy. It does not provide investment services and no real trading occurs here. If you were instructed to log in, stop immediately.",
      li: [
        "Do not send money or share personal/financial information.",
        "Report the source that led you here (social post, chat, SMS, ad).",
        "Consider contacting your bank/card issuer if you shared details."
      ],
      p2: "This warning is shown to protect you. Choosing “I Understand” will close this message.",
      ok: "I Understand",
      exit: "Exit site"
    },
    ms: {
      title: "Laman web ini BUKAN platform dagangan sebenar.",
      sub: "Jika anda tiba di sini melalui tawaran atau mesej, anda mungkin menjadi sasaran penipuan.",
      p1: "Amaran: Laman ini hanyalah olokan. Tiada perkhidmatan pelaburan atau dagangan sebenar di sini. Jika anda diminta untuk log masuk, hentikan segera.",
      li: [
        "Jangan hantar wang atau kongsi maklumat peribadi/kewangan.",
        "Laporkan sumber yang membawa anda ke sini (media sosial, chat, SMS, iklan).",
        "Pertimbangkan untuk hubungi bank/pengeluar kad jika anda berkongsi butiran."
      ],
      p2: "Amaran ini dipaparkan untuk melindungi anda. Pilih “Saya Faham” untuk tutup mesej ini.",
      ok: "Saya Faham",
      exit: "Keluar"
    },
    id: {
      title: "Situs ini BUKAN platform trading yang nyata.",
      sub: "Jika Anda sampai di sini melalui tawaran atau pesan, Anda mungkin menjadi target penipuan.",
      p1: "Peringatan: Situs ini hanyalah umpan. Tidak ada layanan investasi atau trading sungguhan di sini. Jika Anda diminta login, segera hentikan.",
      li: [
        "Jangan kirim uang atau bagikan data pribadi/keuangan.",
        "Laporkan sumber yang mengarahkan Anda ke sini (sosmed, chat, SMS, iklan).",
        "Pertimbangkan menghubungi bank/penerbit kartu jika Anda sudah berbagi data."
      ],
      p2: "Peringatan ini ditampilkan untuk melindungi Anda. Pilih “Saya Paham” untuk menutup pesan ini.",
      ok: "Saya Paham",
      exit: "Keluar"
    },
    zh: {
      title: "本网站并非真实的交易平台。",
      sub: "如果您通过广告或消息来到这里，您可能正遭遇诈骗。",
      p1: "警告：本网站为诱导页面。这里不提供投资服务，也不存在真实交易。如果有人让您登录，请立即停止。",
      li: [
        "不要转账或提供个人/财务信息。",
        "举报将您引至此处的来源（社交媒体、聊天、短信、广告）。",
        "若已泄露信息，请考虑联系银行或发卡机构。"
      ],
      p2: "此警示旨在保护您。点击“我已了解”将关闭本消息。",
      ok: "我已了解",
      exit: "离开网站"
    },
    ar: {
      title: "هذا الموقع ليس منصة تداول حقيقية.",
      sub: "إذا وصلت إلى هذه الصفحة عبر عرض أو رسالة، فقد تكون هدفًا لعملية احتيال.",
      p1: "تحذير: هذا الموقع طُعم. لا يقدم خدمات استثمار ولا تتم أي عمليات تداول حقيقية هنا. إذا طُلب منك تسجيل الدخول، فتوقف فورًا.",
      li: [
        "لا ترسل أي أموال ولا تشارك معلوماتك الشخصية/المالية.",
        "أبلغ عن المصدر الذي أوصلك إلى هنا (منشور، محادثة، رسالة، إعلان).",
        "فكّر في التواصل مع بنكك/مصدر بطاقتك إن شاركت معلومات."
      ],
      p2: "يُعرض هذا التحذير لحمايتك. سيؤدي اختيار “فهمت” إلى إغلاق هذه الرسالة.",
      ok: "فهمت",
      exit: "الخروج"
    }
  };

  // --- Utilities -------------------------------------------------------------

  async function tryHeadOrGet(u) {
    try {
      const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) return true;
    } catch {}
    try {
      const r = await fetch(u, { method: 'GET', cache: 'no-store' });
      if (r.ok) return true;
    } catch {}
    return false;
  }

  async function findExisting(urls) {
    for (const u of urls) {
      if (await tryHeadOrGet(u)) return u;
    }
    return null;
  }

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
  }

  // --- Overlay + Iframe path -------------------------------------------------

  function createOverlayShell() {
    const overlay = document.createElement('div');
    overlay.id = 'scam-warning-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(2px)',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    });
    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
    // ESC to close
    function onKey(e){ if (e.key === 'Escape') closeOverlay(); }
    document.addEventListener('keydown', onKey);

    function closeOverlay() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      lockScroll(false);
    }

    return { overlay, closeOverlay };
  }

  function probeIframeLoaded(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return false;
      // If blocked by X-Frame-Options, many browsers keep about:blank
      const html = doc.documentElement;
      return !!(html && html.innerHTML && html.innerHTML.length > 50);
    } catch {
      // Cross-origin or blocked
      return false;
    }
  }

  // --- Fallback inline popup (no iframe) ------------------------------------

  function renderFallback(overlay) {
    const css = `
      .warn-card{width:min(680px,94vw);background:linear-gradient(180deg,#111827,#0f172a);
        color:#e5e7eb;border:2px solid #ef4444;border-radius:16px;position:relative;overflow:hidden;
        box-shadow:0 25px 80px rgba(0,0,0,.55),0 0 0 6px rgba(239,68,68,.25)}
      .warn-pulse{position:absolute;inset:-2px;border-radius:16px;box-shadow:0 0 0 0 rgba(239,68,68,.45);
        animation:warnpulse 1.8s infinite;pointer-events:none}
      @keyframes warnpulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}70%{box-shadow:0 0 0 14px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      .warn-hd{display:flex;gap:12px;align-items:center;padding:18px 20px;background:#1f2937;border-bottom:1px solid #374151}
      .warn-badge{display:inline-flex;align-items:center;gap:8px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff;
        background:linear-gradient(90deg,#ef4444,#f59e0b);padding:8px 12px;border-radius:999px;font-size:12px}
      .warn-title{margin:6px 0 0 0;font-size:20px;font-weight:700;line-height:1.2}
      .warn-sub{font-size:14px;color:#fca5a5;margin:6px 0 0 0}
      .warn-body{padding:18px 20px 6px 20px;line-height:1.65;font-size:15px;color:#e5e7eb}
      .warn-note{margin-top:8px;color:#9ca3af;font-size:13px}
      .warn-ctrl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px 20px 20px 20px}
      .warn-sel{background:#0b1220;color:#e5e7eb;border:1px solid #334155;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}
      .warn-btn{appearance:none;border:none;cursor:pointer;text-decoration:none;border-radius:12px;padding:12px 16px;font-weight:700;font-size:14px}
      .warn-ok{background:#ef4444;color:#fff}
      .warn-exit{background:#111827;color:#e5e7eb;border:1px solid #374151}
      @media (max-width:420px){.warn-title{font-size:18px}.warn-body{font-size:14px}}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const card = document.createElement('div');
    card.className = 'warn-card';
    card.innerHTML = `
      <div class="warn-pulse"></div>
      <div class="warn-hd">
        <span style="font-size:22px" aria-hidden="true">⚠️</span>
        <div>
          <span class="warn-badge">Security Notice</span>
          <div class="warn-title" id="w-title"></div>
          <div class="warn-sub" id="w-sub"></div>
        </div>
      </div>
      <div class="warn-body">
        <p id="w-p1"></p>
        <ul id="w-list" style="margin:12px 0 0 0; padding-left:18px; font-size:14px"></ul>
        <p class="warn-note" id="w-p2"></p>
      </div>
      <div class="warn-ctrl">
        <select class="warn-sel" id="w-lang">
          <option value="en" selected>English</option>
          <option value="ms">Bahasa Melayu</option>
          <option value="id">Bahasa Indonesia</option>
          <option value="zh">简体中文</option>
          <option value="ar">العربية</option>
        </select>
        <button class="warn-btn warn-ok" id="w-ok" type="button"></button>
        <a class="warn-btn warn-exit" id="w-exit" href="https://www.google.com/" rel="noopener"></a>
      </div>
    `;
    overlay.appendChild(card);

    const els = {
      title: card.querySelector('#w-title'),
      sub: card.querySelector('#w-sub'),
      p1: card.querySelector('#w-p1'),
      list: card.querySelector('#w-list'),
      p2: card.querySelector('#w-p2'),
      ok: card.querySelector('#w-ok'),
      exit: card.querySelector('#w-exit'),
      lang: card.querySelector('#w-lang'),
    };

    function applyLang(code){
      const L = T[code] || T.en;
      els.title.textContent = L.title;
      els.sub.textContent = L.sub;
      els.p1.textContent = L.p1;
      els.list.innerHTML = L.li.map(x => `<li>${x}</li>`).join('');
      els.p2.textContent = L.p2;
      els.ok.textContent = L.ok;
      els.exit.textContent = L.exit;
      document.documentElement.dir = (code === 'ar') ? 'rtl' : 'ltr';
    }
    els.lang.addEventListener('change', e => applyLang(e.target.value));
    applyLang('en');

    // Close handlers
    els.ok.addEventListener('click', () => {
      const parent = overlay.parentNode;
      if (parent) parent.removeChild(overlay);
      lockScroll(false);
    });
  }

  // --- Main flow -------------------------------------------------------------

  async function showPopup() {
    if (document.getElementById('scam-warning-overlay')) return;

    const { overlay, closeOverlay } = createOverlayShell();
    document.body.appendChild(overlay);
    lockScroll(true);

    // Try to load popup via iframe first
    const found = await findExisting(candidatePopupPaths);

    if (found) {
      const frame = document.createElement('iframe');
      Object.assign(frame.style, {
        width: 'min(720px, 96vw)',
        height: 'min(520px, 90vh)',
        border: '0',
        borderRadius: '18px',
        boxShadow: '0 25px 80px rgba(0,0,0,0.65)',
        background: '#0f172a'
      });
      frame.title = 'Security Warning';
      overlay.appendChild(frame);

      // When popup.html wants to close, it will postMessage({type:'POPUP_CLOSE'})
      function onMsg(ev) {
        if (ev && ev.data && ev.data.type === 'POPUP_CLOSE') {
          window.removeEventListener('message', onMsg);
          closeOverlay();
        }
      }
      window.addEventListener('message', onMsg);

      // Load iframe
      frame.src = found;

      // After a moment, check if content actually loaded; if not, render fallback
      setTimeout(() => {
        const ok = probeIframeLoaded(frame);
        if (!ok) {
          overlay.removeChild(frame);
          renderFallback(overlay);
        }
      }, 1200);
      return;
    }

    // If we couldn't find popup.html at all → render fallback immediately
    renderFallback(overlay);
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
