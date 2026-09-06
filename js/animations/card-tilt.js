    const { gsap } = window;

    if (!gsap) {
        throw new Error('GSAP is required for card plane interactions.');
    }

    document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.project-card, .pub-card, .cert-card');
    
    cards.forEach(card => {
        const thumb = card.querySelector('.project-thumb');
        const body = card.querySelector('.project-body');
        const planeTarget = thumb || card;
        const planeX = gsap.quickTo(planeTarget, 'x', { duration: 0.35, ease: 'power2.out' });
        const planeY = gsap.quickTo(planeTarget, 'y', { duration: 0.35, ease: 'power2.out' });
        const bodyX = body ? gsap.quickTo(body, 'x', { duration: 0.35, ease: 'power2.out' }) : null;
        const bodyY = body ? gsap.quickTo(body, 'y', { duration: 0.35, ease: 'power2.out' }) : null;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const offsetX = ((x - centerX) / centerX) * 10;
            const offsetY = ((y - centerY) / centerY) * 8;

            card.classList.add('is-tilting');
            planeX(offsetX);
            planeY(offsetY);
            if (bodyX) bodyX(offsetX * -0.35);
            if (bodyY) bodyY(offsetY * -0.35);
        });

        card.addEventListener('mouseleave', () => {
            card.classList.remove('is-tilting');
            planeX(0);
            planeY(0);
            if (bodyX) bodyX(0);
            if (bodyY) bodyY(0);
        });
    });
});
