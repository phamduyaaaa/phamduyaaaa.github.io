# 📖 Robotics Systems — Reference Cheatsheet

> Bảng tra cứu chi tiết cho mọi từ khoá trong cheatsheet lộ trình học.
> **Cấu trúc mỗi bảng:** Thành phần · Khai báo / Cú pháp · Mục đích · Ví dụ ngắn · Ghi chú thực chiến.

---

## Lớp 1 — Modern C++ Core, Memory Model & Concurrency

---

### 🧱 C++ Core & Custom Allocators

<details>
<summary><strong>Move Semantics & Rvalue References</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Lvalue / Rvalue** | `int x = 5;` → lvalue; `5` → rvalue | Phân biệt đối tượng có địa chỉ và đối tượng tạm | `int& r = x;` (OK) · `int& r = 5;` (lỗi) | Mọi thứ có tên là lvalue. |
| **Rvalue reference** | `T&&` | Bind vào giá trị tạm để tránh copy | `void f(std::string&& s);` | Không phải "luôn move" — phụ thuộc vào bên trong hàm. |
| **`std::move`** | `std::move(obj)` | Ép kiểu sang rvalue (không tự di chuyển gì) | `vec.push_back(std::move(str));` | Sau `std::move`, `str` ở trạng thái "valid but unspecified". |
| **Move constructor** | `MyClass(MyClass&& other) noexcept` | Chuyển quyền sở hữu tài nguyên | `MyClass b = std::move(a);` | Nên đánh dấu `noexcept` để container STL dùng move thay copy. |
| **Move assignment** | `MyClass& operator=(MyClass&& other) noexcept` | Chuyển quyền sở hữu qua `=` | `b = std::move(a);` | Phải tự giải phóng tài nguyên cũ của `*this` trước. |
| **`std::forward`** | `std::forward<T>(arg)` | Perfect forwarding trong template | `template<class T> void wrap(T&& a) { f(std::forward<T>(a)); }` | Dùng trong template, không dùng ngoài context deduction. |
| **RVO / NRVO** | _(tự động bởi compiler)_ | Compiler loại bỏ copy/move khi return object | `return MyClass{};` | Không cần `std::move` khi return local variable — sẽ làm hỏng NRVO. |

</details>

<details>
<summary><strong>Memory Alignment & Padding</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`alignas`** | `alignas(N) T var;` | Căn chỉnh biến/struct theo N byte | `alignas(64) float buf[16];` | Dùng căn 64 byte để tránh false sharing giữa các cache line. |
| **`alignof`** | `alignof(T)` | Truy vấn alignment yêu cầu của type | `static_assert(alignof(double) == 8);` | Compile-time, không có runtime overhead. |
| **Struct padding** | _(tự động)_ | Compiler thêm byte rỗng để căn thành viên | `struct { char a; int b; };` → 8 bytes | Sắp xếp thành viên từ lớn → nhỏ để giảm padding. |
| **`#pragma pack`** | `#pragma pack(1)` | Tắt padding (platform-specific) | Dùng cho network packet | Cẩn thận: truy cập unaligned có thể gây UB hoặc chậm hơn trên ARM. |
| **`__attribute__((packed))`** | `struct S { ... } __attribute__((packed));` | GCC/Clang: tắt padding | Tương tự `#pragma pack(1)` | Không portable, tránh dùng trong code đa nền tảng. |
| **Cache line size** | `constexpr size_t CACHE_LINE = 64;` | Kích thước cache line phổ biến (x86/ARM) | `alignas(64) std::atomic<int> counter;` | Trên Apple Silicon một số cache line là 128 byte. |

</details>

<details>
<summary><strong>Zero-cost Abstractions & Custom Allocators</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`constexpr`** | `constexpr int f(int x) { return x*2; }` | Tính tại compile-time, không có runtime cost | `constexpr int N = f(5);` | Từ C++20 hầu hết `std::` algorithm là `constexpr`. |
| **`inline`** | `inline void f() {}` | Gợi ý compiler nhúng thẳng body vào call site | Hàm ngắn gọi trong hot loop | Compiler tự quyết định; `[[always_inline]]` mạnh hơn nhưng nguy hiểm hơn. |
| **Template** | `template<class T> T add(T a, T b)` | Generic code — zero overhead so với viết tay | `add<float>(1.0f, 2.0f)` | Instantiation xảy ra lúc compile — binary to hơn nhưng runtime nhanh hơn. |
| **`std::pmr::memory_resource`** | `class MyRes : public std::pmr::memory_resource` | Interface cho custom allocator | Override `do_allocate` / `do_deallocate` | Chuẩn C++17, thay thế allocator template cồng kềnh cũ. |
| **`std::pmr::monotonic_buffer_resource`** | `std::pmr::monotonic_buffer_resource res(buf, sizeof(buf));` | Allocate tuyến tính từ buffer, không free từng block | `std::pmr::vector<int> v(&res);` | Giải phóng tất cả 1 lần khi destroy — lý tưởng cho 1 vòng xử lý. |
| **`std::pmr::unsynchronized_pool_resource`** | `std::pmr::unsynchronized_pool_resource pool;` | Pool allocator không thread-safe, nhanh | Dùng trong single-threaded hot path | Không dùng cho multi-thread — dùng `synchronized_pool_resource` khi cần. |

</details>

---

### ⚛️ Memory Model & Atomics

