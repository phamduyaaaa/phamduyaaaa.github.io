---
slug: forcevla2
date: 2026-10-18
title_en: "ForceVLA2: Hybrid Force-Position Control with Force Awareness"
title_vi: "ForceVLA2: Điều khiển lai lực-vị trí có nhận biết lực"
excerpt_en: "ForceVLA reads force but answers only with a pose. ForceVLA2 outputs a pose change and a target force, and feeds force at two scales: 66% vs 18% for π0."
excerpt_vi: "ForceVLA đọc được lực nhưng chỉ trả lời bằng pose. ForceVLA2 xuất cả độ dịch pose lẫn lực mục tiêu, và đưa lực vào ở hai tầng: 66% so với 18% của π0."
tags: [VLA, Force, Paper Notes, MoE, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.15169](https://arxiv.org/abs/2603.15169) · 03/2026 · built on π0 · successor of [ForceVLA](forcevla.html)

**PROBLEM** In pressing and cleaning tasks the goal is a *force* (press the bottle, scrub the vase), not just a position.

**WHAT FAILED BEFORE** [ForceVLA](forcevla.html) and π0 output only an end-effector pose. The paper: pose control "suffices for coarse tasks but fails when subtle force interactions dominate".

**IDEA** Output a hybrid action $a_t = [\Delta p_t;\ f_t]$ (pose change + contact force) and inject force at two scales: as a subtask prompt in the VLM, and as tokens with a raw-force bypass into a Cross-Scale MoE.

**RESULT** 66% average on five tasks vs π0 18%, π0.5 31%.
</div>

## 1. The problem: what ForceVLA left unsolved

[[flow]]
- Before~ForceVLA | F/T + RGB > VLM + FVLMoE > !Pose only! | the applied force depends on where the policy thinks the surface is
+ ForceVLA2 | F/T + force prompt > VLM + Cross-Scale MoE~+ raw-force bypass > *Pose + force~+ subtask progress* | the low level can regulate force directly
[[/flow]] ForceVLA improved the input; ForceVLA2 changes the output.

- With a pose-only output, force is only *implied*: an impedance controller pushes with $F = K\Delta x$, so a millimetre error in the surface becomes a force error (worked below).
- ForceVLA fused force at one place; a short force spike can be washed out by the fusion layers. ForceVLA2 keeps a copy of the raw force token that skips them.

## 2. Architecture

[[fig:forcevla2]] Force enters as a text-like force prompt in the VLM and as force tokens next to the EE pose; the Cross-Scale MoE fuses VLM output, state and force, with a bypass that keeps the raw force signal.

| Block | Input | Output | Role |
|---|---|---|---|
| Force prompt | current subtask (from a predefined list) | text tokens $T_f$ | tell the VLM which contact stage it is in |
| VLM (PaliGemma-based) | multi-view RGB, task prompt, $T_f$ | $E$ | scene + task + stage |
| Linear $\phi_P$, $\phi_F$ | EE pose $p \in \mathbb{R}^7$, force $f \in \mathbb{R}^6$ | $E_P$, $E_F$ | state and force tokens |
| Cross-attention | queries $[E_P; E_F]$, keys/values $E$ | $E'_{state}$ | inject task meaning into state |
| Concatenate | $E$, $E'_{state}$, $E_F$ again | $E_{cond}$ | the second $E_F$ is the bypass |
| Cross-Scale MoE | $E_{cond}$ | $\sum_m w_m \text{Expert}_m$ | experts for vision, state, force |
| Flow-matching head | $E_{\text{MoE}}$ | $a_t = [\Delta p_t; f_t]$, $s_t$ | action + subtask progress |

## 3. Work it by hand: why a pose-only output gets the force wrong

<div class="calc" markdown="1">
Calculation card

**What and why.** Show how a small error in where the surface is turns into a large force error when the policy can only output a pose. This is the reason ForceVLA2 adds $f_t$ to the output.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F^*$ | force the task needs | input | 10 N |
| $K$ | controller stiffness | input | 1000 N/m (illustrative) |
| $\delta$ | error in the surface estimate | input | 5 mm (illustrative) |
| $\Delta x$ | how far the pose is commanded into the surface | intermediate | – |
| $F_{real}$ | force actually applied | output | – |

**Formula** (contact modelled as a spring)

$$\Delta x = \frac{F^*}{K}, \qquad F_{real} = K\,(\Delta x \pm \delta)$$

**Steps**

1. Command: $\Delta x = 10 / 1000 = 0.010$ m = 10 mm.
2. Surface 5 mm closer than believed: real depth $10 + 5 = 15$ mm, so $F_{real} = 1000 \times 0.015 = 15$ N.
3. Surface 5 mm farther: real depth $5$ mm, so $F_{real} = 5$ N.

**Result.** $F_{real} \in [5,\ 15]$ N for a 10 N target: a ±50% error.

**Why it matters.** With $f_t$ in the output, the low-level control can measure force and steer towards 10 N, instead of trusting a guessed geometry.
</div>

## 4. Results

[[bars:%]] π0 + raw force=17; π0=18; π0.5=31; *ForceVLA2=66* || Average success, five tasks × 20 trials: press bottle, clean vase, clean board, retrieve plate, assemble gears.

## 5. Training and data

| Item | Value |
|---|---|
| Base | π0 |
| Data | 1,000 trajectories, ~500K timesteps, 5 tasks, each split into 3–5 subtasks |
| Robot | Flexiv Rizon 4s, force-feedback GELLO teleoperation |
| Sensors | F/T at 300 Hz; two D455 + one wrist D435 cameras |

## 6. Caveats

- The text says the gate "activates the most relevant expert", but the equation sums all three experts.
- Checked against the full text: the force prompt works like a discrete state machine over a predefined list of subtasks per task. The appendix reports a chunk size of 30 and 15 Hz inference on a 4090 (8 A100 GPUs, 30,000 steps, about 10 hours), but under the name "Foca-VLA", apparently an earlier name of this model. Who produces the force prompt at run time, the losses and the frozen modules are still not clear.

**Carry forward:** ForceVLA2 has one gripper and one wrist sensor. A humanoid with two dexterous hands has torques at 14 joints and touch at 10 fingertips: which signal should correct which part of the body? See [MoDE-VLA](mode-vla.html).

**Check question:** $K = 500$ N/m, $F^* = 8$ N, and the surface is 4 mm closer than believed. What force is applied?

<details markdown="1">
<summary>Answer</summary>

$\Delta x = 8/500 = 16$ mm. Real depth $16 + 4 = 20$ mm, so $F_{real} = 500 \times 0.020 = 10$ N: 2 N too much, a 25% error.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.15169](https://arxiv.org/abs/2603.15169) · 03/2026 · nền π0 · kế nhiệm [ForceVLA](forcevla.html)

**VẤN ĐỀ** Trong các task ấn và lau, mục tiêu là một *lực* (ấn chai, chà bình), không chỉ là một vị trí.

**PAPER TRƯỚC HỎNG Ở ĐÂU** [ForceVLA](forcevla.html) và π0 chỉ xuất pose của end-effector. Bài viết: điều khiển pose "đủ cho task thô nhưng thất bại khi tương tác lực tinh tế chiếm ưu thế".

**Ý TƯỞNG** Xuất hành động lai $a_t = [\Delta p_t;\ f_t]$ (độ dịch pose + lực tiếp xúc) và đưa lực vào ở hai tầng: prompt subtask trong VLM, và token kèm bypass lực thô vào Cross-Scale MoE.

**KẾT QUẢ** Trung bình 66% trên năm task, so với π0 18%, π0.5 31%.
</div>

## 1. Vấn đề: ForceVLA còn để lại gì

[[flow]]
- Trước~ForceVLA | F/T + RGB > VLM + FVLMoE > !Chỉ pose! | lực thực tế phụ thuộc vào chỗ chính sách nghĩ bề mặt nằm
+ ForceVLA2 | F/T + force prompt > VLM + Cross-Scale MoE~+ bypass lực thô > *Pose + lực~+ tiến độ subtask* | mức thấp điều chỉnh lực trực tiếp được
[[/flow]] ForceVLA cải thiện đầu vào; ForceVLA2 thay đổi đầu ra.

- Khi chỉ xuất pose, lực chỉ được *ngầm định*: bộ điều khiển impedance đẩy với $F = K\Delta x$, nên một milimét sai về bề mặt thành sai số lực (tính bên dưới).
- ForceVLA gộp lực ở một chỗ; một xung lực ngắn có thể bị các lớp gộp làm mờ. ForceVLA2 giữ một bản token lực thô đi vòng qua chúng.

## 2. Kiến trúc

[[fig:forcevla2]] Lực vào dưới dạng force prompt giống văn bản trong VLM và dưới dạng force token cạnh pose EE; Cross-Scale MoE gộp đầu ra VLM, state và lực, kèm bypass giữ nguyên lực thô.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Force prompt | subtask hiện tại (từ danh sách định sẵn) | token văn bản $T_f$ | cho VLM biết đang ở pha tiếp xúc nào |
| VLM (dựa trên PaliGemma) | RGB nhiều góc, task prompt, $T_f$ | $E$ | cảnh + task + pha |
| Linear $\phi_P$, $\phi_F$ | pose EE $p \in \mathbb{R}^7$, lực $f \in \mathbb{R}^6$ | $E_P$, $E_F$ | token state và lực |
| Cross-attention | query $[E_P; E_F]$, key/value $E$ | $E'_{state}$ | đưa ngữ nghĩa task vào state |
| Nối | $E$, $E'_{state}$, lại $E_F$ | $E_{cond}$ | $E_F$ thứ hai là bypass |
| Cross-Scale MoE | $E_{cond}$ | $\sum_m w_m \text{Expert}_m$ | expert thị giác, state, lực |
| Đầu flow-matching | $E_{\text{MoE}}$ | $a_t = [\Delta p_t; f_t]$, $s_t$ | hành động + tiến độ subtask |

## 3. Tính tay: vì sao chỉ xuất pose thì sai lực

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Cho thấy một sai số nhỏ về vị trí bề mặt biến thành sai số lực lớn khi chính sách chỉ xuất được pose. Đây là lý do ForceVLA2 thêm $f_t$ vào đầu ra.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F^*$ | lực task cần | input | 10 N |
| $K$ | độ cứng bộ điều khiển | input | 1000 N/m (minh họa) |
| $\delta$ | sai số ước lượng bề mặt | input | 5 mm (minh họa) |
| $\Delta x$ | độ sâu pose được ra lệnh vào trong bề mặt | trung gian | – |
| $F_{real}$ | lực thực sự tác dụng | output | – |

**Công thức** (coi tiếp xúc như lò xo)

$$\Delta x = \frac{F^*}{K}, \qquad F_{real} = K\,(\Delta x \pm \delta)$$

**Từng bước**

1. Ra lệnh: $\Delta x = 10 / 1000 = 0.010$ m = 10 mm.
2. Bề mặt gần hơn 5 mm so với chính sách nghĩ: độ sâu thực $10 + 5 = 15$ mm, nên $F_{real} = 1000 \times 0.015 = 15$ N.
3. Bề mặt xa hơn 5 mm: độ sâu thực $5$ mm, nên $F_{real} = 5$ N.

**Kết quả.** $F_{real} \in [5,\ 15]$ N cho mục tiêu 10 N: sai ±50%.

**Ý nghĩa.** Có $f_t$ trong đầu ra, điều khiển mức thấp có thể đo lực và chỉnh về 10 N, thay vì tin vào một hình học đoán mò.
</div>

## 4. Kết quả

[[bars:%]] π0 + lực thô=17; π0=18; π0.5=31; *ForceVLA2=66* || Thành công trung bình, năm task × 20 lượt: ấn chai, lau bình, lau bảng, lấy đĩa, lắp bánh răng.

## 5. Huấn luyện và dữ liệu

| Mục | Giá trị |
|---|---|
| Nền | π0 |
| Dữ liệu | 1.000 quỹ đạo, ~500K timestep, 5 task, mỗi task chia 3–5 subtask |
| Robot | Flexiv Rizon 4s, teleoperation GELLO có phản hồi lực |
| Cảm biến | F/T 300 Hz; hai camera D455 + một D435 cổ tay |

## 6. Lưu ý

- Văn bản nói gate "kích hoạt expert liên quan nhất", nhưng công thức cộng cả ba expert.
- Đã đối chiếu với toàn văn: force prompt hoạt động như một máy trạng thái rời rạc trên danh sách subtask định sẵn cho mỗi tác vụ. Phụ lục nêu chunk 30 và suy luận 15 Hz trên 4090 (8 GPU A100, 30.000 bước, khoảng 10 giờ), nhưng dưới tên "Foca-VLA", có vẻ là tên cũ của mô hình này. Ai tạo force prompt lúc chạy thật, các hàm loss và module đóng băng vẫn chưa rõ.

**Mang sang bài sau:** ForceVLA2 có một kẹp và một cảm biến cổ tay. Một humanoid hai bàn tay khéo léo có mô men ở 14 khớp và xúc giác ở 10 đầu ngón: tín hiệu nào nên hiệu chỉnh phần nào của cơ thể? Xem [MoDE-VLA](mode-vla.html).

**Câu kiểm tra:** $K = 500$ N/m, $F^* = 8$ N, và bề mặt gần hơn 4 mm so với chính sách nghĩ. Lực tác dụng là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\Delta x = 8/500 = 16$ mm. Độ sâu thực $16 + 4 = 20$ mm, nên $F_{real} = 500 \times 0.020 = 10$ N: thừa 2 N, sai 25%.
</details>
:::
