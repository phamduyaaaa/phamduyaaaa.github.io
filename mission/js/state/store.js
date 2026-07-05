class Store {
  constructor() {
    this.state = {
      phases: [],
      weeks: [],
      currentPhase: 1,
      currentWeek: 1,
      filter: 'all',
      search: '',
      done: {},
      notes: {}
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  toggleTask(taskKey) {
    const updatedDone = {
      ...this.state.done,
      [taskKey]: !this.state.done[taskKey]
    };
    this.setState({ done: updatedDone });
  }

  addNote(weekNum, noteText) {
    const currentNotes = this.state.notes[weekNum] || [];
    const newNote = {
      text: noteText,
      date: new Date().toLocaleString('vi-VN')
    };
    const updatedNotes = {
      ...this.state.notes,
      [weekNum]: [newNote, ...currentNotes]
    };
    this.setState({ notes: updatedNotes });
  }
}

export const store = new Store();
