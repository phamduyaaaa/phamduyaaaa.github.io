import { store } from '../state/store.js';

export class Header {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state, isOnline) {
    let totalDone = 0;
    let totalTasks = 0;

    state.weeks.forEach(w => {
      w.tasks.forEach((t, idx) => {
        totalTasks++;
        const key = `${w.w}_${t.day}_${idx}`;
        if (state.done[key]) totalDone++;
      });
    });

    const pct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

    this.container.innerHTML = `
      <span class="topbar__logo">⬡ MISSION CTRL</span>
      <div class="topbar__separator"></div>
      <nav class="phase-pills" aria-label="Phases Navigation">
        ${state.phases.map(p => `
          <button class="phase-pill ${p.id === state.currentPhase ? 'phase-pill--active' : ''}" 
                  data-p="${p.id}" type="button">
            ${p.label} · ${p.title.split('(')[0].trim()}
          </button>
        `).join('')}
      </nav>
      <div class="topbar__spacer"></div>
      <div class="global-stats" role="status" aria-live="polite">
        <span><span class="global-stats__val">${totalDone}</span> done</span>
        <span><span class="global-stats__val">${totalTasks}</span> tasks</span>
        <span><span class="global-stats__val">${pct}</span>%</span>
        <span><span class="global-stats__val">W${state.currentWeek}</span></span>
      </div>
      <div class="sync-dot ${isOnline ? 'sync-dot--ok' : ''}" title="${isOnline ? 'Online Sync' : 'Offline Mode'}"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.phase-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phaseId = Number(e.currentTarget.dataset.p);
        const { weeks } = store.state;
        const firstWeekOfPhase = weeks.find(w => w.phase === phaseId);
        store.setState({
          currentPhase: phaseId,
          currentWeek: firstWeekOfPhase ? firstWeekOfPhase.w : store.state.currentWeek
        });
      });
    });
  }
}
