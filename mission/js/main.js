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

  // 2. Tải dữ liệu từ weeks.json
  let rawData = [];
  try {
    const res = await fetch('./data/weeks.json');
    rawData = await res.json();
  } catch (e) {
    console.error("Lỗi đọc data/weeks.json:", e);
  }

  let phases = [];
  let weeks = [];

  // 3. ADAPTER: Kiểm tra cấu trúc JSON (Nested Phases mới hay Flat Weeks cũ)
  if (rawData.length > 0 && rawData[0].weeks) {
    // ==> Cấu trúc lồng nhóm theo Phase (p0 -> p5) của bạn
    const phaseColors = [
      'var(--p1)', 'var(--p2)', 'var(--p3)', 
      'var(--p4)', '#38bdf8', '#f43f5e'
    ];

    rawData.forEach((p, idx) => {
      const phaseId = idx + 1; // Tạo ID ánh xạ UI: 1, 2, 3, 4, 5, 6
      phases.push({
        id: phaseId,
        label: p.phase ? p.phase.toUpperCase() : `P${idx}`,
        title: p.phase_name || '',
        mission: p.phase_mission || '',
        color: phaseColors[idx % phaseColors.length]
      });

      if (Array.isArray(p.weeks)) {
        p.weeks.forEach(w => {
          weeks.push({
            ...w,
            phase: phaseId // Gắn phaseId vào từng tuần để UI lọc chuẩn xác
          });
        });
      }
    });
  } else {
    // ==> Trường hợp cấu trúc phẳng cũ (Fallback)
    weeks = rawData;
    try {
      const pRes = await fetch('./data/phases.json');
      phases = await pRes.json();
    } catch(e) {}
  }

  // 4. Tải tiến độ đã lưu của người dùng
  const persistedState = await loadPersistedState();

  // 5. Khởi tạo UI Components
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

  // 6. Đăng ký nhận sự kiện cập nhật giao diện
  store.subscribe((state) => {
    headerComp.render(state, isOnline);
    weekListComp.render(state);
    missionTapeComp.render(state);
    filterBarComp.render(state);
    taskTableComp.render(state);
    playbookComp.render(state);
    notesComp.render(state);
  });

  // 7. Nạp dữ liệu ban đầu vào Store
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
