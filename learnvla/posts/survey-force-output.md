---
slug: survey-force-output
date: 2026-10-18
title_en: "Survey 3: What the Policy Outputs, and How It Learns"
title_vi: "Survey 3: Chính sách xuất ra gì, và học bằng cách nào"
excerpt_en: "A VLA that reads force perfectly can still fail if it can only answer with a pose. Four output interfaces, seven ways of learning from force, the speed gap, and why results across papers cannot be compared yet."
excerpt_vi: "Một VLA đọc lực hoàn hảo vẫn có thể thất bại nếu chỉ trả lời được bằng pose. Bốn giao diện đầu ra, bảy cách học từ lực, khoảng cách tốc độ, và vì sao kết quả giữa các bài chưa so sánh được."
tags: [VLA, Force, Survey, Control]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 3 of 3 · [Survey 1: where force enters](survey-force-map.html) · [Survey 2: sensing](survey-force-sensing.html)

**PROBLEM** If the policy outputs only a pose, the force it applies is set by the controller's stiffness and the true surface position, not by the policy.

**FOUR OUTPUTS** pose only · pose + force target · pose + stiffness · base action + residual.

**SEVEN WAYS TO LEARN** imitation · post-training/curriculum · distillation · reward/RL · human-in-the-loop · preference · world-model pretraining.

**OPEN GAP** No shared benchmark: the same baseline (ForceVLA) scores 12% to 60.5% depending on the paper.
</div>

## 1. Four output interfaces

[[fig:survey-force-output]] Four ways a force-aware policy can talk to the robot.

| Interface | Policy outputs | Who sets the force | Examples |
|---|---|---|---|
| (a) Pose only | target pose | controller stiffness × geometry error | ForceVLA, FD-VLA, TaF-VLA, LIFT, FM-VLA, HapticVLA |
| (b) Pose + force target | pose and $F^*$ | hybrid / admittance controller using measured force | ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CR-VLA-Force |
| (c) Pose + stiffness | pose and $K(t)$ | policy chooses how soft to be | CompVLA, CompliantVLA-adaptor |
| (d) Base + residual | base action, small fast correction | the residual, between base updates | ForceDelta-VLA, ForceRFT, TER-DAgger, VLA-Touch, MoDE-VLA, TacPAC |

## 2. Work it by hand: one spring, three interfaces

<div class="calc" markdown="1">
Calculation card

**What and why.** Model contact as a spring and compare the force error of interfaces (a), (c) and (b) for the same mistake about where the surface is. This is the trade-off each interface makes.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F^*$ | force the task needs | input | 10 N |
| $\delta$ | error in the surface estimate | input | 5 mm |
| $K$ | controller stiffness | input | 1000 or 200 N/m |
| $\Delta x$ | commanded depth into the surface | intermediate | – |
| $e_F$ | force error | output | – |
| $d$ | free-space drift under a 2 N disturbance | output | – |

**Formula**

$$\Delta x = \frac{F^*}{K}, \qquad e_F = K\,\delta, \qquad d = \frac{2\ \text{N}}{K}$$

**Steps**

1. (a) Stiff, $K = 1000$: $\Delta x = 10$ mm, $e_F = 1000 \times 0.005 = 5$ N (50%), $d = 2$ mm.
2. (c) Soft, $K = 200$: $\Delta x = 50$ mm, $e_F = 200 \times 0.005 = 1$ N (10%), $d = 10$ mm.
3. (b) Force target: the controller measures $F$ and adjusts until it reads 10 N, so $e_F \approx 0$ up to sensor noise; the price is needing a force measurement at run time.

**Result.** Stiff: precise motion, bad force. Soft: good force, sloppy motion. Force target: good force, needs a sensor.

**Why it matters.** This is why stiffness should vary over time (stiff while moving, soft at contact), and why outputting a force target is attractive when a sensor exists.
</div>

## 3. The speed gap

