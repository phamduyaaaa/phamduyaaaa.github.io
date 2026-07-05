export class Playbook {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state) {
    const week = state.weeks.find(w => w.w === state.currentWeek);
    
    if (!week || !week.playbook || week.playbook.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <h2 class="section-title">Playbook</h2>
      <div class="playbook-grid">
        ${week.playbook.map(p => `
          <article class="pb-card">
            <h3 class="pb-card__label">${p.k}</h3>
            <p class="pb-card__val">${p.v}</p>
          </article>
        `).join('')}
      </div>
    `;
  }
}
