import { initStorage, loadPersistedState } from './services/storage.service.js';
import { store } from './state/store.js';

import { Header } from './components/Header.js';
import { WeekList } from './components/WeekList.js';
import { MissionTape } from './components/MissionTape.js';
import { FilterBar } from './components/FilterBar.js';
import { TaskTable } from './components/TaskTable.js';
import { Playbook } from './components/Playbook.js';
import { Notes } from './components/Notes.js';

async function bootstrap() {
  // 1. Khởi tạo Storage & Kiểm tra kết nối mạng
  const isOnline = await initStorage();

  // 2. Tải dữ liệu tĩnh từ folder data/
  const [phasesRes, weeksRes] = await Promise.all([
    fetch('./data/phases.json'),
    fetch('./data/weeks.json')
  ]);
  const phases = await phasesRes.json();
  const weeks = await weeksRes.json();

  // 3. Tải tiến độ đã lưu của người dùng (từ Firebase hoặc LocalStorage)
  const persistedState = await loadPersistedState();

  // 4. Khởi tạo các UI Components và gắn vào DOM
  const headerComp = new Header(document.querySelector('[data-component="header"]'));
  const weekListComp = new WeekList(document.querySelector('[data-component="week-list"]'));
  const missionTapeComp = new MissionTape(document.querySelector('[data-component="mission-tape"]'));
  const filterBarComp = new FilterBar(document.querySelector('[data-component="filter-bar"]'));
  const taskTableComp = new TaskTable(
    document.querySelector('[data-component="week-header"]'),
    document.querySelector('[data-component="task-table"]')
  );
  const playbookComp = new Playbook(document.querySelector('[data-component="playbook"]'));
  const notesComp = new Notes(document.querySelector('[data-component="notes"]'));

  // 5. Đăng ký nhận sự kiện cập nhật giao diện khi Store thay đổi (Pub/Sub)
  store.subscribe((state) => {
    headerComp.render(state, isOnline);
    weekListComp.render(state);
    missionTapeComp.render(state);
    filterBarComp.render(state);
    taskTableComp.render(state);
    playbookComp.render(state);
    notesComp.render(state);
  });

  // 6. Nạp dữ liệu ban đầu vào Store để kích hoạt lần render đầu tiên
  store.setState({
    phases,
    weeks,
    currentPhase: 1,
    currentWeek: weeks[0]?.w || 1,
    done: persistedState.done || {},
    notes: persistedState.notes || {}
  });
}

window.addEventListener('DOMContentLoaded', bootstrap);
