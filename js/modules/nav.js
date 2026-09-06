document.getElementById('footerYear').textContent = new Date().getFullYear();

const menu = document.getElementById('mobileMenu');
const backdrop = document.getElementById('mobileBackdrop');
const hamBtn = document.getElementById('hamburgerBtn');

function toggleMenu(force) {
  const isOpen = force !== undefined ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
  hamBtn.classList.toggle('open', isOpen);
  hamBtn.setAttribute('aria-expanded', String(isOpen));
}

window.toggleMenu = toggleMenu;

(function initNavActiveState() {
  const sections = ['about', 'experience', 'projects', 'publications', 'certifications', 'contact'];
  const navLinks = {};
  sections.forEach(id => {
    const link = document.querySelector(`.nav-links a[data-section="${id}"]`);
    if (link) navLinks[id] = link;
  });
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (navLinks[entry.target.id]) {
        navLinks[entry.target.id].classList.toggle('active', entry.isIntersecting);
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObs.observe(el);
  });
})();
