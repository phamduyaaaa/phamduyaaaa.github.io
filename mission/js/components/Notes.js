import { store } from '../state/store.js';
import { savePersistedState } from '../services/storage.service.js';

export class Notes {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(state) {
    const currentNotes = state.notes[state.currentWeek] || [];

    this.container.innerHTML = `
      <h2 class="section-title">Notes</h2>
      <textarea class="notes-input" placeholder="Ghi chú cho tuần này… (Ctrl + Enter để lưu)" 
                aria-label="Notes for this week"></textarea>
      <div class="notes-log" role="log" aria-live="polite">
        ${currentNotes.map(n => `
          <article class="note-item">
            <div class="note-meta"><time>${n.date}</time></div>
            <p class="note-text">${n.text}</p>
          </article>
        `).join('')}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const textarea = this.container.querySelector('.notes-input');
    textarea.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        const val = textarea.value.trim();
        if (!val) return;
        
        store.addNote(store.state.currentWeek, val);
        await savePersistedState(store.state);
      }
    });
  }
}
