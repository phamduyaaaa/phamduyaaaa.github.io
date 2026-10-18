---
slug: survey-force-output
date: 2026-10-18
title_en: "Survey 3: What the Policy Outputs, and How It Learns"
title_vi: "Survey 3: Chính sách xuất ra gì, và học bằng cách nào"
excerpt_en: "A VLA that reads force perfectly can still fail if it can only answer with a pose. Four output interfaces, seven ways of learning from force, the speed gap, a decision chart for choosing, and references."
excerpt_vi: "Một VLA đọc lực hoàn hảo vẫn có thể thất bại nếu chỉ trả lời được bằng pose. Bốn giao diện đầu ra, bảy cách học từ lực, khoảng cách tốc độ, sơ đồ giúp chọn thiết kế, và tài liệu tham khảo."
tags: [VLA, Force, Survey, Control]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 3 of 3 · [Survey 1: where force enters](survey-force-map.html) · [Survey 2: sensing](survey-force-sensing.html)

**THE PROBLEM** If the policy only outputs a target pose, the force the robot applies is not chosen by the policy. It comes from the controller's stiffness and from how wrong the policy is about where the surface sits.

**FOUR OUTPUTS** pose only · pose + force target · pose + stiffness · base action + fast residual.

**SEVEN WAYS TO LEARN** imitation · post-training or curriculum · distillation · reward or RL · human in the loop · preference · world-model pretraining.

**OPEN GAP** There is no shared benchmark. The same baseline (ForceVLA) scores anywhere from 12% to 60.5%, depending on which paper ran it. Numbers in brackets are reference numbers from [Survey 1](survey-force-map.html).
</div>

## 1. Four output interfaces

Think of telling someone to push a door. You can say *where to put the hand* (pose), *where to put the hand and how hard to push* (pose + force), *where to put the hand and how stiff to hold the arm* (pose + stiffness), or *keep doing what you planned, but correct yourself every instant from what you feel* (base + residual).

[[fig:survey-force-output]] Four ways a force-aware policy can talk to the robot.

| Interface | The policy outputs | Who sets the force | Examples |
|---|---|---|---|
| (a) Pose only | a target pose | controller stiffness × geometry error | ForceVLA [2], FD-VLA [10], TaF-VLA [9], LIFT [22], FM-VLA [23], HapticVLA [16] |
| (b) Pose + force target | pose and $F^*$ | a hybrid or admittance controller that uses measured force | ForceVLA2 [15], Tabero [17], Tactile-VLA [3], Opt2VLA [32], CR-VLA-Force [27] |
| (c) Pose + stiffness | pose and $K(t)$ | the policy decides how soft to be | CompVLA [31], CompliantVLA-adaptor [8] |
| (d) Base + residual | a base action plus a small fast correction | the residual, between base updates | ForceDelta-VLA [29], ForceRFT [30], TER-DAgger [13], VLA-Touch [4], MoDE-VLA [14], TacPAC [26] |

## 2. Work it by hand: one spring, three interfaces

<div class="calc" markdown="1">

Calculation card

**What and why.** Model contact as a spring and compare the force error of interfaces (a), (c) and (b) when the policy is wrong about where the surface is. This is the trade-off each interface makes.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F^*$ | the force the task needs | input | 10 N |
| $\delta$ | error in the surface estimate | input | 5 mm |
| $K$ | controller stiffness | input | 1000 or 200 N/m |
| $\Delta x$ | commanded depth into the surface | intermediate | – |
| $e_F$ | force error | output | – |
| $d$ | drift in free space under a 2 N disturbance | output | – |

**Formula**

$$\Delta x = \frac{F^*}{K}, \qquad e_F = K\,\delta, \qquad d = \frac{2\ \text{N}}{K}$$

**Steps**

