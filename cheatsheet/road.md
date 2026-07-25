# 🤖 Systems Engineering Cheatsheet — Robotics

> **Mục tiêu:** Tối ưu cho **Kỹ sư Core Robotics** làm việc trực tiếp trên phần cứng robot — chiến trường là bên trong bo mạch, không phải cloud fleet.
>
> **Cách dùng:** Mỗi từ khoá → tự viết định nghĩa bằng lời mình + 1 đoạn code C++ minh hoạ + 1 lần đo bằng công cụ profiling thực tế.

---

## 📐 Lộ trình học — Phân bổ thời gian gợi ý

```
Lớp 1 + 2 (Nền tảng)     ████████████████████████  60%  ← Không vững thì Lớp 3 sẽ bị "black box"
Lớp 3 (Middleware & Math) ████████████████          30%
Lớp 4 (Edge AI Deploy)   ████                      10%
```

> ⚠️ **Lớp Distributed Systems (Raft, Paxos, CAP theorem) đã được lược bỏ** — đó là lãnh địa của Backend/Fleet Engineer. Với On-device Robotics, đây là kiến thức gây phân tâm khỏi mục tiêu tối ưu real-time.

---

## Lớp 1 — Modern C++ Core, Memory Model & Concurrency

> Nền tảng tuyệt đối: kiểm soát bộ nhớ, tối ưu chu kỳ xung nhịp, xử lý đa luồng không khoá.

<details>
<summary><strong>🧱 C++ Core & Custom Allocators</strong> — tránh copy ngầm trong vòng lặp 1000 Hz</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| `Move semantics` & Rvalue references | Tránh copy dữ liệu ngầm trong các vòng lặp tần số cao — hiểu rõ khi nào compiler ngầm copy |
| `Memory alignment` & Padding | Ảnh hưởng trực tiếp đến cache hit rate và SIMD vectorization |
| Zero-cost abstractions | Dùng `constexpr`, `inline`, template để không trả thêm chi phí runtime |
| `std::pmr::memory_resource` (Custom Allocators) | Tự quản lý bộ nhớ đệm → tránh phân mảnh heap RAM trong loop dài hạn |
| `std::expected` / No-exception Policy | Tránh `try-catch` trong critical loop; ưu tiên xử lý lỗi theo giá trị trả về để giữ tính xác định của hệ thống |
| SoA vs AoS *(⭐ Optional)* | Bố trí dữ liệu phù hợp để cải thiện cache locality và SIMD |
</details>

<details>
<summary><strong>⚛️ Memory Model & Atomics</strong> — nền tảng của mọi code concurrent đúng</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| `memory_order` (relaxed / acquire / release / seq_cst) | Hiểu thứ tự đảm bảo — sai `memory_order` là lỗi không tái hiện được |
| `std::atomic<T>` | Không phải "luôn an toàn" — atomic read-modify-write vẫn có race nếu dùng sai |
| happens-before relation | Nền tảng lý thuyết để chứng minh code đúng, không chỉ "chạy được" |
| Cache coherence (MESI protocol) | Hiểu tại sao `false sharing` giết chết hiệu năng multi-core |
| False sharing | Dùng `alignas(64)` để cô lập dữ liệu trên các cache line khác nhau |

</details>

<details>
<summary><strong>🔒 Đồng bộ hoá & Lock-free</strong> — biết khi nào dùng cái gì</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| `mutex` vs `spinlock` | Spinlock sai chỗ → tốn CPU 100%; mutex sai chỗ → latency spike |
| `condition_variable` | Tránh busy-wait; hiểu spurious wakeup |
| Read-write lock (`shared_mutex`) | Khi read nhiều hơn write — cẩn thận writer starvation |
| Lock-free vs Wait-free | Lock-free: ai đó tiến; Wait-free: tất cả tiến — chọn đúng ngữ cảnh |
| SPSC / MPSC Ring Buffer | Cấu trúc chuẩn để truyền data giữa thread sensor và thread control |
| ABA problem & Hazard pointers | Lỗi kinh điển của lock-free — bắt buộc hiểu trước khi tự implement |

</details>

<details>
<summary><strong>🔍 Công cụ Profiling & Debug</strong> — không đo được thì không tối ưu được</summary>

| Công cụ | Dùng để làm gì |
|---|---|
| `ThreadSanitizer (TSan)` | Phát hiện data race — chạy trong CI, không chờ đến khi bug xuất hiện |
| `AddressSanitizer (ASan)` | Phát hiện memory leak, use-after-free, buffer overflow |
| `perf` + Flame graph | Tìm đúng hàm đang ngốn CPU — đừng đoán, hãy đo |
| `strace` | Theo dõi system call — debug khi robot bị lag không rõ nguyên nhân |
| `Valgrind / Helgrind` | Phân tích sâu hơn TSan, chậm hơn nhưng chi tiết hơn |