| System | Slow part | Fast part |
|---|---|---|
| [TER-DAgger](ter-dagger.html) | base policy 1 Hz | residual + detector 50 Hz, impedance 1 kHz |
| [FWBC-VLA](fwbc-vla.html) | VLA 15 Hz | force estimator 200 Hz |
| [VLA-Touch](vla-touch.html) | VLA chunk of 64 steps | refined actions at ≤ 8 Hz |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | pretrained backbone | 100 Hz action head reading latent buffers |

Sensors in these papers report at 30–300 Hz; VLAs replan a few times per second. Every "outside the VLA" design in [Survey 1](survey-force-map.html) is a way to close this gap.

## 4. Seven ways to learn from force

| Regime | Idea | Examples |
|---|---|---|
| Imitation fine-tuning | add force input, fine-tune on demos | ForceVLA, ForceVLA2, MoDE-VLA, TaF-VLA, Tabero, FWBC-VLA |
| Post-training, curriculum | adapt a pretrained VLA in stages | LIFT, CRAFT |
| Distillation | a teacher with force trains a student | FD-VLA, HapticVLA, ForceDelta-VLA, TaF-VLA |
| Reward weighting, RL | force defines what is good | HapticVLA, TORL-VLA, ForceRFT, MoDE-VLA (hand skill) |
| Human in the loop | humans correct contact failures | TER-DAgger, LIFT, TORL-VLA, ForceRFT |
| Preference learning | rank better vs worse actions | VTLA (DPO) |
| World-model pretraining | learn to predict touch first | DexTacWAM, H-Tac / TTP |

## 5. What is still missing

[[bars:%]] Reported by ForceVLA itself=60.5; In ForceDelta-VLA=54.4; In TORL-VLA (15/30 full task)=50; In FWBC-VLA (whiteboard)=24; In FWBC-VLA (door)=12 || The same baseline, ForceVLA, measured by five papers on different tasks and robots. These numbers cannot be compared with each other.

| Gap | Why it matters |
|---|---|
| Shared benchmarks | almost every paper builds its own tasks; Tabero is the only simulated force benchmark here |
| Metrics beyond success | a task can succeed while crushing the object; only some report force (Tabero grip force, ForceDelta-VLA −26% peak force) |
| Sensor diversity | a method tuned to one sensor may not transfer; TaF-VLA's cross-sensor test is a start |

## 6. How to choose

| Situation | Choice | Examples |
|---|---|---|
| Wrist F/T available, want a quick gain | fuse **after the VLM** with a protected path | ForceVLA, TORL-VLA |
| Task is about *how hard* | output a **force target** or **stiffness** | ForceVLA2, Tabero, CompVLA |
| Contact changes fast | add a **fast residual or controller** | ForceDelta-VLA, TER-DAgger, LIFT |
| No sensor on the deployed robot | **distil** from a sensorised teacher, or estimate from torques | FD-VLA, HapticVLA, FWBC-VLA |
| Same contact keeps failing | collect **human corrections**, refine online | TORL-VLA, ForceRFT, TER-DAgger |

This guide follows from the papers surveyed, not from a controlled comparison.

**Carry forward:** the series closes here. Next to write are the foundations these surveys lean on: Mixture of Experts, Cross-attention, Distillation, Impedance control.

**Check question:** $K = 300$ N/m, surface error 4 mm. What is the force error of a pose-only command, and how deep must the policy command to get 6 N?

<details markdown="1">
<summary>Answer</summary>

$e_F = 300 \times 0.004 = 1.2$ N. $\Delta x = 6/300 = 0.02$ m = 20 mm.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 3 / 3 · [Survey 1: lực vào ở đâu](survey-force-map.html) · [Survey 2: cảm biến](survey-force-sensing.html)

**VẤN ĐỀ** Nếu chính sách chỉ xuất pose, lực nó tác dụng do độ cứng bộ điều khiển và vị trí thật của bề mặt quyết định, không do chính sách.

**BỐN ĐẦU RA** chỉ pose · pose + lực mục tiêu · pose + độ cứng · hành động nền + residual.

**BẢY CÁCH HỌC** bắt chước · post-training/giáo trình · chưng cất · phần thưởng/RL · có người trong vòng lặp · theo sở thích · pretrain world model.

