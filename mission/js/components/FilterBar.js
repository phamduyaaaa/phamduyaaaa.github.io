import { store } from '../state/store.js';

export class FilterBar {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state) {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'read', label: '📖 Read' },
      { id: 'code', label: '💻 Code' },
      { id: 'paper', label: '📄 Paper' },
      { id: 'run', label: '🔬 Run' },
      { id: 'write', label: '✍️ Write' }
    ];

    this.container.innerHTML = `
      ${filters.map(f => `
        <button class="filter-btn ${state.filter === f.id ? 'filter-btn--active' : ''}" 
                data-filter="${f.id}" type="button">
          ${f.label}
        </button>
      `).join('')}
      <input class="search-input" type="search" placeholder="Search tasks…" 
             value="${state.search}" aria-label="Search tasks">
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        store.setState({ filter: e.currentTarget.dataset.filter });
      });
    });

    const searchInput = this.container.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
      store.setState({ search: e.target.value });
    });
  }
}
