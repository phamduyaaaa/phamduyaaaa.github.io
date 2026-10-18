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

## Try the naive way first

Keep ForceVLA's output, a target pose only, and let an impedance controller track it. Against a rigid surface that controller behaves like a spring of stiffness $K$: the force it applies is $F = K\,\Delta x$, where $\Delta x$ is how far the commanded pose lies inside the surface.

## Work it by hand

Say the task needs $10$ N and $K = 1000$ N/m. A pose-only policy has to command

$$\Delta x = \frac{F}{K} = \frac{10}{1000} = 0.01\ \text{m} = 10\ \text{mm}$$

inside the surface. Now let its estimate of where the surface is be 5 mm off:

- surface 5 mm closer than believed: $\Delta x = 15$ mm, so $F = 15$ N
- surface 5 mm farther than believed: $\Delta x = 5$ mm, so $F = 5$ N

A 5 mm perception error becomes a ±50% force error, because the force is only implied by the pose through a geometry the policy has to guess. ForceVLA2 makes the policy state the force directly, $a_t = [\Delta p_t;\ f_t]$, so the low-level control can regulate towards $f_t$ instead of relying on that guess. ($K$ and the 5 mm are illustrative values, not from the paper.)

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
**Carry forward:** ForceVLA2 has one parallel gripper and one wrist F/T sensor. A humanoid with two dexterous hands has torque at 14 arm joints and touch at 10 fingertips: which signal should correct which part of the body? See [MoDE-VLA](mode-vla.html).

**Check question:** $K = 500$ N/m, the task needs 8 N, and the surface is actually 4 mm closer than the pose-only policy believes. What force is applied, and how large is the error?

*Answer:* the policy commands $\Delta x = 8/500 = 0.016$ m = 16 mm. The real penetration is $16 + 4 = 20$ mm, so $F = 500 \times 0.020 = 10$ N: 2 N too much, a 25% error.
:::

:::vi
Bài báo: [arXiv 2603.15169](https://arxiv.org/abs/2603.15169) (tháng 3/2026), là bản kế nhiệm của [ForceVLA](forcevla.html), cũng xây trên π0.

## Vấn đề cần chữa

ForceVLA đưa lực vào nhưng **đầu ra vẫn chỉ là pose của end-effector**. Khi chính lực tiếp xúc là mục tiêu (ấn nút với đúng lực, đánh bóng bề mặt), lệnh pose không nói được cần ấn mạnh đến đâu. ForceVLA2 đổi cả **đầu ra**: chính sách dự đoán độ dịch pose và lực tiếp xúc, tức hành động lai lực-vị trí. Lực còn được dùng ở mức cao hơn để quyết định khi nào xong một subtask.

## Thử cách ngây thơ trước

Giữ đầu ra như ForceVLA, chỉ có pose mục tiêu, và để bộ điều khiển impedance bám theo. Khi ấn vào bề mặt cứng, bộ điều khiển đó hoạt động như một lò xo có độ cứng $K$: lực tác dụng là $F = K\,\Delta x$, với $\Delta x$ là độ sâu pose được ra lệnh nằm bên trong bề mặt.

## Tính tay

Giả sử task cần $10$ N và $K = 1000$ N/m. Chính sách chỉ xuất pose phải ra lệnh

$$\Delta x = \frac{F}{K} = \frac{10}{1000} = 0.01\ \text{m} = 10\ \text{mm}$$

vào trong bề mặt. Giờ cho ước lượng vị trí bề mặt của nó lệch 5 mm:

- bề mặt gần hơn 5 mm so với nó nghĩ: $\Delta x = 15$ mm, nên $F = 15$ N
- bề mặt xa hơn 5 mm: $\Delta x = 5$ mm, nên $F = 5$ N

Sai số nhận thức 5 mm biến thành sai số lực ±50%, vì lực chỉ được ngầm định qua pose, qua một hình học mà chính sách phải đoán. ForceVLA2 bắt chính sách nói thẳng lực, $a_t = [\Delta p_t;\ f_t]$, để điều khiển mức thấp điều chỉnh về $f_t$ thay vì dựa vào phỏng đoán đó. ($K$ và 5 mm là giá trị minh họa, không lấy từ bài báo.)

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

**Mang theo sang bài sau:** ForceVLA2 có một kẹp song song và một cảm biến F/T ở cổ tay. Một humanoid hai bàn tay khéo léo có mô men ở 14 khớp tay và xúc giác ở 10 đầu ngón: tín hiệu nào nên hiệu chỉnh phần nào của cơ thể? Xem [MoDE-VLA](mode-vla.html).

**Câu kiểm tra:** $K = 500$ N/m, task cần 8 N, và bề mặt thực ra gần hơn 4 mm so với chính sách chỉ-xuất-pose nghĩ. Lực tác dụng là bao nhiêu, sai số lớn cỡ nào?

*Đáp án:* chính sách ra lệnh $\Delta x = 8/500 = 0.016$ m = 16 mm. Độ ấn thực là $16 + 4 = 20$ mm, nên $F = 500 \times 0.020 = 10$ N: thừa 2 N, sai 25%.
:::