1. (a) Stiff, $K = 1000$: $\Delta x = 10$ mm, $e_F = 1000 \times 0.005 = 5$ N (50% of 10 N), $d = 2$ mm.
2. (c) Soft, $K = 200$: $\Delta x = 50$ mm, $e_F = 200 \times 0.005 = 1$ N (10%), $d = 10$ mm.
3. (b) Force target: the controller measures $F$ and adjusts until it reads 10 N, so $e_F \approx 0$ up to sensor noise. The price is a force measurement at run time.

**Result.** Stiff: precise motion, bad force. Soft: good force, sloppy motion. Force target: good force, needs a sensor.

**Why it matters.** This is why stiffness should change over time (stiff while moving, soft at contact), and why a force target is attractive when a sensor exists.
</div>

[[bars:N]] (a) Stiff K=1000=5; (c) Soft K=200=1; *(b) Force target=0* || Force error in newtons when the surface estimate is 5 mm off. Smaller is better.

[[bars:mm]] (a) Stiff K=1000=2; *(c) Soft K=200=10* || Free-space drift in millimetres under a 2 N disturbance. This is the price of being soft.

## 3. The speed gap

| System | Slow part | Fast part |
|---|---|---|
| [TER-DAgger](ter-dagger.html) [13] | base policy 1 Hz | residual + detector 50 Hz, impedance 1 kHz |
| [FWBC-VLA](fwbc-vla.html) [25] | VLA 15 Hz | force estimator 200 Hz |
| [VLA-Touch](vla-touch.html) [4] | VLA chunk of 64 steps | refined actions at up to 8 Hz |
| DAM-VLA [19] | pretrained backbone | 100 Hz action head reading latent buffers |

Sensors in these papers report at 30-300 Hz while VLAs replan a few times per second. Every "outside the VLA" design in [Survey 1](survey-force-map.html) is a way to close this gap.

## 4. Seven ways to learn from force

| Regime | The idea | Examples |
|---|---|---|
| Imitation fine-tuning | add force as an input, fine-tune on demonstrations | ForceVLA [2], ForceVLA2 [15], MoDE-VLA [14], TaF-VLA [9], Tabero [17], FWBC-VLA [25] |
| Post-training, curriculum | adapt a pretrained VLA in stages | LIFT [22], CRAFT [11] |
| Distillation | a teacher that has force trains a student that does not | FD-VLA [10], HapticVLA [16], ForceDelta-VLA [29], TaF-VLA [9] |
| Reward weighting, RL | force defines what counts as good | HapticVLA [16], TORL-VLA [18], ForceRFT [30], MoDE-VLA [14] (hand skill) |
| Human in the loop | people correct contact failures | TER-DAgger [13], LIFT [22], TORL-VLA [18], ForceRFT [30] |
| Preference learning | rank better against worse actions | VTLA [1] (DPO) |
| World-model pretraining | learn to predict touch first | DexTacWAM [33], H-Tac / TTP [21] |

## 5. What is still missing

[[bars:%]] Reported by ForceVLA itself [2]=60.5; In ForceDelta-VLA [29]=54.4; In TORL-VLA [18] (15/30 full task)=50; In FWBC-VLA [25] (whiteboard)=24; In FWBC-VLA [25] (door)=12 || The same baseline, ForceVLA, as measured in five places on different tasks and robots. These numbers cannot be compared with each other.

| Gap | Why it matters |
|---|---|
| Shared benchmarks | almost every paper builds its own tasks; Tabero [17] is the only simulated force benchmark here |
| Metrics beyond success | a task can succeed while crushing the object; only some papers report force (Tabero grip force, ForceDelta-VLA −26% peak force) |
| Sensor diversity | a method tuned to one sensor may not transfer; TaF-VLA's [9] cross-sensor test is a start |

## 6. How to choose

[[fig:survey-force-choose]] Start at the top left and follow the answers. This chart is a reading aid built from the surveyed papers, not a controlled comparison.

