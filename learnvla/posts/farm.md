---
slug: farm
date: 2026-11-02
title_en: "FARM: Putting Grip Force into the Action, Measured with a GelSight Finger"
title_vi: "FARM: Đưa lực kẹp vào hành động, đo bằng một ngón GelSight"
excerpt_en: "Most tactile policies read touch but command only a gripper width, so the force they apply is an accident. FARM records force with a GelSight finger on a hand-held UMI gripper and predicts pose, grip width and grip force together; a force PID takes over once contact is detected. Screw tightening: 100% vs 40% for touch-as-observation and 0% for vision only."
excerpt_vi: "Phần lớn chính sách xúc giác đọc xúc giác nhưng chỉ ra lệnh độ mở tay kẹp, nên lực thực tế tác dụng là ngẫu nhiên. FARM ghi lực bằng một ngón GelSight trên tay kẹp UMI cầm tay và dự đoán cùng lúc pose, độ mở và lực kẹp; một bộ PID lực tiếp quản khi phát hiện tiếp xúc. Vặn vít: 100% so với 40% khi xúc giác chỉ là quan sát và 0% khi chỉ có thị giác."
tags: [VLA, Force, Tactile, Diffusion, Action Space, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Helmut, Funk, Schneider, de Farias, Peters, *Tactile-Conditioned Diffusion Policy for Force-Aware Robotic Manipulation*, [arXiv 2510.13324](https://arxiv.org/abs/2510.13324) · v1 15 Oct 2025 · TU Darmstadt, DFKI, Hessian.AI · [project page](https://tactile-farm.github.io) · venue: "submitted to the IEEE" (I found no confirmation of ICRA 2026) · code and design files announced, project page shows "coming soon" (checked 2026-11-02)

**PROBLEM** Fragile and deformable objects need the right grip force throughout a task, but imitation policies treat touch only as an extra observation and command a width. The force is then "an uncontrolled consequence of gripper commands".

**WHAT FAILED BEFORE** Vision with a binary gripper crushes every grape (0%). Feeding the raw GelSight image as an observation but commanding only width reaches 60% on grapes and 40% on screw tightening.

**IDEA** Demonstrate with a hand-held UMI gripper whose finger is a GelSight Mini, so the human applies the force directly. A frozen estimator (FEATS) turns each tactile image into a shear and normal force field. A Diffusion Policy predicts pose, grip width and **grip force**; in free space the gripper follows the width, in contact a 25 Hz force PID tracks the predicted force.

**RESULT** 20 rollouts per task on a Franka FR3: plant insertion 95%, grape picking 95%, screw tightening 100%. Applied force is closest to the demonstrations (Wasserstein distance 0.75 N vs 1.66–5.05 N for the baselines).
</div>

## 1. The problem: a width command does not say how hard to squeeze

[[flow]]
- Before~Vision only | Image + pose > !Open or close~binary gripper! > Gripper | grapes crushed: 0%
- Before~Touch as input | Image + raw GelSight > !Width only~force is a side effect! > Gripper | screw: 40%
+ FARM | Image + force field + total force > *Pose + width + grip force* > *Force PID in contact~25 Hz* > Gripper | screw: 100%
[[/flow]] Force is moved from the observation side to the action side, and a low-level loop closes it.

## 2. Architecture

[[fig:farm]] The same gripper geometry is used for the hand-held demonstrations and on the robot, so no retargeting is needed.

| Part | Input | Output | Role |
|---|---|---|---|
| FEATS (frozen) | GelSight Mini image, 320×240, 25 Hz | force field with shear x, shear y and normal channels; total normal force $F_z$ by integration | learned from finite-element labels; no load cell needed |
| Observation | last 2 frames: RGB 96×96 (RealSense D405), force field 96×96, $F_z$, grip width from ArUco markers, pose (3 + 6D rotation) | – | separate ResNet-18 for RGB and force image |
| Policy | observations | 32 future steps, 16 executed | 1D temporal CNN Diffusion Policy with FiLM; DDPM 100 steps for training, DDIM 10 at inference; 7 Hz; 60k iterations |
| Action per step | – | position (3), 6D rotation (6), grip width $w^d$ (1), grip force $F_z^d$ (1) | 11 numbers (my sum; the paper does not give a total) |
| Gripper controller | $w^d$, $F_z^d$, estimate $\hat F_z$ | motor position | free space: width to the DYNAMIXEL PD; contact: PID with anti-windup on $e = \hat F_z - F_z^d$, added to the current width |
| Arm | pose | joint torques | Franka Research 3, Cartesian impedance (franky) |

## 3. Work it by hand: when force control switches on, and how the force is scored

<div class="calc" markdown="1">
Calculation card

**What and why.** Two small computations show how FARM works in practice: the rule that switches the gripper into force control, and the metric the paper uses to say its force "looks like" the demonstrations.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F_z^d$, $\hat F_z$ | predicted target and FEATS estimate of normal force (compression is negative) | input | −2.0 N, −1.2 N |
| $F_{th}$ | contact threshold, from FEATS noise | constant | −0.5 N |
| $e$ | force error for the PID | output | – |
| $W_1$ | 1-Wasserstein distance between demo and rollout forces | output | – |

**Formulas**

$$\text{contact} \iff F_z^d < F_{th}\ \text{and}\ \hat F_z < F_{th},\qquad e = \hat F_z - F_z^d,\qquad W_1 = \frac{1}{n}\sum_{i=1}^{n} \lvert x_{(i)} - y_{(i)}\rvert$$

The last form holds for two equal-size, equally weighted samples in 1D, with $x_{(i)}$, $y_{(i)}$ sorted.

**Steps**

1. Target −2.0 N, estimate −1.2 N: both below −0.5 N, so force control is on. $e = -1.2 - (-2.0) = 0.8$ N: the gripper squeezes less than wanted, so the PID closes it further.
2. Target −2.0 N, estimate −0.3 N (just touching): the estimate is above −0.5 N, so the gripper stays in width mode and keeps closing to $w^d$.
3. Toy $W_1$ (my numbers): demo forces −2, −3, −4 N, rollout −2.5, −3.5, −6 N. Sorted pairs (−4, −6), (−3, −3.5), (−2, −2.5); differences 2, 0.5, 0.5; $W_1 = 3/3 = 1.0$ N.

**Result.** Force control needs both the plan and the sensor to agree that there is contact; $W_1$ is the average gap between matching quantiles of the two force histograms.

**Why it matters.** Requiring both signals prevents a noisy estimate from triggering force control in free space, and stops the policy from squeezing air. The paper's $W_1$ of 0.75 N for FARM vs 5.05 N for vision only means the vision policy's force is, on average, 5 N away from what the human did.
</div>

## 4. Results

[[bars:%]] Vision only=0; Tactile-aware (touch in, width out)=40; Force-aware (total force in, force out)=10; *FARM=100* || Screw tightening with an Allen key, 20 rollouts each. This is the task where force must change during the motion.

| Success, 20 rollouts | Plant insertion (high force) | Grape picking (low force) | Screw tightening (changing force) |
|---|---|---|---|
| Vision only (binary gripper) | 85% | 0% | 0% |
| Tactile-aware (raw GelSight in, width out) | 65% | 60% | 40% |
| Force-aware (total $F_z$ in, force out) | 95% | 85% | 10% |
| FARM (force field + $F_z$ in, force out) | 95% | 95% | 100% |

| Screw tightening, force distance to demos | $W_1$ (N) |
|---|---|
| FARM | 0.75 |
| Force-aware | 1.66 |
| Tactile-aware | 4.38 (too little force) |
| Vision only | 5.05 (too much force) |

- **Scalar force is enough when force is constant.** Force-aware equals FARM on plant insertion and is close on grapes.
- **The force field matters when force changes.** On screws, force-aware often lifts the key out of the screw head (10%); the shear channels tell FARM which way the key is being pushed.
- **Vision only fails the opposite way on each task:** opens too early on the plant, crushes the grape, lets go of the screw.

## 5. Data

| Item | Value |
|---|---|
| Hand-held gripper | UMI with a RealSense D405 instead of GoPro, rigid fingers, a GelSight Mini in one finger and a dummy gel pad on the other, ArUco markers on both fingers |
| Pose tracking | OptiTrack markers on the gripper; hand-eye calibration to the robot base |
| Force labels | FEATS estimates from each tactile frame; no load cell |
| Demonstrations | 30 per task, one expert |
| Robot gripper | actuated UMI: one DYNAMIXEL XL430 driving both fingers by belt, springs to open, about 50 Hz, same sensor placement |
| Tasks | plant into soil-filled pot; grape from a toothpick into a bowl; Allen key screw, two orientations, stopped above a torque threshold |

## 6. Can I use this on my robot?

**Short answer.** The arm part transfers, the force part needs new hardware. FARM's force is grip force between the fingers, measured by a GelSight in the finger. A UR10e wrist F/T sensor measures the wrench on the whole tool and cannot see grip force, so you would need a tactile finger and a gripper you can position-command at tens of Hz. "Not stated" means I did not find it in the paper or project page.

| Need | What the authors used | If yours differs |
|---|---|---|
| Arm | Franka FR3, Cartesian impedance | A UR10e with a compliant pose controller plays the same role |
| Grip force sensing | GelSight Mini + FEATS | A wrist F/T cannot replace it; FEATS may not transfer across sensors (the authors' own warning) |
| Gripper | actuated UMI with a DYNAMIXEL, position mode at ~50 Hz | Any gripper with fast position commands could host the PID; gains: not stated |
| Demonstrations | hand-held UMI + OptiTrack | Needs motion capture or another pose tracker |
| Training | LeRobot Diffusion Policy, 60k iterations | GPU and time: not stated |
| Code | announced, "coming soon" on the project page | Not usable yet |

## 7. Caveats

- One expert, 30 demonstrations and 20 rollouts per task. 95% (19/20) has a Wilson interval of about 76–99% (my arithmetic); the clear gaps are 100% vs 10–40% on screws and 95% vs 0% on grapes.
- Force is the normal grip force only; the arm has no force target. Force along the tool (pressing, wiping) is outside the method.
- The contact threshold depends on FEATS noise, and FEATS may not generalise across GelSight units.
- Venue: some reading lists cite it as ICRA 2026; the arXiv page and the project page do not confirm it.

**Carry forward:** FARM puts force in the action of a gripper. [ForceVLA](forcevla.html) and [TA-VLA](ta-vla.html) bring force into a VLA, and [TDC](tdc.html) puts it in the controller rather than in the action. [Reactive Diffusion Policy](reactive-diffusion-policy.html) handles the timing problem FARM leaves to its 25 Hz PID.

**Check question:** The target is −1.0 N and FEATS reads −0.4 N. Is the gripper in force control? What if the reading becomes −0.7 N, and what is $e$ then?

<details markdown="1">
<summary>Answer</summary>

No: −0.4 N is above −0.5 N, so it stays in width mode. At −0.7 N both are below −0.5 N, force control is on, and $e = -0.7 - (-1.0) = 0.3$ N, so the gripper still needs to squeeze harder.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Helmut, Funk, Schneider, de Farias, Peters, *Tactile-Conditioned Diffusion Policy for Force-Aware Robotic Manipulation*, [arXiv 2510.13324](https://arxiv.org/abs/2510.13324) · v1 15/10/2025 · TU Darmstadt, DFKI, Hessian.AI · [trang dự án](https://tactile-farm.github.io) · nơi đăng: "đã nộp cho IEEE" (mình không tìm thấy xác nhận ICRA 2026) · code và file thiết kế được thông báo, trang dự án ghi "coming soon" (kiểm tra 2/11/2026)

**VẤN ĐỀ** Vật dễ vỡ và biến dạng cần đúng lực kẹp suốt tác vụ, nhưng chính sách bắt chước chỉ coi xúc giác là một quan sát thêm và ra lệnh độ mở. Khi đó lực là "hệ quả không được kiểm soát của lệnh tay kẹp".

**PAPER TRƯỚC HỎNG Ở ĐÂU** Thị giác với tay kẹp nhị phân làm nát mọi quả nho (0%). Đưa ảnh GelSight thô làm quan sát nhưng chỉ ra lệnh độ mở đạt 60% với nho và 40% với vặn vít.

**Ý TƯỞNG** Làm demo bằng tay kẹp UMI cầm tay có một ngón là GelSight Mini, để chính người tác dụng lực. Một bộ ước lượng đóng băng (FEATS) biến mỗi ảnh xúc giác thành trường lực cắt và lực pháp tuyến. Một Diffusion Policy dự đoán pose, độ mở và **lực kẹp**; ngoài không gian tự do tay kẹp theo độ mở, khi tiếp xúc một PID lực 25 Hz bám theo lực dự đoán.

**KẾT QUẢ** 20 lượt mỗi tác vụ trên Franka FR3: cắm cây 95%, hái nho 95%, vặn vít 100%. Lực tác dụng gần với demo nhất (khoảng cách Wasserstein 0,75 N so với 1,66–5,05 N của các baseline).
</div>

## 1. Vấn đề: lệnh độ mở không nói phải bóp mạnh tới đâu

[[flow]]
- Trước~Chỉ thị giác | Ảnh + pose > !Mở hoặc đóng~tay kẹp nhị phân! > Tay kẹp | nho bị nát: 0%
- Trước~Xúc giác làm input | Ảnh + GelSight thô > !Chỉ độ mở~lực là tác dụng phụ! > Tay kẹp | vặn vít: 40%
+ FARM | Ảnh + trường lực + lực tổng > *Pose + độ mở + lực kẹp* > *PID lực khi tiếp xúc~25 Hz* > Tay kẹp | vặn vít: 100%
[[/flow]] Lực được chuyển từ phía quan sát sang phía hành động, và một vòng cấp thấp khép nó lại.

## 2. Kiến trúc

[[fig:farm]] Cùng một hình học tay kẹp được dùng cho demo cầm tay và trên robot, nên không cần retargeting.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| FEATS (đóng băng) | ảnh GelSight Mini, 320×240, 25 Hz | trường lực với kênh cắt x, cắt y và pháp tuyến; lực pháp tuyến tổng $F_z$ bằng tích phân | học từ nhãn phần tử hữu hạn; không cần cảm biến lực |
| Quan sát | 2 khung gần nhất: RGB 96×96 (RealSense D405), trường lực 96×96, $F_z$, độ mở từ marker ArUco, pose (3 + quay 6D) | – | ResNet-18 riêng cho RGB và ảnh lực |
| Chính sách | các quan sát | 32 bước tương lai, thực thi 16 | Diffusion Policy CNN thời gian 1D với FiLM; DDPM 100 bước khi huấn luyện, DDIM 10 bước khi suy luận; 7 Hz; 60 nghìn vòng lặp |
| Hành động mỗi bước | – | vị trí (3), quay 6D (6), độ mở $w^d$ (1), lực kẹp $F_z^d$ (1) | 11 số (mình tự cộng; bài không nêu tổng) |
| Bộ điều khiển tay kẹp | $w^d$, $F_z^d$, ước lượng $\hat F_z$ | vị trí động cơ | không gian tự do: độ mở gửi cho PD của DYNAMIXEL; tiếp xúc: PID có chống bão hòa trên $e = \hat F_z - F_z^d$, cộng vào độ mở hiện tại |
| Cánh tay | pose | mô-men khớp | Franka Research 3, trở kháng Descartes (franky) |

## 3. Tính tay: khi nào điều khiển lực bật, và lực được chấm điểm ra sao

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Hai phép tính nhỏ cho thấy FARM chạy thế nào trong thực tế: quy tắc chuyển tay kẹp sang điều khiển lực, và thước đo bài dùng để nói lực của nó "giống" demo.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F_z^d$, $\hat F_z$ | lực pháp tuyến mục tiêu dự đoán và ước lượng FEATS (nén là âm) | input | −2,0 N, −1,2 N |
| $F_{th}$ | ngưỡng tiếp xúc, theo nhiễu của FEATS | hằng số | −0,5 N |
| $e$ | sai số lực cho PID | output | – |
| $W_1$ | khoảng cách Wasserstein-1 giữa lực demo và lực khi chạy | output | – |

**Công thức**

$$\text{tiếp xúc} \iff F_z^d < F_{th}\ \text{và}\ \hat F_z < F_{th},\qquad e = \hat F_z - F_z^d,\qquad W_1 = \frac{1}{n}\sum_{i=1}^{n} \lvert x_{(i)} - y_{(i)}\rvert$$

Dạng cuối đúng cho hai mẫu 1 chiều cùng kích thước, trọng số bằng nhau, với $x_{(i)}$, $y_{(i)}$ đã sắp xếp.

**Từng bước**

1. Mục tiêu −2,0 N, ước lượng −1,2 N: cả hai dưới −0,5 N, nên điều khiển lực bật. $e = -1{,}2 - (-2{,}0) = 0{,}8$ N: tay kẹp bóp nhẹ hơn mong muốn, nên PID khép thêm.
2. Mục tiêu −2,0 N, ước lượng −0,3 N (vừa chạm): ước lượng nằm trên −0,5 N, nên tay kẹp vẫn ở chế độ độ mở và tiếp tục khép tới $w^d$.
3. $W_1$ ví dụ (số của mình): lực demo −2, −3, −4 N, khi chạy −2,5; −3,5; −6 N. Cặp đã sắp xếp (−4, −6), (−3, −3,5), (−2, −2,5); chênh lệch 2; 0,5; 0,5; $W_1 = 3/3 = 1{,}0$ N.

**Kết quả.** Điều khiển lực cần cả kế hoạch lẫn cảm biến đồng ý là có tiếp xúc; $W_1$ là khoảng cách trung bình giữa các phân vị tương ứng của hai histogram lực.

**Ý nghĩa.** Đòi cả hai tín hiệu giúp một ước lượng nhiễu không bật điều khiển lực ngoài không gian tự do, và chính sách không bóp vào không khí. $W_1$ của FARM là 0,75 N so với 5,05 N của bản chỉ thị giác, nghĩa là lực của chính sách thị giác trung bình lệch 5 N so với những gì người làm.
</div>

## 4. Kết quả

[[bars:%]] Chỉ thị giác=0; Tactile-aware (xúc giác vào, độ mở ra)=40; Force-aware (lực tổng vào, lực ra)=10; *FARM=100* || Vặn vít bằng lục giác, 20 lượt mỗi cột. Đây là tác vụ mà lực phải đổi trong lúc chuyển động.

| Thành công, 20 lượt | Cắm cây (lực lớn) | Hái nho (lực nhỏ) | Vặn vít (lực thay đổi) |
|---|---|---|---|
| Chỉ thị giác (tay kẹp nhị phân) | 85% | 0% | 0% |
| Tactile-aware (GelSight thô vào, độ mở ra) | 65% | 60% | 40% |
| Force-aware ($F_z$ tổng vào, lực ra) | 95% | 85% | 10% |
| FARM (trường lực + $F_z$ vào, lực ra) | 95% | 95% | 100% |

| Vặn vít, khoảng cách lực tới demo | $W_1$ (N) |
|---|---|
| FARM | 0,75 |
| Force-aware | 1,66 |
| Tactile-aware | 4,38 (lực quá nhỏ) |
| Chỉ thị giác | 5,05 (lực quá lớn) |

- **Lực vô hướng là đủ khi lực không đổi.** Force-aware ngang FARM ở cắm cây và gần bằng ở hái nho.
- **Trường lực quan trọng khi lực thay đổi.** Với vít, force-aware thường nhấc lục giác ra khỏi đầu vít (10%); các kênh lực cắt cho FARM biết lục giác đang bị đẩy về phía nào.
- **Chỉ thị giác hỏng theo kiểu ngược nhau ở từng tác vụ:** mở quá sớm với cây, bóp nát nho, buông vít.

## 5. Dữ liệu

| Mục | Giá trị |
|---|---|
| Tay kẹp cầm tay | UMI với RealSense D405 thay GoPro, ngón cứng, một GelSight Mini ở một ngón và miếng gel giả ở ngón kia, marker ArUco trên cả hai ngón |
| Theo dõi pose | marker OptiTrack trên tay kẹp; hiệu chuẩn hand-eye về đế robot |
| Nhãn lực | ước lượng FEATS từ mỗi khung xúc giác; không có cảm biến lực |
| Demo | 30 mỗi tác vụ, một chuyên gia |
| Tay kẹp robot | UMI có động cơ: một DYNAMIXEL XL430 kéo cả hai ngón bằng dây đai, lò xo để mở, khoảng 50 Hz, vị trí cảm biến giống hệt |
| Tác vụ | cắm cây vào chậu đất; gỡ nho khỏi tăm bỏ vào bát; vặn vít lục giác, hai hướng, dừng khi vượt ngưỡng mô-men |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Phần cánh tay chuyển được, phần lực cần phần cứng mới. Lực của FARM là lực kẹp giữa hai ngón, đo bằng GelSight trong ngón. Cảm biến F/T cổ tay của UR10e đo wrench lên cả dụng cụ và không thấy được lực kẹp, nên bạn cần một ngón xúc giác và một tay kẹp ra lệnh vị trí được ở vài chục Hz. "Không nêu" nghĩa là mình không tìm thấy trong paper hay trang dự án.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cánh tay | Franka FR3, trở kháng Descartes | UR10e với bộ điều khiển pose mềm đóng vai trò tương tự |
| Đo lực kẹp | GelSight Mini + FEATS | F/T cổ tay không thay được; FEATS có thể không chuyển được giữa các cảm biến (chính tác giả cảnh báo) |
| Tay kẹp | UMI có động cơ với DYNAMIXEL, chế độ vị trí khoảng 50 Hz | Tay kẹp nào nhận lệnh vị trí nhanh đều chứa được PID; hệ số: không nêu |
| Demo | UMI cầm tay + OptiTrack | Cần motion capture hoặc bộ theo dõi pose khác |
| Huấn luyện | Diffusion Policy của LeRobot, 60 nghìn vòng lặp | GPU và thời gian: không nêu |
| Code | đã thông báo, trang dự án ghi "coming soon" | Chưa dùng được |

## 7. Lưu ý

- Một chuyên gia, 30 demo và 20 lượt mỗi tác vụ. 95% (19/20) có khoảng Wilson khoảng 76–99% (phép tính của mình); khoảng cách rõ là 100% so với 10–40% ở vặn vít và 95% so với 0% ở hái nho.
- Lực chỉ là lực kẹp pháp tuyến; cánh tay không có mục tiêu lực. Lực dọc dụng cụ (ấn, lau) nằm ngoài phương pháp.
- Ngưỡng tiếp xúc phụ thuộc nhiễu của FEATS, và FEATS có thể không tổng quát qua các bộ GelSight khác.
- Nơi đăng: một số danh sách đọc ghi là ICRA 2026; trang arXiv và trang dự án không xác nhận điều này.

**Mang sang bài sau:** FARM đưa lực vào hành động của tay kẹp. [ForceVLA](forcevla.html) và [TA-VLA](ta-vla.html) đưa lực vào một VLA, còn [TDC](tdc.html) đặt lực vào bộ điều khiển thay vì vào hành động. [Reactive Diffusion Policy](reactive-diffusion-policy.html) xử lý bài toán thời gian mà FARM giao cho PID 25 Hz.

**Câu kiểm tra:** Mục tiêu là −1,0 N và FEATS đọc −0,4 N. Tay kẹp có đang điều khiển lực không? Nếu số đọc thành −0,7 N thì sao, và $e$ khi đó là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Không: −0,4 N nằm trên −0,5 N, nên vẫn ở chế độ độ mở. Ở −0,7 N cả hai đều dưới −0,5 N, điều khiển lực bật, và $e = -0{,}7 - (-1{,}0) = 0{,}3$ N, nên tay kẹp vẫn cần bóp mạnh hơn.
</details>
:::