**KHOẢNG TRỐNG** Chưa có benchmark chung: cùng một baseline (ForceVLA) đạt từ 12% đến 60,5% tùy bài.
</div>

## 1. Bốn giao diện đầu ra

[[fig:survey-force-output]] Bốn cách một chính sách nhận biết lực nói chuyện với robot.

| Giao diện | Chính sách xuất | Ai quyết định lực | Ví dụ |
|---|---|---|---|
| (a) Chỉ pose | pose mục tiêu | độ cứng bộ điều khiển × sai số hình học | ForceVLA, FD-VLA, TaF-VLA, LIFT, FM-VLA, HapticVLA |
| (b) Pose + lực mục tiêu | pose và $F^*$ | bộ điều khiển lai / admittance dùng lực đo | ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CR-VLA-Force |
| (c) Pose + độ cứng | pose và $K(t)$ | chính sách chọn mềm đến đâu | CompVLA, CompliantVLA-adaptor |
| (d) Nền + residual | hành động nền, hiệu chỉnh nhỏ nhanh | residual, giữa hai lần cập nhật của nền | ForceDelta-VLA, ForceRFT, TER-DAgger, VLA-Touch, MoDE-VLA, TacPAC |

## 2. Tính tay: một lò xo, ba giao diện

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Coi tiếp xúc như lò xo và so sai số lực của giao diện (a), (c) và (b) với cùng một sai lầm về vị trí bề mặt. Đây là đánh đổi mà mỗi giao diện chấp nhận.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F^*$ | lực task cần | input | 10 N |
| $\delta$ | sai số ước lượng bề mặt | input | 5 mm |
| $K$ | độ cứng bộ điều khiển | input | 1000 hoặc 200 N/m |
| $\Delta x$ | độ sâu được ra lệnh vào bề mặt | trung gian | – |
| $e_F$ | sai số lực | output | – |
| $d$ | độ lệch khi di chuyển tự do dưới nhiễu 2 N | output | – |

**Công thức**

$$\Delta x = \frac{F^*}{K}, \qquad e_F = K\,\delta, \qquad d = \frac{2\ \text{N}}{K}$$

**Từng bước**

1. (a) Cứng, $K = 1000$: $\Delta x = 10$ mm, $e_F = 1000 \times 0.005 = 5$ N (50%), $d = 2$ mm.
2. (c) Mềm, $K = 200$: $\Delta x = 50$ mm, $e_F = 200 \times 0.005 = 1$ N (10%), $d = 10$ mm.
3. (b) Lực mục tiêu: bộ điều khiển đo $F$ và chỉnh tới khi đọc được 10 N, nên $e_F \approx 0$ trong giới hạn nhiễu cảm biến; cái giá là cần đo lực lúc chạy.

**Kết quả.** Cứng: chuyển động chính xác, lực tệ. Mềm: lực tốt, chuyển động lỏng. Lực mục tiêu: lực tốt, cần cảm biến.

**Ý nghĩa.** Đây là lý do độ cứng nên thay đổi theo thời gian (cứng khi di chuyển, mềm khi tiếp xúc), và vì sao xuất lực mục tiêu hấp dẫn khi có cảm biến.
</div>

## 3. Khoảng cách tốc độ

| Hệ thống | Phần chậm | Phần nhanh |
|---|---|---|
| [TER-DAgger](ter-dagger.html) | chính sách nền 1 Hz | residual + bộ phát hiện 50 Hz, impedance 1 kHz |
| [FWBC-VLA](fwbc-vla.html) | VLA 15 Hz | bộ ước lượng lực 200 Hz |
| [VLA-Touch](vla-touch.html) | chunk VLA 64 bước | hành động tinh chỉnh ≤ 8 Hz |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | backbone đã pretrain | đầu hành động 100 Hz đọc bộ đệm latent |