| Situation | Choice | Examples |
|---|---|---|
| Wrist F/T available, want a quick gain | fuse **after the VLM** with a protected path | ForceVLA [2], TORL-VLA [18] |
| The task is about *how hard* | output a **force target** or **stiffness** | ForceVLA2 [15], Tabero [17], CompVLA [31] |
| Contact changes fast | add a **fast residual or controller** | ForceDelta-VLA [29], TER-DAgger [13], LIFT [22] |
| No sensor on the deployed robot | **distil** from a sensorised teacher, or estimate from torque | FD-VLA [10], HapticVLA [16], FWBC-VLA [25] |
| The same contact keeps failing | collect **human corrections** and refine online | TORL-VLA [18], ForceRFT [30], TER-DAgger [13] |

**Check question:** with $K = 500$ N/m, $\delta = 4$ mm, $F^* = 10$ N, what are $\Delta x$ and $e_F$ for a pose-only policy?

<details markdown="1">
<summary>Answer</summary>

$\Delta x = 10/500 = 20$ mm and $e_F = 500 \times 0.004 = 2$ N (20% of the target).
</details>

## References

Same numbering as [Survey 1](survey-force-map.html). Titles are as listed on arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 3 / 3 · [Survey 1: lực đi vào đâu](survey-force-map.html) · [Survey 2: cảm biến](survey-force-sensing.html)

**VẤN ĐỀ** Nếu chính sách chỉ xuất ra một pose đích, thì lực robot tác dụng không do chính sách chọn. Nó phụ thuộc vào độ cứng của bộ điều khiển và vào việc chính sách đoán sai vị trí bề mặt bao nhiêu.

**BỐN KIỂU ĐẦU RA** chỉ pose · pose + lực mục tiêu · pose + độ cứng · hành động nền + residual nhanh.

**BẢY CÁCH HỌC** imitation · hậu huấn luyện hoặc giáo trình · chưng cất · phần thưởng hoặc RL · có người trong vòng lặp · học theo sở thích · tiền huấn luyện bằng world model.

**KHOẢNG TRỐNG LỚN** Chưa có benchmark chung. Cùng một baseline (ForceVLA) đạt từ 12% đến 60,5% tùy paper nào chạy nó. Số trong ngoặc vuông là số tài liệu tham khảo của [Survey 1](survey-force-map.html).
</div>

## 1. Bốn giao diện đầu ra

Hãy nghĩ đến chuyện bảo ai đó đẩy cánh cửa. Bạn có thể nói *đặt tay ở đâu* (pose), *đặt tay ở đâu và đẩy mạnh bao nhiêu* (pose + lực), *đặt tay ở đâu và giữ cánh tay cứng hay mềm thế nào* (pose + độ cứng), hoặc *cứ làm theo kế hoạch, nhưng liên tục tự chỉnh theo cảm giác trên tay* (nền + residual).

[[fig:survey-force-output]] Bốn cách để một chính sách có nhận biết lực nói chuyện với robot.

| Giao diện | Chính sách xuất ra | Ai quyết định lực | Ví dụ |
|---|---|---|---|
| (a) Chỉ pose | một pose đích | độ cứng bộ điều khiển × sai lệch hình học | ForceVLA [2], FD-VLA [10], TaF-VLA [9], LIFT [22], FM-VLA [23], HapticVLA [16] |
| (b) Pose + lực mục tiêu | pose và $F^*$ | bộ điều khiển lai hoặc admittance dùng lực đo được | ForceVLA2 [15], Tabero [17], Tactile-VLA [3], Opt2VLA [32], CR-VLA-Force [27] |
| (c) Pose + độ cứng | pose và $K(t)$ | chính sách quyết định nên mềm đến đâu | CompVLA [31], CompliantVLA-adaptor [8] |
| (d) Nền + residual | hành động nền cộng một bản hiệu chỉnh nhỏ, nhanh | phần residual, giữa hai lần cập nhật nền | ForceDelta-VLA [29], ForceRFT [30], TER-DAgger [13], VLA-Touch [4], MoDE-VLA [14], TacPAC [26] |

