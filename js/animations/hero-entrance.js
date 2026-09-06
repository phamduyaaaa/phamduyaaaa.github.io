const { gsap } = window;

if (!gsap) {
  throw new Error('GSAP is required for the hero entrance animation.');
}

function initHeroEntrance() {
  if (window.__heroEntranceStarted) return;
  window.__heroEntranceStarted = true;

  const timeline = gsap.timeline({ delay: 0.2 });

  timeline
    .from('.hero-eyebrow', {
      opacity: 0,
      y: 35,
      x: -25,
      filter: 'blur(8px)',
      duration: 0.8,
      ease: 'power2.out',
    })
    .from('h1', {
      opacity: 0,
      y: 65,
      scale: 0.9,
      filter: 'blur(10px)',
      duration: 1.1,
      ease: 'power3.out',
    }, '-=0.3')
    .from('.hero-rule-line', {
      scaleX: 0,
      opacity: 0,
      duration: 0.8,
      transformOrigin: 'left',
      ease: 'expo.out',
    }, '-=0.4')
    .from('.hero-role', {
      opacity: 0,
      y: 35,
      filter: 'blur(6px)',
      duration: 0.8,
    }, '-=0.3')
    .from('.hero-bio', {
      opacity: 0,
      y: 30,
      duration: 0.75,
    }, '-=0.4')
    .from('.btn-group .btn', {
      opacity: 0,
      y: 28,
      scale: 0.86,
      stagger: 0.14,
      duration: 0.65,
      ease: 'back.out(1.7)',
    }, '-=0.3')
    .from('.metrics-bar', {
      opacity: 0,
      y: 35,
      scale: 0.95,
      duration: 0.8,
    }, '-=0.2')
    .from('.rl-container', {
      opacity: 0,
      x: 100,
      rotationY: -12,
      scale: 0.88,
      duration: 1.2,
      ease: 'power3.out',
    }, '-=0.8');

  gsap.to('.hero-rules', {
    yPercent: 12,
    duration: 8,
    ease: 'none',
    repeat: 1,
    yoyo: true,
  });
  window.heroEntranceTimeline = timeline;
}

if (document.getElementById('ros-boot-screen')?.style.display === 'none') {
  initHeroEntrance();
} else {
  window.addEventListener('boot:complete', initHeroEntrance, { once: true });
}
