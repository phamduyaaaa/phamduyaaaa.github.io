const dialog = document.getElementById('mediaLightbox');
const video = document.getElementById('mediaLightboxVideo');
const title = document.getElementById('mediaLightboxTitle');
const status = document.getElementById('mediaLightboxStatus');

if (dialog && video && title && status) {
  const closeButton = dialog.querySelector('.media-lightbox-close');

  document.querySelectorAll('.project-media-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      title.textContent = trigger.dataset.mediaTitle;
      status.textContent = '';
      video.src = trigger.dataset.mediaSrc;
      dialog.showModal();
      video.play().catch(() => {
        status.textContent = 'Press play to start the video.';
      });
    });
  });

  closeButton?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    status.textContent = '';
  });
  video.addEventListener('error', () => {
    status.textContent = 'This video could not be loaded.';
  });
}