<details>
<summary><strong>std::atomic & memory_order</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`std::atomic<T>`** | `std::atomic<int> x{0};` | Đọc/ghi nguyên tử, không cần mutex | `x.fetch_add(1, std::memory_order_relaxed);` | Không đảm bảo thứ tự với biến khác nếu không chỉ định `memory_order`. |
| **`memory_order_relaxed`** | `x.load(std::memory_order_relaxed)` | Chỉ đảm bảo atomicity, không đảm bảo thứ tự | Counter thống kê đơn giản | Nhanh nhất. Không tạo memory fence. |
| **`memory_order_acquire`** | `x.load(std::memory_order_acquire)` | Ngăn mọi read/write sau không bị kéo lên trước | `flag.load(acquire)` trước khi đọc dữ liệu | Dùng ở phía consumer (bên nhận). |
| **`memory_order_release`** | `x.store(v, std::memory_order_release)` | Ngăn mọi read/write trước không bị đẩy xuống sau | `data = val; flag.store(true, release)` | Dùng ở phía producer (bên gửi). |
| **`memory_order_seq_cst`** | `x.load()` _(mặc định)_ | Thứ tự toàn cục — mọi thread đều thấy cùng thứ tự | Khi không chắc, dùng cái này | An toàn nhất nhưng chậm nhất — có full memory fence. |
| **`memory_order_acq_rel`** | `x.fetch_add(1, std::memory_order_acq_rel)` | Kết hợp acquire + release trong một RMW operation | Dùng trong RMW giữa producer và consumer | Chỉ dùng được với read-modify-write (fetch_add, exchange...). |
| **`compare_exchange_weak`** | `x.compare_exchange_weak(expected, desired)` | CAS — nền tảng của lock-free | `while (!x.compare_exchange_weak(old, old+1))` | `weak` có thể spurious fail — dùng trong vòng lặp. |
| **`compare_exchange_strong`** | `x.compare_exchange_strong(expected, desired)` | CAS không spurious fail | Khi không muốn dùng vòng lặp retry | Chậm hơn `weak` một chút trên một số kiến trúc. |

</details>

<details>
<summary><strong>Cache Coherence & False Sharing</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **MESI protocol** | _(hardware)_ | Đồng bộ cache giữa các core CPU | Modified / Exclusive / Shared / Invalid | Khi 1 core write, các core khác bị invalidate cache line đó. |
| **False sharing** | _(hiện tượng)_ | Hai thread ghi vào 2 biến khác nhau nhưng cùng cache line | `int a, b;` kề nhau → lỗi | Giải pháp: `alignas(64)` để tách biến ra 2 cache line khác nhau. |
| **`std::hardware_destructive_interference_size`** | `alignas(std::hardware_destructive_interference_size)` | Kích thước cache line theo chuẩn C++17 | Thay cho magic number 64 | Cần `#include <new>`. |
| **happens-before** | _(quan hệ trừu tượng)_ | Nếu A happens-before B thì B thấy mọi hiệu ứng của A | Release → Acquire tạo happens-before | Không phải về thời gian thực — về thứ tự có thể quan sát được. |

</details>

---

### 🔒 Đồng bộ hoá & Lock-free

<details>
<summary><strong>Mutex & Locking Primitives</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`std::mutex`** | `std::mutex m;` | Khóa bảo vệ dữ liệu dùng chung | `m.lock(); ... m.unlock();` | Không gọi lock/unlock thủ công — dùng RAII. |
| **`std::lock_guard`** | `std::lock_guard<std::mutex> lg(m);` | RAII lock đơn giản, tự unlock khi ra scope | `{ std::lock_guard lg(m); data++; }` | Không thể unlock giữa chừng — dùng mặc định. |
| **`std::unique_lock`** | `std::unique_lock<std::mutex> ul(m);` | RAII lock linh hoạt | `ul.unlock(); ...; ul.lock();` | Bắt buộc khi dùng với `condition_variable`. |
| **`std::scoped_lock`** | `std::scoped_lock sl(m1, m2);` | Lock nhiều mutex cùng lúc, không deadlock | `std::scoped_lock sl(mu_a, mu_b);` | C++17. Tự xử lý thứ tự lock để tránh deadlock. |
| **`std::shared_mutex`** | `std::shared_mutex sm;` | Read-write lock | Nhiều reader hoặc 1 writer | Dùng `shared_lock` để đọc, `unique_lock` để ghi. |
| **`std::shared_lock`** | `std::shared_lock<std::shared_mutex> sl(sm);` | Lock shared (read) | Nhiều thread cùng đọc song song | Không block nhau nếu chỉ có reader. |
| **`std::recursive_mutex`** | `std::recursive_mutex rm;` | Cho phép cùng thread lock nhiều lần | Hàm đệ quy cần lock | Dấu hiệu thiết kế có vấn đề — tránh nếu được. |
| **spinlock (manual)** | `std::atomic_flag flag = ATOMIC_FLAG_INIT;` | Busy-wait thay vì ngủ | `while (flag.test_and_set(std::memory_order_acquire));` | Tốt khi critical section **rất ngắn** (< vài ns). Tệ khi bị preempt. |

</details>