## 2. Tự tính tay: một chiếc lò xo, ba giao diện

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Coi tiếp xúc như một lò xo, rồi so sai số lực của các giao diện (a), (c) và (b) khi chính sách đoán sai vị trí bề mặt. Đó chính là sự đánh đổi mà mỗi giao diện chọn.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F^*$ | lực mà tác vụ cần | input | 10 N |
| $\delta$ | sai số khi ước lượng vị trí bề mặt | input | 5 mm |
| $K$ | độ cứng bộ điều khiển | input | 1000 hoặc 200 N/m |
| $\Delta x$ | độ sâu được ra lệnh ấn vào bề mặt | trung gian | – |
| $e_F$ | sai số lực | output | – |
| $d$ | độ trôi ngoài không gian tự do khi bị nhiễu 2 N | output | – |

**Công thức**

$$\Delta x = \frac{F^*}{K}, \qquad e_F = K\,\delta, \qquad d = \frac{2\ \text{N}}{K}$$

**Từng bước**

1. (a) Cứng, $K = 1000$: $\Delta x = 10$ mm, $e_F = 1000 \times 0{,}005 = 5$ N (50% của 10 N), $d = 2$ mm.
2. (c) Mềm, $K = 200$: $\Delta x = 50$ mm, $e_F = 200 \times 0{,}005 = 1$ N (10%), $d = 10$ mm.
3. (b) Lực mục tiêu: bộ điều khiển đo $F$ rồi chỉnh đến khi đọc được 10 N, nên $e_F \approx 0$ (chỉ còn nhiễu cảm biến). Cái giá là cần đo lực khi chạy thật.

**Kết quả.** Cứng: chuyển động chính xác, lực tệ. Mềm: lực tốt, chuyển động lỏng lẻo. Lực mục tiêu: lực tốt nhưng cần cảm biến.

**Ý nghĩa.** Đây là lý do độ cứng nên thay đổi theo thời gian (cứng khi di chuyển, mềm khi chạm), và vì sao xuất lực mục tiêu hấp dẫn khi đã có cảm biến.
</div>

[[bars:N]] (a) Cứng K=1000=5; (c) Mềm K=200=1; *(b) Lực mục tiêu=0* || Sai số lực (N) khi ước lượng bề mặt lệch 5 mm. Càng nhỏ càng tốt.

[[bars:mm]] (a) Cứng K=1000=2; *(c) Mềm K=200=10* || Độ trôi (mm) trong không gian tự do khi bị nhiễu 2 N. Đây là cái giá của việc mềm.

## 3. Khoảng cách tốc độ

| Hệ thống | Phần chậm | Phần nhanh |
|---|---|---|
| [TER-DAgger](ter-dagger.html) [13] | chính sách nền 1 Hz | residual + bộ phát hiện 50 Hz, trở kháng 1 kHz |
| [FWBC-VLA](fwbc-vla.html) [25] | VLA 15 Hz | bộ ước lượng lực 200 Hz |
| [VLA-Touch](vla-touch.html) [4] | đoạn hành động 64 bước của VLA | hành động đã tinh chỉnh tối đa 8 Hz |
| DAM-VLA [19] | backbone đã tiền huấn luyện | đầu hành động 100 Hz đọc các bộ đệm ẩn |

Cảm biến trong các paper này báo cáo ở 30-300 Hz, trong khi VLA lập lại kế hoạch vài lần mỗi giây. Mọi thiết kế "ngoài VLA" ở [Survey 1](survey-force-map.html) đều là một cách để lấp khoảng cách này.

## 4. Bảy cách học từ lực

