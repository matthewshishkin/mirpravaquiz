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
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = window.setInterval(() => {
      const next = index + 1 >= steps.length ? 0 : index + 1;
      goTo(next, true);
    }, AUTOPLAY_MS);
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

  const DEFAULT_DURATION_MS = 1100; /* быстрая анимация; для отдельных — data-duration (напр. 780 млн = 3500) */

  const animateCounter = (el) => new Promise((resolve) => {
    if (!el || el.dataset.countDone === '1') {
      resolve();
      return;
    }
    el.dataset.countDone = '1';

    const target = Number(el.dataset.target || 0);
    const suffix = el.dataset.suffix || '';
    const customMs = Number(el.dataset.duration);
    const duration =
      Number.isFinite(customMs) && customMs > 0 ? customMs : DEFAULT_DURATION_MS;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ускорение по мере роста числа
      const eased = 1 - Math.pow(1 - t, 2.35);
      const val = Math.round(target * eased);
      el.textContent = `${val}${suffix}`;
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

  const start = heroBottom - GLASS_START_OFFSET;
  const end = heroBottom;
  const raw = (window.scrollY - start) / Math.max(1, end - start);
  const progress = clamp01(raw);

  // 0%: чистый чёрный, без blur
  // 100%: текущий стеклянный вид (rgba(0,0,0,0.62) + blur(10px))
  const alpha = 1 - (1 - 0.62) * progress;
  const blur = 10 * progress;

  header.style.background = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
  header.style.backdropFilter = `blur(${blur.toFixed(2)}px)`;
  header.style.webkitBackdropFilter = `blur(${blur.toFixed(2)}px)`;
}

/**
 * После полного прохолжения 2-го блока (.law-section) кнопка в шапке — белая с чёрным текстом.
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
    if (v2) {
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
    if (v) {
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

    if (v2) {
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
const TOTAL_STEPS = 4;
const answers = {};
let lastProgressPercent = 0;

/** Ссылка на WhatsApp (LinkTwin) — кнопка «Связаться вне очереди» после шага «Отлично!…» */
const WHATSAPP_QUIZ_URL = 'https://linktw.in/ocjIoY';

/** Прокси на Vercel (без CORS): POST JSON { text } → пересылает в Telegram */
const TELEGRAM_PROXY_URL = 'https://mainur.vercel.app/api/send-telegram';

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
    return raw.map((v) => getQuizOptionLabel(step, v)).join(', ');
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

function openModal() {
  // Компенсируем ширину скроллбара, чтобы страница не прыгала
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbarWidth + 'px';
  document.getElementById('siteHeader').style.paddingRight = scrollbarWidth + 'px';
  document.body.style.overflow = 'hidden';

  document.getElementById('quizModal').classList.add('open');
  // Сразу показываем квиз
  document.getElementById('quizFormScreen').classList.remove('hidden');
  document.getElementById('quizSuccess').classList.add('hidden');
  const qc = document.querySelector('.quiz-modal .quiz-container');
  if (qc) qc.scrollTop = 0;
  // Сбрасываем квиз
  currentStep = 1;
  lastProgressPercent = 0;
  showStep(1);
  Object.keys(answers).forEach((k) => delete answers[k]);
  document.querySelectorAll('.q-opt.selected').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.q-consent input[type="checkbox"]').forEach(c => {
    c.checked = false;
  });
  document.querySelectorAll('.q-consent').forEach(l => l.classList.remove('quiz-consent-invalid'));
}

function closeModal() {
  document.getElementById('quizModal').classList.remove('open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.getElementById('siteHeader').style.paddingRight = '';
}

// Открываем квиз сразу на последнем шаге ("Контакт") из футера.
function openQuizContact(e) {
  if (e && e.preventDefault) e.preventDefault();

  // Открываем модалку, но НЕ вызываем openModal(),
  // чтобы не было автосброса на шаг 1.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbarWidth + 'px';
  document.getElementById('siteHeader').style.paddingRight = scrollbarWidth + 'px';
  document.body.style.overflow = 'hidden';

  document.getElementById('quizModal').classList.add('open');
  document.getElementById('quizFormScreen').classList.remove('hidden');
  document.getElementById('quizSuccess').classList.add('hidden');
  const qc2 = document.querySelector('.quiz-modal .quiz-container');
  if (qc2) qc2.scrollTop = 0;

  // Сбрасываем выбранные ответы и сразу ставим шаг 5.
  lastProgressPercent = 0;
  currentStep = 5;
  showStep(5);
  Object.keys(answers).forEach((k) => delete answers[k]);
  document.querySelectorAll('.q-opt.selected').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.q-consent input[type="checkbox"]').forEach(c => {
    c.checked = false;
  });
  document.querySelectorAll('.q-consent').forEach(l => l.classList.remove('quiz-consent-invalid'));

  // Небольшая задержка, чтобы DOM уже успел отрисовать шаг.
  setTimeout(() => {
    const nameInput = document.querySelector('#step5 input[name="name"]');
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
  // Прогресс: 4 вопроса + контакт = 5 частей (20/40/60/80/99% — на шаге контактов не 100%, а 99%)
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
    // На шагах 1–4 нельзя переходить без выбора ответа.
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
  }
}

