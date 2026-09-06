document.addEventListener('DOMContentLoaded', () => {
    
    if (matchMedia('(pointer: fine)').matches) {
        const dot = document.createElement('div');
        dot.className = 'cursor-dot';
        const outline = document.createElement('div');
        outline.className = 'cursor-outline';
        document.body.appendChild(dot);
        document.body.appendChild(outline);

        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;
            
            dot.style.left = `${posX}px`;
            dot.style.top = `${posY}px`;
            
            outline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 400, fill: "forwards", easing: "ease-out" });
        });

        const interactives = document.querySelectorAll('a, button, .rl-btn');
        interactives.forEach(el => {
            el.addEventListener('mouseenter', () => {
                dot.classList.add('hovering');
                outline.classList.add('hovering');
            });
            el.addEventListener('mouseleave', () => {
                dot.classList.remove('hovering');
                outline.classList.remove('hovering');
            });
        });
    }
});
