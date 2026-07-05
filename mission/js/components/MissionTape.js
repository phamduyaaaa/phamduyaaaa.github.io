import { store } from '../state/store.js';

export class MissionTape {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state) {
    this.container.innerHTML = state.phases.map(ph => {
      const phWeeks = state.weeks.filter(w => w.phase === ph.id);
      const segs = phWeeks.map(w => {
        let done = 0;
        w.tasks.forEach((t, idx) => {
          if (state.done[`${w.w}_${t.day}_${idx}`]) done++;
        });
        const pct = w.tasks.length ? (done / w.tasks.length) * 100 : 0;
        const isCurrent = w.w === state.currentWeek ? 'tape-seg--current' : '';

        return `
          <button class="tape-seg ${isCurrent}" data-w="${w.w}" type="button">
            <span class="tape-seg__label" style="color: ${ph.color}">W${w.w}</span>
            <span class="tape-seg__title">${w.title.split('—')[0].trim().slice(0, 16)}</span>
            <span class="tape-seg__bar" style="width: ${pct}%; background-color: ${ph.color}"></span>
          </button>
        `;
      }).join('');
      return `<div class="tape-phase">${segs}</div>`;
    }).join('');

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.tape-seg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const weekNum = Number(e.currentTarget.dataset.w);
        const targetWeek = store.state.weeks.find(w => w.w === weekNum);
        if (targetWeek) {
          store.setState({ currentPhase: targetWeek.phase, currentWeek: weekNum });
        }
      });
    });
  }
}