| Cách học | Ý tưởng | Ví dụ |
|---|---|---|
| Tinh chỉnh bằng imitation | thêm lực làm đầu vào, tinh chỉnh trên demo | ForceVLA [2], ForceVLA2 [15], MoDE-VLA [14], TaF-VLA [9], Tabero [17], FWBC-VLA [25] |
| Hậu huấn luyện, giáo trình | thích nghi một VLA đã huấn luyện theo từng giai đoạn | LIFT [22], CRAFT [11] |
| Chưng cất | một "thầy" có lực dạy một "trò" không có | FD-VLA [10], HapticVLA [16], ForceDelta-VLA [29], TaF-VLA [9] |
| Trọng số theo thưởng, RL | lực định nghĩa thế nào là tốt | HapticVLA [16], TORL-VLA [18], ForceRFT [30], MoDE-VLA [14] (kỹ năng bàn tay) |
| Có người trong vòng lặp | con người sửa các lần hỏng khi tiếp xúc | TER-DAgger [13], LIFT [22], TORL-VLA [18], ForceRFT [30] |
| Học theo sở thích | xếp hạng hành động tốt hơn và kém hơn | VTLA [1] (DPO) |
| Tiền huấn luyện bằng world model | học dự đoán xúc giác trước | DexTacWAM [33], H-Tac / TTP [21] |

## 5. Còn thiếu gì

[[bars:%]] ForceVLA tự báo cáo [2]=60.5; Trong ForceDelta-VLA [29]=54.4; Trong TORL-VLA [18] (15/30 cả tác vụ)=50; Trong FWBC-VLA [25] (bảng trắng)=24; Trong FWBC-VLA [25] (cửa)=12 || Cùng một baseline, ForceVLA, được đo ở năm nơi với tác vụ và robot khác nhau. Các con số này không thể so với nhau.

| Khoảng trống | Vì sao quan trọng |
|---|---|
| Benchmark chung | hầu như paper nào cũng tự dựng tác vụ; Tabero [17] là benchmark lực mô phỏng duy nhất ở đây |
| Thước đo ngoài tỉ lệ thành công | tác vụ có thể "thành công" mà vẫn bóp nát vật; chỉ một số paper báo cáo lực (lực kẹp của Tabero, ForceDelta-VLA giảm 26% lực đỉnh) |
| Đa dạng cảm biến | phương pháp chỉnh cho một cảm biến có thể không chuyển sang loại khác; thử nghiệm đa cảm biến của TaF-VLA [9] là bước đầu |

## 6. Cách chọn

[[fig:survey-force-choose]] Bắt đầu từ góc trên bên trái rồi đi theo các câu trả lời. Sơ đồ này chỉ là công cụ giúp đọc, dựng từ các paper đã khảo sát, không phải một so sánh có kiểm soát.

| Tình huống | Lựa chọn | Ví dụ |
|---|---|---|
| Có F/T cổ tay, muốn cải thiện nhanh | trộn **sau VLM** bằng một đường được bảo vệ | ForceVLA [2], TORL-VLA [18] |
| Tác vụ xoay quanh việc *mạnh đến đâu* | xuất **lực mục tiêu** hoặc **độ cứng** | ForceVLA2 [15], Tabero [17], CompVLA [31] |
| Tiếp xúc đổi nhanh | thêm **residual hoặc bộ điều khiển nhanh** | ForceDelta-VLA [29], TER-DAgger [13], LIFT [22] |
| Robot triển khai không có cảm biến | **chưng cất** từ thầy có cảm biến, hoặc ước lượng từ mô-men | FD-VLA [10], HapticVLA [16], FWBC-VLA [25] |
| Cùng một tiếp xúc cứ hỏng | thu **sửa lỗi từ con người** rồi tinh chỉnh online | TORL-VLA [18], ForceRFT [30], TER-DAgger [13] |

**Câu hỏi kiểm tra:** với $K = 500$ N/m, $\delta = 4$ mm, $F^* = 10$ N, một chính sách chỉ xuất pose có $\Delta x$ và $e_F$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\Delta x = 10/500 = 20$ mm và $e_F = 500 \times 0{,}004 = 2$ N (20% lực mục tiêu).
</details>

## Tài liệu tham khảo

Số thứ tự giống [Survey 1](survey-force-map.html). Tiêu đề giữ nguyên như trên arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.
:::
