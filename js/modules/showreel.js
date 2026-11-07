const video = document.getElementById('heroShowreel');
const toggle = document.getElementById('showreelToggle');
const label = toggle?.querySelector('.showreel-toggle-label');
const caption = document.getElementById('showreelCaption');

if (video && toggle && label) {
  const clips = [
    { src: 'assets/robot1.webm', label: 'Service robot navigating an indoor environment' },
    { src: 'assets/robot8.webm', label: 'UR5e robot arm performing a peg-in-hole task' },
    { src: 'assets/robot6.webm', label: 'Microduck bipedal robot walking in simulation' },
  ];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let clipIndex = 0;
  let isPlaying = false;
  let timer;

  function updateToggle() {
    const action = isPlaying ? 'Pause' : 'Play';
    label.textContent = `${action} showreel`;
    toggle.setAttribute('aria-label', `${action} showreel`);
    toggle.setAttribute('aria-pressed', String(isPlaying));
  }

  function scheduleNextClip() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      clipIndex = (clipIndex + 1) % clips.length;
      video.src = clips[clipIndex].src;
      video.setAttribute('aria-label', clips[clipIndex].label);
      video.load();
      play();
    }, 3200);
  }

  function play() {
    video.play().then(() => {
      isPlaying = true;
      caption.textContent = 'Field robotics · manipulation · locomotion';
      updateToggle();
      scheduleNextClip();
    }).catch(() => {
      isPlaying = false;
      updateToggle();
    });
  }

  toggle.addEventListener('click', () => {
    if (isPlaying) {
      window.clearTimeout(timer);
      video.pause();
      isPlaying = false;
      updateToggle();
      return;
    }

    play();
  });

  video.addEventListener('error', () => {
    window.clearTimeout(timer);
    isPlaying = false;
    caption.textContent = 'Showreel unavailable in this browser. Explore the project demos below.';
    updateToggle();
  });

  updateToggle();

  if (!prefersReducedMotion) {
    const bootScreen = document.getElementById('ros-boot-screen');
    if (bootScreen?.style.display === 'none') {
      play();
    } else {
      window.addEventListener('boot:complete', play, { once: true });
    }
  }
}
