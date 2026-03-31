/* =============================================
   POLYFILLS (Safari/old Chromium)
   - NodeList.forEach (Safari <= 9)
   - Element.matches / Element.closest (Safari <= 9)
   ============================================= */
(function () {
  try {
    if (window.NodeList && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = Array.prototype.forEach;
    }
    if (window.Element && !Element.prototype.matches) {
      Element.prototype.matches =
        Element.prototype.msMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function (s) {
          const m = (this.document || this.ownerDocument).querySelectorAll(s);
          let i = 0;
          while (m[i] && m[i] !== this) i++;
          return !!m[i];
        };
    }
    if (window.Element && !Element.prototype.closest) {
      Element.prototype.closest = function (s) {
        let el = this;
        while (el && el.nodeType === 1) {
          if (el.matches(s)) return el;
          el = el.parentElement || el.parentNode;
        }
        return null;
      };
    }
  } catch (_) {}
})();

/* =============================================
   HEADER — стекло при скролле
   ============================================= */
window.addEventListener('scroll', () => {
  const header = document.getElementById('siteHeader');
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }
}, { passive: true });

/* =============================================
   Image download on click (no preview)
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const downloadImgs = document.querySelectorAll('.owner-img, .cta-img');

  const downloadImage = async (src) => {
    try {
      // Скачиваем как blob, чтобы не открывать превью/картинку в браузере
      const res = await fetch(src, { cache: 'no-store' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = src.split('/').pop() || 'image';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Отпускаем объект URL после старта скачивания
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (_) {
      // Фолбэк: если blob недоступен, откроем ссылку через download (в большинстве браузеров без предпросмотра)
      const a = document.createElement('a');
      a.href = src;
      a.download = src.split('/').pop() || 'image';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  downloadImgs.forEach((img) => {
    if (!img) return;
    img.style.cursor = 'pointer';
    img.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = img.currentSrc || img.src;
      if (src) await downloadImage(src);
    });
  });
});

/* =============================================
   MONITORING CAROUSEL — свайп, drag мышью, автопрокрутка 2,2 с
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('monitoringCarousel');
  const viewport = document.getElementById('monitoringCarouselViewport');
  const track = document.getElementById('monitoringFlowCards');
  const dotsEl = document.getElementById('monitoringCarouselDots');
  if (!root || !viewport || !track) return;

  const steps = Array.from(track.querySelectorAll('.flow-step'));
  if (steps.length === 0) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const AUTOPLAY_MS = 2200;
  const LONG_DELAY_SLIDE_INDEX = 3; // flow4
  const LONG_DELAY_MULTIPLIER = 2;

  if (mqReduce.matches) {
    root.classList.add('monitoring-carousel--static');
    return;
  }

  let index = 0;
  let slideWidth = 0;
  let autoplayTimer = null;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTranslate = 0;
  const mqMobileCarousel = window.matchMedia('(max-width: 700px)');
  let currentTranslate = 0;
  let resizeObs = null;
  let ioAutoplay = null;

  function stopAutoplay() {
    if (autoplayTimer != null) {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function autoplayDelayForCurrentSlide() {
    return index === LONG_DELAY_SLIDE_INDEX ? AUTOPLAY_MS * LONG_DELAY_MULTIPLIER : AUTOPLAY_MS;
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = window.setTimeout(function tick() {
      const next = index + 1 >= steps.length ? 0 : index + 1;
      goTo(next, true);
      autoplayTimer = window.setTimeout(tick, autoplayDelayForCurrentSlide());
    }, autoplayDelayForCurrentSlide());
  }

  function updateDots() {
    if (!dotsEl) return;
    dotsEl.querySelectorAll('.monitoring-carousel-dot').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === index);
      btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  }

  function carouselDotAriaLabel(i, total) {
    const lang = window.SiteI18n && window.SiteI18n.getLang ? window.SiteI18n.getLang() : 'ru';
    return lang === 'kk' ? `${i + 1}-слайд, барлығы ${total}` : `Слайд ${i + 1} из ${total}`;
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    steps.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'monitoring-carousel-dot';
      btn.setAttribute('aria-label', carouselDotAriaLabel(i, steps.length));
      btn.addEventListener('click', () => {
        goTo(i, true);
        stopAutoplay();
        startAutoplay();
      });
      dotsEl.appendChild(btn);
    });
    updateDots();
  }

  function goTo(i, animate) {
    if (slideWidth <= 0) return;
    index = Math.max(0, Math.min(steps.length - 1, i));
    const x = -index * slideWidth;
    currentTranslate = x;
    if (!animate) {
      track.style.transition = 'none';
    } else {
      track.style.transition = '';
    }
    track.style.transform = `translate3d(${x}px, 0, 0)`;
    updateDots();
    if (!animate) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          track.style.transition = '';
        });
      });
    }
  }

  function updateSlideWidths() {
    slideWidth = viewport.clientWidth;
    if (slideWidth <= 0) return;
    steps.forEach((s) => {
      s.style.width = `${slideWidth}px`;
      s.style.flex = `0 0 ${slideWidth}px`;
    });
    track.style.width = `${slideWidth * steps.length}px`;
    goTo(index, false);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    viewport.classList.add('is-dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartTranslate = -index * slideWidth;
    currentTranslate = dragStartTranslate;
    stopAutoplay();
    track.style.transition = 'none';
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (!dragging || slideWidth <= 0) return;
    const dx = e.clientX - dragStartX;
    let next = dragStartTranslate + dx;
    const min = -(steps.length - 1) * slideWidth;
    const max = 0;
    next = Math.max(min, Math.min(max, next));
    track.style.transform = `translate3d(${next}px, 0, 0)`;
    currentTranslate = next;
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    track.style.transition = '';
    if (slideWidth <= 0) {
      startAutoplay();
      return;
    }

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const TAP_MAX_PX = 18;

    /* Мобилка: лёгкий тап — левая половина экрана назад, правая вперёд (без длинного свайпа) */
    if (mqMobileCarousel.matches && Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX) {
      const rect = viewport.getBoundingClientRect();
      const rel = e.clientX - rect.left;
      const dir = rel < rect.width / 2 ? -1 : 1;
      const next = Math.max(0, Math.min(steps.length - 1, index + dir));
      goTo(next, true);
      startAutoplay();
      return;
    }

    /* Чувствительнее, чем «половина слайда»: ~16% ширины достаточно для смены слайда */
    const swipePx = slideWidth * 0.16;
    let snapped;
    if (dx < -swipePx) {
      snapped = Math.min(steps.length - 1, index + 1);
    } else if (dx > swipePx) {
      snapped = Math.max(0, index - 1);
    } else {
      snapped = Math.round(-currentTranslate / slideWidth);
    }
    goTo(Math.max(0, Math.min(steps.length - 1, snapped)), true);
    startAutoplay();
  }

  buildDots();
  updateSlideWidths();

  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => {
      updateSlideWidths();
    });
    resizeObs.observe(viewport);
  } else {
    window.addEventListener('resize', updateSlideWidths, { passive: true });
  }

  ioAutoplay = new IntersectionObserver(
    (entries) => {
      const vis = entries[0] && entries[0].isIntersecting;
      if (vis) startAutoplay();
      else stopAutoplay();
    },
    { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
  );
  ioAutoplay.observe(root);

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);

  mqReduce.addEventListener('change', () => {
    if (mqReduce.matches) {
      stopAutoplay();
      root.classList.add('monitoring-carousel--static');
      if (resizeObs) {
        resizeObs.disconnect();
        resizeObs = null;
      }
      if (ioAutoplay) {
        ioAutoplay.disconnect();
        ioAutoplay = null;
      }
    } else {
      root.classList.remove('monitoring-carousel--static');
      updateSlideWidths();
      ioAutoplay = new IntersectionObserver(
        (entries) => {
          const vis = entries[0] && entries[0].isIntersecting;
          if (vis) startAutoplay();
          else stopAutoplay();
        },
        { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
      );
      ioAutoplay.observe(root);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(() => updateSlideWidths());
        resizeObs.observe(viewport);
      }
    }
  });

  document.addEventListener('siteLangChange', () => {
    if (!dotsEl) return;
    dotsEl.querySelectorAll('.monitoring-carousel-dot').forEach((btn, i) => {
      btn.setAttribute('aria-label', carouselDotAriaLabel(i, steps.length));
    });
  });
});

/* =============================================
   STATS SHOWCASE — counters + reveal
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.stats-showcase-section');
  const items = Array.from(document.querySelectorAll('.stats-showcase-item'));
  if (!section || !items.length) return;

  const DEFAULT_DURATION_MS = 1000; /* медленнее для остальных чисел; отдельные data-duration сохраняются */

  const animateCounter = (el) => new Promise((resolve) => {
    if (!el || el.dataset.countDone === '1') {
      resolve();
      return;
    }
    el.dataset.countDone = '1';

    const target = Number(el.dataset.target || 0);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const customMs = Number(el.dataset.duration);
    const duration =
      Number.isFinite(customMs) && customMs > 0 ? Math.max(1, customMs / 2) : DEFAULT_DURATION_MS;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ускорение по мере роста числа
      const eased = 1 - Math.pow(1 - t, 2.35);
      const val = Math.round(target * eased);
      el.textContent = `${prefix}${val}${suffix}`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });

  // Десктоп и мобила: по одному блоку — сначала появление, затем счётчик, потом следующий
  const sectionObserver = new IntersectionObserver((entries, obs) => {
    const entry = entries[0];
    if (!entry || !entry.isIntersecting) return;

    (async () => {
      for (const item of items) {
        item.classList.add('is-visible');
        const counter = item.querySelector('.stats-showcase-num[data-counter]');
        if (counter) {
          await animateCounter(counter);
        }
      }
    })();

    obs.unobserve(section);
  }, { threshold: 0.22, rootMargin: '0px 0px -10% 0px' });

  sectionObserver.observe(section);
});

