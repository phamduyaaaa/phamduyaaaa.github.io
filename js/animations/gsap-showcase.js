const { gsap, ScrollTrigger } = window;

if (!gsap || !ScrollTrigger) {
  throw new Error('GSAP and ScrollTrigger are required for the showcase animations.');
}

gsap.registerPlugin(ScrollTrigger);

function splitText(element) {
  const text = element.textContent.trim();
  element.setAttribute('aria-label', text);
  element.textContent = '';

  return [...text].map((character) => {
    const span = document.createElement('span');
    span.className = 'gsap-char';
    span.textContent = character === ' ' ? '\u00a0' : character;
    span.setAttribute('aria-hidden', 'true');
    element.appendChild(span);
    return span;
  });
}

function initTextAnimations() {
  document.querySelectorAll('h2, .section-label').forEach((element) => {
    const chars = splitText(element);

    gsap.from(chars, {
      yPercent: 120,
      rotateX: -80,
      opacity: 0,
      duration: 0.8,
      stagger: 0.025,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: element,
        start: 'top 86%',
        toggleActions: 'play none none reverse',
      },
    });
  });
}

function initSvgAnimation() {
  const paths = document.querySelectorAll('.orbit-path');
  const nodes = document.querySelectorAll('.orbit-node');

  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.to(paths, {
    strokeDashoffset: 0,
    duration: 2.4,
    stagger: 0.25,
    ease: 'power2.inOut',
    delay: 0.6,
  });
  gsap.from('.cubist-facet', {
    opacity: 0,
    scale: 0.72,
    rotation: -8,
    transformOrigin: '50% 50%',
    duration: 1.25,
    stagger: 0.16,
    ease: 'power4.out',
    delay: 0.35,
  });
  gsap.to(nodes, {
    scale: 1.8,
    opacity: 0.35,
    transformOrigin: 'center',
    duration: 1.2,
    stagger: 0.2,
    repeat: 2,
    yoyo: true,
    ease: 'sine.inOut',
  });
  gsap.to('.hero-orbit', {
    yPercent: 18,
    rotation: 3,
    transformOrigin: 'center',
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
    },
  });
  gsap.to('.cubist-facet:nth-of-type(odd)', {
    x: 12,
    y: -8,
    rotation: 2,
    duration: 3.5,
    repeat: 1,
    yoyo: true,
    ease: 'steps(4)',
  });
}

function initScrollStory() {
  document.querySelectorAll('section:not(.hero)').forEach((section) => {
    gsap.fromTo(section, { backgroundPosition: '50% 0%' }, {
      backgroundPosition: '50% 100%',
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  gsap.to('.hero-text', {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  });
}

function initUiInteractions() {
  document.querySelectorAll('.btn, .nav-cta, .contact-link, .project-link').forEach((element) => {
    const enter = () => gsap.to(element, {
      y: -5,
      scale: 1.035,
      duration: 0.35,
      overwrite: 'auto',
      ease: 'power3.out',
    });
    const leave = () => gsap.to(element, {
      y: 0,
      scale: 1,
      duration: 0.45,
      overwrite: 'auto',
      ease: 'elastic.out(1, 0.5)',
    });

    element.addEventListener('mouseenter', enter);
    element.addEventListener('mouseleave', leave);
    element.addEventListener('focus', enter);
    element.addEventListener('blur', leave);
  });
}

function init() {
  initTextAnimations();
  initSvgAnimation();
  initScrollStory();
  initUiInteractions();
  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
