if (matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.nav-links a').forEach((magnet) => {
    magnet.addEventListener('mousemove', (event) => {
      const rect = magnet.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      magnet.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    });

    magnet.addEventListener('mouseleave', () => {
      magnet.style.transform = 'translate(0px, 0px)';
    });
  });
}
