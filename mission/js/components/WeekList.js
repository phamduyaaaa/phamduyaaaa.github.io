import { store } from '../state/store.js';

export class WeekList {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state) {
    const currentPhaseWeeks = state.weeks.filter(w => w.phase === state.currentPhase);

    this.container.innerHTML = currentPhaseWeeks.map(w => {
      let doneCount = 0;
      const totalTasks = w.tasks.length;

      const sparkBars = w.tasks.map((t, idx) => {
        const key = `${w.w}_${t.day}_${idx}`;
        const isDone = !!state.done[key];
        if (isDone) doneCount++;
        return `<div class="spark-bar ${isDone ? 'spark-bar--done' : ''}"></div>`;
      }).join('');

      const pct = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;
      const isActive = w.w === state.currentWeek ? 'week-item--active' : '';

      return `
        <button class="week-item ${isActive}" data-w="${w.w}" type="button">
          <span class="week-item__num">${w.w}</span>
          <span class="week-item__title">${w.title}</span>
          <div class="week-sparkline" aria-hidden="true">${sparkBars}</div>
          <span class="week-item__pct">${pct}%</span>
        </button>
      `;
    }).join('');

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.week-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const weekNum = Number(e.currentTarget.dataset.w);
        store.setState({ currentWeek: weekNum });
      });
    });
  }
}