<details>
<summary><strong>Condition Variable & Semaphore</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`std::condition_variable`** | `std::condition_variable cv;` | Báo hiệu giữa các thread | `cv.notify_one();` / `cv.wait(lock, pred);` | Luôn dùng với predicate để tránh spurious wakeup. |
| **`cv.wait(lock, pred)`** | `cv.wait(ul, []{ return ready; });` | Chờ đến khi predicate đúng | `cv.wait(ul, [&]{ return !queue.empty(); });` | Tương đương `while(!pred()) cv.wait(ul);` nhưng an toàn hơn. |
| **`cv.notify_one()`** | `cv.notify_one();` | Đánh thức 1 thread đang chờ | Sau khi push data vào queue | Đánh thức không đảm bảo thứ tự thread nào được chọn. |
| **`cv.notify_all()`** | `cv.notify_all();` | Đánh thức tất cả thread đang chờ | Khi trạng thái thay đổi ảnh hưởng nhiều consumer | Tất cả woken thread sẽ cạnh tranh lock — cẩn thận thundering herd. |
| **`std::counting_semaphore`** | `std::counting_semaphore<N> sem(init);` | Giới hạn số thread vào critical section (C++20) | `sem.acquire(); ...; sem.release();` | Thay thế pattern semaphore thủ công bằng atomic. |
| **`std::binary_semaphore`** | `std::binary_semaphore sem(0);` | Signal đơn giản giữa 2 thread (C++20) | `sem.release()` / `sem.acquire()` | Nhẹ hơn `condition_variable` khi không cần predicate phức tạp. |

</details>

<details>
<summary><strong>Lock-free, SPSC/MPSC & ABA Problem</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Lock-free** | _(thuật toán)_ | Ít nhất 1 thread tiến bộ trong mọi thời điểm | CAS-based queue | Không đồng nghĩa với "nhanh" — CAS retry loop có thể tệ hơn mutex. |
| **Wait-free** | _(thuật toán)_ | Mọi thread đều tiến bộ trong số bước hữu hạn | Rất khó implement đúng | Chỉ cần thiết trong real-time nghiêm ngặt nhất. |
| **SPSC Ring Buffer** | `head_`, `tail_` atomic; array cố định | Truyền data giữa 1 producer và 1 consumer | Thread sensor → thread control | Không cần CAS — chỉ cần `acquire`/`release` trên head/tail. |
| **MPSC Queue** | _(nhiều implementation)_ | Nhiều producer, 1 consumer | Nhiều thread sensor → 1 thread tổng hợp | Phức tạp hơn SPSC; xem `folly::MPMCQueue`. |
| **ABA problem** | _(hiện tượng CAS)_ | CAS thấy giá trị cũ → new nhưng nghĩa đã thay đổi | Pointer A → B → A lại → CAS sai | Giải pháp: tagged pointer (dùng bit cao để đếm version). |
| **Hazard pointers** | _(kỹ thuật reclamation)_ | Báo hiệu "tôi đang dùng pointer này" để tránh free sớm | Dùng trong lock-free linked list | Thay thế: epoch-based reclamation (đơn giản hơn, dùng trong `folly`). |
| **`boost::lockfree::spsc_queue`** | `boost::lockfree::spsc_queue<T, capacity<N>> q;` | SPSC queue ready-to-use | `q.push(val); q.pop(out);` | Nên dùng thư viện trước khi tự implement. |

</details>

---

### 🔍 Công cụ Profiling & Debug

<details>
<summary><strong>Sanitizers: TSan, ASan, UBSan</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **ThreadSanitizer (TSan)** | `-fsanitize=thread -g` | Phát hiện data race lúc runtime | `g++ -fsanitize=thread -g prog.cpp` | Overhead ~5–15×. Dùng trong CI, không trong production. |
| **AddressSanitizer (ASan)** | `-fsanitize=address -g` | Phát hiện memory error: OOB, use-after-free, leak | `g++ -fsanitize=address -g prog.cpp` | Overhead ~2×. Không tương thích đồng thời với TSan. |
| **UndefinedBehaviorSanitizer** | `-fsanitize=undefined` | Bắt UB: integer overflow, null deref, bad cast | `g++ -fsanitize=undefined -g prog.cpp` | Kết hợp với ASan: `-fsanitize=address,undefined`. |
| **LeakSanitizer (LSan)** | `-fsanitize=leak` | Chỉ phát hiện memory leak (nhẹ hơn ASan) | Tích hợp trong ASan; bật riêng bằng `LSAN_OPTIONS` | Tích hợp sẵn trong ASan trên Linux. |

</details>

<details>
<summary><strong>perf, Flame Graph & strace</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`perf stat`** | `perf stat ./program` | Đếm hardware event (cache miss, branch miss...) | `perf stat -e cache-misses,branch-misses ./a.out` | Cần `perf_event_paranoid` ≤ 1 trên Linux. |
| **`perf record`** | `perf record -g ./program` | Sampling call stack theo thời gian | `perf record -F 999 -g ./a.out` | `-F 999`: sample 999 lần/giây. `-g`: ghi call graph. |
| **`perf report`** | `perf report` | Xem báo cáo hotspot | Interactive TUI sau `perf record` | Cần binary có debug symbols (`-g`). |
| **Flame Graph** | `perf script \| stackcollapse-perf.pl \| flamegraph.pl > fg.svg` | Visualize thời gian CPU theo call stack | Xem bằng browser | Script của Brendan Gregg: `github.com/brendangregg/FlameGraph`. |
| **`strace`** | `strace -c ./program` | Thống kê số lần và thời gian mỗi syscall | `strace -e trace=read,write ./a.out` | Overhead rất cao — chỉ dùng để debug, không profile. |
| **`Valgrind`** | `valgrind --tool=memcheck ./program` | Phát hiện memory error (chậm hơn ASan nhưng chi tiết) | `valgrind --leak-check=full ./a.out` | Overhead ~20–50×. Dùng khi ASan không đủ. |
| **`Helgrind`** | `valgrind --tool=helgrind ./program` | Phát hiện data race (tương tự TSan) | `valgrind --tool=helgrind ./a.out` | Chậm hơn TSan nhưng ít false positive hơn trong một số trường hợp. |

</details>

---

## Lớp 2 — OS Internals, Hardware Architecture & Real-time Linux

