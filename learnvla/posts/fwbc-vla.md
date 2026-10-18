---
slug: fwbc-vla
date: 2026-10-18
title_en: "FWBC-VLA: Force-aware Whole-Body Compensation for Loco-Manipulation"
title_vi: "FWBC-VLA: Bù trừ toàn thân có nhận biết lực cho loco-manipulation"
excerpt_en: "Arm-centric force VLAs like ForceVLA correct the arm, but on a legged robot the door also pushes the body. FWBC-VLA estimates contact from joint torques, feeds it to the VLA and corrects the base: door opening 52% vs 12%."
excerpt_vi: "VLA lực lấy cánh tay làm trung tâm như ForceVLA chỉ sửa cánh tay, nhưng trên robot có chân, cánh cửa đẩy ngược cả thân. FWBC-VLA ước lượng tiếp xúc từ mô men khớp, đưa vào VLA và sửa lệnh thân: mở cửa 52% so với 12%."
tags: [VLA, Force, Loco-manipulation, Paper Notes, π0.5]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.03889](https://arxiv.org/abs/2609.03889) · 09/2026 · built on π0.5 · wheeled-legged robot with an arm

**PROBLEM** Wiping a board or pushing a spring-closed door also pushes the robot's body.

**WHAT FAILED BEFORE** The paper's Fig. 1 names both: a kinematic whole-body VLA "uses no explicit interaction feedback"; an arm-centric force-aware VLA (such as [ForceVLA](forcevla.html)) "uses force for task adaptation but ignores body-level effects".

**IDEA** One sensorless contact estimate (HSR-Force, from joint torques, 200 Hz) feeds two loops: force tokens into the VLA's action expert, and a bounded body correction into the whole-body controller.

**RESULT** Final-stage success: whiteboard 64% vs 24% (ForceVLA), door 52% vs 12%.
</div>

## 1. The problem: two kinds of earlier VLA, two blind spots

[[flow]]
- Before~kinematic whole-body VLA | RGB + language > VLA > !WBC~no contact feedback! > Robot | pushes blindly: door 0% at the final stage
- Before~arm-centric force VLA | force + RGB > Force-aware VLA > !WBC~body not corrected! > Robot | arm adapts, body is pushed away: door 12%
+ FWBC-VLA | joint torque > *HSR-Force~sensorless, 200 Hz* > *VLA force tokens~+ body compensation* > WBC > Robot | door 52%, whiteboard 64%
[[/flow]] One estimate, two loops: task actions and body balance.

## 2. Architecture

[[fig:fwbc-vla]] A 200 Hz sensorless estimator feeds force tokens to the 15 Hz VLA and a body load to a small compensation network; the corrected base command goes to the WBC.

| Block | Input | Output | Role |
|---|---|---|---|
| HSR-Force (200 Hz) | joint torque, arm/base/leg/IMU state | external torque $\hat\tau_{ext}$ | separate contact from own motion |
| Descriptor + GRU | last 13 values of $[\lVert\hat\tau\rVert, \Delta]$ | force tokens (width 1024) | contact strength and trend |
| π0.5 action expert (15 Hz) | VLA features + cross-attention to force tokens | arm, gripper, nominal base actions | task actions |
| Jacobian | $\hat\tau_{ext}$ | body-frame load $\hat F_{body}$ | force on the chassis |
| Compensation $C_\psi$ | $\hat F_{body}$, IMU deviation, $u_{nom}$ | bounded residual $r$ | correct the base |
| WBC | $u_{nom} + r$, arm actions | joint commands | balance and tracking |

## 3. Work it by hand: separating contact from motion

<div class="calc" markdown="1">
Calculation card

**What and why.** Without a force sensor, contact must be inferred: the measured joint torque minus the torque the robot's own motion explains. Two experts guess that free-motion torque and a gate blends them. Then the body correction is squashed so it can never exceed a safe limit.

| Symbol | Meaning | Type | Example (one joint) |
|---|---|---|---|
| $\tau_{meas}$ | measured joint torque | input | 5.0 N·m |
| $\hat\tau_{hist}$, $\hat\tau_{state}$ | free-motion torque from the history / state expert | input | 2.0, 3.0 N·m |
| $\alpha_t$ | gate weight | input | 0.25 (illustrative) |
| $\hat\tau_{ext}$ | contact torque | output | – |
| $\bar r$, $r_{max}$ | raw correction, limit | input | 1.0; 0.2 m/s (illustrative) |
| $r$ | bounded body correction | output | – |

**Formula**

$$\hat\tau_{free} = (1-\alpha_t)\hat\tau_{hist} + \alpha_t\hat\tau_{state}, \qquad \hat\tau_{ext} = \tau_{meas} - \hat\tau_{free}, \qquad r = r_{max}\tanh(\bar r)$$

**Steps**

1. $\hat\tau_{free} = 0.75 \times 2.0 + 0.25 \times 3.0 = 2.25$ N·m.
2. $\hat\tau_{ext} = 5.0 - 2.25 = 2.75$ N·m: this much is contact.
3. $r = 0.2 \times \tanh(1.0) = 0.2 \times 0.762 = 0.152$ m/s; even $\bar r = 5$ gives only $0.19998$.

**Result.** Contact 2.75 N·m; body correction 0.152 m/s, never above 0.2.

**Why it matters.** The estimator's quality decides everything downstream; the $\tanh$ bound means a wrong network output cannot throw the robot off balance.
</div>

## 4. Results

[[bars:%]] Whiteboard · OpenPI 0.5=12; Whiteboard · ForceVLA=24; *Whiteboard · FWBC-VLA=64*; Door · OpenPI 0.5=0; Door · ForceVLA=12; *Door · FWBC-VLA=52* || Final-stage success, 25 trials per task.

- Ablation, average over contact stages: no force 12%, force input only 35%, full method 65%.
- Estimator force error with no load: 0.15 N.

## 5. Training and data

| Item | Value |
|---|---|
| Data | WL&Arm: > 5,000 teleoperation episodes, 200 Hz joints, 15 Hz demonstrations |
| VLA | π0.5, fully fine-tuned |
| Estimator | fitted on free-motion windows where contact ≈ 0 |
| Compensation | $\ell_1$ regression on the demonstrated base residual |

## 6. Caveats

- Chunk length, WBC internals and the compensation rate are not stated.
- The base output is described as velocity + steering in one place and $(\Delta v_x, \Delta v_y, \Delta\omega_z)$ in another.

**Carry forward:** FWBC-VLA, like every model so far, is trained offline and stays fixed. [TORL-VLA](torl-vla.html) keeps learning online.

**Check question:** $\tau_{meas} = 4$, $\hat\tau_{hist} = 1$, $\hat\tau_{state} = 3$, $\alpha_t = 0.5$; $r_{max} = 0.2$, $\bar r = -0.5$. Find $\hat\tau_{ext}$ and $r$.

<details markdown="1">
<summary>Answer</summary>

$\hat\tau_{free} = 2$, so $\hat\tau_{ext} = 2$ N·m. $r = 0.2 \tanh(-0.5) = 0.2 \times (-0.462) = -0.092$ m/s.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.03889](https://arxiv.org/abs/2609.03889) · 09/2026 · nền π0.5 · robot bánh-chân có tay

**VẤN ĐỀ** Lau bảng hay đẩy cửa có lò xo đóng cũng đẩy ngược lên thân robot.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Fig. 1 của bài nêu cả hai: VLA toàn thân thuần động học "không có phản hồi tương tác"; VLA lực lấy cánh tay làm trung tâm (như [ForceVLA](forcevla.html)) "dùng lực để thích nghi task nhưng bỏ qua ảnh hưởng lên thân".

**Ý TƯỞNG** Một ước lượng tiếp xúc không cảm biến (HSR-Force, từ mô men khớp, 200 Hz) cấp cho hai vòng: token lực vào action expert của VLA, và một hiệu chỉnh thân bị chặn vào bộ điều khiển toàn thân.

**KẾT QUẢ** Thành công ở bước cuối: lau bảng 64% so với 24% (ForceVLA), mở cửa 52% so với 12%.
</div>

## 1. Vấn đề: hai kiểu VLA trước, hai điểm mù

[[flow]]
- Trước~VLA toàn thân động học | RGB + ngôn ngữ > VLA > !WBC~không phản hồi tiếp xúc! > Robot | đẩy mù: mở cửa 0% ở bước cuối
- Trước~VLA lực trung tâm cánh tay | lực + RGB > VLA nhận biết lực > !WBC~không sửa thân! > Robot | tay thích nghi, thân bị đẩy đi: mở cửa 12%
+ FWBC-VLA | mô men khớp > *HSR-Force~không cảm biến, 200 Hz* > *Token lực cho VLA~+ bù thân* > WBC > Robot | mở cửa 52%, lau bảng 64%
[[/flow]] Một ước lượng, hai vòng: hành động task và thăng bằng thân.

## 2. Kiến trúc

[[fig:fwbc-vla]] Bộ ước lượng 200 Hz không cảm biến cấp token lực cho VLA 15 Hz và tải thân cho một mạng bù nhỏ; lệnh thân đã sửa đi vào WBC.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| HSR-Force (200 Hz) | mô men khớp, state tay/thân/chân/IMU | mô men ngoài $\hat\tau_{ext}$ | tách tiếp xúc khỏi chuyển động của chính robot |
| Mô tả + GRU | 13 giá trị gần nhất của $[\lVert\hat\tau\rVert, \Delta]$ | token lực (rộng 1024) | độ mạnh và xu hướng tiếp xúc |
| Action expert π0.5 (15 Hz) | đặc trưng VLA + cross-attention tới token lực | hành động tay, kẹp, thân danh định | hành động task |
| Jacobian | $\hat\tau_{ext}$ | tải khung thân $\hat F_{body}$ | lực lên khung xe |
| Bù $C_\psi$ | $\hat F_{body}$, độ lệch IMU, $u_{nom}$ | residual bị chặn $r$ | sửa phần thân |
| WBC | $u_{nom} + r$, hành động tay | lệnh khớp | thăng bằng và bám lệnh |

## 3. Tính tay: tách tiếp xúc khỏi chuyển động

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Không có cảm biến lực, tiếp xúc phải được suy ra: mô men khớp đo được trừ đi phần mà chuyển động của chính robot giải thích. Hai expert đoán phần mô men chuyển động tự do đó và một gate trộn chúng. Sau đó hiệu chỉnh thân bị nén để không bao giờ vượt giới hạn an toàn.

| Ký hiệu | Nghĩa | Loại | Ví dụ (một khớp) |
|---|---|---|---|
| $\tau_{meas}$ | mô men khớp đo được | input | 5.0 N·m |
| $\hat\tau_{hist}$, $\hat\tau_{state}$ | mô men tự do theo expert lịch sử / trạng thái | input | 2.0, 3.0 N·m |
| $\alpha_t$ | trọng số gate | input | 0.25 (minh họa) |
| $\hat\tau_{ext}$ | mô men do tiếp xúc | output | – |
| $\bar r$, $r_{max}$ | hiệu chỉnh thô, giới hạn | input | 1.0; 0.2 m/s (minh họa) |
| $r$ | hiệu chỉnh thân đã chặn | output | – |

**Công thức**

$$\hat\tau_{free} = (1-\alpha_t)\hat\tau_{hist} + \alpha_t\hat\tau_{state}, \qquad \hat\tau_{ext} = \tau_{meas} - \hat\tau_{free}, \qquad r = r_{max}\tanh(\bar r)$$

**Từng bước**

1. $\hat\tau_{free} = 0.75 \times 2.0 + 0.25 \times 3.0 = 2.25$ N·m.
2. $\hat\tau_{ext} = 5.0 - 2.25 = 2.75$ N·m: phần này là tiếp xúc.
3. $r = 0.2 \times \tanh(1.0) = 0.2 \times 0.762 = 0.152$ m/s; kể cả $\bar r = 5$ cũng chỉ cho $0.19998$.

**Kết quả.** Tiếp xúc 2,75 N·m; hiệu chỉnh thân 0,152 m/s, không bao giờ quá 0,2.

**Ý nghĩa.** Chất lượng bộ ước lượng quyết định mọi thứ phía sau; giới hạn $\tanh$ nghĩa là một đầu ra sai của mạng không thể làm robot mất thăng bằng.
</div>

## 4. Kết quả

[[bars:%]] Lau bảng · OpenPI 0.5=12; Lau bảng · ForceVLA=24; *Lau bảng · FWBC-VLA=64*; Mở cửa · OpenPI 0.5=0; Mở cửa · ForceVLA=12; *Mở cửa · FWBC-VLA=52* || Thành công ở bước cuối, 25 lượt mỗi task.

- Ablation, trung bình các bước tiếp xúc: không lực 12%, chỉ đưa lực vào VLA 35%, đầy đủ 65%.
- Sai số lực của bộ ước lượng khi không tải: 0,15 N.

## 5. Huấn luyện và dữ liệu

| Mục | Giá trị |
|---|---|
| Dữ liệu | WL&Arm: > 5.000 episode teleoperation, khớp 200 Hz, demo 15 Hz |
| VLA | π0.5, fine-tune toàn bộ |
| Bộ ước lượng | fit trên các đoạn chuyển động tự do, nơi tiếp xúc ≈ 0 |
| Mạng bù | hồi quy $\ell_1$ trên residual thân của demo |

## 6. Lưu ý

- Độ dài chunk, nội bộ WBC và tần số của đường bù không được nêu.
- Đầu ra thân được mô tả là vận tốc + góc lái ở một chỗ, và $(\Delta v_x, \Delta v_y, \Delta\omega_z)$ ở chỗ khác.

**Mang sang bài sau:** FWBC-VLA, như mọi mô hình tới đây, được huấn luyện offline rồi đứng yên. [TORL-VLA](torl-vla.html) tiếp tục học online.

**Câu kiểm tra:** $\tau_{meas} = 4$, $\hat\tau_{hist} = 1$, $\hat\tau_{state} = 3$, $\alpha_t = 0.5$; $r_{max} = 0.2$, $\bar r = -0.5$. Tìm $\hat\tau_{ext}$ và $r$.

<details markdown="1">
<summary>Đáp án</summary>

$\hat\tau_{free} = 2$, nên $\hat\tau_{ext} = 2$ N·m. $r = 0.2 \tanh(-0.5) = 0.2 \times (-0.462) = -0.092$ m/s.
</details>
:::