// Стеклянность хедера: плавный прогресс эффекта на участке перед концом hero.
let heroBottom = 0;
const GLASS_START_OFFSET = 220;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function updateHeroBottom() {
  const hero = document.querySelector('.hero--video');
  if (!hero) return;
  heroBottom = hero.offsetTop + hero.offsetHeight;
}

function updateHeaderGlassProgress() {
  const header = document.getElementById('siteHeader');
  if (!header || !heroBottom) return;
  if (document.body && document.body.classList.contains('single-video-page')) {
    header.style.background = 'transparent';
    header.style.backdropFilter = 'none';
    header.style.webkitBackdropFilter = 'none';
    return;
  }
  header.style.background = '#000';
  header.style.backdropFilter = 'none';
  header.style.webkitBackdropFilter = 'none';
}

/**
 * После полного прохолжения 2-го блока (.law-section) кнопка в шапке — бордовая с белым текстом.
 * Класс не снимается при возврате к 1-му блоку; после перезагрузки страницы снова стандартный вид.
 */
function updateHeaderCtaAfterSecondBlock() {
  const btn = document.querySelector('.site-header .btn-header--cta');
  const law = document.querySelector('.law-section');
  if (!btn || !law) return;
  if (btn.classList.contains('btn-header--solid')) return;
  const rect = law.getBoundingClientRect();
  if (rect.bottom <= 0) {
    btn.classList.add('btn-header--solid');
  }
}

updateHeroBottom();
updateHeaderGlassProgress();
updateHeaderCtaAfterSecondBlock();
window.addEventListener('resize', () => {
  updateHeroBottom();
  updateHeaderGlassProgress();
  updateHeaderCtaAfterSecondBlock();
}, { passive: true });
window.addEventListener('scroll', () => {
  updateHeaderGlassProgress();
  updateHeaderCtaAfterSecondBlock();
}, { passive: true });
window.addEventListener('load', updateHeaderCtaAfterSecondBlock);
window.addEventListener('pageshow', updateHeaderCtaAfterSecondBlock);

/* =============================================
   HERO VIDEO — автозапуск на мобиле
   ============================================= */
(function () {
  const tryPlayHero = () => {
    const v = document.querySelector('.hero-video');
    if (!v) return;
    if (typeof v.play !== 'function') return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryPlayHero);
  } else {
    tryPlayHero();
  }

  // Если автозапуск блокируется, повторяем после жеста пользователя
  document.addEventListener('touchstart', tryPlayHero, { passive: true, once: true });
  document.addEventListener('click', tryPlayHero, { passive: true, once: true });
})();

/* =============================================
   MOBILE LOADING OVERLAY + REALISH PROGRESS
   (быстрый выход; к скрытию оверлея hero-видео уже в playback, насколько позволяет браузер)
   ============================================= */