---

### ⚡ Hardware & Low-level Optimization

<details>
<summary><strong>SIMD — AVX-512 & ARM NEON</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **SIMD intrinsics (AVX2)** | `#include <immintrin.h>` | Xử lý 8 float song song trong 1 lệnh | `__m256 a = _mm256_loadu_ps(ptr);` | Yêu cầu data aligned 32-byte cho hiệu năng tối đa. |
| **`_mm256_add_ps`** | `__m256 r = _mm256_add_ps(a, b);` | Cộng 8 float cùng lúc | Tính tổng vector 3D × 8 điểm | Throughput 1 cycle, latency 4 cycle trên Skylake. |
| **`_mm256_fmadd_ps`** | `_mm256_fmadd_ps(a, b, c)` | Fused multiply-add: `a*b + c` | Dot product, matrix multiply | Dùng FMA thay `mul` + `add` để tiết kiệm 1 lệnh + độ chính xác cao hơn. |
| **ARM NEON** | `#include <arm_neon.h>` | SIMD cho ARM (Jetson, Apple Silicon) | `float32x4_t v = vld1q_f32(ptr);` | Tương đương SSE128 của x86 — 4 float32 cùng lúc. |
| **Auto-vectorization** | `-O2 -march=native` | Compiler tự sinh SIMD | Thêm `-fopt-info-vec` để xem loop nào được vectorize | Đảm bảo loop không có alias và trip count có thể suy ra. |
| **`__builtin_expect`** | `if (__builtin_expect(cond, 1))` | Gợi ý branch prediction cho compiler | `if (__builtin_expect(ptr != nullptr, 1))` | C++20: dùng `[[likely]]` / `[[unlikely]]` thay thế. |

</details>

<details>
<summary><strong>DMA & Branch Prediction</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **DMA (Direct Memory Access)** | _(hardware + kernel driver)_ | Truyền dữ liệu sensor → RAM không qua CPU | Kernel: `dma_alloc_coherent()` | CPU chỉ setup transfer rồi nhận interrupt khi xong. |
| **`mmap` cho device** | `mmap(0, size, PROT_READ, MAP_SHARED, fd, 0)` | Map bộ nhớ thiết bị vào user space | Đọc camera frame không qua copy | Kết hợp với DMA để đạt zero-copy từ sensor đến xử lý. |
| **`[[likely]]` / `[[unlikely]]`** | `if (err) [[unlikely]] { ... }` | Gợi ý compiler tổ chức code layout | `if (data_valid) [[likely]] { process(); }` | C++20. Compiler đặt path likely vào đoạn code liên tục (ít jump). |
| **Branch-free code** | _(kỹ thuật)_ | Tránh conditional branch trong hot loop | `int abs_val = (x ^ (x >> 31)) - (x >> 31);` | Dùng khi profiler cho thấy branch miss rate cao. |

</details>

---

### ⏱️ Real-time Scheduling

<details>
<summary><strong>Linux Scheduler & Real-time Policies</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **CFS** | _(kernel mặc định)_ | Fair scheduler cho desktop/server | Tất cả process thường | **Không dùng cho real-time** — có thể delay hàng ms. |
| **`SCHED_FIFO`** | `param.sched_priority = 80; sched_setscheduler(0, SCHED_FIFO, &param);` | RT policy: chạy cho đến khi tự nhường CPU | Thread điều khiển động cơ | Không có time-slice — thread phải tự `sched_yield()` hoặc block. |
| **`SCHED_RR`** | `sched_setscheduler(0, SCHED_RR, &param);` | RT policy với time-slice xoay vòng | Nhiều RT thread cùng priority | Sau hết time-slice tự chuyển xuống cuối hàng đợi cùng priority. |
| **`PREEMPT_RT` patch** | _(kernel build option)_ | Biến Linux thành RTOS thực sự | `CONFIG_PREEMPT_RT=y` khi build kernel | Giảm latency từ hàng ms xuống ~50 µs. Tiêu chuẩn ngành xe tự lái. |
| **Priority inversion** | _(hiện tượng)_ | Thread ưu tiên cao bị block bởi thread ưu tiên thấp | L giữ mutex, H chờ mutex → M chiếm CPU | Giải pháp: Priority Inheritance (PTHREAD_PRIO_INHERIT). |
| **`pthread_setschedparam`** | `pthread_setschedparam(tid, SCHED_FIFO, &param)` | Set RT policy cho thread cụ thể | Dùng sau khi thread đã chạy | Cần `CAP_SYS_NICE` hoặc chạy với sudo. |
| **`cpu_set_t` (CPU affinity)** | `CPU_SET(2, &cpuset); pthread_setaffinity_np(tid, sizeof(cpuset), &cpuset);` | Ghim thread vào core cụ thể | Ghim RT thread vào core isolated | Kết hợp với `isolcpus=2` trong kernel cmdline để isolate hoàn toàn. |
| **`cyclictest`** | `cyclictest -l 1000000 -m -n -p99` | Đo latency của RT thread theo thời gian | Xem histogram latency | Tool chuẩn để benchmark real-time kernel. |

</details>

---

### 🧠 Memory Management & Kernel I/O

