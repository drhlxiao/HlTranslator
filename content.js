(() => {
  let popup = null;
  let currentWord = '';
  let currentTranslation = '';
  let hideTimer = null;

  // ── Create popup DOM ──────────────────────────────────────────────────────
  function createPopup() {
    const el = document.createElement('div');
    el.id = 'de-en-popup';
    el.innerHTML = `
      <div class="dep-inner">
        <div class="dep-header">
          <span class="dep-lang-badge">DE</span>
          <span class="dep-arrow">→</span>
          <span class="dep-lang-badge en">EN</span>
          <button class="dep-close" title="Close">✕</button>
        </div>
        <div class="dep-word"></div>
        <div class="dep-divider"></div>
        <div class="dep-translation"></div>
        <div class="dep-hint">
          <span class="dep-key">Ctrl</span> to pronounce
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('.dep-close').addEventListener('click', hidePopup);
    el.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    el.addEventListener('mouseleave', () => scheduleHide(3000));

    return el;
  }

  function getPopup() {
    if (!popup || !document.body.contains(popup)) {
      popup = createPopup();
    }
    return popup;
  }

  // ── Position & show popup ─────────────────────────────────────────────────
  function showPopup(x, y, word, translation) {
    const el = getPopup();
    el.querySelector('.dep-word').textContent = word;
    el.querySelector('.dep-translation').textContent = translation;
    el.classList.remove('dep-visible', 'dep-loading', 'dep-error');

    // Position above click point
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.display = 'block';

    const rect = el.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const vw = window.innerWidth;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let left = x + scrollX - W / 2;
    let top = y + scrollY - H - 14;

    if (left < scrollX + 8) left = scrollX + 8;
    if (left + W > scrollX + vw - 8) left = scrollX + vw - W - 8;
    if (top < scrollY + 8) top = y + scrollY + 20;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.classList.add('dep-visible');

    scheduleHide(6000);
  }

  function showLoading(x, y, word) {
    const el = getPopup();
    el.querySelector('.dep-word').textContent = word;
    el.querySelector('.dep-translation').textContent = '';
    el.classList.remove('dep-visible', 'dep-error');
    el.classList.add('dep-loading');

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.display = 'block';

    const rect = el.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const vw = window.innerWidth;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let left = x + scrollX - W / 2;
    let top = y + scrollY - H - 14;
    if (left < scrollX + 8) left = scrollX + 8;
    if (left + W > scrollX + vw - 8) left = scrollX + vw - W - 8;
    if (top < scrollY + 8) top = y + scrollY + 20;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.classList.add('dep-visible');
  }

  function showError(msg) {
    const el = getPopup();
    el.querySelector('.dep-translation').textContent = msg;
    el.classList.remove('dep-loading');
    el.classList.add('dep-error', 'dep-visible');
    scheduleHide(4000);
  }

  function hidePopup() {
    clearTimeout(hideTimer);
    if (popup) {
      popup.classList.remove('dep-visible');
      setTimeout(() => {
        if (popup) popup.style.display = 'none';
      }, 200);
    }
  }

  function scheduleHide(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePopup, ms);
  }

  // ── Translation ───────────────────────────────────────────────────────────
  const cache = {};

  async function translate(word) {
    if (cache[word]) return cache[word];
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    const translation = data?.responseData?.translatedText;
    if (!translation || translation === word) throw new Error('No translation found');
    cache[word] = translation;
    return translation;
  }

  // ── Pronunciation ─────────────────────────────────────────────────────────
  function pronounce(word) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = 'de-DE';
    utter.rate = 0.9;

    // Prefer a German voice if available
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.startsWith('de'));
    if (germanVoice) utter.voice = germanVoice;

    // Flash the word in the popup
    const el = getPopup();
    el.classList.add('dep-speaking');
    utter.onend = () => el.classList.remove('dep-speaking');

    window.speechSynthesis.speak(utter);
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  document.addEventListener('dblclick', async (e) => {
    // Don't trigger inside our own popup
    if (popup && popup.contains(e.target)) return;

    const selection = window.getSelection();
    const word = (selection?.toString() || '').trim();
    if (!word || word.length > 60) return;

    currentWord = word;
    currentTranslation = '';

    showLoading(e.clientX, e.clientY, word);

    try {
      const translation = await translate(word);
      currentTranslation = translation;
      showPopup(e.clientX, e.clientY, word, translation);
    } catch (err) {
      showError('Translation unavailable');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' && currentWord) {
      clearTimeout(hideTimer);
      pronounce(currentWord);
      scheduleHide(5000);
    }
    if (e.key === 'Escape') {
      hidePopup();
    }
  });

  // Pre-load voices (required in some browsers)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  }
})();
