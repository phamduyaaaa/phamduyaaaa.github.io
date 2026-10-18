---
slug: forcevla2
date: 2026-10-18
title_en: "ForceVLA2: Hybrid Force-Position Control with Force Awareness"
title_vi: "ForceVLA2: Điều khiển lai lực-vị trí có nhận biết lực"
excerpt_en: "ForceVLA2 injects force at two scales (force prompts in the VLM, force tokens in the action path), fuses them with a Cross-Scale MoE and outputs both a pose change and a target force."
excerpt_vi: "ForceVLA2 đưa lực vào ở hai tầng (force prompt trong VLM, force token trong nhánh hành động), gộp bằng Cross-Scale MoE và xuất cả độ dịch pose lẫn lực mục tiêu."
tags: [VLA, Force, Paper Notes, MoE, π0]
---

:::en
Paper: [arXiv 2603.15169](https://arxiv.org/abs/2603.15169) (March 2026), the successor of [ForceVLA](forcevla.html), also built on π0.

## The pain it cures

ForceVLA feeds force in but still **outputs only an end-effector pose**. When the contact itself is the goal (press a button with the right force, polish a surface), a pose command cannot say how hard to push. ForceVLA2 changes the **output** too: the policy predicts a pose change and a contact force, a hybrid force-position action. It also lets force steer the task at a higher level, deciding when a subtask is done.

## Architecture

[[fig:forcevla2]] ForceVLA2: force enters as a text-like force prompt in the VLM and as force tokens next to the EE pose; the Cross-Scale MoE fuses VLM output, state and force, with a bypass that keeps the raw force signal.

1. **Force prompts (high level).** Each task has a predefined list of subtasks. A text force prompt, fed to the VLM together with the task prompt, tells it which subtask is active. The paper compares it to a discrete state machine. How the prompt text is produced at inference is not stated.
2. **VLM.** Multi-view images and text give the fused representation $E$.
3. **State and force tokens (low level).** EE pose $p \in \mathbb{R}^7$ and force $f_{raw} \in \mathbb{R}^6$ are each linearly projected to $E_P$ and $E_F$. A cross-attention layer (queries = state tokens, keys/values = $E$) injects task semantics into them.
4. **Condition sequence.** $E_{cond} = [E;\ E'_{state};\ E_F]$. Note that $E_F$ appears a second time: this is the **bypass** that stops transient force from being washed out by the fusion layers.
5. **Cross-Scale MoE.** Three lightweight MLP experts (vision, state, force) and a token-wise gate; the output is $\sum_m w_m\,\text{Expert}_m(E_{cond})$.
6. **Flow-matching head.** It outputs $a_t = [\Delta p_t;\ f_t]$ (pose change and predicted contact force) plus a progress value $s_t \in [0,1]$. When $s_t$ exceeds 1 the controller moves to the next subtask and resets it to 0.

## Data and results

- ForceVLA2-Dataset: 1,000 trajectories, about 500K timesteps, five tasks (press bottle, clean vase, clean board, retrieve plate, assemble gears), each split into 3–5 annotated subtasks; force-feedback GELLO teleoperation on a Flexiv Rizon 4s; F/T sensor at 300 Hz.
- Success rate over 20 trials per task: **66%** average, against π0 18%, π0.5 31% and π0 with naive force input 17%, which matches the abstract's +48.0 and +35.0 points.

## Caveats

- The text says the gate "activates the most relevant expert" but the equation sums all three experts weighted by $w$. Top-k and load-balancing are not described.
- Loss equations, the list of frozen modules and the number of denoising steps are not given in the part of the paper I could read in full. Appendix details (control rate, hyper-parameters) were not verified, so they are left out here.
:::

:::vi
Bài báo: [arXiv 2603.15169](https://arxiv.org/abs/2603.15169) (tháng 3/2026), là bản kế nhiệm của [ForceVLA](forcevla.html), cũng xây trên π0.

## Vấn đề cần chữa

ForceVLA đưa lực vào nhưng **đầu ra vẫn chỉ là pose của end-effector**. Khi chính lực tiếp xúc là mục tiêu (ấn nút với đúng lực, đánh bóng bề mặt), lệnh pose không nói được cần ấn mạnh đến đâu. ForceVLA2 đổi cả **đầu ra**: chính sách dự đoán độ dịch pose và lực tiếp xúc, tức hành động lai lực-vị trí. Lực còn được dùng ở mức cao hơn để quyết định khi nào xong một subtask.

## Kiến trúc

[[fig:forcevla2]] ForceVLA2: lực vào dưới dạng force prompt giống văn bản trong VLM và dưới dạng force token cạnh pose EE; Cross-Scale MoE gộp đầu ra VLM, state và lực, kèm một đường bypass giữ nguyên tín hiệu lực thô.

1. **Force prompt (mức cao).** Mỗi task có sẵn danh sách subtask. Một force prompt dạng văn bản, đưa vào VLM cùng task prompt, cho biết subtask nào đang chạy. Bài so sánh nó với một máy trạng thái rời rạc. Cách sinh văn bản prompt lúc suy luận không được nêu.
2. **VLM.** Ảnh nhiều góc nhìn và văn bản cho ra biểu diễn gộp $E$.
3. **Token state và lực (mức thấp).** Pose EE $p \in \mathbb{R}^7$ và lực $f_{raw} \in \mathbb{R}^6$ mỗi cái qua một lớp linear thành $E_P$ và $E_F$. Một lớp cross-attention (query = token state, key/value = $E$) đưa ngữ nghĩa nhiệm vụ vào chúng.
4. **Chuỗi điều kiện.** $E_{cond} = [E;\ E'_{state};\ E_F]$. Để ý $E_F$ xuất hiện lần thứ hai: đó là **bypass**, giúp lực thoáng qua không bị các lớp gộp làm mờ.
5. **Cross-Scale MoE.** Ba expert MLP nhẹ (thị giác, state, lực) và một gate theo từng token; đầu ra là $\sum_m w_m\,\text{Expert}_m(E_{cond})$.
6. **Đầu flow-matching.** Xuất $a_t = [\Delta p_t;\ f_t]$ (độ dịch pose và lực tiếp xúc dự đoán) cùng giá trị tiến độ $s_t \in [0,1]$. Khi $s_t$ vượt 1, bộ điều khiển chuyển sang subtask kế và đặt lại về 0.

## Dữ liệu và kết quả

- ForceVLA2-Dataset: 1.000 quỹ đạo, khoảng 500K timestep, năm task (ấn chai, lau bình, lau bảng, lấy đĩa, lắp bánh răng), mỗi task chia 3–5 subtask có nhãn; teleoperation GELLO có phản hồi lực trên Flexiv Rizon 4s; cảm biến F/T 300 Hz.
- Tỉ lệ thành công trên 20 lượt mỗi task: trung bình **66%**, so với π0 18%, π0.5 31% và π0 với force thô 17%, khớp với mức +48,0 và +35,0 điểm trong abstract.

## Lưu ý

- Bài viết gate "kích hoạt expert liên quan nhất" nhưng công thức lại cộng cả ba expert theo trọng số $w$. Top-k và cân bằng tải không được mô tả.
- Công thức loss, danh sách module đóng băng và số bước denoise không có trong phần bài tôi đọc nguyên văn. Chi tiết ở phụ lục (tần số điều khiển, siêu tham số) chưa được kiểm chứng nên tôi bỏ qua.
:::