<details>
<summary><strong>Virtual Memory, Page Fault & mlockall</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Virtual memory** | _(kernel)_ | Mỗi process có không gian địa chỉ riêng | `0x...` trong code là virtual address | Kernel map virtual → physical qua Page Table. |
| **Page fault** | _(hardware interrupt)_ | Truy cập trang chưa map → kernel load từ disk/swap | Gây latency spike hàng ms | Trong RT loop: dùng `mlockall()` để pre-map tất cả trang. |
| **`mlockall`** | `mlockall(MCL_CURRENT \| MCL_FUTURE)` | Khoá toàn bộ memory vào RAM, không swap | Gọi một lần khi khởi động RT process | Cần `CAP_IPC_LOCK`. Pre-fault stack: ghi vào buffer lớn ngay sau khi lock. |
| **`mmap`** | `void* p = mmap(NULL, size, PROT_READ\|PROT_WRITE, MAP_SHARED, fd, 0)` | Map file/device vào không gian địa chỉ | Map camera frame buffer | `MAP_SHARED`: thay đổi thấy ngay; `MAP_PRIVATE`: copy-on-write. |
| **NUMA** | _(hardware)_ | Multi-socket CPU: mỗi socket có RAM "gần" riêng | AMD EPYC, Intel Xeon multi-socket | Cross-NUMA access tốn ~2× latency. Dùng `numactl --membind=0` để ghim. |
| **`numactl`** | `numactl --cpunodebind=0 --membind=0 ./program` | Chạy program trên NUMA node cụ thể | Ghim cả CPU và RAM cùng node | `libnuma` để làm programmatically trong code C++. |

</details>

<details>
<summary><strong>epoll, io_uring & System Call Overhead</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`epoll`** | `epoll_create1(0)` + `epoll_ctl` + `epoll_wait` | I/O multiplexing — chờ nhiều fd cùng lúc | Monitor nhiều sensor socket | `EPOLLET` (edge-triggered) hiệu năng cao hơn `EPOLLIN` (level-triggered). |
| **`io_uring`** | `io_uring_queue_init(N, &ring, 0)` | Async I/O với shared ring buffer user-kernel (Linux 5.1+) | `io_uring_prep_read` + `io_uring_submit` | Gần như zero syscall overhead — submit/complete qua shared memory. |
| **`vDSO`** | _(kernel feature)_ | Một số syscall (clock_gettime) chạy không cần kernel trap | `clock_gettime(CLOCK_MONOTONIC, &t)` | Tự động nếu kernel hỗ trợ — lấy timestamp trong hot loop không tốn overhead. |
| **`CLOCK_MONOTONIC`** | `clock_gettime(CLOCK_MONOTONIC, &ts)` | Timestamp đơn điệu, không bị điều chỉnh NTP | Đo interval thời gian | Dùng thay `CLOCK_REALTIME` khi đo latency. |
| **`CLOCK_MONOTONIC_RAW`** | `clock_gettime(CLOCK_MONOTONIC_RAW, &ts)` | Như MONOTONIC nhưng không bị NTP skew | Đo thời gian chính xác tuyệt đối | Không sync với NTP — tốt cho benchmark local. |

</details>

<details>
<summary><strong>Latency Measurement</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Latency vs Throughput** | _(khái niệm)_ | Latency: thời gian 1 request. Throughput: số request/giây | Tối ưu throughput có thể tăng latency (batching) | Trong robotics: latency là ưu tiên số 1. |
| **Tail latency (p99, p99.9)** | _(thống kê)_ | Latency ở percentile 99 / 99.9 | `p99 = 500µs` nghĩa là 99% request < 500µs | Robot ngoài đời cần p99.9 — worst case mới quan trọng. |
| **Jitter** | _(thống kê)_ | Độ lệch chuẩn của latency | `jitter = stddev(latency_samples)` | Jitter cao → robot co giật / điều khiển không ổn định. |
| **`cyclictest`** | `cyclictest -l 1000000 -p 99 -m -n` | Benchmark RT latency trực tiếp trên kernel | Xuất histogram: min/avg/max | Tool chuẩn sau khi cài `PREEMPT_RT` để verify hiệu quả. |
| **`rdtsc`** | `__rdtsc()` | Đọc cycle counter CPU với độ phân giải cao nhất | `uint64_t t0 = __rdtsc();` | Không portable; trên multi-core cần pin thread hoặc dùng `rdtscp`. |
| **HDR Histogram** | `hdr_histogram` library | Lưu histogram latency hiệu quả, hỗ trợ p99.999 | `hdr_record_value(h, latency_us)` | Dùng thay `std::vector` để không tốn O(N) memory cho N sample. |

</details>

---

## Lớp 3 — Robot Middleware, Zero-Copy IPC & Math Engines

---

### 🤝 ROS 2 Core & DDS

<details>
<summary><strong>ROS 2 Executor & Callback Groups</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`SingleThreadedExecutor`** | `rclcpp::executors::SingleThreadedExecutor exec;` | Chạy tất cả callback tuần tự trên 1 thread | Node đơn giản, không cần parallelism | Callback chậm sẽ chặn callback nhanh hơn. |
| **`MultiThreadedExecutor`** | `rclcpp::executors::MultiThreadedExecutor exec(opts, N);` | Chạy callback song song trên N thread | Node có nhiều callback độc lập | Cần xác định rõ callback group để tránh race condition. |
| **`StaticSingleThreadedExecutor`** | `rclcpp::executors::StaticSingleThreadedExecutor exec;` | Executor hiệu năng cao, lock-free nội bộ | Production RT node | Không thể thêm/xóa node sau khi `spin()`. Nhanh nhất trong 3 loại. |
| **MutuallyExclusiveCallbackGroup** | `node->create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive)` | Tối đa 1 callback trong group chạy cùng lúc | Default cho hầu hết callback | Bảo vệ state dùng chung trong node mà không cần mutex riêng. |
| **ReentrantCallbackGroup** | `create_callback_group(rclcpp::CallbackGroupType::Reentrant)` | Cho phép nhiều callback trong group chạy đồng thời | Callback stateless, không share state | Cần tự bảo vệ state dùng chung bằng mutex. |
| **`rclcpp::Rate`** | `rclcpp::Rate rate(100);` + `rate.sleep();` | Điều tiết vòng lặp theo tần số | 100 Hz control loop | Không đảm bảo real-time — dùng `SCHED_FIFO` + timer callback thay thế. |

