import { store } from '../state/store.js';
import { savePersistedState } from '../services/storage.service.js';

export class TaskTable {
  constructor(headerContainer, tableContainer) {
    this.headerContainer = headerContainer;
    this.tableContainer = tableContainer;
    
    // Khởi tạo Event Delegation ngay khi tạo Component
    this.initEventDelegation();
  }

  render(state) {
    const week = state.weeks.find(w => w.w === state.currentWeek);
    if (!week) return;

    const currentPhase = state.phases.find(p => p.id === week.phase) || state.phases[0];

    // 1. Render Week Header
    this.headerContainer.innerHTML = `
      <div class="week-header__badge" style="background: ${currentPhase.color}22; color: ${currentPhase.color}">
        W${week.w}
      </div>
      <div class="week-header__meta">
        <div class="week-header__phase" style="color: ${currentPhase.color}">
          Phase ${week.phase} — ${currentPhase.title}
        </div>
        <h1 class="week-header__title">${week.title}</h1>
        <p class="week-header__sub">${week.sub}</p>
      </div>
      <div class="week-header__gate">
        <div class="week-header__gate-label">✓ Gate Criteria</div>
        <div class="week-header__gate-text">${week.gate}</div>
      </div>
    `;

    // 2. Filter & Search Tasks
    let tasks = week.tasks;
    if (state.filter !== 'all') tasks = tasks.filter(t => t.tag === state.filter);
    if (state.search) {
      const q = state.search.toLowerCase();
      tasks = tasks.filter(t => 
        t.title.toLowerCase().includes(q) || (t.sub && t.sub.toLowerCase().includes(q))
      );
    }

    // 3. Render Table với Key đã được mã hóa an toàn (encodeURIComponent)
    const rows = tasks.map(t => {
      const rawKey = `${week.w}_${t.day}_${t.title.slice(0, 20)}`;
      const safeKey = encodeURIComponent(rawKey);
      const isDone = !!state.done[rawKey];

      return `
        <tr class="task-row">
          <td>
            <button class="task-check" role="checkbox" aria-checked="${isDone}" 
                    data-key="${safeKey}" aria-label="Mark task ${t.title} as completed" type="button">
            </button>
          </td>
          <td class="task-day">${t.day}</td>
          <td>
            <span class="task-tag tag--${t.tag}">${t.tag}</span>
            <span class="task-title ${isDone ? 'task-title--done' : ''}">${t.title}</span>
            ${t.sub ? `<div class="task-sub">${t.sub}</div>` : ''}
          </td>
          <td class="task-output">${t.out || ''}</td>
        </tr>
      `;
    }).join('');

    this.tableContainer.innerHTML = `
      <table class="task-table" aria-label="Weekly Tasks">
        <thead>
          <tr>
            <th scope="col" style="width: 40px">Status</th>
            <th scope="col" style="width: 50px">Day</th>
            <th scope="col">Task Details</th>
            <th scope="col">Expected Output</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Event Delegation: Bắt sự kiện click từ container cha, cực kỳ mượt mà và chống lỗi re-render
  initEventDelegation() {
    this.tableContainer.addEventListener('click', async (e) => {
      const checkBtn = e.target.closest('.task-check');
      if (!checkBtn) return;

      // Giải mã key về nguyên bản để lưu store
      const rawKey = decodeURIComponent(checkBtn.dataset.key);
      
      store.toggleTask(rawKey);
      await savePersistedState(store.state);
    });
  }
}