</details>

---

## Lớp 2 — OS Internals, Hardware Architecture & Real-time Linux

> Hiểu sâu phần cứng và Linux để triệt tiêu các nút thắt cổ chai về độ trễ.

<details>
<summary><strong>⚡ Hardware & Low-level Optimization</strong> — tận dụng phần cứng đến giới hạn</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| SIMD — `AVX-512` (x86) / `ARM NEON` | Nhân ma trận 3D cho LiDAR/IMU nhanh hơn 4–8× so với scalar code |
| Branch Prediction & Pipeline stalls | Sắp xếp lại điều kiện `if` để CPU đoán đúng → giảm stall |
| DMA (Direct Memory Access) | Truyền dữ liệu sensor ↔ RAM mà không chiếm CPU cycles |
| PTP (IEEE 1588) | Đồng bộ timestamp giữa các cảm biến và máy tính ở độ chính xác cao, hữu ích cho Sensor Fusion |
| CPU P-State / C-State *(⭐ Optional)* | Điều chỉnh power management để giảm jitter trong hệ thống real-time khi cần |

</details>

<details>
<summary><strong>⏱️ Real-time Scheduling</strong> — yếu tố sống còn của robot phản ứng đúng hạn</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| CFS (Completely Fair Scheduler) | Scheduler mặc định của Linux — **không** phù hợp cho real-time |
| `PREEMPT_RT` Patch | Tiêu chuẩn vàng của ngành xe tự lái và robot công nghiệp |
| `SCHED_FIFO` / `SCHED_RR` | Policy real-time — dùng cho thread điều khiển động cơ |
| Context switch & Priority inversion | Priority inversion là thủ phạm của nhiều bug latency khó tái hiện |

</details>

<details>
<summary><strong>🧠 Memory Management & Kernel I/O</strong> — hiểu vì sao latency đột biến</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| Virtual memory & Page fault | Page fault trong real-time loop → latency spike → dùng `mlockall()` để khoá |
| `mmap` (memory-mapped I/O) | Giao tiếp với thiết bị ngoại vi không qua system call overhead |
| NUMA | Trên multi-socket, dữ liệu cross-NUMA tốn gấp đôi latency |
| `epoll` / `io_uring` | I/O bất đồng bộ hiệu năng cao cho sensor stream |

</details>

<details>
<summary><strong>📊 Đo lường Latency đúng cách</strong> — con số nào mới thực sự quan trọng</summary>

| Khái niệm | Ghi chú thực chiến |
|---|---|
| Latency vs Throughput | Hai chỉ số khác nhau — tối ưu một cái có thể làm hại cái kia |
| **Tail latency (p99 / p99.9)** | Trong robotics, latency tệ nhất quan trọng hơn latency trung bình |
| Jitter & Latency Spikes | Jitter cao → robot co giật → phân tích bằng `cyclictest` |

</details>

---

## Lớp 3 — Robot Middleware, Zero-Copy IPC & Math Engines

> Nơi C++ giao tiếp với cảm biến, cơ cấu chấp hành và hệ điều hành robot.

<details>
<summary><strong>🤝 ROS 2 Core & DDS</strong> — tầng giấu latency mà 90% người dùng không để ý</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| ROS 2 Executor (Single / Multi-threaded) | Hiểu executor trước khi thêm thread — sai executor type → callback bị block |
| Callback groups & Mutually Exclusive | Điều phối để callback Camera không chặn callback Motor |
| DDS (Data Distribution Service) | Tầng transport phía dưới ROS 2 — cấu hình sai QoS là nguồn gốc nhiều vấn đề |
| QoS policy (reliability, durability, deadline) | `BEST_EFFORT` cho sensor; `RELIABLE` cho command — đừng dùng default cho tất cả |
| Lifecycle Nodes (`rclcpp_lifecycle`) | Quản lý vòng đời node theo trạng thái rõ ràng trước khi đưa vào hoạt động |
| UDP Buffer Tuning | Điều chỉnh `rmem_max` và `wmem_max` khi truyền dữ liệu DDS tốc độ cao |

</details>

