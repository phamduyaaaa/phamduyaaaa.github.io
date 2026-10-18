---
slug: vla-touch
date: 2026-10-18
title_en: "VLA-Touch: Dual-level Tactile Feedback Without Retraining the VLA"
title_vi: "VLA-Touch: Phản hồi xúc giác hai tầng mà không train lại VLA"
excerpt_en: "VLA-Touch leaves the base VLA (RDT) frozen and adds touch twice: as language for a GPT-4o planner, and as force for a small diffusion refiner on the action chunk."
excerpt_vi: "VLA-Touch giữ nguyên VLA nền (RDT) và thêm xúc giác ở hai tầng: dưới dạng ngôn ngữ cho planner GPT-4o, và dưới dạng lực cho một bộ tinh chỉnh diffusion nhỏ trên action chunk."
tags: [VLA, Tactile, Paper Notes, RDT]
---

:::en
Paper: [arXiv 2507.17294](https://arxiv.org/abs/2507.17294) (accepted to RA-L 2026), code at [jxbi1010/VLA-Touch](https://github.com/jxbi1010/VLA-Touch).

## The pain it cures

Fine-tuning a large VLA to read a new sensor needs a lot of paired data. VLA-Touch asks: can touch be added **without fine-tuning the base VLA**? It splits touch into two roles. Some tactile information is semantic ("this mango is soft") and helps **planning**. Some is continuous ("shear force is rising") and helps **control**.

## Architecture

[[fig:vla-touch]] Two loops: an outer planning loop where tactile text updates the GPT-4o instruction, and an inner control loop where tactile force refines the chunk produced by the frozen RDT.

**Planning level (outer loop).**

- **Task planner:** GPT-4o receives the goal, a scene image, the tactile description $L^m_t$ and the previous instruction $I_k$, and returns the next one-sentence instruction $I_{k+1}$.
- **Tactile to text:** Octopi, a tactile-language model, reads 6 frames from a GelSight Mini and describes properties such as hardness and roughness. Force is handled separately: marker-tracked shear force vectors are given to GPT-4o directly.

**Control level (inner loop).**

- **Base VLA:** RDT-1B maps the instruction and visual state to an action chunk with horizon $T_a = 64$.
- **Tactile state:** OpenCV marker tracking on the GelSight image gives per-marker forces, summed into $m_t = (X, Y, M)$.
- **Interpolant controller** ($\pi_I$, BRIDGeR-style): its input is $[z^r, z^o, m]$ (proprioception embedding, DINOv2 embedding, tactile force history). Instead of denoising from Gaussian noise it starts from the VLA's action chunk and refines it with a stochastic interpolant. It refines the first 48 of the 64 steps in sliding windows, executed at up to 8 Hz.

## Training

1. RDT first fine-tuned on unrelated Franka data (100k steps) to align action spaces.
2. Fine-tuned on the task data **without** tactile input (20k steps per task).
3. The VLA is then run on task observations to collect chunks; the interpolant controller is trained by supervised MSE against expert actions.

The paper states the method works "without fine-tuning the base VLA"; whether Octopi and DINOv2 are frozen is not stated.

## Results

Tasks: Cup (does it hold water?), Wipe (pick the smoother sponge, then wipe), Peel (pick the softer mango, then peel). Successes out of 20:

| Task (complete) | RDT | RDT + Interpolant |
|---|---|---|
| Cup place | 7 | 10 |
| Wipe | 5 | 12 |
| Peel | 6 | 10 |

The abstract reports planning efficiency up to 40% higher and manipulation success up to 35% higher than vision-only VLAs. Removing touch from the controller cut cup placement by 50%.

## Caveats

The controller does not yet use high-frequency tactile signals (25 Hz and above); data are logged at 10 Hz. Discretised Octopi categories failed to separate objects with subtle differences.
:::

:::vi
Bài báo: [arXiv 2507.17294](https://arxiv.org/abs/2507.17294) (được nhận ở RA-L 2026), code tại [jxbi1010/VLA-Touch](https://github.com/jxbi1010/VLA-Touch).

## Vấn đề cần chữa

Fine-tune một VLA lớn để đọc cảm biến mới cần rất nhiều dữ liệu ghép đôi. VLA-Touch hỏi: có thêm được xúc giác mà **không fine-tune VLA nền** không? Bài tách xúc giác thành hai vai trò. Một phần là ngữ nghĩa ("quả xoài này mềm") giúp **lập kế hoạch**. Một phần là liên tục ("lực trượt đang tăng") giúp **điều khiển**.

## Kiến trúc

[[fig:vla-touch]] Hai vòng lặp: vòng ngoài lập kế hoạch, nơi văn bản xúc giác cập nhật chỉ dẫn của GPT-4o; vòng trong điều khiển, nơi lực xúc giác tinh chỉnh action chunk do RDT đóng băng tạo ra.

**Tầng lập kế hoạch (vòng ngoài).**

- **Task planner:** GPT-4o nhận mục tiêu, ảnh cảnh, mô tả xúc giác $L^m_t$ và chỉ dẫn trước $I_k$, rồi trả về chỉ dẫn một câu kế tiếp $I_{k+1}$.
- **Xúc giác thành văn bản:** Octopi, một mô hình tactile-language, đọc 6 khung hình từ GelSight Mini và mô tả các thuộc tính như độ cứng, độ nhám. Lực được xử lý riêng: vector lực trượt từ marker tracking đưa thẳng cho GPT-4o.

**Tầng điều khiển (vòng trong).**

- **VLA nền:** RDT-1B ánh xạ chỉ dẫn và trạng thái thị giác thành action chunk với horizon $T_a = 64$.
- **Trạng thái xúc giác:** marker tracking bằng OpenCV trên ảnh GelSight cho lực từng marker, cộng lại thành $m_t = (X, Y, M)$.
- **Interpolant controller** ($\pi_I$, kiểu BRIDGeR): đầu vào là $[z^r, z^o, m]$ (embedding proprioception, embedding DINOv2, lịch sử lực xúc giác). Thay vì khử nhiễu từ Gaussian, nó bắt đầu từ action chunk của VLA và tinh chỉnh bằng stochastic interpolant. Nó tinh chỉnh 48 trong 64 bước đầu theo cửa sổ trượt, thực thi tối đa 8 Hz.

## Huấn luyện

1. RDT được fine-tune trước trên dữ liệu Franka không liên quan (100k bước) để căn chỉnh không gian hành động.
2. Fine-tune trên dữ liệu task **không** có xúc giác (20k bước mỗi task).
3. Sau đó chạy VLA trên quan sát của task để thu các chunk; interpolant controller được huấn luyện có giám sát bằng MSE so với hành động chuyên gia.

Bài khẳng định phương pháp chạy "không fine-tune VLA nền"; việc Octopi và DINOv2 có bị đóng băng hay không không được nêu.

## Kết quả

Các task: Cup (cốc có nước không?), Wipe (chọn miếng bọt biển mịn hơn rồi lau), Peel (chọn quả xoài mềm hơn rồi gọt). Số lần thành công trên 20:

| Task (hoàn chỉnh) | RDT | RDT + Interpolant |
|---|---|---|
| Đặt cốc | 7 | 10 |
| Lau | 5 | 12 |
| Gọt | 6 | 10 |

Abstract nêu hiệu quả lập kế hoạch tăng tới 40% và tỉ lệ thao tác thành công tăng tới 35% so với VLA chỉ dùng thị giác. Bỏ xúc giác khỏi bộ điều khiển làm giảm 50% ở bước đặt cốc.

## Lưu ý

Bộ điều khiển chưa tận dụng tín hiệu xúc giác tần số cao (từ 25 Hz trở lên); dữ liệu được ghi ở 10 Hz. Các nhóm Octopi rời rạc hóa không phân biệt được những vật khác biệt tinh tế.
:::