(function () {
  const mqMobile = window.matchMedia('(max-width: 700px)');
  if (!mqMobile.matches) return;

  const overlay = document.getElementById('siteLoadingOverlay');
  const percentNum = document.getElementById('siteLoadingPercentNum');
  if (!overlay || !percentNum) return;

  let displayedPercent = 0;
  let timeoutId = null;
  let safetyTimeoutId = null;
  let imageStallId = null;
  let fontStallId = null;
  let videoBufFallbackId = null;
  let videoPlayFallbackId = null;
  let targetPercent = 0;

  let loadedImages = 0;
  let totalImages = 1;
  let fontsReady = false;
  /** Достаточно данных для отображения кадра (canplay / loadeddata) — вес в прогресс-баре */
  let videoBuffered = false;
  /** Реальное воспроизведение — условие снятия оверлея (или таймаут ниже) */
  let heroVideoPlaying = false;
  let isDone = false;

  // Быстрее тики счётчика %
  const START_DELAY_MS = 4;
  const END_DELAY_MS = 2;

  const calcDelay = (p) => {
    const t = Math.max(0, Math.min(100, p)) / 100; // 0..1
    return Math.max(2, Math.round(START_DELAY_MS - (START_DELAY_MS - END_DELAY_MS) * t));
  };

  const setDisplayedPercent = (p) => {
    displayedPercent = Math.max(0, Math.min(100, p));
    percentNum.textContent = String(displayedPercent);
  };

  /** Веса: видео — приоритет (1-й экран), картинки и шрифты не блокируют надолго */
  const W_IMG = 0.30;
  const W_FONT = 0.08;
  const W_VID = 0.62;

  const computeRealState = () => {
    const imgPart = totalImages > 0 ? loadedImages / totalImages : 1;
    const fontPart = fontsReady ? 1 : 0;
    const videoPart = videoBuffered ? 1 : 0;
    const overall = Math.min(1, imgPart * W_IMG + fontPart * W_FONT + videoPart * W_VID);
    const realPercent = Math.floor(overall * 100);
    isDone = imgPart >= 1 && fontsReady && heroVideoPlaying;
    return { realPercent, imgPart, isDone };
  };

  const doHideAndPlayFromStart = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (safetyTimeoutId != null) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
    }
    if (imageStallId != null) {
      clearTimeout(imageStallId);
      imageStallId = null;
    }
    if (fontStallId != null) {
      clearTimeout(fontStallId);
      fontStallId = null;
    }
    if (videoBufFallbackId != null) {
      clearTimeout(videoBufFallbackId);
      videoBufFallbackId = null;
    }
    if (videoPlayFallbackId != null) {
      clearTimeout(videoPlayFallbackId);
      videoPlayFallbackId = null;
    }
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    const v2 = document.querySelector('.hero-video');
    const isVideoEl = v2 && (v2.tagName === 'VIDEO' || typeof v2.play === 'function');
    if (isVideoEl) {
      v2.loop = true;
      // На iOS/Android autoplay иногда требует повторных попыток.
      // Мы пробуем включить play несколько раз, пока не появится состояние "playing".
      v2.muted = true;
      try { v2.playsInline = true; } catch (_) {}

      let attempts = 0;
      const MAX_ATTEMPTS = 30;
      const RETRY_MS = 120;

      const tryPlay = () => {
        attempts++;
        // Если уже играет — прекращаем.
        if (!v2.paused && !v2.ended) return;

        const p = v2.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }

        if (attempts < MAX_ATTEMPTS) {
          window.setTimeout(tryPlay, RETRY_MS);
        }
      };

      // Первый запуск сразу после скрытия оверлея.
      tryPlay();

      // Если iOS всё равно не разрешил autoplay — попробуем ещё раз на следующем таче.
      // Это гарантирует запуск при любом касании экрана, а не только на "play" иконке.
      window.addEventListener('touchstart', () => {
        if (!v2.paused && !v2.ended) return;
        try { v2.play().catch(() => {}); } catch (_) {}
      }, { passive: true, once: true });
    }
  };

  const update = () => {
    const imgPart = totalImages > 0 ? loadedImages / totalImages : 1;
    const fontPart = fontsReady ? 1 : 0;
    const videoPart = videoBuffered ? 1 : 0;
    const overall = Math.min(1, imgPart * W_IMG + fontPart * W_FONT + videoPart * W_VID);
    const p = Math.floor(overall * 100);
    const state = computeRealState();
    isDone = state.isDone;
    targetPercent = Math.max(targetPercent, p);
  };

  const show = () => {
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setDisplayedPercent(0);
  };

  const init = () => {
    const startLoadingUi = () => {
    show();

    // Не трогаем видео принудительно: полагаемся на autoplay (muted + playsinline).
    // На некоторых моб. браузерах принудительная pause может сломать autoplay до user-gesture.
    const v = document.querySelector('.hero-video');
    const isHeroVideo = v && (v.tagName === 'VIDEO' || typeof v.play === 'function');
    if (isHeroVideo) {
      v.loop = true;
      v.muted = true;
      try { v.playsInline = true; } catch (_) {}

      // Доп. попытки запуска, пока показываем оверлей.
      // На некоторых моб. браузерах autoplay может сработать только при нескольких попытках подряд.
      let attempts = 0;
      const MAX_ATTEMPTS = 32;
      const RETRY_MS = 100;
      const tryPlay = () => {
        attempts++;
        if (!v.paused && !v.ended) return;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        if (attempts < MAX_ATTEMPTS) window.setTimeout(tryPlay, RETRY_MS);
      };
      tryPlay();
    } else {
      // Hero — не видео (картинка). Не блокируем загрузку на "video"-части.
      videoBuffered = true;
      heroVideoPlaying = true;
    }

    // Images progress: не ждём lazy — они могут не грузиться до скролла и «вешают» прогресс на ~97%.
    const imgs = Array.from(document.images).filter((img) => {
      if (!img.src || img.src.startsWith('data:')) return false;
      if (img.getAttribute('loading') === 'lazy') return false;
      return true;
    });
    totalImages = imgs.length;
    loadedImages = 0;

    const markImg = () => {
      if (totalImages <= 0) return;
      loadedImages++;
      if (loadedImages > totalImages) loadedImages = totalImages;
      update();
    };

    imgs.forEach((img) => {
      if (img.complete) return markImg();
      img.addEventListener('load', markImg, { once: true });
      img.addEventListener('error', markImg, { once: true });
    });

    // Fonts: не держим оверлей из‑за шрифтов
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        fontsReady = true;
        update();
      }).catch(() => {
        fontsReady = true;
        update();
      });
    } else {
      fontsReady = true;
    }
    fontStallId = window.setTimeout(() => {
      fontStallId = null;
      if (!fontsReady) {
        fontsReady = true;
        update();
      }
    }, 380);

    // Картинки: не ждём «вечный хвост» ниже экрана
    imageStallId = window.setTimeout(() => {
      imageStallId = null;
      if (totalImages > 0 && loadedImages < totalImages) {
        loadedImages = totalImages;
        update();
      }
    }, 2200);

    // Видео: буфер для %; «playing» — для снятия оверлея
    const v2 = document.querySelector('.hero-video');
    const isVideoEl2 = v2 && (v2.tagName === 'VIDEO' || typeof v2.play === 'function');

    const markVideoBuffered = () => {
      if (videoBufFallbackId != null) {
        clearTimeout(videoBufFallbackId);
        videoBufFallbackId = null;
      }
      if (!videoBuffered) {
        videoBuffered = true;
        update();
      }
    };

    const markHeroPlaying = () => {
      if (videoPlayFallbackId != null) {
        clearTimeout(videoPlayFallbackId);
        videoPlayFallbackId = null;
      }
      if (!heroVideoPlaying) {
        heroVideoPlaying = true;
        update();
      }
    };

    if (isVideoEl2) {
      if (v2.readyState >= 2) {
        videoBuffered = true;
      }
      if (!v2.paused && !v2.ended) {
        heroVideoPlaying = true;
      }

      v2.addEventListener('playing', markHeroPlaying, { once: true });
      v2.addEventListener('loadeddata', markVideoBuffered, { once: true });
      v2.addEventListener('canplay', markVideoBuffered, { once: true });
      v2.addEventListener('error', () => {
        markVideoBuffered();
        markHeroPlaying();
      }, { once: true });

      // буфер: если события задержались
      videoBufFallbackId = window.setTimeout(() => {
        videoBufFallbackId = null;
        markVideoBuffered();
      }, 4200);

      // воспроизведение: если autoplay упирается в политику — не висим вечно
      videoPlayFallbackId = window.setTimeout(() => {
        videoPlayFallbackId = null;
        markHeroPlaying();
      }, 4200);
    } else {
      videoBuffered = true;
      heroVideoPlaying = true;
    }

    update();

    // Абсолютная страховка: никогда не оставляем оверлей навсегда
    safetyTimeoutId = window.setTimeout(() => {
      safetyTimeoutId = null;
      if (!overlay.classList.contains('show')) return;
      targetPercent = 100;
      fontsReady = true;
      videoBuffered = true;
      heroVideoPlaying = true;
      if (totalImages > 0) loadedImages = totalImages;
      update();
      setDisplayedPercent(100);
      doHideAndPlayFromStart();
    }, 7200);

    const tick = () => {
      timeoutId = null;

      const maxP = Math.min(100, targetPercent);
      if (displayedPercent < maxP) {
        setDisplayedPercent(displayedPercent + 1);
      } else if (isDone && displayedPercent >= 100) {
        // Готово: скрываем оверлей и запускаем видео.
        doHideAndPlayFromStart();
        return;
      }

      // Планируем следующий тик с уменьшающейся задержкой.
      timeoutId = window.setTimeout(tick, calcDelay(displayedPercent));
    };

    timeoutId = window.setTimeout(tick, calcDelay(displayedPercent));
    };

    /* Оверлей с процентами — только после Playfair (как у hero), иначе сначала Arial. Макс. ожидание 900 ms. */
    const fontWait =
      document.fonts && document.fonts.load
        ? document.fonts.load('500 80px PlayfairDisplay').catch(() => {})
        : Promise.resolve();
    Promise.race([fontWait, new Promise((r) => setTimeout(r, 900))]).then(() => {
      startLoadingUi();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* =============================================
   QUIZ MODAL
   ============================================= */
let currentStep = 1;
const TOTAL_STEPS = 5;
const answers = {};
let lastProgressPercent = 0;

/** Черновик квиза (шаги 1–6, форма) — для возврата с legal-страниц в новой вкладке */
try {
  document.documentElement.classList.add('js');
} catch (_) {}

const QUIZ_DRAFT_KEY = 'mainur_quiz_draft_v1';
const QUIZ_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 ч

function quizCloneAnswers() {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(answers)
      : JSON.parse(JSON.stringify(answers));
  } catch (_) {
    return { ...answers };
  }
}

function quizSerializeContactForm() {
  const form = document.querySelector('.q-contact-form');
  if (!form) return {};
  let fd;
  try {
    fd = new FormData(form);
  } catch (_) {
    return {};
  }
  return {
    name: (fd.get('name') || '').toString(),
    phone: (fd.get('phone') || '').toString(),
    city: (fd.get('city') || '').toString(),
  };
}

function quizSaveDraft() {
  try {
    const modal = document.getElementById('quizModal');
    if (!modal || !modal.classList.contains('open')) return;
    const payload = {
      answers: quizCloneAnswers(),
      currentStep,
      form: quizSerializeContactForm(),
      t: Date.now(),
    };
    localStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function quizClearDraft() {
  try {
    localStorage.removeItem(QUIZ_DRAFT_KEY);
  } catch (_) {}
}

function quizApplySelectedFromAnswers() {
  document.querySelectorAll('.q-opt').forEach((btn) => {
    const st = btn.dataset.step;
    const val = btn.dataset.val;
    if (!st || val == null) return;
    const raw = answers[st];
    let sel = false;
    if (Array.isArray(raw)) sel = raw.includes(val);
    else if (raw !== undefined && raw !== null) sel = String(raw) === String(val);
    btn.classList.toggle('selected', !!sel);
  });
  const q1Other = document.getElementById('q1OtherWrap');
  const q1Inp = document.getElementById('q1OtherInput');
  if (answers[1] === 'other' && q1Other && q1Inp) {
    q1Other.classList.remove('q-other-field--hidden');
    q1Inp.value = answers['1_other'] || '';
    q1Inp.classList.remove('q-other-input--invalid');
  } else if (q1Other && q1Inp) {
    q1Other.classList.add('q-other-field--hidden');
    q1Inp.value = '';
    q1Inp.classList.remove('q-other-input--invalid');
  }
  const q3Other = document.getElementById('q3OtherWrap');
  const q3Inp = document.getElementById('q3OtherInput');
  const a3 = answers[3];
  const has3other = Array.isArray(a3) && a3.includes('other');
  if (has3other && q3Other && q3Inp) {
    q3Other.classList.remove('q-other-field--hidden');
    q3Inp.value = answers['3_other'] || '';
    q3Inp.classList.remove('q-other-input--invalid');
  } else if (q3Other && q3Inp) {
    q3Other.classList.add('q-other-field--hidden');
    q3Inp.value = '';
    q3Inp.classList.remove('q-other-input--invalid');
  }

  // Шаг 3: блокировка «Свой вариант», если выбраны первые варианты
  const firstVals = ['san_tax', 'suppliers', 'guests_hr'];
  const anyFirstSelected = Array.isArray(a3) && a3.some((v) => firstVals.includes(String(v)));
  const otherBtn = document.querySelector('.q-opt.multi[data-step="3"][data-val="other"]');
  if (otherBtn) {
    otherBtn.disabled = !!anyFirstSelected;
    otherBtn.setAttribute('aria-disabled', anyFirstSelected ? 'true' : 'false');
  }
}

/** Восстанавливает ответы и поля формы из localStorage. Не меняет видимый шаг — вызывайте showStep(6) после. */
function quizApplyDraft() {
  try {
    const raw = localStorage.getItem(QUIZ_DRAFT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      quizClearDraft();
      return false;
    }
    const t = data.t || 0;
    if (Date.now() - t > QUIZ_DRAFT_MAX_AGE_MS) {
      quizClearDraft();
      return false;
    }
    Object.keys(answers).forEach((k) => delete answers[k]);
    const saved = data.answers;
    if (saved && typeof saved === 'object') Object.assign(answers, saved);
    quizApplySelectedFromAnswers();

    const form = document.querySelector('.q-contact-form');
    const f = data.form || {};
    if (form) {
      const nameEl = form.querySelector('[name="name"]');
      const phoneEl = form.querySelector('[name="phone"]');
      const cityEl = form.querySelector('[name="city"]');
      if (nameEl && f.name != null) nameEl.value = f.name;
      if (phoneEl && f.phone != null) phoneEl.value = f.phone;
      if (cityEl && f.city != null) cityEl.value = f.city;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function quizGetDraftStep() {
  try {
    const raw = localStorage.getItem(QUIZ_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const st = Number(data && data.currentStep);
    if (!Number.isFinite(st) || st < 1 || st > TOTAL_STEPS + 1) return null;
    return st;
  } catch (_) {
    return null;
  }
}

function resetQuizToEmptyContactStep() {
  Object.keys(answers).forEach((k) => delete answers[k]);
  document.querySelectorAll('.q-opt.selected').forEach((b) => b.classList.remove('selected'));
  const form = document.querySelector('.q-contact-form');
  if (form) form.reset();
  const q1Other = document.getElementById('q1OtherWrap');
  const q1Inp = document.getElementById('q1OtherInput');
  if (q1Other) q1Other.classList.add('q-other-field--hidden');
  if (q1Inp) {
    q1Inp.value = '';
    q1Inp.classList.remove('q-other-input--invalid');
  }
  const q3Other = document.getElementById('q3OtherWrap');
  const q3Inp = document.getElementById('q3OtherInput');
  if (q3Other) q3Other.classList.add('q-other-field--hidden');
  if (q3Inp) {
    q3Inp.value = '';
    q3Inp.classList.remove('q-other-input--invalid');
  }
}

/** Ссылка на WhatsApp (LinkTwin) — кнопка «Связаться вне очереди» после шага «Отлично!…» */
const WHATSAPP_QUIZ_URL = 'https://linktw.in/ocjIoY';

/** Прокси на Vercel (без CORS): POST JSON { text } → пересылает в Telegram */
const TELEGRAM_PROXY_URL = '/api/send-telegram';

function getQuizStepQuestionTitle(stepNum) {
  const stepEl = document.getElementById(`step${stepNum}`);
  if (!stepEl) return `Вопрос ${stepNum}`;
  const h3 = stepEl.querySelector('h3');
  if (!h3) return `Вопрос ${stepNum}`;
  return h3.textContent.replace(/\s+/g, ' ').trim();
}

function getQuizOptionLabel(step, val) {
  const list = document.querySelectorAll(`.q-opt[data-step="${step}"]`);
  const btn = Array.from(list).find((b) => b.dataset.val === String(val));
  if (!btn) return val;
  return btn.textContent.replace(/\s+/g, ' ').trim();
}

function formatQuizAnswerForStep(step) {
  const raw = answers[step];
  if (raw == null || raw === '') return '—';
  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—';
    const kk = typeof window !== 'undefined' && window.SiteI18n && window.SiteI18n.getLang() === 'kk';
    return raw
      .map((v) => {
        if (step === 3 && v === 'other') {
          const el = document.getElementById('q3OtherInput');
          const detail = (answers['3_other'] || (el && el.value) || '').trim();
          if (detail) return kk ? `Өз нұсқа: ${detail}` : `Свой вариант: ${detail}`;
          return kk ? 'Өз нұсқа (көрсетілмеген)' : 'Свой вариант (не указано)';
        }
        return getQuizOptionLabel(step, v);
      })
      .join(', ');
  }
  if (step === 1 && raw === 'other') {
    const el = document.getElementById('q1OtherInput');
    const detail = (answers['1_other'] || (el && el.value) || '').trim();
    const kk = typeof window !== 'undefined' && window.SiteI18n && window.SiteI18n.getLang() === 'kk';
    if (detail) return kk ? `Басқа: ${detail}` : `Другое: ${detail}`;
    return kk ? 'Басқа (көрсетілмеген)' : 'Другое (не указано)';
  }
  return getQuizOptionLabel(step, raw);
}

/** Текст заявки для Telegram (plain text, все шаги квиза + контакты). */
function buildTelegramLeadMessage(form) {
  const fd = new FormData(form);
  const name = (fd.get('name') || '').toString().trim();
  const phone = (fd.get('phone') || '').toString().trim();
  const city = (fd.get('city') || '').toString().trim();

  const contactBlock = `👤 Имя: ${name}\n📞 Телефон: ${phone}\n📍 Город: ${city}`;

  const qaLines = [];
  for (let s = 1; s <= TOTAL_STEPS; s++) {
    const qTitle = getQuizStepQuestionTitle(s);
    const ans = formatQuizAnswerForStep(s);
    qaLines.push(`${qTitle}: ${ans}`);
  }
  const answersBlock = qaLines.join('\n\n');

  return (
    `🔔 Новая заявка с сайта!\n\n` +
    `${contactBlock}\n\n` +
    `📋 Ответы на вопросы:\n\n` +
    answersBlock
  );
}

/**
 * Отправка заявки через прокси Vercel (без CORS).
 */
async function sendQuizLeadToTelegram(form) {
  const text = buildTelegramLeadMessage(form);
  const res = await fetch(TELEGRAM_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.ok !== true) {
    const desc = (data && data.description) || data.error || res.statusText;
    throw new Error(`Telegram proxy: ${res.status} ${desc}`);
  }
  return true;
}

/* =============================================
   QUIZ — priority timer (03:00 → 00:00)
   - starts when quiz opens
   - pauses when quiz closes (keeps remaining)
   - resets on page reload (no persistence)
   - first minute is accelerated: 03:00 → 02:00 in 30s real time
   ============================================= */
let quizPriorityRemainingMs = 3 * 60 * 1000; // 03:00
let quizPriorityLastTs = 0;
let quizPriorityRaf = null;
let quizPriorityExpired = false;
let quizPriorityLastShakeAt = null; // marker in seconds
const QUIZ_PRIORITY_STATE_KEY = 'mainur_quiz_priority_state_v1';

function getNavType() {
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation');
    const entry = nav && nav[0];
    return (entry && entry.type) || 'navigate';
  } catch (_) {
    return 'navigate';
  }
}

function quizPriorityPersist() {
  try {
    const modal = document.getElementById('quizModal');
    if (!modal || !modal.classList.contains('open')) return;
    const payload = {
      remainingMs: Math.max(0, Math.round(quizPriorityRemainingMs)),
      expired: !!quizPriorityExpired,
      t: Date.now(),
    };
    localStorage.setItem(QUIZ_PRIORITY_STATE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function quizPriorityRestoreIfNeeded() {
  try {
    // По ТЗ раньше таймер сбрасывался при reload. Сохраняем это поведение:
    // при обычном обновлении страницы игнорируем сохранённое состояние.
    if (getNavType() === 'reload') {
      localStorage.removeItem(QUIZ_PRIORITY_STATE_KEY);
      return false;
    }

    const raw = localStorage.getItem(QUIZ_PRIORITY_STATE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const ms = Number(data && data.remainingMs);
    if (!Number.isFinite(ms) || ms < 0 || ms > 3 * 60 * 1000) return false;
    quizPriorityRemainingMs = ms;
    quizPriorityExpired = !!(data && data.expired);
    quizPriorityLastTs = 0;
    quizPriorityRender();
    return true;
  } catch (_) {
    return false;
  }
}

function formatMmSs(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function quizPriorityRender() {
  const labelHtml = (window.SiteI18n && window.SiteI18n.STRINGS)
    ? ((() => {
        const lang = window.SiteI18n.getLang ? window.SiteI18n.getLang() : 'ru';
        const dict = (window.SiteI18n.STRINGS && window.SiteI18n.STRINGS[lang]) || window.SiteI18n.STRINGS.ru || {};
        return quizPriorityExpired
          ? (dict.q_timer_expired || 'Бонус PDF 11 штрафов <span class="q-timer-accent">недоступен.</span>')
          : (dict.q_timer_label || '<span class="q-timer-accent">Сгорает</span>: <span class="q-timer-muted">PDF 11 актуальных штрафов 2026</span>');
      })())
    : (quizPriorityExpired
        ? 'Бонус PDF 11 штрафов <span class="q-timer-accent">недоступен.</span>'
        : '<span class="q-timer-accent">Сгорает</span>: <span class="q-timer-muted">PDF 11 актуальных штрафов 2026</span>');
  const time = quizPriorityExpired ? '00:00' : formatMmSs(quizPriorityRemainingMs);

  document.querySelectorAll('.q-timer').forEach((wrap) => {
    wrap.classList.toggle('is-expired', quizPriorityExpired);
  });

  document.querySelectorAll('.js-q-timer-label').forEach((el) => {
    el.innerHTML = labelHtml;
  });
  document.querySelectorAll('.js-q-timer-time').forEach((el) => {
    el.textContent = time;
  });
}

function quizPriorityShakeIfNeeded() {
  // Shake at exact marks: 02:30 / 02:00 / 01:30 / 01:00 / 00:30 / 00:00
  const marksSec = [150, 120, 90, 60, 30, 0];
  const curSec = Math.max(0, Math.ceil(quizPriorityRemainingMs / 1000));

  // Trigger only once per mark.
  let should = false;
  for (let i = 0; i < marksSec.length; i++) {
    if (curSec === marksSec[i]) { should = true; break; }
  }
  if (!should || quizPriorityLastShakeAt === curSec) return;
  quizPriorityLastShakeAt = curSec;

  document.querySelectorAll('.q-timer').forEach((wrap) => {
    wrap.classList.remove('q-timer--shake');
    // Force reflow to restart animation reliably
    void wrap.offsetWidth;
    wrap.classList.add('q-timer--shake');
  });
}

function quizPriorityStep(now) {
  if (quizPriorityExpired) return;

  if (!quizPriorityLastTs) quizPriorityLastTs = now;
  let dt = now - quizPriorityLastTs;
  quizPriorityLastTs = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;

  // Accelerated zone: only while remaining > 02:00
  const THRESHOLD_MS = 2 * 60 * 1000; // 02:00
  if (quizPriorityRemainingMs > THRESHOLD_MS) {
    const toThresholdDisplay = quizPriorityRemainingMs - THRESHOLD_MS;
    const toThresholdReal = toThresholdDisplay / 2; // 2× speed
    if (dt <= toThresholdReal) {
      quizPriorityRemainingMs -= dt * 2;
      dt = 0;
    } else {
      quizPriorityRemainingMs = THRESHOLD_MS;
      dt -= toThresholdReal;
    }
  }

  // Normal zone
  if (dt > 0) {
    quizPriorityRemainingMs -= dt;
  }

  if (quizPriorityRemainingMs <= 0) {
    quizPriorityRemainingMs = 0;
    quizPriorityExpired = true;
  }

  quizPriorityRender();
  quizPriorityShakeIfNeeded();
}

function quizPriorityStart() {
  const modal = document.getElementById('quizModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (quizPriorityRaf != null) return; // already running

  // Если вернулись со страницы политики — восстановить значение, если оно сохранено.
  quizPriorityRestoreIfNeeded();
  quizPriorityLastTs = 0;
  quizPriorityLastShakeAt = null;
  quizPriorityRender();
  quizPriorityShakeIfNeeded();

  const loop = (now) => {
    const m = document.getElementById('quizModal');
    if (!m || !m.classList.contains('open')) {
      quizPriorityRaf = null;
      quizPriorityLastTs = 0;
      return;
    }
    quizPriorityStep(now);
    if (!quizPriorityExpired) {
      quizPriorityRaf = requestAnimationFrame(loop);
    } else {
      quizPriorityRaf = null;
      quizPriorityLastTs = 0;
    }
  };

  quizPriorityRaf = requestAnimationFrame(loop);
}

function quizPriorityStop() {
  if (quizPriorityRaf != null) {
    cancelAnimationFrame(quizPriorityRaf);
    quizPriorityRaf = null;
  }
  quizPriorityLastTs = 0;
  quizPriorityPersist();
  quizPriorityRender();
}

function openModal() {
  // Компенсируем ширину скроллбара, чтобы страница не прыгала
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbarWidth + 'px';
  document.getElementById('siteHeader').style.paddingRight = scrollbarWidth + 'px';
  document.body.style.overflow = 'hidden';

  document.getElementById('quizModal').classList.add('open');
  quizPriorityStart();
  // Сразу показываем квиз
  document.getElementById('quizFormScreen').classList.remove('hidden');
  document.getElementById('quizSuccess').classList.add('hidden');
  const qc = document.querySelector('.quiz-modal .quiz-container');
  if (qc) qc.scrollTop = 0;

  // Если есть черновик (например, пользователь закрыл квиз / переключил язык),
  // продолжаем с текущего шага. Иначе — начинаем с начала.
  lastProgressPercent = 0;
  const restored = quizApplyDraft();
  const draftStep = restored ? quizGetDraftStep() : null;
  if (restored && draftStep) {
    currentStep = draftStep;
    showStep(draftStep);
  } else {
    currentStep = 1;
    showStep(1);
    Object.keys(answers).forEach((k) => delete answers[k]);
    document.querySelectorAll('.q-opt.selected').forEach(b => b.classList.remove('selected'));
    const q1Other = document.getElementById('q1OtherWrap');
    const q1Inp = document.getElementById('q1OtherInput');
    if (q1Other) q1Other.classList.add('q-other-field--hidden');
    if (q1Inp) {
      q1Inp.value = '';
      q1Inp.classList.remove('q-other-input--invalid');
    }
    const q3Other = document.getElementById('q3OtherWrap');
    const q3Inp = document.getElementById('q3OtherInput');
    if (q3Other) q3Other.classList.add('q-other-field--hidden');
    if (q3Inp) {
      q3Inp.value = '';
      q3Inp.classList.remove('q-other-input--invalid');
    }
  }
}

function closeModal() {
  document.getElementById('quizModal').classList.remove('open');
  quizPriorityStop();
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.getElementById('siteHeader').style.paddingRight = '';
}

// Inline onclick in HTML expects globals (Safari-safe).
try {
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openQuizContact = openQuizContact;
  window.prevStep = prevStep;
  window.nextStep = nextStep;
  window.submitQuizLastStep = submitQuizLastStep;
} catch (_) {}

/**
 * Открыть квиз на шаге контактов (шаг 6).
 * @param {Event|null} e
 * @param {{ fromLegal?: boolean }} [options] — с legal-страниц: восстановить черновик из localStorage
 */
function openQuizContact(e, options) {
  if (e && e.preventDefault) e.preventDefault();
  const fromLegal = options && options.fromLegal;

  // Открываем модалку, но НЕ вызываем openModal(),
  // чтобы не было автосброса на шаг 1.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbarWidth + 'px';
  document.getElementById('siteHeader').style.paddingRight = scrollbarWidth + 'px';
  document.body.style.overflow = 'hidden';

  document.getElementById('quizModal').classList.add('open');
  quizPriorityStart();
  document.getElementById('quizFormScreen').classList.remove('hidden');
  document.getElementById('quizSuccess').classList.add('hidden');
  const qc2 = document.querySelector('.quiz-modal .quiz-container');
  if (qc2) qc2.scrollTop = 0;

  lastProgressPercent = 0;

  if (!fromLegal) {
    quizClearDraft();
    resetQuizToEmptyContactStep();
  } else {
    const restored = quizApplyDraft();
    if (!restored) resetQuizToEmptyContactStep();
  }

  currentStep = 6;
  showStep(6);

  setTimeout(() => {
    const nameInput = document.querySelector('#step6 input[name="name"]');
    if (nameInput) nameInput.focus();
  }, 60);
}

function showStep(n) {
  document.querySelectorAll('.q-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step' + n);
  if (el) el.classList.add('active');

  updateProgress(n);
}

function updateProgress(step) {
  // Прогресс: 5 вопросов + контакт = 6 частей (до контактов равные части, на контактах 99%)
  const percent = step <= TOTAL_STEPS ? step * (100 / (TOTAL_STEPS + 1)) : 99;
  const p = Math.round(percent);
  const textEl = document.getElementById('quizProgressText');
  const fillEl = document.getElementById('quizProgressFill');
  if (textEl) textEl.textContent = `${p}%`;
  if (fillEl) {
    // При открытии квиза (0% -> 20%) делаем заполнение в 3 раза медленнее.
    const isFirstFillTo20 = p === 20 && lastProgressPercent === 0;
    const durationMs = isFirstFillTo20 ? 1050 : 350;
    fillEl.style.transitionDuration = `${durationMs}ms`;
    fillEl.style.width = `${p}%`;
    if (p >= 99) fillEl.classList.add('is-full');
    else fillEl.classList.remove('is-full');
  }
  lastProgressPercent = p;

  for (let i = 1; i <= TOTAL_STEPS + 1; i++) {
    const sp = document.getElementById('sp' + i);
    if (!sp) continue;
    sp.classList.remove('active', 'done');
    if (i === step)      sp.classList.add('active');
    else if (i < step)   sp.classList.add('done');
  }
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const sl = document.getElementById('sl' + i);
    if (!sl) continue;
    sl.classList.toggle('done', i < step);
  }
}

function nextStep() {
  if (currentStep <= TOTAL_STEPS) {
    // Шаг 1 «Другое»: нужен непустой ввод (без автоперехода по клику на карточку)
    if (currentStep === 1 && answers[1] === 'other') {
      const inp = document.getElementById('q1OtherInput');
      const t = inp && inp.value.trim();
      if (!t) {
        if (inp) {
          inp.classList.add('q-other-input--invalid');
          inp.focus();
        }
        return;
      }
      answers['1_other'] = t;
      if (inp) inp.classList.remove('q-other-input--invalid');
    }

    // Шаг 3 «Свой вариант» в мультивыборе: нужен непустой ввод
    if (currentStep === 3 && Array.isArray(answers[3]) && answers[3].includes('other')) {
      const inp3 = document.getElementById('q3OtherInput');
      const t3 = inp3 && inp3.value.trim();
      if (!t3) {
        if (inp3) {
          inp3.classList.add('q-other-input--invalid');
          inp3.focus();
        }
        return;
      }
      answers['3_other'] = t3;
      if (inp3) inp3.classList.remove('q-other-input--invalid');
    }

    // На шагах 1–5 нельзя переходить без выбора ответа.
    if (currentStep >= 1 && currentStep <= TOTAL_STEPS) {
      const stepOpts = document.querySelectorAll(`.q-opt[data-step="${currentStep}"]`);
      const anySelected = Array.from(stepOpts).some(opt => opt.classList.contains('selected'));

      if (!anySelected && stepOpts.length > 0) {
        stepOpts.forEach(opt => {
          opt.classList.remove('quiz-option-invalid');
          void opt.offsetWidth;
          opt.classList.add('quiz-option-invalid');
        });
        // фокус на первый вариант, чтобы пользователь видел где ошибка
        stepOpts[0].focus();
        return;
      }
    }

    currentStep++;
    showStep(currentStep);
    quizSaveDraft();
  }
}

function prevStep() {
  if (currentStep <= 1) {
    closeModal();
    return;
  }
  currentStep--;
  showStep(currentStep);
  quizSaveDraft();
}

/** Валидация шага 5 (контакты). true — можно открывать WhatsApp и показывать успех. */
function validateQuizContactForm(form) {
  if (!form) return false;

  const fields = Array.from(
    form.querySelectorAll('.q-contact-form input:not([type="checkbox"]), .q-contact-form select')
  );
  const emptyFields = fields.filter(el => {
    if (el.tagName === 'SELECT') return !el.value;
    return !el.value || !el.value.trim();
  });

  if (emptyFields.length > 0) {
    emptyFields.forEach(field => {
      field.classList.remove('quiz-field-invalid');
      void field.offsetWidth;
      field.classList.add('quiz-field-invalid');
    });
    emptyFields[0].focus();
    return false;
  }

  const phoneInput = form.querySelector('input[name="phone"]');
  const phoneRaw = phoneInput && phoneInput.value ? phoneInput.value : '';
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const isValidPhone = phoneDigits.length === 11 && phoneDigits.startsWith('7');

  if (!isValidPhone) {
    if (phoneInput) {
      phoneInput.classList.remove('quiz-field-invalid');
      void phoneInput.offsetWidth;
      phoneInput.classList.add('quiz-field-invalid');
      phoneInput.focus();
    }
    return false;
  }

  return true;
}

/** Enter в поле формы — то же, что клик по кнопке отправки */
function submitQuizLastStep(e) {
  e.preventDefault();
  const a = document.getElementById('quizWhatsAppCta');
  if (a) a.click();
}

/** Экран «Заявка принята!» — сразу после шага с контактами (внутри модалки квиза) */
function redirectToThankYouPage() {
  const isKk = typeof window !== 'undefined' && window.SiteI18n && window.SiteI18n.getLang() === 'kk';
  window.location.href = isKk ? 'thank-you-kk.html' : 'thank-you.html';
}

function showQuizSuccessScreen() {
  const formScreen = document.getElementById('quizFormScreen');
  const successEl = document.getElementById('quizSuccess');
  const container = document.querySelector('.quiz-modal .quiz-container');
  if (formScreen) formScreen.classList.add('hidden');
  if (successEl) successEl.classList.remove('hidden');
  if (container) container.scrollTop = 0;
  const h3 = successEl && successEl.querySelector('.quiz-success-copy h3');
  if (h3) {
    try {
      h3.setAttribute('tabindex', '-1');
      h3.focus({ preventScroll: true });
    } catch (_) {}
  }
}

async function onQuizWhatsAppCtaClick(e) {
  e.preventDefault();
  const form = document.querySelector('.q-contact-form');
  if (!form || !validateQuizContactForm(form)) return;

  const btn = document.getElementById('quizWhatsAppCta');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  }

  try {
    await sendQuizLeadToTelegram(form);
    quizClearDraft();
    redirectToThankYouPage();
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : 'Неизвестная ошибка';
    alert(`Не удалось отправить заявку в Telegram.\n\n${msg}\n\nПроверьте интернет и попробуйте ещё раз.`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
}

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Уход со страницы (например, переход в политику) — сохранить оставшееся время.
window.addEventListener('pagehide', () => {
  quizPriorityPersist();
});

// При переключении языка (RU/KZ) не сбрасываем прогресс квиза:
// оставляем пользователя на том же шаге и с теми же данными.
window.addEventListener('siteLangChange', () => {
  const modal = document.getElementById('quizModal');
  if (!modal || !modal.classList.contains('open')) return;

  // Сохраняем текущее состояние, т.к. apply(lang) меняет тексты в DOM.
  quizSaveDraft();

  const draftStep = quizGetDraftStep();
  const stepToShow = draftStep || currentStep || 1;

  // Восстанавливаем selected + инпуты формы (если есть черновик),
  // затем показываем текущий шаг.
  quizApplyDraft();
  currentStep = stepToShow;
  showStep(stepToShow);

  // Перерисовать подпись таймера в новом языке (и expired-текст).
  quizPriorityRender();
});

// ── Option buttons logic ──
document.addEventListener('DOMContentLoaded', () => {
  const waQuizBtn = document.querySelector('.quiz-whatsapp-btn');
  if (waQuizBtn) waQuizBtn.href = WHATSAPP_QUIZ_URL;

  const waCta = document.getElementById('quizWhatsAppCta');
  if (waCta) waCta.addEventListener('click', onQuizWhatsAppCtaClick);

  // Single-choice: auto-advance (кроме шага 1 «Другое…» — нужен ввод и «Далее»)
  document.querySelectorAll('.q-opt.single').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      const val = btn.dataset.val;
      document.querySelectorAll(`.q-opt.single[data-step="${step}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      answers[step] = val;
      if (step === '1') {
        const wrap = document.getElementById('q1OtherWrap');
        const inp = document.getElementById('q1OtherInput');
        if (val === 'other') {
          if (wrap) wrap.classList.remove('q-other-field--hidden');
          delete answers['1_other'];
          if (inp) {
            inp.classList.remove('q-other-input--invalid');
            setTimeout(() => inp.focus(), 0);
          }
          quizSaveDraft();
          return;
        }
        if (wrap) wrap.classList.add('q-other-field--hidden');
        if (inp) {
          inp.value = '';
          inp.classList.remove('q-other-input--invalid');
        }
        delete answers['1_other'];
      }
      quizSaveDraft();
      setTimeout(nextStep, 300);
    });
  });

  const q1OtherInput = document.getElementById('q1OtherInput');
  if (q1OtherInput) {
    q1OtherInput.addEventListener('input', () => {
      if (answers[1] === 'other') {
        answers['1_other'] = q1OtherInput.value.trim();
        quizSaveDraft();
      }
    });
  }

  const q3OtherInput = document.getElementById('q3OtherInput');
  if (q3OtherInput) {
    q3OtherInput.addEventListener('input', () => {
      if (Array.isArray(answers[3]) && answers[3].includes('other')) {
        answers['3_other'] = q3OtherInput.value.trim();
        quizSaveDraft();
      }
    });
  }

  // Multi-choice: toggle
  document.querySelectorAll('.q-opt.multi').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      const val = btn.dataset.val;

      // Шаг 3: если выбран любой из первых трех вариантов — «Свой вариант» недоступен
      if (step === '3') {
        const firstVals = ['san_tax', 'suppliers', 'guests_hr'];
        const otherVal = 'other';
        const selectedNow = Array.isArray(answers[step]) ? answers[step] : [];
        const anyFirstSelected = selectedNow.some((v) => firstVals.includes(String(v)));
        const isOtherClick = String(val) === otherVal;
        const willSelectOther = isOtherClick && !btn.classList.contains('selected');

        if (willSelectOther && anyFirstSelected) {
          // Не даём выбрать «Свой вариант», если уже выбраны первые варианты
          return;
        }
      }

      // Toggle selected
      btn.classList.toggle('selected');
      if (!answers[step]) answers[step] = [];
      if (btn.classList.contains('selected')) {
        if (!answers[step].includes(val)) answers[step].push(val);
      } else {
        answers[step] = answers[step].filter(v => v !== val);
      }

      if (step === '3') {
        const firstVals = ['san_tax', 'suppliers', 'guests_hr'];
        const otherBtn = document.querySelector('.q-opt.multi[data-step="3"][data-val="other"]');
        const anyFirstSelected = (answers[step] || []).some((v) => firstVals.includes(String(v)));

        // Если выбрали любой из первых трех — автоматически снимаем «Свой вариант»
        if (anyFirstSelected && Array.isArray(answers[step]) && answers[step].includes('other')) {
          answers[step] = answers[step].filter((v) => String(v) !== 'other');
          if (otherBtn) otherBtn.classList.remove('selected');
        }

        // Визуально/семантически блокируем кнопку «Свой вариант» при выбранных первых вариантах
        if (otherBtn) {
          otherBtn.disabled = anyFirstSelected;
          otherBtn.setAttribute('aria-disabled', anyFirstSelected ? 'true' : 'false');
        }

        const wrap = document.getElementById('q3OtherWrap');
        const inp = document.getElementById('q3OtherInput');
        const hasOther = (answers[step] || []).includes('other');
        if (hasOther) {
          if (wrap) wrap.classList.remove('q-other-field--hidden');
          if (val === 'other' && btn.classList.contains('selected') && inp) {
            delete answers['3_other'];
            inp.classList.remove('q-other-input--invalid');
            setTimeout(() => inp.focus(), 0);
          }
        } else {
          if (wrap) wrap.classList.add('q-other-field--hidden');
          if (inp) {
            inp.value = '';
            inp.classList.remove('q-other-input--invalid');
          }
          delete answers['3_other'];
        }
      }

      quizSaveDraft();
    });
  });

  const quizModalEl = document.getElementById('quizModal');
  if (quizModalEl) {
    let quizDraftTimer;
    quizModalEl.addEventListener('input', () => {
      clearTimeout(quizDraftTimer);
      quizDraftTimer = setTimeout(quizSaveDraft, 280);
    });
    quizModalEl.addEventListener('change', () => quizSaveDraft());
    quizModalEl.addEventListener('click', (ev) => {
      if (ev.target.closest('a.q-doc-link')) {
        quizSaveDraft();
        quizPriorityPersist(); // зафиксировать таймер перед уходом на политику
      }
    });
  }

  function handleQuizContactHash() {
    if (location.hash !== '#quiz-contact') return;
    openQuizContact(null, { fromLegal: true });
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (_) {}
  }
  handleQuizContactHash();
  window.addEventListener('hashchange', handleQuizContactHash);

  /* =============================================
     SCROLL ANIMATIONS — Law cards
     ============================================= */
  const lawCards = document.querySelectorAll('.law-card');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('animate-in'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  lawCards.forEach(card => observer.observe(card));

  /* =============================================
     SCROLL ANIMATIONS — Risk cards (same behavior, separate observer)
     ============================================= */
  const riskCards = document.querySelectorAll('.risk-card');
  if (riskCards.length) {
    const riskObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || 0);
          setTimeout(() => entry.target.classList.add('animate-in'), delay);
          riskObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    riskCards.forEach(card => riskObserver.observe(card));
  }

  /* =============================================
     SCROLL ANIMATIONS — CTA (title + subtitle)
     ============================================= */
  const ctaEls = document.querySelectorAll('.cta-anim');
  if (ctaEls.length) {
    const ctaObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        ctaObserver.unobserve(entry.target);
        entry.target.classList.add('animate-in');
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    ctaEls.forEach((el, idx) => {
      // Небольшой каскад: заголовок, затем подзаголовок
      el.style.transitionDelay = `${idx * 120}ms`;
      ctaObserver.observe(el);
    });
  }

  /* =============================================
     Telegram spoiler (canvas particles)
     ============================================= */

  // Компактный simplex noise 2D (Stefan Gustavson style)
  const grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  const perm = new Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function simplex2(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
    const t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = grad3[gi0];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    const t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = grad3[gi1];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    const t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = grad3[gi2];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const cards = [];

  // Общий бюджет частиц на все карточки во 2-м блоке
  const TOTAL_PARTICLES = 5000;
  let reallocateTimer = null;

  const recreateParticles = (s, count) => {
    s.particles = new Array(count).fill(0).map((_, i) => ({
      x: Math.random() * s.w,
      y: Math.random() * s.h,
      vx: 0,
      vy: 0,
      seed: Math.random() * 1000 + i * 0.17
    }));
  };

  const allocateParticles = () => {
    if (!cards.length) return;

    const totalArea = cards.reduce((acc, s) => acc + (s.w * s.h), 0);
    const baseCounts = cards.map((s) => {
      const area = s.w * s.h;
      return totalArea > 0 ? (TOTAL_PARTICLES * area) / totalArea : (TOTAL_PARTICLES / cards.length);
    });

    const floored = baseCounts.map((c) => Math.floor(c));
    let sum = floored.reduce((a, b) => a + b, 0);
    let remainder = TOTAL_PARTICLES - sum;

    // Дорозподелим остаток по фракциям, чтобы сумма ровно была TOTAL_PARTICLES
    if (remainder > 0) {
      const byFrac = baseCounts
        .map((c, idx) => ({ idx, frac: c - Math.floor(c) }))
        .sort((a, b) => b.frac - a.frac);

      for (let i = 0; i < remainder; i++) {
        floored[byFrac[i % byFrac.length].idx]++;
      }
    }

    for (let i = 0; i < cards.length; i++) {
      const s = cards[i];
      const targetCount = floored[i];
      if (s.particles.length !== targetCount) recreateParticles(s, targetCount);
    }
  };

  const requestReallocate = () => {
    clearTimeout(reallocateTimer);
    reallocateTimer = setTimeout(() => allocateParticles(), 120);
  };

  function setupCard(card) {
    const canvas = document.createElement('canvas');
    canvas.className = 'law-spoiler-canvas';
    card.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));

    const state = {
      card,
      canvas,
      ctx,
      dpr,
      w: 1,
      h: 1,
      particles: [],
      revealAlpha: 1, // 1 => particles visible
      locked: false,
      hovering: false,
      autoCloseTimeoutId: null
    };

    const resize = () => {
      const rect = card.getBoundingClientRect();
      state.w = Math.max(1, Math.round(rect.width));
      state.h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.floor(state.w * dpr);
      canvas.height = Math.floor(state.h * dpr);
      canvas.style.width = state.w + 'px';
      canvas.style.height = state.h + 'px';

      // particles пересоздаём общим распределением (TOTAL_PARTICLES),
      // поэтому здесь только подготавливаем размер канваса.
      if (!state.particles.length) recreateParticles(state, 300);
    };

    resize();
    window.addEventListener('resize', () => {
      resize();
      requestReallocate();
    }, { passive: true });

    cards.push(state);

    const applyReveal = () => {
      const shouldReveal = state.locked || state.hovering;
      card.classList.toggle('law-card--revealed', shouldReveal);
      card.setAttribute('aria-expanded', String(shouldReveal));
    };

    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', 'false');

    card.addEventListener('click', () => {
      // Требование:
      // - открытие карточки не должно закрывать другие;
      // - автоматическое "возвращение как было" запускается ТОЛЬКО при повторном клике
      //   по уже открытой карточке.
      if (!state.locked) {
        state.locked = true;
        state.hovering = false;
        if (state.autoCloseTimeoutId) {
          clearTimeout(state.autoCloseTimeoutId);
          state.autoCloseTimeoutId = null;
        }
        applyReveal();
        return;
      }

      // Повторный клик по уже открытой карточке: закрыть саму себя через 20 секунд.
      state.hovering = false;
      if (state.autoCloseTimeoutId) clearTimeout(state.autoCloseTimeoutId);
      state.autoCloseTimeoutId = setTimeout(() => {
        state.locked = false;
        state.hovering = false;
        state.autoCloseTimeoutId = null;
        applyReveal();
      }, 20000);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!state.locked) {
          state.locked = true;
          state.hovering = false;
          if (state.autoCloseTimeoutId) {
            clearTimeout(state.autoCloseTimeoutId);
            state.autoCloseTimeoutId = null;
          }
          applyReveal();
          return;
        }

        // Повторный клик (keyboard) по уже открытой карточке: закрыть через 20 секунд.
        state.hovering = false;
        if (state.autoCloseTimeoutId) clearTimeout(state.autoCloseTimeoutId);
        state.autoCloseTimeoutId = setTimeout(() => {
          state.locked = false;
          state.hovering = false;
          state.autoCloseTimeoutId = null;
          applyReveal();
        }, 20000);
      }
    });
  }

  lawCards.forEach(setupCard);
  allocateParticles();

  let rafId = 0;
  let lastT = performance.now();
  const anim = (t) => {
    const dt = Math.min(50, t - lastT);
    lastT = t;

    for (const s of cards) {
      const rect = s.card.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      // alpha: при revealed частицы плавно исчезают
      const shouldReveal = s.card.classList.contains('law-card--revealed');
      const target = shouldReveal ? 0 : 1;
      s.revealAlpha = lerp(s.revealAlpha, target, 0.08);

      if (!s.particles.length) continue;
      if (shouldReveal && s.revealAlpha < 0.03) continue;

      const time = t * 0.001;
      const cellSize = 14;
      const radius = 16;
      const radius2 = radius * radius;
      const attraction = 0.00055;
      const noiseStrength = 0.08;
      const repulse = 0.00075;
      const SPEED_MUL = 0.7; // замедляем движение частиц на ~30%

      const cols = Math.ceil(s.w / cellSize);
      const rows = Math.ceil(s.h / cellSize);
      const grid = new Map();

      // rebuild spatial hash
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        const cx = Math.floor(p.x / cellSize);
        const cy = Math.floor(p.y / cellSize);
        const key = cx + ',' + cy;
        let arr = grid.get(key);
        if (!arr) { arr = []; grid.set(key, arr); }
        arr.push(i);
      }

      const ctx = s.ctx;
      const wPx = s.canvas.width;
      const hPx = s.canvas.height;

      ctx.clearRect(0, 0, wPx, hPx);
      ctx.save();
      ctx.scale(s.dpr, s.dpr);
      ctx.globalCompositeOperation = 'lighter';

      // Update + draw
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];

        // Noise-driven turbulence direction
        const n = simplex2(p.x * 0.01 + time * 0.9, p.y * 0.01 - time * 0.7 + p.seed);
        const angle = n * Math.PI;
        p.vx += Math.cos(angle) * noiseStrength;
        p.vy += Math.sin(angle) * noiseStrength;

        // Clumping + craters (density-based)
        const cx = Math.floor(p.x / cellSize);
        const cy = Math.floor(p.y / cellSize);
        let sumX = 0, sumY = 0, count = 0;
        let density = 0;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const key = (cx + ox) + ',' + (cy + oy);
            const bucket = grid.get(key);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j === i) continue;
              const q = s.particles[j];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > radius2) continue;
              density++;
              sumX += q.x;
              sumY += q.y;
              count++;
            }
          }
        }

        if (count > 0) {
          const avgX = sumX / count;
          const avgY = sumY / count;
          p.vx += (avgX - p.x) * attraction;
          p.vy += (avgY - p.y) * attraction;

          // Repulsion on high density => craters/holes
          if (density >= 3) {
            p.vx -= (avgX - p.x) * repulse * (density / 5);
            p.vy -= (avgY - p.y) * repulse * (density / 5);
          }
        }

        // Damping
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx * (dt / 16.67) * SPEED_MUL;
        p.y += p.vy * (dt / 16.67) * SPEED_MUL;

        // wrap
        if (p.x < -10) p.x = s.w + 10;
        if (p.x > s.w + 10) p.x = -10;
        if (p.y < -10) p.y = s.h + 10;
        if (p.y > s.h + 10) p.y = -10;

        const rN = simplex2(p.x * 0.03 + time, p.y * 0.03 - time + p.seed) / 70;
        const rn01 = clamp((rN + 1) * 0.5, 0, 1);
        // Радиус частиц (уменьшаем "точки" относительно предыдущей версии)
        const r = (0.55 + rn01 * 0.45) / 1.5; // примерно в 1.5 раза меньше

        const a = 0.95 * s.revealAlpha;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    rafId = requestAnimationFrame(anim);
  };

  rafId = requestAnimationFrame(anim);

  /* =============================================
     MARQUEE
     ============================================= */
  initMarquee();

});

/* =============================================
   MARQUEE — бесконечная лента с drag и wheel
   ============================================= */
function initMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;

  const outer = track.parentElement;
  const AUTO_SPEED = window.innerWidth <= 700 ? 3.0 : 1.0; // мобиле ×3 быстрее

  let offset = 0;
  let halfWidth = 0;
  let dragActive = false;
  let dragStartX = 0;
  let dragStartOffset = 0;
  // Инерция после drag
  let velocity = 0;
  let lastDragX = 0;
  let lastDragTime = 0;

  function getHalf() {
    return track.scrollWidth / 2;
  }

  // Фиксируем половину ширины, чтобы не пересчитывать её каждый кадр
  halfWidth = getHalf();

  const updateHalfWidth = () => {
    halfWidth = getHalf();
    if (halfWidth > 0) offset = wrap(offset);
  };

  function wrap(val) {
    const h = halfWidth || getHalf();
    if (val >= h) val -= h;
    if (val < 0)  val += h;
    return val;
  }

  function tick() {
    if (!dragActive) {
      // Инерция после drag затухает, потом возобновляется автоскролл
      if (Math.abs(velocity) > 0.1) {
        offset = wrap(offset + velocity);
        velocity *= 0.94; // затухание
      } else {
        velocity = 0;
        offset = wrap(offset + AUTO_SPEED);
      }
    }

    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    requestAnimationFrame(tick);
  }

  // ── Mouse drag ──
  track.addEventListener('mousedown', (e) => {
    dragActive = true;
    dragStartX = e.clientX;
    dragStartOffset = offset;
    lastDragX = e.clientX;
    lastDragTime = Date.now();
    velocity = 0;
    track.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragActive) return;
    const now = Date.now();
    const dt = now - lastDragTime || 1;
    velocity = (lastDragX - e.clientX) / dt * 16; // px/frame
    lastDragX = e.clientX;
    lastDragTime = now;
    offset = wrap(dragStartOffset + (dragStartX - e.clientX));
  });

  document.addEventListener('mouseup', () => {
    if (!dragActive) return;
    dragActive = false;
    track.classList.remove('dragging');
  });

  // ── Touch drag ──
  track.addEventListener('touchstart', (e) => {
    dragStartX = e.touches[0].clientX;
    dragStartOffset = offset;
    lastDragX = e.touches[0].clientX;
    lastDragTime = Date.now();
    velocity = 0;
    dragActive = true;
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    if (!dragActive) return;
    const now = Date.now();
    const dt = now - lastDragTime || 1;
    velocity = (lastDragX - e.touches[0].clientX) / dt * 16;
    lastDragX = e.touches[0].clientX;
    lastDragTime = now;
    offset = wrap(dragStartOffset + (dragStartX - e.touches[0].clientX));
  }, { passive: true });

  track.addEventListener('touchend', () => { dragActive = false; });

  // ── Wheel scroll ──
  outer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    // Не делаем мгновенный jump по offset — только разгоняем инерцию.
    velocity += delta * 0.02;
    velocity = Math.max(-60, Math.min(60, velocity));
  }, { passive: false });

  requestAnimationFrame(tick);

  window.addEventListener('resize', updateHalfWidth, { passive: true });
  // На случай догрузки картинок (scrollWidth может поменяться)
  window.setTimeout(updateHalfWidth, 600);
}

/* =============================================
   СЕРТИФИКАТЫ — карусель + просмотр PDF в модалке
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('certsCarousel');
  const viewport = document.getElementById('certsViewport');
  const track = document.getElementById('certsTrack');
  const dotsEl = document.getElementById('certsDots');
  const modal = document.getElementById('certViewerModal');
  const iframe = modal?.querySelector('.cert-viewer-iframe');
  const backdrop = modal?.querySelector('.cert-viewer-backdrop');
  const closeBtn = modal?.querySelector('.cert-viewer-close');

  if (!root || !viewport || !track || !dotsEl) return;

  const prevBtn = root.querySelector('.certs-nav--prev');
  const nextBtn = root.querySelector('.certs-nav--next');
  const slides = Array.from(track.querySelectorAll('.certs-slide'));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const AUTOPLAY_MS = 1500;

  let index = 0;
  let slideW = 0;
  let autoplayTimer = null;

  function isStatic() {
    return mqReduce.matches;
  }

  function legitModalTitle() {
    try {
      const lang = window.SiteI18n.getLang();
      const dict = window.SiteI18n.STRINGS[lang] || window.SiteI18n.STRINGS.ru;
      return dict.legit_modal_title || 'Document';
    } catch (_) {
      return 'Document';
    }
  }

  function buildDots() {
    dotsEl.innerHTML = '';
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'certs-dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('aria-label', `${i + 1} / ${slides.length}`);
      b.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(b);
    });
  }

  function applyTransform() {
    if (isStatic()) return;
    track.style.transform = `translate3d(${-index * slideW}px,0,0)`;
    dotsEl.querySelectorAll('.certs-dot').forEach((d, i) => {
      d.classList.toggle('is-active', i === index);
    });
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;
  }

  function measure() {
    slideW = viewport.getBoundingClientRect().width;
    if (isStatic()) {
      track.style.transform = '';
      track.style.width = '';
      slides.forEach((s) => {
        s.style.width = '';
      });
      return;
    }
    slides.forEach((s) => {
      s.style.width = `${slideW}px`;
    });
    track.style.width = `${slideW * slides.length}px`;
    applyTransform();
  }

  function goTo(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    applyTransform();
  }

  function stopAutoplay() {
    if (autoplayTimer != null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (isStatic() || slides.length < 2) return;
    autoplayTimer = window.setInterval(() => {
      goTo((index + 1) % slides.length);
    }, AUTOPLAY_MS);
  }

  function openCertViewer(pdfSrc) {
    if (!modal || !iframe) return;
    iframe.title = legitModalTitle();
    iframe.src = pdfSrc;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCertViewer() {
    if (!modal || !iframe) return;
    iframe.src = 'about:blank';
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const quiz = document.getElementById('quizModal');
    document.body.style.overflow = quiz?.classList.contains('open') ? 'hidden' : '';
  }

  track.querySelectorAll('.certs-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pdf = btn.getAttribute('data-pdf');
      if (pdf) openCertViewer(pdf);
    });
  });

  prevBtn?.addEventListener('click', () => goTo(index - 1));
  nextBtn?.addEventListener('click', () => goTo(index + 1));

  backdrop?.addEventListener('click', closeCertViewer);
  closeBtn?.addEventListener('click', closeCertViewer);

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (!modal?.classList.contains('open')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeCertViewer();
    },
    true
  );

  buildDots();
  root.classList.toggle('certs-carousel--static', isStatic());
  mqReduce.addEventListener('change', () => {
    root.classList.toggle('certs-carousel--static', isStatic());
    measure();
    startAutoplay();
  });

  window.addEventListener('resize', measure, { passive: true });
  measure();
  startAutoplay();

  let tx0 = 0;
  let tActive = false;
  viewport.addEventListener(
    'touchstart',
    (e) => {
      if (isStatic()) return;
      stopAutoplay();
      tActive = true;
      tx0 = e.touches[0].clientX;
    },
    { passive: true }
  );
  viewport.addEventListener(
    'touchend',
    (e) => {
      if (!tActive || isStatic()) return;
      tActive = false;
      const dx = e.changedTouches[0].clientX - tx0;
      if (Math.abs(dx) >= 48) {
        if (dx < 0) goTo(index + 1);
        else goTo(index - 1);
      }
      startAutoplay();
    },
    { passive: true }
  );

  window.addEventListener('siteLangChange', () => {
    if (!iframe || !modal?.classList.contains('open')) return;
    iframe.title = legitModalTitle();
  });
});
