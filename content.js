(() => {
  let popup = null;
  let currentWord = '';
  let currentSourceLang = 'DE';
  let currentTranslation = '';
  let hideTimer = null;

  const SPEAKER_SVG = `
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3.5a.75.75 0 0 0-1.264-.545L5.203 6H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.203l3.533 3.045A.75.75 0 0 0 10 16.5V3.5zM14.4 6.175a.75.75 0 0 1 1.06.065A6.97 6.97 0 0 1 17 10a6.97 6.97 0 0 1-1.54 4.36.75.75 0 1 1-1.125-.994A5.47 5.47 0 0 0 15.5 10a5.47 5.47 0 0 0-1.165-3.366.75.75 0 0 1 .065-1.059zM12.2 8.43a.75.75 0 0 1 1.06.07A3.98 3.98 0 0 1 14.25 10a3.98 3.98 0 0 1-.99 2.6.75.75 0 1 1-1.13-.99A2.48 2.48 0 0 0 12.75 10a2.48 2.48 0 0 0-.62-1.51.75.75 0 0 1 .07-1.06z"/>
    </svg>`;

  const BOOKMARK_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>`;

  // ── Create popup DOM ──────────────────────────────────────────────────────
  function createPopup() {
    const el = document.createElement('div');
    el.id = 'de-en-popup';
    el.innerHTML = `
      <div class="dep-inner">
        <div class="dep-header">
          <span class="dep-lang-badge" id="dep-src-badge">DE</span>
          <span class="dep-arrow">→</span>
          <span class="dep-lang-badge en">EN</span>
          <button class="dep-close" title="Close">✕</button>
        </div>
        <div class="dep-word-row">
          <div class="dep-word"></div>
          <button class="dep-speak-btn" title="Pronounce (or press Ctrl)">${SPEAKER_SVG}</button>
          <button class="dep-bookmark-btn" title="Save to bookmarks">${BOOKMARK_SVG}</button>
        </div>
        <div class="dep-divider"></div>
        <div class="dep-translation"></div>
        <div class="dep-hint">
          <span class="dep-key">Ctrl</span> also pronounces
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('.dep-close').addEventListener('click', hidePopup);
    el.querySelector('.dep-speak-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentWord) {
        clearTimeout(hideTimer);
        pronounce(currentWord);
        scheduleHide(5000);
      }
    });
    el.querySelector('.dep-bookmark-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentWord && currentTranslation) {
        const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
        if (!bookmarks.find(b => b.w === currentWord)) {
          bookmarks.push({ 
            w: currentWord, 
            t: currentTranslation, 
            sl: currentSourceLang,
            d: new Date().toLocaleDateString() 
          });
          await chrome.storage.local.set({ bookmarks });
          el.querySelector('.dep-bookmark-btn').classList.add('active');
        }
      }
    });
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

  // ── Positioning helper ────────────────────────────────────────────────────
  function positionPopup(el, x, y) {
    // Set initial state to calculate dimensions without being seen
    el.style.display = 'block';
    el.style.visibility = 'hidden';

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
    el.style.visibility = 'visible';
  }

  // ── Show / hide ───────────────────────────────────────────────────────────
  function showPopup(x, y, word, translation) {
    const el = getPopup();
    el.querySelector('.dep-word').textContent = word;
    el.querySelector('.dep-translation').textContent = translation;
    el.querySelector('#dep-src-badge').textContent = currentSourceLang.toUpperCase();
    
    // Only add dep-visible AFTER positioning to trigger the entrance transition smoothly
    el.classList.remove('dep-loading', 'dep-error');
    el.querySelector('.dep-bookmark-btn').classList.remove('active');

    positionPopup(el, x, y);
    el.classList.add('dep-visible');
    scheduleHide(6000);
  }

  function showLoading(x, y, word) {
    const el = getPopup();
    el.querySelector('.dep-word').textContent = word;
    el.querySelector('.dep-translation').textContent = '';
    el.classList.remove('dep-error');
    el.classList.add('dep-loading');

    positionPopup(el, x, y);
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
      popup.style.display = 'none';
    }
  }

  function scheduleHide(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePopup, ms);
  }

  // ── Translation ───────────────────────────────────────────────────────────
  const cache = {};

  async function translate(word) {
    const { targetLang = 'en' } = await chrome.storage.local.get('targetLang');
    const cacheKey = `${word}:${targetLang}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=autodetect|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    const translation = data?.responseData?.translatedText;
    if (!translation || translation.toLowerCase() === word.toLowerCase()) throw new Error('No translation found');
    currentSourceLang = data?.responseData?.matchedLanguage || '??';
    cache[cacheKey] = translation;
    return translation;
  }

  // ── Pronunciation ─────────────────────────────────────────────────────────
  function pronounce(word) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = 'de-DE';
    utter.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.startsWith('de'));
    if (germanVoice) utter.voice = germanVoice;

    const el = getPopup();
    el.classList.add('dep-speaking');
    utter.onend = () => el.classList.remove('dep-speaking');
    utter.onerror = () => el.classList.remove('dep-speaking');

    window.speechSynthesis.speak(utter);
  }

  // ── Events ────────────────────────────────────────────────────────────────
  document.addEventListener('dblclick', async (e) => {
    if (popup && popup.contains(e.target)) return;

    const selection = window.getSelection();
    const word = (selection?.toString() || '').trim();
    if (!word || word.length > 80) return;

    currentWord = word;
    currentTranslation = '';
    showLoading(e.clientX, e.clientY, word);

    try {
      const translation = await translate(word);
      currentTranslation = translation;
      showPopup(e.clientX, e.clientY, word, translation);
    } catch {
      showError('Translation unavailable');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' && currentWord) {
      clearTimeout(hideTimer);
      pronounce(currentWord);
      scheduleHide(5000);
    }
    if (e.key === 'Escape') hidePopup();
  });

  // Pre-load voices
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  }
})();