Cảm biến trong các bài này báo ở 30–300 Hz; VLA chỉ lập kế hoạch lại vài lần mỗi giây. Mọi thiết kế "ngoài VLA" ở [Survey 1](survey-force-map.html) là một cách lấp khoảng cách này.

## 4. Bảy cách học từ lực

| Cách học | Ý tưởng | Ví dụ |
|---|---|---|
| Fine-tune bắt chước | thêm đầu vào lực, fine-tune trên demo | ForceVLA, ForceVLA2, MoDE-VLA, TaF-VLA, Tabero, FWBC-VLA |
| Post-training, giáo trình | thích nghi VLA đã pretrain theo giai đoạn | LIFT, CRAFT |
| Chưng cất | teacher có lực dạy student | FD-VLA, HapticVLA, ForceDelta-VLA, TaF-VLA |
| Trọng số phần thưởng, RL | lực định nghĩa thế nào là tốt | HapticVLA, TORL-VLA, ForceRFT, MoDE-VLA (kỹ năng tay) |
| Có người trong vòng lặp | con người sửa lỗi tiếp xúc | TER-DAgger, LIFT, TORL-VLA, ForceRFT |
| Học theo sở thích | xếp hạng hành động tốt và kém | VTLA (DPO) |
| Pretrain world model | học dự đoán xúc giác trước | DexTacWAM, H-Tac / TTP |

## 5. Những gì còn thiếu

[[bars:%]] Do chính ForceVLA báo=60.5; Trong ForceDelta-VLA=54.4; Trong TORL-VLA (15/30 cả chuỗi)=50; Trong FWBC-VLA (lau bảng)=24; Trong FWBC-VLA (mở cửa)=12 || Cùng một baseline, ForceVLA, được năm bài đo trên task và robot khác nhau. Các con số này không so sánh được với nhau.

| Khoảng trống | Vì sao quan trọng |
|---|---|
| Benchmark chung | gần như bài nào cũng tự dựng task; Tabero là benchmark lực mô phỏng duy nhất ở đây |
| Chỉ số ngoài thành công | task có thể thành công mà vẫn bóp bẹp vật; chỉ vài bài báo cáo lực (lực kẹp của Tabero, ForceDelta-VLA giảm 26% lực đỉnh) |
| Đa dạng cảm biến | phương pháp chỉnh cho một cảm biến có thể không chuyển được; thử nghiệm chéo cảm biến của TaF-VLA mới là bước đầu |

## 6. Chọn thế nào

| Tình huống | Lựa chọn | Ví dụ |
|---|---|---|
| Có F/T cổ tay, muốn cải thiện nhanh | gộp **sau VLM** với đường được bảo vệ | ForceVLA, TORL-VLA |
| Task xoay quanh *mạnh hay nhẹ* | xuất **lực mục tiêu** hoặc **độ cứng** | ForceVLA2, Tabero, CompVLA |
| Tiếp xúc thay đổi nhanh | thêm **residual hoặc bộ điều khiển nhanh** | ForceDelta-VLA, TER-DAgger, LIFT |
| Robot triển khai không có cảm biến | **chưng cất** từ teacher có cảm biến, hoặc ước lượng từ mô men | FD-VLA, HapticVLA, FWBC-VLA |
| Cứ hỏng ở cùng một tiếp xúc | thu **chỉnh sửa của người**, tinh chỉnh online | TORL-VLA, ForceRFT, TER-DAgger |

Hướng dẫn rút ra từ các bài trong survey, không phải từ một so sánh có kiểm soát.

**Mang sang bài sau:** series khép lại ở đây. Các nền tảng nên viết tiếp: Mixture of Experts, Cross-attention, Distillation, điều khiển Impedance.

**Câu kiểm tra:** $K = 300$ N/m, sai số bề mặt 4 mm. Sai số lực của lệnh chỉ-pose là bao nhiêu, và phải ra lệnh ấn sâu bao nhiêu để được 6 N?

<details markdown="1">
<summary>Đáp án</summary>

$e_F = 300 \times 0.004 = 1.2$ N. $\Delta x = 6/300 = 0.02$ m = 20 mm.
</details>
:::
