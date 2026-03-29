/* ===== CSI LOCAÇÕES — SCRIPT.JS ===== */
document.addEventListener('DOMContentLoaded', () => {

  /* PRELOADER */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => preloader.classList.add('hidden'), 1200);
    });
  }

  /* FAQ ACCORDION + Schema FAQPage injection */
  const faqItems = document.querySelectorAll('.faq-item');
  const faqSchemaData = [];
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    faqSchemaData.push({
      '@type': 'Question',
      name: btn.textContent.trim().replace(/[\n\s]+/g, ' ').replace(/chevron.*$/, '').trim(),
      acceptedAnswer: { '@type': 'Answer', text: ans.querySelector('p')?.textContent.trim() || '' }
    });
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(i => { i.classList.remove('open'); i.querySelector('.faq-q').setAttribute('aria-expanded', 'false'); });
      if (!isOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  if (faqSchemaData.length) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqSchemaData });
    document.head.appendChild(s);
  }

  /* HEADER SCROLL */
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  /* MOBILE MENU */
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  const overlay = document.getElementById('navOverlay');
  if (toggle && nav && overlay) {
    const openMenu = () => { nav.classList.add('active'); toggle.classList.add('active'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
    const closeMenu = () => { nav.classList.remove('active'); toggle.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = ''; };
    toggle.addEventListener('click', () => nav.classList.contains('active') ? closeMenu() : openMenu());
    overlay.addEventListener('click', closeMenu);
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }

  /* HERO SLIDESHOW */
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hdot');
  let curSlide = 0;
  function goSlide(n) {
    slides[curSlide]?.classList.remove('active');
    dots[curSlide]?.classList.remove('active');
    curSlide = (n + slides.length) % slides.length;
    slides[curSlide]?.classList.add('active');
    dots[curSlide]?.classList.add('active');
  }
  if (slides.length > 1) {
    dots.forEach((d, i) => d.addEventListener('click', () => goSlide(i)));
    let heroInterval = setInterval(() => goSlide(curSlide + 1), 5000);
    const heroBg = document.querySelector('.hero-bg');
    heroBg?.addEventListener('mouseenter', () => clearInterval(heroInterval));
    heroBg?.addEventListener('mouseleave', () => { heroInterval = setInterval(() => goSlide(curSlide + 1), 5000); });
  }

  /* SCROLL REVEAL */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObs.observe(el));

  /* STAT COUNTERS */
  const statItems = document.querySelectorAll('.stat-item[data-target]');
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      counterObs.unobserve(el);
      const target = parseInt(el.dataset.target);
      const numEl = el.querySelector('.stat-number');
      if (!numEl) return;
      const duration = 1800;
      const step = Math.ceil(target / (duration / 16));
      let cur = 0;
      const timer = setInterval(() => {
        cur = Math.min(cur + step, target);
        numEl.textContent = cur.toLocaleString('pt-BR');
        if (cur >= target) clearInterval(timer);
      }, 16);
    });
  }, { threshold: 0.4 });
  statItems.forEach(s => counterObs.observe(s));

  /* BLOG CAROUSEL */
  const blogTrack = document.getElementById('blogTrack');
  const blogPrev = document.getElementById('blogPrev');
  const blogNext = document.getElementById('blogNext');
  if (blogTrack && blogPrev && blogNext) {
    let blogIdx = 0;
    const blogCards = blogTrack.querySelectorAll('.blog-card');
    const totalBlog = blogCards.length;
    function getVisible() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }
    function updateBlog() {
      const vis = getVisible();
      const max = Math.max(0, totalBlog - vis);
      blogIdx = Math.min(blogIdx, max);
      const w = blogTrack.querySelector('.blog-card')?.offsetWidth || 320;
      const gap = 28;
      blogTrack.style.transform = `translateX(-${blogIdx * (w + gap)}px)`;
      blogTrack.style.transition = 'transform .5s ease';
      blogTrack.style.display = 'flex';
    }
    blogPrev.addEventListener('click', () => { blogIdx = Math.max(0, blogIdx - 1); updateBlog(); });
    blogNext.addEventListener('click', () => { const vis = getVisible(); blogIdx = Math.min(totalBlog - vis, blogIdx + 1); updateBlog(); });
    window.addEventListener('resize', updateBlog);
    blogTrack.style.display = 'flex';
    blogTrack.style.gap = '28px';
    blogTrack.style.transition = 'transform .5s ease';
  }

  /* TESTIMONIAL CAROUSEL */
  const testimonialSlides = document.querySelectorAll('.testimonial-slide');
  const testimonialDots = document.querySelectorAll('.dot');
  const testPrev = document.getElementById('testPrev');
  const testNext = document.getElementById('testNext');
  let curTest = 0;
  function goTest(n) {
    testimonialSlides[curTest]?.classList.remove('active');
    testimonialDots[curTest]?.classList.remove('active');
    curTest = (n + testimonialSlides.length) % testimonialSlides.length;
    testimonialSlides[curTest]?.classList.add('active');
    testimonialDots[curTest]?.classList.add('active');
  }
  if (testimonialSlides.length) {
    testimonialDots.forEach((d, i) => d.addEventListener('click', () => goTest(i)));
    testPrev?.addEventListener('click', () => goTest(curTest - 1));
    testNext?.addEventListener('click', () => goTest(curTest + 1));
    setInterval(() => goTest(curTest + 1), 6000);
  }

  /* CONTACT FORM */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = document.getElementById('formSubmit');
      if (!btn) return;
      btn.querySelector('span').textContent = 'Enviado!';
      btn.classList.add('success');
      btn.disabled = true;
      setTimeout(() => {
        contactForm.reset();
        btn.querySelector('span').textContent = 'Enviar';
        btn.classList.remove('success');
        btn.disabled = false;
      }, 3000);
    });
  }

  /* ESTIMATIVA FORM */
  const estimForm = document.getElementById('estimForm');
  if (estimForm) {
    estimForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const whats = document.getElementById('estWhats')?.value;
      const cidade = document.getElementById('estCidade')?.value;
      const seg = document.getElementById('estSegmento')?.value;
      const tipo = document.querySelector('input[name="tipo"]:checked')?.value;
      const msg = encodeURIComponent(`Olá! Vim do site e gostaria de um orçamento.\n\n📌 Serviço: ${tipo || 'Não informado'}\n🏭 Segmento: ${seg || 'Não informado'}\n📍 Cidade: ${cidade || 'Não informada'}`);
      window.open(`https://wa.me/558533057000?text=${msg}`, '_blank');
    });
  }

  /* BACK TO TOP */
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 500));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* SMOOTH SCROLL ANCHOR */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  /* ACTIVE NAV ON SCROLL */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-list>li>a');
  if (sections.length && navLinks.length) {
    const secObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.id;
          navLinks.forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { threshold: 0.4, rootMargin: '-80px 0px 0px 0px' });
    sections.forEach(s => secObs.observe(s));
  }
});
