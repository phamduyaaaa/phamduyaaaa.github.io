---
slug: mimictouch
date: 2026-11-02
title_en: "MimicTouch: Recording Touch on a Human Finger, Then Closing the Gap with Residual RL"
title_vi: "MimicTouch: Ghi xúc giác trên ngón tay người, rồi lấp khoảng cách bằng residual RL"
excerpt_en: "Teleoperation is slow and the operator cannot feel what the robot feels. MimicTouch puts a GelSight Mini on a human fingertip and a contact microphone under the hole, copies the demonstrations by nearest-neighbour lookup, then corrects them on the robot with a small residual SAC policy: 96% insertion after 3 hours of online RL."
excerpt_vi: "Teleoperation chậm và người điều khiển không cảm nhận được những gì robot cảm nhận. MimicTouch gắn GelSight Mini lên đầu ngón tay người và một micro tiếp xúc dưới lỗ, chép demo bằng tra cứu láng giềng gần nhất, rồi sửa trên robot bằng một chính sách SAC residual nhỏ: chèn thành công 96% sau 3 giờ RL trực tuyến."
tags: [VLA, Tactile, Human Data, Residual RL, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Yu, Han, Wang, Saxena, Xu, Zhao, [arXiv 2310.16917](https://arxiv.org/abs/2310.16917) · v1 25 Oct 2023, v4 6 Feb 2025 · **CoRL 2024** (PMLR 270); Best Paper, NeurIPS 2023 Touch Processing Workshop · Georgia Tech · [project page](https://sites.google.com/view/mimictouch) · no code or dataset released

**PROBLEM** Contact-rich insertion needs touch, but tactile demonstrations are usually collected by teleoperation: slow, hard to learn, and the operator steers by sight while the robot records touch, so the data does not reflect a touch-driven strategy.

**WHAT FAILED BEFORE** Teleoperated tactile imitation (MULSA) assumes a small action space such as 3D translation; its policy reached 16% here. Pure tactile RL learns from scratch and produces quasi-static, limited motions.

**IDEA** Let a person do the task with a GelSight Mini on the fingertip while a contact microphone listens at the hole. Learn tactile and audio embeddings by self-supervision (BYOL), copy actions by nearest-neighbour lookup in the demonstration library, then train a bounded residual policy online on the robot with SAC to cover the human-to-gripper gap.

**RESULT** Human demonstrations are collected 5.5× faster than with a SpaceMouse (104 vs 19 usable per hour). The offline policy alone succeeds 40% (10/25); after 3 hours of residual RL it reaches 96% (24/25), and keeps 52–93% on unseen tilts, shapes and materials.
</div>

## 1. The problem: teleoperation records touch the operator never used

[[flow]]
- Before~Teleoperation | SpaceMouse operator watches > !Robot moves~touch recorded, not used to decide! > Tactile dataset | 19 usable demos/h; policy 12%
- Before~Tactile RL | Random start > !Learn from scratch~no motion prior! > Policy | quasi-static, small action space
+ MimicTouch | Human finger feels > *Tactile + audio demos~104 usable/h* > *NN copy + residual RL* > Robot | 96% after 3 h
[[/flow]] The person's own sense of touch decides each move, so the demonstrations contain a real touch-guided strategy; RL fixes only what changes between a finger and a gripper.

## 2. Pipeline

[[fig:mimictouch]] Three stages: human data without a robot, an offline nearest-neighbour policy, and a small residual learned online on the robot.

| Part | Input | Output | Role |
|---|---|---|---|
| Human rig | GelSight Mini on the fingertip (15 Hz, 400×300), contact microphone at the hole base (44.1 kHz), RealSense + ArUco for fingertip pose (60 Hz) | synchronised streams, resampled to 15 Hz | demonstrations without a robot |
| Tactile encoder | GelSight image, 256×256 | 2,048-D embedding | BYOL; only blur and crop augmentation, because colour jitter would change the tactile signal |
| Audio encoder | 0.5 s mel-spectrogram, 64 bins | 2,048-D embedding | BYOL-A |
| Offline policy | tactile and audio embeddings plus EE pose | 6-D delta EE pose $a_o$ | nearest-neighbour lookup in the library of 20 demonstrations; inputs normalised to unit maximum distance |
| Residual policy | the same features plus the previous action | $a_r$, clipped to ±0.15 cm and ±3° per axis | MLP trained with SAC on the real robot |
| Robot | $a = a_o + a_r$ at 5 Hz | joint commands via IK | Franka Panda; no camera during execution |

The residual is trained with a shaped reward: $d = 1 - \tanh(10\,\lVert\Delta p\rVert)$ for distance to the target, $o = 1 - \tanh(7.5\,\lVert\Delta q\rVert)$ for orientation, a 0.2 term for a blocked step (written in the paper as a penalty $c$ that is 0.2 when the step completes and 0 when it cannot complete within 0.5 s), a 0.5 penalty when the tactile embedding jumps (slip), and a trajectory term $D_{KL}$ that keeps the robot near the expert. Overall $R = 1$ on success, otherwise $R = 0.5\,D_{KL} + 0.3\,d + 0.2\,o - c - s$, as printed.

## 3. Work it by hand: data speed and how far the residual can move

<div class="calc" markdown="1">
Calculation card

**What and why.** Two numbers decide whether the method is practical: how long collecting the 20 demonstrations takes, and how much the residual can correct, since it is the only part that learns on the robot.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $r$ | usable demonstrations per hour (Table 1) | measured | 19 (SpaceMouse), 44 (hand-guided), 104 (human tactile) |
| $N$ | demonstrations needed | constant | 20 |
| $\delta$ | residual limit per step, translation | constant | 0.15 cm |
| $f$ | control rate | constant | 5 Hz |
| $d$ | distance reward term | output | – |

**Formulas**

$$T = \frac{N}{r},\qquad v_{max} = \delta\, f,\qquad d = 1 - \tanh(10\,\lVert\Delta p\rVert)$$

**Steps**

1. SpaceMouse: $20 / 19 = 1.05$ h, about 63 minutes, after about 5 hours of operator practice.
2. Human tactile: $20 / 104 = 0.19$ h, about 11.5 minutes. Ratio $104 / 19 = 5.5$.
3. Residual speed: $0.15 \times 5 = 0.75$ cm/s per axis at most.
4. Distance reward with $\lVert\Delta p\rVert$ = 0.01 m (1 cm, assuming metres): $\tanh(0.1) = 0.0997$, so $d = 0.90$; at 0.05 m: $\tanh(0.5) = 0.462$, $d = 0.54$.

**Result.** About 12 minutes of human demonstrations against an hour of SpaceMouse; the residual can shift the plan by at most 0.75 cm/s.

**Why it matters.** The residual is small on purpose: it can fix a millimetre-scale offset between a finger and a gripper, but it cannot invent a new strategy. Whatever the human did must already be close to right.
</div>

## 4. Results

[[bars:%]] SpaceMouse demos, offline=12; Hand-guided demos, offline=28; Human tactile demos, offline=40; SpaceMouse + RL 2 h=32; Hand-guided + RL 2 h=60; Human tactile + RL 2 h=88; *Human tactile + RL 3 h=96* || Cylinder insertion, 25 trials each. Every policy is the same nearest-neighbour method; only the source of the 20 demonstrations differs.

| Data collection (20 usable demos) | Usable per hour | Usable share |
|---|---|---|
| SpaceMouse teleoperation | 19 | 38.5% (20/52) |
| Hand-guided teleoperation | 44 | 58.8% (20/34) |
| Human tactile demonstration | 104 | 83.3% (20/24) |

Offline policy against the MULSA baseline on the same demonstrations: action MSE 0.21 vs 1.53, success 40% vs 16%.

| Zero-shot generalisation (final policy) | Open-loop replay | MimicTouch |
|---|---|---|
| Hole shifted 0.8 cm | 24/40 | 37/40 |
| Hole tilted 10° | 14/25 | 23/25 |
| Hole tilted 20° | 10/25 | 20/25 |
| Two-stage dense packing | 13/25 | 22/25 |
| Rigid multi-material box | 13/25 | 20/25 |
| Soft multi-material box | 9/25 | 16/25 |
| Furniture assembly (insertion part) | 8/25 | 19/25 |
| Furniture assembly (full) | 3/25 | 13/25 |

"Open-loop replay" executes five successful insertion trajectories five times each. Failures shown by the authors: joint limits at 20° tilt, a sponge too soft to give a contact signal, a hole that is too small.

## 5. Data

| Item | Value |
|---|---|
| Representation learning set | 100 human trajectories of about 5 s: 7,657 tactile images, 1,000 audio clips, including failed and sub-optimal ones |
| Policy library | 20 successful demonstrations |
| Main task | cylinder of radius 17.5 mm into a hole of radius 20 mm, 40 mm deep |
| Pose processing | hand-eye calibration from six poses, IQR outlier removal, median filter, 2 Hz low-pass |
| Online RL | each iteration: 5 new trajectories plus 5 from the replay buffer; evaluation every ~20 min; start pose randomised |

## 6. Can I use this on my robot?

**Short answer.** The idea yes, the system no. There is no code, the tasks are single insertions, and the method needs a GelSight Mini on the gripper finger plus a microphone near the hole; a wrist F/T sensor is not part of it. The useful lesson is the recipe: collect demonstrations with your own hand, then learn a small bounded residual on the robot. "Not stated" means I did not find it in the paper or project page.

| Need | What the authors used | If yours differs |
|---|---|---|
| Arm | Franka Panda, 6-D delta pose through IK | A UR10e takes the same delta-pose command |
| Touch | GelSight Mini on the human finger and on the robot | The UR10e's wrist F/T is not a substitute for the tactile image; you would need a fingertip sensor |
| Audio | HOYUJI TD-11 contact microphone at the hole base | Cheap, but tied to the fixture, not the robot |
| Online RL | several hours of real-robot SAC per task | Needs resets and safety supervision for each task |
| Gripper | Not stated | – |
| Code, data | Not released | Re-implementation from the paper |

## 7. Caveats

- 25 trials per setting; 96% (24/25) has a Wilson interval of about 80–99% (my arithmetic).
- The RL reward contains $+0.5\,D_{KL}$ to the expert trajectory, which as written rewards divergence; the text says it is meant to keep the robot close to the expert, and the paper does not say how $D_{KL}$ is estimated.
- The method is task-specific: the authors list several hours of RL per task and no transfer of the tactile strategy across tasks as the main limits.
- No camera during execution, so the hole must already be roughly within reach of the start pose.

**Carry forward:** MimicTouch shows how to collect tactile demonstrations without a robot. [FARM](farm.html) takes the same idea further with a hand-held gripper that records force, and [FACT](fact.html) scales human touch to 2,000 hours with gloves. The residual step is explained in [Residual Policy](residual-policy.html) and [Actor-Critic RL](actor-critic.html).

**Check question:** With 44 usable hand-guided demonstrations per hour, how long do 20 take, and how much faster is the human tactile rig?

<details markdown="1">
<summary>Answer</summary>

$20/44 = 0.45$ h, about 27 minutes; $104/44 = 2.4$ times faster.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Yu, Han, Wang, Saxena, Xu, Zhao, [arXiv 2310.16917](https://arxiv.org/abs/2310.16917) · v1 25/10/2023, v4 6/2/2025 · **CoRL 2024** (PMLR 270); Best Paper, NeurIPS 2023 Touch Processing Workshop · Georgia Tech · [trang dự án](https://sites.google.com/view/mimictouch) · không công bố code hay dữ liệu

**VẤN ĐỀ** Thao tác chèn nhiều tiếp xúc cần xúc giác, nhưng demo xúc giác thường được thu bằng teleoperation: chậm, khó học, và người điều khiển lái bằng mắt trong khi robot ghi xúc giác, nên dữ liệu không phản ánh một chiến lược dựa trên xúc giác.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Bắt chước xúc giác bằng teleoperation (MULSA) giả định không gian hành động nhỏ như tịnh tiến 3D; chính sách của nó chỉ đạt 16% ở đây. RL xúc giác thuần học từ đầu và tạo ra chuyển động gần tĩnh, hạn chế.

**Ý TƯỞNG** Cho một người làm tác vụ với GelSight Mini gắn ở đầu ngón tay trong khi một micro tiếp xúc nghe ở lỗ. Học embedding xúc giác và âm thanh bằng tự giám sát (BYOL), chép hành động bằng tra cứu láng giềng gần nhất trong thư viện demo, rồi huấn luyện trực tuyến trên robot một chính sách residual có giới hạn bằng SAC để lấp khoảng cách giữa ngón tay người và tay kẹp.

**KẾT QUẢ** Demo của người thu nhanh gấp 5,5 lần SpaceMouse (104 so với 19 demo dùng được mỗi giờ). Riêng chính sách offline thành công 40% (10/25); sau 3 giờ residual RL đạt 96% (24/25), và giữ 52–93% với độ nghiêng, hình dạng và vật liệu chưa thấy.
</div>

## 1. Vấn đề: teleoperation ghi lại xúc giác mà người điều khiển không hề dùng

[[flow]]
- Trước~Teleoperation | Người cầm SpaceMouse nhìn > !Robot di chuyển~xúc giác được ghi, không dùng để quyết định! > Dữ liệu xúc giác | 19 demo dùng được/giờ; chính sách 12%
- Trước~RL xúc giác | Khởi đầu ngẫu nhiên > !Học từ đầu~không có tiên nghiệm chuyển động! > Chính sách | gần tĩnh, không gian hành động nhỏ
+ MimicTouch | Ngón tay người cảm nhận > *Demo xúc giác + âm thanh~104 dùng được/giờ* > *Chép NN + residual RL* > Robot | 96% sau 3 giờ
[[/flow]] Chính xúc giác của người quyết định từng bước, nên demo chứa một chiến lược thật sự dựa trên xúc giác; RL chỉ sửa phần khác nhau giữa ngón tay và tay kẹp.

## 2. Quy trình

[[fig:mimictouch]] Ba giai đoạn: dữ liệu người không cần robot, một chính sách láng giềng gần nhất offline, và một residual nhỏ học trực tuyến trên robot.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Bộ thu của người | GelSight Mini ở đầu ngón (15 Hz, 400×300), micro tiếp xúc ở đáy lỗ (44,1 kHz), RealSense + ArUco cho pose đầu ngón (60 Hz) | các luồng đồng bộ, lấy mẫu lại 15 Hz | demo không cần robot |
| Bộ mã hóa xúc giác | ảnh GelSight, 256×256 | embedding 2.048 chiều | BYOL; chỉ tăng cường bằng làm mờ và cắt, vì đổi màu sẽ thay đổi tín hiệu xúc giác |
| Bộ mã hóa âm thanh | mel-spectrogram 0,5 s, 64 dải | embedding 2.048 chiều | BYOL-A |
| Chính sách offline | embedding xúc giác và âm thanh cộng pose EE | delta pose EE 6 chiều $a_o$ | tra láng giềng gần nhất trong thư viện 20 demo; input chuẩn hóa để khoảng cách lớn nhất bằng 1 |
| Chính sách residual | cùng các đặc trưng cộng hành động trước | $a_r$, bị chặn ở ±0,15 cm và ±3° mỗi trục | MLP huấn luyện bằng SAC trên robot thật |
| Robot | $a = a_o + a_r$ ở 5 Hz | lệnh khớp qua IK | Franka Panda; không dùng camera khi thực thi |

Residual được huấn luyện với phần thưởng định hình: $d = 1 - \tanh(10\,\lVert\Delta p\rVert)$ cho khoảng cách tới đích, $o = 1 - \tanh(7{,}5\,\lVert\Delta q\rVert)$ cho hướng, một số hạng 0,2 cho bước bị chặn (bài viết thành phạt $c$ bằng 0,2 khi bước hoàn thành và 0 khi không hoàn thành trong 0,5 s), phạt 0,5 khi embedding xúc giác nhảy mạnh (trượt), và một số hạng quỹ đạo $D_{KL}$ giữ robot gần chuyên gia. Tổng $R = 1$ khi thành công, ngược lại $R = 0{,}5\,D_{KL} + 0{,}3\,d + 0{,}2\,o - c - s$, đúng như in trong bài.

## 3. Tính tay: tốc độ thu dữ liệu và residual dịch được bao xa

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Hai con số quyết định phương pháp có thực tế không: thu 20 demo mất bao lâu, và residual sửa được bao nhiêu, vì nó là phần duy nhất học trên robot.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $r$ | số demo dùng được mỗi giờ (Bảng 1) | đo được | 19 (SpaceMouse), 44 (dẫn tay), 104 (xúc giác người) |
| $N$ | số demo cần | hằng số | 20 |
| $\delta$ | giới hạn residual mỗi bước, tịnh tiến | hằng số | 0,15 cm |
| $f$ | tần số điều khiển | hằng số | 5 Hz |
| $d$ | số hạng thưởng khoảng cách | output | – |

**Công thức**

$$T = \frac{N}{r},\qquad v_{max} = \delta\, f,\qquad d = 1 - \tanh(10\,\lVert\Delta p\rVert)$$

**Từng bước**

1. SpaceMouse: $20 / 19 = 1{,}05$ giờ, khoảng 63 phút, sau khoảng 5 giờ người điều khiển tập luyện.
2. Xúc giác người: $20 / 104 = 0{,}19$ giờ, khoảng 11,5 phút. Tỉ lệ $104 / 19 = 5{,}5$.
3. Tốc độ residual: tối đa $0{,}15 \times 5 = 0{,}75$ cm/s mỗi trục.
4. Thưởng khoảng cách với $\lVert\Delta p\rVert$ = 0,01 m (1 cm, giả sử đơn vị mét): $\tanh(0{,}1) = 0{,}0997$, nên $d = 0{,}90$; ở 0,05 m: $\tanh(0{,}5) = 0{,}462$, $d = 0{,}54$.

**Kết quả.** Khoảng 12 phút demo của người so với một giờ SpaceMouse; residual chỉ dịch kế hoạch tối đa 0,75 cm/s.

**Ý nghĩa.** Residual được cố ý giữ nhỏ: nó sửa được độ lệch cỡ milimét giữa ngón tay và tay kẹp, nhưng không tự nghĩ ra chiến lược mới được. Những gì người làm phải gần đúng sẵn.
</div>

## 4. Kết quả

[[bars:%]] Demo SpaceMouse, offline=12; Demo dẫn tay, offline=28; Demo xúc giác người, offline=40; SpaceMouse + RL 2 giờ=32; Dẫn tay + RL 2 giờ=60; Xúc giác người + RL 2 giờ=88; *Xúc giác người + RL 3 giờ=96* || Chèn trụ, 25 lượt mỗi cột. Mọi chính sách dùng cùng phương pháp láng giềng gần nhất; chỉ nguồn của 20 demo khác nhau.

| Thu dữ liệu (20 demo dùng được) | Dùng được mỗi giờ | Tỉ lệ dùng được |
|---|---|---|
| Teleoperation SpaceMouse | 19 | 38,5% (20/52) |
| Teleoperation dẫn tay | 44 | 58,8% (20/34) |
| Demo xúc giác của người | 104 | 83,3% (20/24) |

Chính sách offline so với baseline MULSA trên cùng demo: MSE hành động 0,21 so với 1,53, thành công 40% so với 16%.

| Tổng quát hóa zero-shot (chính sách cuối) | Phát lại vòng hở | MimicTouch |
|---|---|---|
| Lỗ dịch 0,8 cm | 24/40 | 37/40 |
| Lỗ nghiêng 10° | 14/25 | 23/25 |
| Lỗ nghiêng 20° | 10/25 | 20/25 |
| Xếp chặt hai tầng | 13/25 | 22/25 |
| Hộp nhiều vật liệu cứng | 13/25 | 20/25 |
| Hộp nhiều vật liệu mềm | 9/25 | 16/25 |
| Lắp đồ nội thất (phần chèn) | 8/25 | 19/25 |
| Lắp đồ nội thất (đầy đủ) | 3/25 | 13/25 |

"Phát lại vòng hở" chạy năm quỹ đạo chèn thành công, mỗi quỹ đạo năm lần. Thất bại tác giả nêu: chạm giới hạn khớp khi nghiêng 20°, miếng bọt biển quá mềm không cho tín hiệu tiếp xúc, lỗ quá nhỏ.

## 5. Dữ liệu

| Mục | Giá trị |
|---|---|
| Tập học biểu diễn | 100 quỹ đạo người khoảng 5 s: 7.657 ảnh xúc giác, 1.000 đoạn âm thanh, gồm cả lần thất bại và chưa tối ưu |
| Thư viện chính sách | 20 demo thành công |
| Tác vụ chính | trụ bán kính 17,5 mm vào lỗ bán kính 20 mm, sâu 40 mm |
| Xử lý pose | hiệu chuẩn hand-eye từ sáu pose, loại ngoại lai bằng IQR, lọc trung vị, lọc thông thấp 2 Hz |
| RL trực tuyến | mỗi vòng: 5 quỹ đạo mới cộng 5 quỹ đạo từ replay buffer; đánh giá khoảng 20 phút một lần; pose bắt đầu ngẫu nhiên |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Ý tưởng thì có, hệ thống thì không. Không có code, tác vụ chỉ là chèn đơn lẻ, và phương pháp cần GelSight Mini trên ngón tay kẹp cộng một micro gần lỗ; cảm biến F/T cổ tay không nằm trong đó. Bài học hữu ích là công thức: thu demo bằng chính tay mình, rồi học một residual nhỏ có giới hạn trên robot. "Không nêu" nghĩa là mình không tìm thấy trong paper hay trang dự án.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cánh tay | Franka Panda, delta pose 6 chiều qua IK | UR10e nhận cùng kiểu lệnh delta pose |
| Xúc giác | GelSight Mini trên ngón tay người và trên robot | F/T cổ tay của UR10e không thay được ảnh xúc giác; bạn sẽ cần cảm biến ở đầu ngón |
| Âm thanh | Micro tiếp xúc HOYUJI TD-11 ở đáy lỗ | Rẻ, nhưng gắn với đồ gá, không gắn với robot |
| RL trực tuyến | vài giờ SAC trên robot thật cho mỗi tác vụ | Cần reset và giám sát an toàn cho từng tác vụ |
| Tay kẹp | Không nêu | – |
| Code, dữ liệu | Không công bố | Phải tự cài lại từ paper |

## 7. Lưu ý

- 25 lượt mỗi thiết lập; 96% (24/25) có khoảng Wilson khoảng 80–99% (phép tính của mình).
- Phần thưởng RL chứa $+0{,}5\,D_{KL}$ so với quỹ đạo chuyên gia, nếu đọc đúng như in thì là thưởng cho việc lệch xa; phần chữ nói nó dùng để giữ robot gần chuyên gia, và bài không nói $D_{KL}$ được ước lượng thế nào.
- Phương pháp gắn với từng tác vụ: tác giả nêu vài giờ RL mỗi tác vụ và việc chiến lược xúc giác không chuyển được giữa các tác vụ là giới hạn chính.
- Không có camera khi thực thi, nên lỗ phải nằm gần pose bắt đầu sẵn.

**Mang sang bài sau:** MimicTouch cho thấy cách thu demo xúc giác không cần robot. [FARM](farm.html) đi xa hơn với tay kẹp cầm tay ghi được lực, và [FACT](fact.html) mở rộng xúc giác của người lên 2.000 giờ bằng găng tay. Bước residual được giải thích ở [Residual Policy](residual-policy.html) và [Actor-Critic RL](actor-critic.html).

**Câu kiểm tra:** Với 44 demo dẫn tay dùng được mỗi giờ, thu 20 demo mất bao lâu, và bộ thu xúc giác của người nhanh hơn bao nhiêu lần?

<details markdown="1">
<summary>Đáp án</summary>

$20/44 = 0{,}45$ giờ, khoảng 27 phút; $104/44 = 2{,}4$ lần.
</details>
:::
