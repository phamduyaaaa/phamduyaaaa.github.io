const { gsap, ScrollTrigger } = window;

if (!gsap || !ScrollTrigger) {
  throw new Error('GSAP and ScrollTrigger are required for scroll reveals.');
}

gsap.registerPlugin(ScrollTrigger);

const standaloneReveals = document.querySelectorAll(
  '[data-reveal]:not([data-stagger] [data-reveal])'
);

standaloneReveals.forEach((element) => {
  gsap.from(element, {
    opacity: 0,
    y: 80,
    scale: 0.94,
    filter: 'blur(7px)',
    duration: 1.1,
    ease: 'power3.out',
    delay: Number(element.dataset.delay || 0),
    scrollTrigger: {
      trigger: element,
      start: 'top 92%',
      toggleActions: 'play none none none',
    },
  });
});

document.querySelectorAll('[data-stagger]').forEach((container) => {
  const children = container.querySelectorAll(':scope > [data-reveal]');

  if (!children.length) return;

  gsap.from(children, {
    opacity: 0,
    y: 65,
    scale: 0.93,
    filter: 'blur(5px)',
    duration: 0.9,
    stagger: 0.14,
    ease: 'back.out(1.15)',
    scrollTrigger: {
      trigger: container,
      start: 'top 90%',
      toggleActions: 'play none none none',
    },
  });
});
