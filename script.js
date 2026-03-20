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
   QUIZ MODAL
   ============================================= */
let currentStep = 1;
const TOTAL_STEPS = 4;
const answers = {};

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
  // Сбрасываем квиз
  currentStep = 1;
  showStep(1);
  // Сбрасываем выбранные ответы
  document.querySelectorAll('.q-opt.selected').forEach(b => b.classList.remove('selected'));
}

function closeModal() {
  document.getElementById('quizModal').classList.remove('open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.getElementById('siteHeader').style.paddingRight = '';
}

function showStep(n) {
  document.querySelectorAll('.q-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step' + n);
  if (el) el.classList.add('active');

  updateProgress(n);
}

function updateProgress(step) {
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
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
}

function submitQuiz(e) {
  e.preventDefault();
  document.getElementById('quizFormScreen').classList.add('hidden');
  document.getElementById('quizSuccess').classList.remove('hidden');
  // Update progress to 100%
  document.getElementById('quizBar').style.width = '100%';
}

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Option buttons logic ──
document.addEventListener('DOMContentLoaded', () => {

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
      btn.classList.toggle('selected');
      const step = btn.dataset.step;
      if (!answers[step]) answers[step] = [];
      const val = btn.dataset.val;
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
     MARQUEE
     ============================================= */
  initMarquee();

  /* =============================================
     CAROUSEL
     ============================================= */
  initCarousel();
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

  function wrap(val) {
    const h = halfWidth || getHalf();
    if (val >= h) val -= h;
    if (val < 0)  val += h;
    return val;
  }

  function tick() {
    halfWidth = getHalf();

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

    track.style.transform = `translateX(${-offset}px)`;
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
    velocity = delta * 0.12;
    offset = wrap(offset + delta * 0.3);
  }, { passive: false });

  requestAnimationFrame(tick);
}

/* =============================================
   CAROUSEL
   ============================================= */
let carouselIdx = 0;

function initCarousel() {
  // Auto-play every 5s
  setInterval(() => moveCarousel(1), 5000);
}

function getSlides() { return document.querySelectorAll('.carousel-slide'); }
function getDots()   { return document.querySelectorAll('.dot'); }

function moveCarousel(dir) {
  const slides = getSlides();
  const dots   = getDots();
  slides[carouselIdx].classList.remove('active');
  dots[carouselIdx].classList.remove('active');
  carouselIdx = (carouselIdx + dir + slides.length) % slides.length;
  slides[carouselIdx].classList.add('active');
  dots[carouselIdx].classList.add('active');
}

function goToSlide(n) {
  const slides = getSlides();
  const dots   = getDots();
  slides[carouselIdx].classList.remove('active');
  dots[carouselIdx].classList.remove('active');
  carouselIdx = n;
  slides[n].classList.add('active');
  dots[n].classList.add('active');
}
