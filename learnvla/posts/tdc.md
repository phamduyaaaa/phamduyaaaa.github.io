---
slug: tdc
date: 2026-11-02
title_en: "TDC: Learn the Direction of Compliance in Simulation, Set the Magnitude by Hand"
title_vi: "TDC: Học hướng mềm dẻo trong mô phỏng, đặt độ lớn bằng tay"
excerpt_en: "Contact forces do not transfer from simulation, but which axis should be soft, stiff or force-controlled does. TDC trains a VLA only on simulated demonstrations to output a task frame and a per-axis control mode, and an admittance controller adds a hand-set stiffness and target force: 95% on four real tasks vs at most 71% for the baselines."
excerpt_vi: "Lực tiếp xúc không chuyển được từ mô phỏng, nhưng việc trục nào cần mềm, cứng hay điều khiển lực thì chuyển được. TDC huấn luyện một VLA chỉ trên demo mô phỏng để xuất một khung tác vụ và một chế độ điều khiển cho từng trục, và một bộ điều khiển admittance thêm độ cứng và lực mục tiêu đặt bằng tay: 95% trên bốn tác vụ thật so với tối đa 71% của các baseline."
tags: [VLA, Force, Sim-to-Real, Compliance, Admittance, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Yang, Chen, Zhu, Xu, Mao, Wei, Chen, Xiong, Wang, *TDC: Sim-to-Real Transferable Directional Compliance for Contact-Rich Manipulation*, [arXiv 2602.14174](https://arxiv.org/abs/2602.14174) · v1 15 Feb 2026 (titled "Direction Matters"), v2 5 Oct 2026 · **CoRL 2026** (accepted; the conference is 9–11 Nov 2026) · Zhejiang University, Zhejiang Humanoid Robot Innovation Center · [project page](https://yifei-y.github.io/project-pages/TDC/) · no code released

**PROBLEM** Real force data is costly and risky to collect, and simulated contact dynamics do not match reality. Existing sim-to-real methods either adapt on the real robot or give up adaptive compliance by using one isotropic stiffness for every axis.

**WHAT FAILED BEFORE** VLAs trained in simulation with force as input or output (ForceVLA-Sim, ACP-Sim) score 1% and 5%. Position-only VLAs with an isotropic admittance controller reach 41–71%, and pick the wrong compromise: low stiffness misses the target, high stiffness pushes too hard.

**IDEA** Split force regulation into **direction** and **magnitude**. Direction (a task frame plus, for each of 6 axes, force control, compliant or stiff) depends on geometry and transfers from simulation. Magnitude (one stiffness value, one target force) depends on dynamics and is set by hand. A VLA (E2VLA) is fine-tuned on 2,000 simulated demonstrations per task to predict pose, task frame and mode vector; an admittance controller does the rest.

**RESULT** On four real tasks with a Franka: 95% without disturbance and 90% with a human pushing the object, against 71% and 70% for the best baselines, including VLAs trained on real teleoperation data.
</div>

## 1. The problem: force magnitude does not transfer, force direction does

[[flow]]
- Before~Force VLA in sim | Images + sim wrench > !Force in / force out~sim forces are wrong! > Robot | 1–5% overall
- Before~Blind compliance | Images > !Pose only + one stiffness~same on every axis! > Admittance > Robot | 41–71%
+ TDC | Images + language > *Pose + task frame + mode per axis~learned in sim* > *Admittance + hand-set k, F~magnitude by hand* > Robot | 95%
[[/flow]] The policy never sees or outputs a force; it only says along which axes force, compliance or stiffness applies.

## 2. Architecture

[[fig:tdc]] Simulation supplies the labels that are geometry; the human supplies two numbers that are dynamics.

| Part | Input | Output | Role |
|---|---|---|---|
| Privileged expert (sim) | ground-truth object state | trajectories with pose, task frame, mode labels | rules per contact state: descend along the hole axis, zigzag over the ink, circular arc about the hinge |
| Simulated data | 3D-scanned real objects, 27 HDR backgrounds, randomised lights, cameras and poses | 2,000 successful demos per task | about 6 h per task on one RTX 4090; no dynamics randomisation |
| Policy | wrist + 1–2 global RGB at 240×320, EE pose and gripper (10), instruction; current frame only | chunk of 32 steps, each $X^d$ (10) + task frame $T^d$ (6D rotation, 6) + mode $C^d$ (6) | E2VLA with widened input and output layers of its diffusion action expert; ~10 h training |
| Mode vector $C^d$ | – | per axis $(x, y, z, r_x, r_y, r_z)$: 0 force, 1 compliant, 4 stiff | the numbers 1 and 4 are also the stiffness ratio |
| Admittance controller | $p_{cmd}$, $T^d$, $C^d$, $F_{ext}$ from joint torques, hand-set $k$ and $F_h$ | compliant reference pose | $M\ddot p_r + D\dot p_r + K(p_r - p_{cmd}) = F_{ext} - F_{cmd}$ |

How the mode becomes gains, in the task frame: $\tilde K_{ii} = 0$ for force axes, $k_{low}$ for compliant, $k_{high} = 4k_{low}$ for stiff; damping $\tilde D = 2\xi\sqrt{M\tilde K}$ with $\xi = 2$ (force axes use $k_{low}$ for damping); the commanded wrench is $F_h$ on force axes and zero elsewhere. Both are rotated into the world frame with $S = \mathrm{diag}(R, R)$. One setting, $k_{low}$ = 50 translational and 10 rotational, is used for all tasks; $F_h$ is 2 N for peg-in-hole and 4 N for wiping, along the task-frame $z$.

Example from the paper, whiteboard wiping: $C = [4, 4, 0, 1, 1, 4]$. Slide stiffly in $x$ and $y$, press with force along $z$, let the eraser tilt freely about $x$ and $y$, hold the yaw.

## 3. Work it by hand: the wiping gains and what each axis does

<div class="calc" markdown="1">
Calculation card

**What and why.** Turn the wiping mode vector into stiffness and damping, then check what the controller settles to on the force axis and how far a stiff axis yields to a push.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $k_{low}$ | compliant stiffness, translation / rotation (units not stated; I assume N/m and N·m/rad) | constant | 50 / 10 |
| $k_{high}$ | stiff axis, $4 k_{low}$ | constant | 200 / 40 |
| $m$ | virtual mass, translation / rotation | constant | 1 / 0.1 |
| $\xi$ | damping ratio | constant | 2 |
| $F_h$ | target force on the force axis | hand-set | 4 N |
| $D$ | damping per axis | output | – |

**Formulas**

$$D_{ii} = 2\xi\sqrt{m\,K_{ii}},\qquad \text{steady state: } K_{ii}(p_r - p_{cmd}) = F_{ext} - F_{cmd}$$

**Steps**

1. $x$, $y$ (mode 4, translation): $K = 200$, $D = 2 \cdot 2 \sqrt{1 \cdot 200} = 4 \cdot 14.1 = 56.6$.
2. $z$ (mode 0): $K = 0$, damping from $k_{low}$: $D = 4\sqrt{1 \cdot 50} = 28.3$.
3. $r_x$, $r_y$ (mode 1, rotation): $K = 10$, $D = 4\sqrt{0.1 \cdot 10} = 4.0$.
4. $r_z$ (mode 4, rotation): $K = 40$, $D = 4\sqrt{0.1 \cdot 40} = 8.0$.
5. Force axis at rest ($\dot p_r = \ddot p_r = 0$, $K = 0$): $0 = F_{ext} - F_{cmd}$, so the contact force settles exactly at $F_h$ = 4 N, wherever the board is.
6. Stiff $x$ axis pushed by 4 N: deflection $4 / 200 = 0.02$ m = 2 cm. With the isotropic low setting ($K = 50$) it would be 8 cm.

**Result.** Force along $z$ converges to 4 N regardless of board height; $x$ and $y$ follow the plan within centimetres; the eraser can tilt with only 10 units of stiffness.

**Why it matters.** None of these numbers came from simulated forces. The policy only chose the frame and the pattern $[4, 4, 0, 1, 1, 4]$; that is why it transfers.
</div>

## 4. Results

[[bars:%]] ACP-Sim=5; ForceVLA-Sim=1; π0-Real=45; ForceVLA-Real=58; E2VLA-Real=63; π0-Sim + mid admittance=64; E2VLA-Sim + mid admittance=71; *TDC=95* || Overall success without disturbance, four tasks × 20 trials (real-data baselines only on peg-in-hole and wiping, where teleoperation was possible).

| Success (%) without / with disturbance | Microwave | Peg-in-hole | Wiping | Door | Overall |
|---|---|---|---|---|---|
| π0-Real | – | 30 / 40 | 60 / 20 | – | 45 / 30 |
| E2VLA-Real | – | 35 / 20 | 90 / 60 | – | 63 / 40 |
| ForceVLA-Real | – | 15 / 40 | 100 / 80 | – | 58 / 60 |
| ACP-Real | – | 45 / 20 | 60 / 0 | – | 53 / 10 |
| π0-Sim + low admittance | 30 / 60 | 35 / 60 | 35 / 60 | 80 / 100 | 45 / 70 |
| E2VLA-Sim + mid admittance | 90 / 20 | 55 / 60 | 55 / 80 | 85 / 40 | 71 / 50 |
| E2VLA-Sim + high admittance | 70 / 20 | 70 / 40 | 65 / 40 | 75 / 40 | 70 / 35 |
| ForceVLA-Sim | 0 / 0 | 0 / 60 | 5 / 40 | 0 / 20 | 1 / 30 |
| ACP-Sim | 0 / 0 | 5 / 20 | 15 / 0 | 0 / 0 | 5 / 5 |
| TDC | 95 / 80 | 90 / 100 | 100 / 100 | 95 / 80 | 95 / 90 |

"–" means no real-data baseline: teleoperation of the microwave and door kept triggering safety stops. Disturbed trials are 5 per task.

| Completion quality (successful trials) | Peg depth (mm) ↑ | Ink left (cm) ↓ |
|---|---|---|
| E2VLA-Real | 25.0 | 0.8 |
| ForceVLA-Real | 22.0 | 0.5 |
| E2VLA-Sim + mid admittance | 23.5 | 1.1 |
| TDC | 25.0 | 0.3 |

- **Ablation** (pooled, 80 + 20 trials): without the pre-trained VLA 76% / 95%; with it but isotropic low, mid, high admittance 36% / 60%, 65% / 40%, 51% / 10%; full TDC 95% / 90%.
- **Stiffness ratio** on the microwave: $k_{high} = k_{low}$ gives 30%, ratio 4 gives 85%, ratio 16 gives 40%.
- **TDC failures:** 6 of 100 trials, four from excessive force after a misaligned task frame, two from pose errors.

## 5. Data and setup

| Item | Value |
|---|---|
| Tasks | microwave opening (≥50° in 120 s), peg-in-hole (1 mm clearance, ≥10 mm deep in 60 s), whiteboard wiping (<5 cm ink left in 120 s), door opening (≥30° in 120 s) |
| Human effort per task | about 1–5 person-hours to set up the scene and write the planner; labelling phases, frames and modes under 5 min each |
| Real teleoperation (baselines only) | 100 demos each for peg-in-hole and wiping |
| Robot | Franka arm with Franka Hand; two RealSense D435 (global and wrist), a third global camera for wiping |
| Force sensing | external wrench estimated from joint torques; no F/T sensor |
| Compute | one RTX 4090 for data, training and inference |

## 6. Can I use this on my robot?

**Short answer.** Yes with work, and it is the most transferable idea in this group. The controller side fits a UR10e directly: a task-frame admittance loop driven by its wrist F/T is standard. The policy side needs your own simulation of each task, scanned objects and a scripted expert, plus E2VLA, and no code is released. "Not stated" means I did not find it in the paper or project page.

| Need | What the authors used | If yours differs |
|---|---|---|
| Arm and force | Franka, wrench estimated from joint torques | UR10e wrist F/T gives a cleaner $F_{ext}$ for the same admittance law |
| Controller | task-frame admittance, $\xi = 2$, $k_{low}$ = 50/10, $k_{high} = 4k_{low}$ | Implementable on RTDE; control rate: not stated |
| Policy backbone | E2VLA (ICRA 2026) | Another VLA with a diffusion or flow action head should take the extra 12 outputs; not tested |
| Simulator | Not stated (the paper cites Genesis, Isaac Lab, Isaac Sim, SAPIEN) | – |
| Demonstrations | 2,000 per task, generated automatically | Needs scanned meshes and a planner per task |
| Code | Not released | Re-implementation from the paper |

## 7. Caveats

- 20 + 5 trials per task. The ablation gives Wilson intervals: TDC's 90% with disturbance is [70, 97].
- The ablation rows with isotropic admittance (36 / 65 / 51%) do not match the E2VLA-Sim rows of the main table (41 / 71 / 70%), and the paper does not explain the difference.
- Without pre-training the disturbed success is higher (95%) than with it (90%); not discussed.
- The task-frame origin is fixed at the end-effector; tasks where contact is far from the gripper break this. Stiffness and force are constant per task, so all stages must accept the same values.

**Carry forward:** TDC is the controller-side answer to force: compare with [Contact-rich control](contact-rich-control.html) for impedance and admittance basics, [ForceVLA](forcevla.html) for force as a VLA input, and [Reactive Diffusion Policy](reactive-diffusion-policy.html) for a learned fast loop instead of a fixed controller. [Cross-embodiment data](cross-embodiment-data.html) covers the data side that TDC replaces with simulation.

**Check question:** For peg-in-hole, suppose $C = [1, 1, 0, 1, 1, 4]$ with $F_h$ = 2 N. What are $K$ and $D$ on $z$ and on $x$, and where does the $z$ force settle?

<details markdown="1">
<summary>Answer</summary>

$z$: $K = 0$, $D = 4\sqrt{50} = 28.3$. $x$: $K = 50$, $D = 4\sqrt{50} = 28.3$. The $z$ force settles at 2 N.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Yang, Chen, Zhu, Xu, Mao, Wei, Chen, Xiong, Wang, *TDC: Sim-to-Real Transferable Directional Compliance for Contact-Rich Manipulation*, [arXiv 2602.14174](https://arxiv.org/abs/2602.14174) · v1 15/2/2026 (tên cũ "Direction Matters"), v2 5/10/2026 · **CoRL 2026** (đã được nhận; hội nghị diễn ra 9–11/11/2026) · Zhejiang University, Zhejiang Humanoid Robot Innovation Center · [trang dự án](https://yifei-y.github.io/project-pages/TDC/) · chưa công bố code

**VẤN ĐỀ** Dữ liệu lực thật tốn kém và rủi ro khi thu, còn động lực học tiếp xúc trong mô phỏng không khớp thực tế. Các phương pháp sim-to-real hiện có hoặc phải thích nghi trên robot thật, hoặc bỏ đi tính mềm dẻo thích nghi bằng cách dùng một độ cứng đẳng hướng cho mọi trục.

**PAPER TRƯỚC HỎNG Ở ĐÂU** VLA huấn luyện trong mô phỏng với lực làm input hay output (ForceVLA-Sim, ACP-Sim) đạt 1% và 5%. VLA chỉ xuất vị trí với bộ admittance đẳng hướng đạt 41–71%, và phải chọn thỏa hiệp sai: độ cứng thấp thì trượt mục tiêu, cao thì ấn quá mạnh.

**Ý TƯỞNG** Tách điều khiển lực thành **hướng** và **độ lớn**. Hướng (một khung tác vụ, cộng với mỗi trục trong 6 trục là điều khiển lực, mềm hay cứng) phụ thuộc hình học và chuyển được từ mô phỏng. Độ lớn (một giá trị độ cứng, một lực mục tiêu) phụ thuộc động lực học và được đặt bằng tay. Một VLA (E2VLA) được fine-tune trên 2.000 demo mô phỏng mỗi tác vụ để dự đoán pose, khung tác vụ và vector chế độ; bộ điều khiển admittance làm phần còn lại.

**KẾT QUẢ** Trên bốn tác vụ thật với Franka: 95% khi không nhiễu và 90% khi có người đẩy vật, so với 71% và 70% của các baseline tốt nhất, kể cả VLA huấn luyện bằng dữ liệu teleoperation thật.
</div>

## 1. Vấn đề: độ lớn của lực không chuyển được, hướng của lực thì có

[[flow]]
- Trước~VLA lực trong sim | Ảnh + wrench mô phỏng > !Lực vào / lực ra~lực mô phỏng bị sai! > Robot | 1–5% tổng
- Trước~Mềm dẻo mù | Ảnh > !Chỉ pose + một độ cứng~giống nhau mọi trục! > Admittance > Robot | 41–71%
+ TDC | Ảnh + câu lệnh > *Pose + khung tác vụ + chế độ từng trục~học trong sim* > *Admittance + k, F đặt tay~độ lớn bằng tay* > Robot | 95%
[[/flow]] Chính sách không bao giờ nhìn thấy hay xuất ra lực; nó chỉ nói lực, mềm dẻo hay độ cứng áp dụng theo trục nào.

## 2. Kiến trúc

[[fig:tdc]] Mô phỏng cung cấp các nhãn thuộc về hình học; con người cung cấp hai con số thuộc về động lực học.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Chuyên gia đặc quyền (sim) | trạng thái vật thật từ simulator | quỹ đạo có nhãn pose, khung tác vụ, chế độ | luật theo trạng thái tiếp xúc: hạ dọc trục lỗ, đi zigzag phủ vết mực, cung tròn quanh bản lề |
| Dữ liệu mô phỏng | vật thật quét 3D, 27 nền HDR, ánh sáng, camera và pose ngẫu nhiên | 2.000 demo thành công mỗi tác vụ | khoảng 6 giờ mỗi tác vụ trên một RTX 4090; không ngẫu nhiên hóa động lực học |
| Chính sách | RGB cổ tay + 1–2 camera ngoài 240×320, pose EE và tay kẹp (10), câu lệnh; chỉ khung hiện tại | chunk 32 bước, mỗi bước $X^d$ (10) + khung tác vụ $T^d$ (quay 6D, 6) + chế độ $C^d$ (6) | E2VLA với lớp vào và ra của action expert diffusion được mở rộng; huấn luyện khoảng 10 giờ |
| Vector chế độ $C^d$ | – | mỗi trục $(x, y, z, r_x, r_y, r_z)$: 0 lực, 1 mềm, 4 cứng | các số 1 và 4 cũng chính là tỉ lệ độ cứng |
| Bộ điều khiển admittance | $p_{cmd}$, $T^d$, $C^d$, $F_{ext}$ từ mô-men khớp, $k$ và $F_h$ đặt tay | pose tham chiếu mềm | $M\ddot p_r + D\dot p_r + K(p_r - p_{cmd}) = F_{ext} - F_{cmd}$ |

Cách chế độ trở thành hệ số, trong khung tác vụ: $\tilde K_{ii} = 0$ với trục lực, $k_{low}$ với trục mềm, $k_{high} = 4k_{low}$ với trục cứng; giảm chấn $\tilde D = 2\xi\sqrt{M\tilde K}$ với $\xi = 2$ (trục lực dùng $k_{low}$ để tính giảm chấn); wrench ra lệnh bằng $F_h$ trên trục lực và bằng 0 ở trục khác. Cả hai được quay sang khung thế giới bằng $S = \mathrm{diag}(R, R)$. Một thiết lập duy nhất, $k_{low}$ = 50 cho tịnh tiến và 10 cho quay, dùng cho mọi tác vụ; $F_h$ là 2 N cho cắm chốt và 4 N cho lau, theo trục $z$ của khung tác vụ.

Ví dụ trong bài, lau bảng: $C = [4, 4, 0, 1, 1, 4]$. Trượt cứng theo $x$ và $y$, ấn bằng lực theo $z$, để giẻ lau nghiêng tự do quanh $x$ và $y$, giữ cố định góc yaw.

## 3. Tính tay: hệ số của tác vụ lau và mỗi trục làm gì

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Biến vector chế độ của tác vụ lau thành độ cứng và giảm chấn, rồi kiểm tra bộ điều khiển dừng ở đâu trên trục lực và một trục cứng bị đẩy lệch bao xa.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $k_{low}$ | độ cứng mềm, tịnh tiến / quay (bài không nêu đơn vị; mình giả sử N/m và N·m/rad) | hằng số | 50 / 10 |
| $k_{high}$ | trục cứng, $4 k_{low}$ | hằng số | 200 / 40 |
| $m$ | khối lượng ảo, tịnh tiến / quay | hằng số | 1 / 0,1 |
| $\xi$ | tỉ số giảm chấn | hằng số | 2 |
| $F_h$ | lực mục tiêu trên trục lực | đặt tay | 4 N |
| $D$ | giảm chấn mỗi trục | output | – |

**Công thức**

$$D_{ii} = 2\xi\sqrt{m\,K_{ii}},\qquad \text{trạng thái dừng: } K_{ii}(p_r - p_{cmd}) = F_{ext} - F_{cmd}$$

**Từng bước**

1. $x$, $y$ (chế độ 4, tịnh tiến): $K = 200$, $D = 2 \cdot 2 \sqrt{1 \cdot 200} = 4 \cdot 14{,}1 = 56{,}6$.
2. $z$ (chế độ 0): $K = 0$, giảm chấn theo $k_{low}$: $D = 4\sqrt{1 \cdot 50} = 28{,}3$.
3. $r_x$, $r_y$ (chế độ 1, quay): $K = 10$, $D = 4\sqrt{0{,}1 \cdot 10} = 4{,}0$.
4. $r_z$ (chế độ 4, quay): $K = 40$, $D = 4\sqrt{0{,}1 \cdot 40} = 8{,}0$.
5. Trục lực khi dừng ($\dot p_r = \ddot p_r = 0$, $K = 0$): $0 = F_{ext} - F_{cmd}$, nên lực tiếp xúc dừng đúng ở $F_h$ = 4 N, bảng ở đâu cũng vậy.
6. Trục $x$ cứng bị đẩy 4 N: lệch $4 / 200 = 0{,}02$ m = 2 cm. Với thiết lập thấp đẳng hướng ($K = 50$) sẽ là 8 cm.

**Kết quả.** Lực theo $z$ hội tụ về 4 N bất kể độ cao của bảng; $x$ và $y$ bám kế hoạch trong vài centimét; giẻ lau nghiêng được với độ cứng chỉ 10.

**Ý nghĩa.** Không con số nào ở đây đến từ lực mô phỏng. Chính sách chỉ chọn khung và mẫu $[4, 4, 0, 1, 1, 4]$; đó là lý do nó chuyển sang thật được.
</div>

## 4. Kết quả

[[bars:%]] ACP-Sim=5; ForceVLA-Sim=1; π0-Real=45; ForceVLA-Real=58; E2VLA-Real=63; π0-Sim + admittance vừa=64; E2VLA-Sim + admittance vừa=71; *TDC=95* || Thành công tổng khi không nhiễu, bốn tác vụ × 20 lượt (baseline dữ liệu thật chỉ có ở cắm chốt và lau, nơi teleoperation làm được).

| Thành công (%) không nhiễu / có nhiễu | Lò vi sóng | Cắm chốt | Lau bảng | Cửa | Tổng |
|---|---|---|---|---|---|
| π0-Real | – | 30 / 40 | 60 / 20 | – | 45 / 30 |
| E2VLA-Real | – | 35 / 20 | 90 / 60 | – | 63 / 40 |
| ForceVLA-Real | – | 15 / 40 | 100 / 80 | – | 58 / 60 |
| ACP-Real | – | 45 / 20 | 60 / 0 | – | 53 / 10 |
| π0-Sim + admittance thấp | 30 / 60 | 35 / 60 | 35 / 60 | 80 / 100 | 45 / 70 |
| E2VLA-Sim + admittance vừa | 90 / 20 | 55 / 60 | 55 / 80 | 85 / 40 | 71 / 50 |
| E2VLA-Sim + admittance cao | 70 / 20 | 70 / 40 | 65 / 40 | 75 / 40 | 70 / 35 |
| ForceVLA-Sim | 0 / 0 | 0 / 60 | 5 / 40 | 0 / 20 | 1 / 30 |
| ACP-Sim | 0 / 0 | 5 / 20 | 15 / 0 | 0 / 0 | 5 / 5 |
| TDC | 95 / 80 | 90 / 100 | 100 / 100 | 95 / 80 | 95 / 90 |

"–" nghĩa là không có baseline dữ liệu thật: teleoperation lò vi sóng và cửa liên tục kích hoạt dừng an toàn. Lượt có nhiễu là 5 mỗi tác vụ.

| Chất lượng hoàn thành (lượt thành công) | Độ sâu chốt (mm) ↑ | Mực còn lại (cm) ↓ |
|---|---|---|
| E2VLA-Real | 25,0 | 0,8 |
| ForceVLA-Real | 22,0 | 0,5 |
| E2VLA-Sim + admittance vừa | 23,5 | 1,1 |
| TDC | 25,0 | 0,3 |

- **Ablation** (gộp, 80 + 20 lượt): không có VLA pretrain 76% / 95%; có nhưng dùng admittance đẳng hướng thấp, vừa, cao 36% / 60%, 65% / 40%, 51% / 10%; TDC đầy đủ 95% / 90%.
- **Tỉ lệ độ cứng** ở lò vi sóng: $k_{high} = k_{low}$ cho 30%, tỉ lệ 4 cho 85%, tỉ lệ 16 cho 40%.
- **Thất bại của TDC:** 6 trên 100 lượt, bốn do lực quá lớn sau khi khung tác vụ lệch, hai do lỗi dự đoán pose.

## 5. Dữ liệu và thiết lập

| Mục | Giá trị |
|---|---|
| Tác vụ | mở lò vi sóng (≥50° trong 120 s), cắm chốt (khe hở 1 mm, sâu ≥10 mm trong 60 s), lau bảng (còn <5 cm mực trong 120 s), mở cửa (≥30° trong 120 s) |
| Công sức người mỗi tác vụ | khoảng 1–5 giờ công để dựng cảnh và viết planner; gán nhãn pha, khung và chế độ dưới 5 phút mỗi việc |
| Teleoperation thật (chỉ cho baseline) | 100 demo mỗi tác vụ cho cắm chốt và lau |
| Robot | cánh tay Franka với Franka Hand; hai RealSense D435 (ngoài và cổ tay), thêm một camera ngoài cho tác vụ lau |
| Cảm biến lực | wrench ngoài ước lượng từ mô-men khớp; không có cảm biến F/T |
| Tính toán | một RTX 4090 cho dữ liệu, huấn luyện và suy luận |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Có nhưng tốn công, và đây là ý tưởng dễ chuyển nhất trong nhóm này. Phía bộ điều khiển hợp thẳng với UR10e: vòng admittance theo khung tác vụ dùng F/T cổ tay là chuẩn mực. Phía chính sách cần mô phỏng riêng cho từng tác vụ, vật thể quét 3D và một chuyên gia viết bằng script, cộng E2VLA, và chưa có code. "Không nêu" nghĩa là mình không tìm thấy trong paper hay trang dự án.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cánh tay và lực | Franka, wrench ước lượng từ mô-men khớp | F/T cổ tay của UR10e cho $F_{ext}$ sạch hơn cho cùng luật admittance |
| Bộ điều khiển | admittance theo khung tác vụ, $\xi = 2$, $k_{low}$ = 50/10, $k_{high} = 4k_{low}$ | Cài được trên RTDE; tần số điều khiển: không nêu |
| Backbone chính sách | E2VLA (ICRA 2026) | VLA khác có đầu hành động diffusion hay flow chắc nhận được thêm 12 output; chưa được thử |
| Simulator | Không nêu (bài trích Genesis, Isaac Lab, Isaac Sim, SAPIEN) | – |
| Demo | 2.000 mỗi tác vụ, sinh tự động | Cần mesh quét và một planner cho từng tác vụ |
| Code | Chưa công bố | Phải tự cài lại từ paper |

## 7. Lưu ý

- 20 + 5 lượt mỗi tác vụ. Ablation có khoảng Wilson: 90% khi có nhiễu của TDC là [70, 97].
- Các dòng ablation với admittance đẳng hướng (36 / 65 / 51%) không khớp các dòng E2VLA-Sim của bảng chính (41 / 71 / 70%), và bài không giải thích.
- Không pretrain thì thành công khi có nhiễu lại cao hơn (95%) so với có pretrain (90%); bài không bàn.
- Gốc khung tác vụ cố định ở end-effector; tác vụ có điểm tiếp xúc xa tay kẹp sẽ phá giả định này. Độ cứng và lực là hằng số mỗi tác vụ, nên mọi giai đoạn phải chấp nhận cùng giá trị.

**Mang sang bài sau:** TDC là lời giải phía bộ điều khiển cho bài toán lực: so với [Contact-rich control](contact-rich-control.html) cho kiến thức trở kháng và admittance, [ForceVLA](forcevla.html) cho lực làm input của VLA, và [Reactive Diffusion Policy](reactive-diffusion-policy.html) cho một vòng nhanh học được thay vì bộ điều khiển cố định. [Dữ liệu cross-embodiment](cross-embodiment-data.html) nói về phía dữ liệu mà TDC thay bằng mô phỏng.

**Câu kiểm tra:** Với cắm chốt, giả sử $C = [1, 1, 0, 1, 1, 4]$ và $F_h$ = 2 N. $K$ và $D$ trên $z$ và trên $x$ là bao nhiêu, và lực theo $z$ dừng ở đâu?

<details markdown="1">
<summary>Đáp án</summary>

$z$: $K = 0$, $D = 4\sqrt{50} = 28{,}3$. $x$: $K = 50$, $D = 4\sqrt{50} = 28{,}3$. Lực theo $z$ dừng ở 2 N.
</details>
:::