<details>
<summary><strong>⚡ Zero-Copy IPC</strong> — bắt buộc khi truyền LiDAR point cloud hàng trăm MB/s</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| **Iceoryx** (True Zero-Copy Shared Memory) | Truyền con trỏ bộ nhớ thay vì copy data — tiêu chuẩn công nghiệp cho robotics |
| Shared memory transport | ROS 2 hỗ trợ qua `rmw_iceoryx` — kích hoạt để loại bỏ serialize overhead |
| `Zenoh` | Transport thay thế DDS, hiệu năng cao hơn qua WAN/edge |
| Protobuf / FlatBuffers | FlatBuffers: zero-parse; Protobuf: ecosystem tốt hơn — chọn theo use case |

</details>

<details>
<summary><strong>🔢 Robotics Math & Simulation</strong> — vũ khí toán học C++ bắt buộc</summary>

| Công cụ | Dùng để làm gì |
|---|---|
| **Eigen** | Đại số tuyến tính C++ — rotation matrix, transformation, covariance |
| **Ceres Solver / GTSAM** | Tối ưu hoá phi tuyến cho SLAM và trajectory optimization |
| **NVIDIA Isaac Sim / Gazebo** | Test thuật toán trong môi trường vật lý 3D trước khi lên robot thật |
| Kinematics & Dynamics (FK / IK) | Forward/Inverse Kinematics — nền tảng để điều khiển cánh tay robot |

</details>

<details>
<summary><strong>⏰ Real-time Constraints</strong> — khác biệt giữa "chạy nhanh" và "chạy đúng hạn"</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| RTOS (FreeRTOS / Zephyr) | Dùng cho vi điều khiển nhúng cần determinism tuyệt đối |
| Deadline scheduling | Kernel tự động preempt khi task sắp trễ deadline |
| WCET (Worst-Case Execution Time) | Phân tích bằng tool (e.g., `OTAWA`) trước khi deploy lên robot thật |
| Watchdog Timer | Nếu control loop không heartbeat đúng hạn → hardware trigger phanh khẩn cấp |

</details>

---

## Lớp 4 — Edge AI Infra & Real-world Deployment

> Đưa mô hình AI chạy trực tiếp trên chip nhúng robot với độ trễ tối thiểu.

<details>
<summary><strong>🚀 Edge AI Acceleration</strong> — cầu nối giữa Systems Engineering và Embodied AI</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| **TensorRT** | Tối ưu inference cho NVIDIA Jetson — compile graph + fuse layers |
| ONNX Runtime | Portable: export từ PyTorch, chạy trên nhiều hardware target |
| Model Quantization (FP16 / INT8 / FP8) | INT8 giảm 4× bộ nhớ, tăng throughput — cần calibration dataset |
| CUDA Kernels & GPU Memory Hierarchy | Viết custom kernel khi TensorRT không đủ — hiểu Shared Memory / Warp |

</details>

<details>
<summary><strong>🛡️ Safety & Deployment</strong> — khoảng cách giữa "chạy demo" và "chạy ngoài đời"</summary>

| Từ khoá | Ghi chú thực chiến |
|---|---|
| OTA Update | Cập nhật firmware/model không cần cắm cáp — cần rollback mechanism |
| Graceful Degradation | Khi camera fail → chuyển sang LiDAR-only mode thay vì crash |
| Safety Layer / Hardware Interlocks | Lớp độc lập với AI — triggered khi latency vượt ngưỡng hoặc AI output bất thường |
| Fault Tolerance (Heartbeat / Fail-safe) | Nếu AI thread không heartbeat trong X ms → safety layer tự động phanh |
| Dual-MCU Watchdog Architecture | Tách biệt tầng AI và tầng Safety để tăng khả năng xử lý lỗi nghiêm trọng |
| Zero-copy AI Pipeline *(⭐ Optional)* | Giảm số lần copy bộ nhớ trong pipeline Camera → GPU trên nền tảng hỗ trợ |

</details>

---

## ✅ Checklist thực hành

```text
□ Bước 1 — Hiểu khái niệm

□ Bước 2 — Viết code C++

□ Bước 3 — Đo bằng công cụ thực tế

──────────────────────────────

Khi Camera/LiDAR ROS 2 bị drop frame:
→ UDP Buffer
→ QoS
→ Shared Memory / Iceoryx

Khi SLAM / EKF bị drift:
→ PTP Time Sync
→ tf2 Timestamp
→ CPU Power Management

Khi Robot gặp lỗi nghiêm trọng:
→ Dual-MCU Watchdog
→ Safety Layer
→ Hardware E-Stop
```

---

*Cheat sheet này được tối ưu cho **Nhánh A — On-device Robotics Systems Engineer**. Phiên bản cho Backend/Fleet Engineer (bao gồm Distributed Systems) là tài liệu riêng.*