function prevStep() {
  if (currentStep <= 1) {
    closeModal();
    return;
  }
  currentStep--;
  showStep(currentStep);
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

  const consentPd = form.querySelector('input[name="consent_pd"]');
  const consentPrivacy = form.querySelector('input[name="consent_privacy"]');
  form.querySelectorAll('.q-consent').forEach(l => l.classList.remove('quiz-consent-invalid'));
  if (!consentPd || !consentPrivacy || !consentPd.checked || !consentPrivacy.checked) {
    if (consentPd && !consentPd.checked) {
      const lab = consentPd.closest('.q-consent');
      if (lab) {
        void lab.offsetWidth;
        lab.classList.add('quiz-consent-invalid');
      }
    }
    if (consentPrivacy && !consentPrivacy.checked) {
      const lab = consentPrivacy.closest('.q-consent');
      if (lab) {
        void lab.offsetWidth;
        lab.classList.add('quiz-consent-invalid');
      }
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
    showQuizSuccessScreen();
  } catch (err) {
    console.error(err);
    alert('Заявка отправлена, мы свяжемся с вами!');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
}

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Option buttons logic ──
document.addEventListener('DOMContentLoaded', () => {
  const waQuizBtn = document.querySelector('.quiz-whatsapp-btn');
  if (waQuizBtn) waQuizBtn.href = WHATSAPP_QUIZ_URL;

  const waCta = document.getElementById('quizWhatsAppCta');
  if (waCta) waCta.addEventListener('click', onQuizWhatsAppCtaClick);

  document.querySelectorAll('.q-consent input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const lab = cb.closest('.q-consent');
      if (lab) lab.classList.remove('quiz-consent-invalid');
    });
  });

  // Single-choice: auto-advance
  document.querySelectorAll('.q-opt.single').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      document.querySelectorAll(`.q-opt.single[data-step="${step}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      answers[step] = btn.dataset.val;
      setTimeout(nextStep, 300);
    });
  });

  // Multi-choice: toggle
  document.querySelectorAll('.q-opt.multi').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      const val = btn.dataset.val;

      // Правило для шага 3:
      // если выбраны какие-то из первых трех или все 3,
      // то "none" ("Пока не сталкивался") выбрать нельзя.
      if (step === '3') {
        const noneVal = 'none';
        const noneBtn = document.querySelector(`.q-opt.multi[data-step="${step}"][data-val="${noneVal}"]`);
        const otherBtns = Array.from(document.querySelectorAll(`.q-opt.multi[data-step="${step}"]:not([data-val="${noneVal}"])`));
        const otherSelected = otherBtns.filter(b => b.classList.contains('selected'));
        const wasSelected = btn.classList.contains('selected');

        // Пытаемся выбрать "none", но уже выбраны другие варианты
        if (val === noneVal && !wasSelected && otherSelected.length > 0) {
          return;
        }

        // Выбираем любой из первых вариантов -> снимаем "none" если он был выбран
        if (val !== noneVal && !wasSelected && noneBtn && noneBtn.classList.contains('selected')) {
          noneBtn.classList.remove('selected');
          if (answers[step]) answers[step] = answers[step].filter(v => v !== noneVal);
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
    });
  });

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
   PRICING — блок в зоне видимости → 1-я карточка;
   2-я («С нами») — через 3 с после старта анимации первой карточки
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.pricing-section .tariff-grid');
  if (!grid) return;

  const mqMobile = window.matchMedia('(max-width: 700px)');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Пауза перед показом второй карточки (мс) */
  const SECOND_CARD_SHOW_DELAY_MS = 3000;

  let tariffObserver = null;
  let secondCardTimer = null;

  function disconnectTariffObserver() {
    if (tariffObserver) {
      tariffObserver.disconnect();
      tariffObserver = null;
    }
  }

  function clearSecondCardTimer() {
    if (secondCardTimer != null) {
      window.clearTimeout(secondCardTimer);
      secondCardTimer = null;
    }
  }

  function setupTariffInView() {
    disconnectTariffObserver();
    clearSecondCardTimer();
    grid.classList.remove(
      'tariff-animate-ready',
      'tariff-filled-animate-ready',
      'tariff-second-visible'
    );

    if (mqReduce.matches) {
      grid.classList.add(
        'tariff-animate-ready',
        'tariff-filled-animate-ready',
        'tariff-second-visible'
      );
      return;
    }

    /* Мобила: без задержек и без анимаций (отключение в CSS) */
    if (mqMobile.matches) {
      grid.classList.add(
        'tariff-animate-ready',
        'tariff-filled-animate-ready',
        'tariff-second-visible'
      );
      return;
    }

    tariffObserver = new IntersectionObserver(
      (entries, obs) => {
        const entry = entries && entries[0];
        if (!entry || !entry.isIntersecting) return;
        grid.classList.add('tariff-animate-ready');
        obs.unobserve(grid);
        disconnectTariffObserver();

        secondCardTimer = window.setTimeout(() => {
          secondCardTimer = null;
          grid.classList.add('tariff-second-visible', 'tariff-filled-animate-ready');
        }, SECOND_CARD_SHOW_DELAY_MS);
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    tariffObserver.observe(grid);
  }

  setupTariffInView();

  mqMobile.addEventListener('change', () => {
    setupTariffInView();
  });

  mqReduce.addEventListener('change', () => {
    if (mqReduce.matches) {
      clearSecondCardTimer();
      disconnectTariffObserver();
      grid.classList.add(
        'tariff-animate-ready',
        'tariff-filled-animate-ready',
        'tariff-second-visible'
      );
    } else {
      setupTariffInView();
    }
  });
});

