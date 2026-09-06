    const { gsap } = window;

    if (!gsap) {
        throw new Error('GSAP is required for card tilt.');
    }

    document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.project-card, .pub-card, .cert-card');
    
    cards.forEach(card => {
        const rotateX = gsap.quickTo(card, 'rotationX', { duration: 0.35, ease: 'power2.out' });
        const rotateY = gsap.quickTo(card, 'rotationY', { duration: 0.35, ease: 'power2.out' });
        const scaleX = gsap.quickTo(card, 'scaleX', { duration: 0.35, ease: 'power2.out' });
        const scaleY = gsap.quickTo(card, 'scaleY', { duration: 0.35, ease: 'power2.out' });

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const tiltX = ((y - centerY) / centerY) * -12;
            const tiltY = ((x - centerX) / centerX) * 12;

            card.classList.add('is-tilting');
            rotateX(tiltX);
            rotateY(tiltY);
            scaleX(1.035);
            scaleY(1.035);
        });

        card.addEventListener('mouseleave', () => {
            card.classList.remove('is-tilting');
            rotateX(0);
            rotateY(0);
            scaleX(1);
            scaleY(1);
        });
    });
});