</details>

<details>
<summary><strong>DDS & QoS Policy</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **DDS (Data Distribution Service)** | _(middleware)_ | Transport layer của ROS 2 — pub/sub phân tán | CycloneDDS, FastDDS, ConnextDDS | Thay đổi DDS impl bằng `RMW_IMPLEMENTATION` env var. |
| **`rmw_qos_profile_sensor_data`** | `rclcpp::SensorDataQoS()` | QoS preset cho sensor: BEST_EFFORT + VOLATILE | `/camera/image_raw` subscriber | Ưu tiên freshness — drop packet nếu queue đầy. |
| **`rmw_qos_profile_system_default`** | `rclcpp::SystemDefaultsQoS()` | QoS mặc định: RELIABLE + VOLATILE | Hầu hết topic | Không phù hợp cho sensor rate cao (overhead retransmit). |
| **`RELIABLE`** | `qos.reliability(rclcpp::ReliabilityPolicy::Reliable)` | Đảm bảo giao nhận, retry nếu mất | Command/control topic | Có overhead — không dùng cho camera 30Hz+. |
| **`BEST_EFFORT`** | `qos.reliability(rclcpp::ReliabilityPolicy::BestEffort)` | Gửi và quên, không retry | LiDAR, IMU, camera | Latency thấp hơn RELIABLE. |
| **`deadline` QoS** | `qos.deadline(std::chrono::milliseconds(10))` | Cảnh báo nếu message không đến đúng hạn | Phát hiện sensor chết | Publisher và subscriber phải khai báo cùng deadline. |
| **Discovery** | _(DDS tự động)_ | Các node tự tìm nhau qua multicast UDP | Không cần rosmaster như ROS 1 | Vấn đề: discovery chậm khi nhiều node trên mạng lớn — dùng FastDDS Discovery Server. |

</details>

---

### ⚡ Zero-Copy IPC

<details>
<summary><strong>Iceoryx, Shared Memory & Zenoh</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Iceoryx** | `iox::popo::Publisher<LidarScan> pub({"Lidar", "Scan", "1"});` | Zero-copy shared memory IPC | `auto sample = pub.loan(); sample->data = ...; pub.publish(std::move(sample));` | Truyền con trỏ vào shared memory — không copy byte nào. |
| **`rmw_iceoryx`** | `RMW_IMPLEMENTATION=rmw_iceoryx_cpp ros2 run ...` | Dùng Iceoryx làm transport cho ROS 2 | Kích hoạt qua env var | Yêu cầu tất cả node trên cùng machine (không qua network). |
| **`shm_open` / `mmap`** | `int fd = shm_open("/name", O_CREAT\|O_RDWR, 0666);` | Tạo shared memory thủ công giữa process | `mmap(0, size, PROT_READ\|PROT_WRITE, MAP_SHARED, fd, 0)` | Cần đồng bộ bằng semaphore/atomic khi dùng thủ công. |
| **Zenoh** | `zenoh::open(zenoh::Config())` | Pub/sub transport hiệu năng cao, hỗ trợ cả LAN và WAN | `session.declare_publisher("robot/lidar")` | Thay thế DDS tốt hơn qua mạng không ổn định. |
| **FlatBuffers** | `flatbuffers::FlatBufferBuilder builder;` | Serialization zero-parse — đọc trực tiếp từ buffer | Schema-based, generate C++ code | Nhanh hơn Protobuf khi đọc; chậm hơn khi ghi. |
| **Protobuf** | `MyMsg msg; msg.set_id(1); msg.SerializeToString(&out);` | Serialization phổ biến, ecosystem rộng | gRPC, cross-language | Parse/serialize tốn CPU — không dùng trong hard RT loop. |

</details>

---

### 🔢 Robotics Math & Simulation

<details>
<summary><strong>Eigen — Linear Algebra C++</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **`Eigen::Matrix3d`** | `Eigen::Matrix3d R;` | Ma trận 3×3 double | `R = Eigen::Matrix3d::Identity();` | Fixed-size: stack-allocated, không heap, tối ưu SIMD tự động. |
| **`Eigen::Vector3d`** | `Eigen::Vector3d v(1, 0, 0);` | Vector 3D double | `Eigen::Vector3d t = R * v;` | `.norm()`, `.normalized()`, `.dot()`, `.cross()`. |
| **`Eigen::Quaterniond`** | `Eigen::Quaterniond q(w, x, y, z);` | Quaternion — biểu diễn rotation | `q.toRotationMatrix()` | Tránh Gimbal lock. Normalize sau mỗi chuỗi phép nhân. |
| **`Eigen::Isometry3d`** | `Eigen::Isometry3d T = Eigen::Isometry3d::Identity();` | Transformation matrix 4×4 (SE3) | `T.rotate(R); T.translate(v);` | `.inverse()` nhanh hơn `Matrix4d::inverse()` vì biết cấu trúc. |
| **`Eigen::MatrixXd`** | `Eigen::MatrixXd A(m, n);` | Ma trận kích thước động | `Eigen::MatrixXd A = Eigen::MatrixXd::Random(100, 100);` | Heap-allocated. Tránh trong hot loop — dùng fixed-size nếu biết kích thước. |
| **`Eigen::Map`** | `Eigen::Map<Eigen::Vector3f> v(raw_ptr);` | Wrap C array thành Eigen object | `Eigen::Map<Eigen::MatrixXf>(data, 3, 3)` | Zero-copy: không allocate memory mới. |
| **Lazy evaluation** | `(A + B).eval()` | Eigen trì hoãn tính toán — expression template | `C = A * B + D` → 1 pass | Gọi `.eval()` khi cần materialize ngay. Tránh aliasing `A = A * A`. |

