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
  // 1. Khởi tạo Storage & Kiểm tra kết nối mạng (Firebase / LocalStorage)
  const isOnline = await initStorage();

  // 2. Tải dữ liệu từ weeks.json
  let rawData = [];
  try {
    const res = await fetch('./data/weeks.json');
    rawData = await res.json();
  } catch (e) {
    console.error("Lỗi đọc file data/weeks.json:", e);
  }

  let phases = [];
  let weeks = [];

  // 3. DATA ADAPTER: Chuẩn hóa & bóc tách dữ liệu
  if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].weeks) {
    // ==> Trường hợp 1: Cấu trúc lồng nhóm theo Phase (p0 -> p5) của bạn
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
            phase: phaseId,
            // PHÒNG THỦ: Đảm bảo tasks luôn là mảng [], tránh lỗi 'forEach' on undefined
            tasks: Array.isArray(w.tasks) ? w.tasks : []
          });
        });
      }
    });
  } else {
    // ==> Trường hợp 2: Cấu trúc phẳng cũ (Fallback)
    weeks = (rawData || []).map(w => ({
      ...w,
      tasks: Array.isArray(w.tasks) ? w.tasks : []
    }));

    try {
      const pRes = await fetch('./data/phases.json');
      phases = await pRes.json();
    } catch(e) {
      console.warn("Không tải được phases.json, sử dụng cấu hình mặc định.");
    }
  }

  // 4. Tải tiến độ đã lưu của người dùng (Checklist done & Notes)
  const persistedState = await loadPersistedState();

  // 5. Khởi tạo các UI Components dựa trên data-attribute
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

  // 6. Đăng ký nhận sự kiện cập nhật giao diện (Reactive Pub/Sub)
  store.subscribe((state) => {
    headerComp.render(state, isOnline);
    weekListComp.render(state);
    missionTapeComp.render(state);
    filterBarComp.render(state);
    taskTableComp.render(state);
    playbookComp.render(state);
    notesComp.render(state);
  });

  // 7. Nạp trạng thái ban đầu vào Store để kích hoạt lần render đầu tiên
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
