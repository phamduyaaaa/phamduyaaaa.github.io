if (window.gsap && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.gsap.globalTimeline.timeScale(50);
}

import './modules/boot-screen.js';
import './modules/nav.js';
import './modules/showreel.js';
import './modules/media-lightbox.js';
import './modules/cursor.js';
import './animations/scroll-reveal.js';
import './animations/hero-entrance.js';
import './animations/card-tilt.js';
import './animations/magnetic-btn.js';
import './animations/gsap-showcase.js';