</details>

<details>
<summary><strong>Ceres Solver, GTSAM & Kinematics</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Ceres Solver** | `ceres::Problem problem;` | Least-squares optimization — SLAM, bundle adjustment | `problem.AddResidualBlock(cost_fn, nullptr, params);` | Auto-differentiation: `ceres::AutoDiffCostFunction`. |
| **GTSAM** | `gtsam::NonlinearFactorGraph graph;` | Factor graph optimization cho SLAM, pose estimation | `graph.add(gtsam::PriorFactor<gtsam::Pose3>(key, prior, noise))` | iSAM2: incremental optimization cho SLAM real-time. |
| **Forward Kinematics (FK)** | _(tính toán)_ | Tính vị trí end-effector từ joint angles | `T_end = T_base * T_j1(θ1) * T_j2(θ2) * ...` | Dùng Eigen::Isometry3d cho mỗi joint transform. |
| **Inverse Kinematics (IK)** | _(tối ưu hoá)_ | Tính joint angles để đạt vị trí end-effector mong muốn | Numerical: Jacobian pseudo-inverse; Analytical: closed-form | Numerical IK dùng Ceres/KDL; Analytical IK nhanh hơn nhưng chỉ cho geometry đặc biệt. |
| **KDL (Kinematics & Dynamics Library)** | `KDL::Chain chain;` | IK/FK solver tích hợp sẵn với ROS | `KDL::ChainIkSolverPos_LMA solver(chain);` | Tích hợp qua `kdl_parser` với URDF. |

</details>

<details>
<summary><strong>Simulation: Isaac Sim & Gazebo</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **Gazebo (Classic / Harmonic)** | `ros2 launch gazebo_ros gazebo.launch.py` | Vật lý 3D open-source, tích hợp ROS 2 | URDF/SDF robot model + sensor plugin | Gazebo Harmonic là phiên bản mới nhất (thay Classic). |
| **NVIDIA Isaac Sim** | _(Omniverse app)_ | GPU-accelerated physics, photorealistic rendering | Xuất synthetic training data cho AI | Tốt hơn Gazebo cho Embodied AI training; yêu cầu GPU NVIDIA. |
| **URDF** | `<robot name="..."><link>...</link><joint>...</joint></robot>` | Mô tả cấu trúc robot bằng XML | `ros2 launch robot_description display.launch.py` | Chỉ hỗ trợ kinematic tree — không có loop. |
| **SDF** | _(Simulation Description Format)_ | Format mô tả robot + world cho Gazebo | Hỗ trợ loop joints, surface friction | Gazebo Harmonic ưu tiên SDF hơn URDF. |
| **`ros2_control`** | `<ros2_control name="..." type="system">` | Framework chuẩn cho hardware interface + controller | `JointTrajectoryController`, `DiffDriveController` | Abstraction layer giữa controller và hardware driver. |

</details>

<details>
<summary><strong>Real-time Constraints: RTOS, WCET & Watchdog</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **FreeRTOS** | `xTaskCreate(task_fn, "name", stack, param, priority, &handle)` | RTOS nhẹ cho vi điều khiển (ARM Cortex-M) | STM32, ESP32, RP2040 | Không có MMU — không có virtual memory, không có process isolation. |
| **Zephyr RTOS** | `k_thread_create(&t, stack, size, fn, p1, p2, p3, prio, 0, K_NO_WAIT)` | RTOS hiện đại, hỗ trợ nhiều hardware | Cả MCU lẫn MPU | Linux Foundation project — hỗ trợ Bluetooth, USB, network stack. |
| **Deadline scheduling** | `SCHED_DEADLINE` + `sched_setattr()` | Kernel tự preempt khi task sắp miss deadline | RT, period, deadline đặt qua `sched_attr` | Không dùng được cùng `SCHED_FIFO`. |
| **WCET (Worst-Case Execution Time)** | _(phân tích tĩnh)_ | Giới hạn trên của thời gian thực thi bất kỳ đường dẫn nào | Tool: OTAWA, aiT, Rapitime | Đo bằng hardware performance counter trên target thực tế. |
| **Watchdog Timer** | `int fd = open("/dev/watchdog", O_RDWR);` | Reset hệ thống nếu process không heartbeat đúng hạn | `write(fd, "1", 1)` định kỳ để "kick" watchdog | Nếu control loop chết, watchdog trigger reset hardware — an toàn quan trọng. |

</details>

---

## Lớp 4 — Edge AI Infra & Real-world Deployment

---

### 🚀 Edge AI Acceleration

<details>
<summary><strong>TensorRT & ONNX Runtime</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **TensorRT** | `nvinfer1::IBuilder* builder = nvinfer1::createInferBuilder(logger);` | Compile & optimize model cho NVIDIA GPU | Build engine 1 lần, serialize, load lại | Layer fusion, precision calibration (INT8), kernel auto-tuning. |
| **TensorRT Engine** | `builder->buildSerializedNetwork(*network, *config)` | Tạo engine tối ưu cho GPU cụ thể | Serialize: `engine->serialize()` → lưu file `.trt` | Engine không portable giữa GPU khác nhau — build lại khi đổi GPU. |
| **`trtexec`** | `trtexec --onnx=model.onnx --fp16 --saveEngine=model.trt` | CLI tool để build và benchmark TensorRT engine | Nhanh nhất để thử nghiệm | `--int8 --calib=calib_data` để calibrate INT8. |
| **ONNX Runtime** | `Ort::Session session(env, L"model.onnx", session_options)` | Inference portable qua nhiều backend (CPU/GPU/NPU) | `session.Run(...)` | Hỗ trợ CUDA EP, TensorRT EP, CoreML EP — 1 code chạy nhiều hardware. |
| **CUDA Execution Provider** | `session_options.AppendExecutionProvider_CUDA(cuda_options)` | Chạy ONNX Runtime trên NVIDIA GPU | Thêm trước `Ort::Session` constructor | Fallback tự động về CPU nếu op không hỗ trợ trên GPU. |

</details>

<details>
<summary><strong>Model Quantization & CUDA Kernels</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **FP32 → FP16** | `--fp16` trong trtexec | Giảm 2× memory, tăng ~2× throughput trên Tensor Core | Hầu hết model không mất accuracy đáng kể | Jetson Orin hỗ trợ native FP16. |
| **FP32 → INT8** | `--int8 --calib=data/` | Giảm 4× memory, tăng ~4× throughput | Cần calibration dataset (~100–1000 ảnh) | Accuracy drop ~0.5–2% — chấp nhận được cho detection. |
| **PTQ (Post-Training Quantization)** | _(tool: trtexec, optimum)_ | Quantize sau khi train xong | Nhanh nhưng accuracy thấp hơn QAT | Dùng khi không có dataset để retrain. |
| **QAT (Quantization-Aware Training)** | _(PyTorch fake-quantize)_ | Quantize trong quá trình fine-tune | Accuracy gần bằng FP32 | Tốn công hơn PTQ nhưng kết quả tốt hơn nhiều. |
| **CUDA Shared Memory** | `__shared__ float tile[32][32];` | Bộ nhớ nhanh dùng chung trong 1 block | Dùng trong matrix multiply kernel | 48KB per block trên hầu hết GPU — dùng hết sẽ giảm occupancy. |
| **CUDA Warp** | _(32 thread cùng execute)_ | Đơn vị thực thi cơ bản của GPU | Warp divergence: nhánh if/else trong warp | Tránh divergence — 32 thread của warp luôn chạy cùng instruction. |
| **`cudaMemcpyAsync`** | `cudaMemcpyAsync(dst, src, size, kind, stream)` | Copy H↔D bất đồng bộ trên stream | Overlap compute và memory transfer | Cần pinned memory (`cudaMallocHost`) để transfer nhanh nhất. |

</details>

---

### 🛡️ Safety & Deployment

<details>
<summary><strong>OTA Update, Graceful Degradation & Fault Tolerance</strong></summary>

| Thành phần | Khai báo / Cú pháp | Mục đích | Ví dụ ngắn | Ghi chú |
|---|---|---|---|---|
| **OTA (Over-The-Air) Update** | _(system design)_ | Cập nhật firmware/model không cần cắm cáp | A/B partition: update B, verify, swap bootloader | Bắt buộc có rollback về partition cũ nếu boot fail. |
| **A/B Partition** | _(bootloader config)_ | Luôn có 1 bản ổn định để rollback | SLOT_A (running) / SLOT_B (updating) | NVIDIA Jetson hỗ trợ A/B natively. |
| **Graceful Degradation** | _(system design)_ | Giảm chức năng thay vì crash khi component fail | Camera fail → chuyển LiDAR-only navigation | Định nghĩa rõ degradation mode cho từng failure scenario. |
| **Safety Layer** | _(hardware + software)_ | Layer độc lập trigger phanh/dừng khi AI fail | MCU riêng monitor heartbeat từ AI compute | Không chạy trên cùng CPU với AI — tách biệt hoàn toàn. |
| **Hardware Interlock** | _(relay/circuit)_ | Ngắt điện động cơ không qua software | Nút emergency stop vật lý | Cuối cùng không tin vào software — cần hardware cutoff. |
| **Heartbeat** | `pub_heartbeat.publish(stamp)` mỗi 10ms | Monitor xem module còn sống không | Safety node timeout 50ms → trigger stop | Dùng `rclcpp::WallTimer` với priority cao để không bị delay. |
| **Fault Tolerance** | _(system design)_ | Hệ thống tiếp tục hoạt động dù có lỗi thành phần | Dual IMU: lấy consensus; 1 fail → dùng cái kia | Redundancy + voting là pattern phổ biến trong robot công nghiệp. |

</details>

---

## ✅ Checklist tra cứu nhanh

```
Khi gặp latency spike bất thường:
  → perf stat → cache miss cao? → kiểm tra false sharing (alignas)
  → strace → nhiều syscall? → dùng io_uring / vDSO
  → cyclictest → jitter cao? → kiểm tra PREEMPT_RT, isolcpus, mlockall

Khi code concurrent có hành vi kỳ lạ:
  → Chạy TSan → có data race?
  → Kiểm tra memory_order của atomic đang dùng
  → Kiểm tra spurious wakeup trong condition_variable

Khi AI inference quá chậm trên robot:
  → trtexec benchmark → GPU utilization?
  → Quantize FP16 → INT8 nếu cần
  → Kiểm tra H↔D transfer (dùng cudaMemcpyAsync + pinned memory)
```

---

*Reference cheatsheet bổ sung cho **Robotics Systems Engineering Cheatsheet (Nhánh A)**.*
