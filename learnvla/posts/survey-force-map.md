---
slug: survey-force-map
date: 2026-10-18
title_en: "Survey 1: Where Does Force Enter a VLA?"
title_vi: "Survey 1: Lực đi vào VLA ở đâu?"
excerpt_en: "A cheatsheet map of 33 force, torque and tactile VLA methods (2025–2026), sorted by the one design choice they all make: where in the pipeline the contact signal comes in."
excerpt_vi: "Bản đồ dạng cheatsheet của 33 phương pháp VLA dùng lực, mô men, xúc giác (2025–2026), xếp theo lựa chọn mà phương pháp nào cũng phải đưa ra: tín hiệu tiếp xúc đi vào pipeline ở đâu."
tags: [VLA, Force, Tactile, Survey]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 1 of 3 · [Survey 2: sensing](survey-force-sensing.html) · [Survey 3: outputs and learning](survey-force-output.html)

**PROBLEM THE FIELD ADDRESSES** VLAs such as π0, OpenVLA and RDT see images and words, not force. They fail exactly when contact decides the task: insertion, wiping, fragile grasps, occluded hands.

**WHY THE OBVIOUS FIX FAILS** Appending force to the robot state: +2.9 points for π0-base, −16.8 for π0-fast ([ForceVLA](forcevla.html)). One force token is lost among ~800 image and text tokens (worked below).

**THE MAP** Six places force can enter: VLM input, after the VLM, inside the action expert, outside the VLA, training only, or predicted.

**TAKEAWAY** Most recent methods give force a *dedicated, protected, fast* path, and more of them remove the sensor at run time.
</div>

## 1. Why a single force token gets ignored

[[flow]]
- Naive~force in the crowd | 768 image + 20 text tokens > !+ 1 force token! > VLM attention | gets ~0.1% of attention
+ Most methods | force > *Dedicated path~MoE, adapter, bypass, controller* > Action | force cannot be drowned out
[[/flow]] The pattern behind almost every design in this survey.

<div class="calc" markdown="1">
Calculation card

**What and why.** Estimate how much attention one force token gets among a π0-style VLM's tokens, and how large an advantage it would need. This explains why methods build separate paths for force.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $N$ | total tokens: 3 views × 256 + text + 1 force | input | $768 + 20 + 1 = 789$ |
| $\Delta$ | how much larger the force token's logit is than every other token's | unknown | – |
| $p_F$ | share of attention on the force token | output | – |

**Formula** (softmax with all other logits equal)

$$p_F = \frac{e^{\Delta}}{e^{\Delta} + (N - 1)}$$

**Steps**

1. Uniform attention ($\Delta = 0$): $p_F = 1/789 \approx 0.0013$.
2. For $p_F = 0.5$: $e^{\Delta} = N - 1 = 788$.
3. $\Delta = \ln 788 \approx 6.7$.

**Result.** The force token must beat every other token by about 6.7 logits to get half the attention.

**Why it matters.** Such a gap must be learned from a few hundred demonstrations and only on contact steps. A dedicated path avoids the competition altogether.
</div>

## 2. The map: six entry points

[[fig:survey-force-map]] Six entry points for force, torque or touch in a VLA pipeline, with the methods that use each one. DAM-VLA (*) handles an unnamed high-frequency modality.

| # | Entry point | What it means | Typical form |
|---|---|---|---|
| ① | VLM input | force as a token or as words next to the image | token, text, prompt |
| ② | After the VLM | fusion module on finished vision-language features | MoE, cross-attention |
| ③ | Inside the action expert | condition the action decoder directly | extra tokens, adapters, grafted expert |
| ④ | Outside the VLA | controller, refiner or residual changes the executed action | fast loop next to the VLA |
| ⑤ | Training only | force shapes the weights, absent at run time | teacher, reward, curriculum |
| ⑥ | Predicted | the model forecasts future force/touch | auxiliary target, world model |

[[bars:]] ① VLM input=7; ② After the VLM=7; ③ Action expert=7; *④ Outside the VLA=13*; ⑤ Training only=5; ⑥ Predicted=8 || Number of the 33 methods using each entry point (many use two).

## 3. Five patterns

| Pattern | Evidence | Methods |
|---|---|---|
| After the VLM beats before | MoE before VLM 0%, after 80% (ForceVLA); decoder adapters beat encoder (TA-VLA) | ForceVLA, TA-VLA |
| Protect the pretrained model | residuals, zero-initialised paths, gated cross-attention start from "add nothing" | MoDE-VLA, TORL-VLA, LIFT, DAM-VLA |
| Fast next to slow | force changes in ms, VLAs replan a few times per second | FAVLA, LIFT, ForceDelta-VLA, DAM-VLA, TacPAC, TER-DAgger |
| Remove the sensor | sensor only in training, or estimate from joint torques | FD-VLA, HapticVLA, FWBC-VLA |
| Output more than a pose | force targets or stiffness ([Survey 3](survey-force-output.html)) | ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CompVLA |

## 4. The full table

"Read": **full** = detailed note on this site; **abstract** = classified from the arXiv abstract only. n/s = not stated in what I read.

| Method | Date | Signal | Enters at | Output | Learning | Read |
|---|---|---|---|---|---|---|
| [ForceVLA](forcevla.html) | 05/2025 | wrist F/T | ② | pose | imitation, π0 | full |
| [VLA-Touch](vla-touch.html) | 07/2025 | GelSight | ① planner text, ④ refiner | refined chunk | refiner only, RDT | full |
| [ForceVLA2](forcevla2.html) | 03/2026 | wrist F/T, force prompt | ① ② | pose + force | imitation, π0 | full |
| [MoDE-VLA](mode-vla.html) | 03/2026 | joint torque, fingertip tactile | ② | arm/hand residual | imitation + RL hand skill, π0 | full |
| [TaF-VLA](taf-vla.html) | 01/2026 | vision tactile aligned to F/T | ③ ⑤ | actions | contrastive pretraining, π0.5 | full |
| [Tabero](tabero.html) | 05/2026 | simulated tactile + fingertip force | ① ④ | pose + grip/applied force | LoRA imitation, π0 | full |
| [FD-VLA](fd-vla.html) | 02/2026 | F/T (training only) | ① ⑤ | actions | distillation, SmolVLA | full |
| [HapticVLA](hapticvla.html) | 03/2026 | taxel arrays (training only) | ⑤ | actions | reward-weighted + distillation, SmolVLA | full |
| [FWBC-VLA](fwbc-vla.html) | 09/2026 | sensorless, from joint torque | ③ ④ | actions + base residual | imitation, π0.5 | full |
| [TORL-VLA](torl-vla.html) | 06/2026 | piezo pads → wrench | ② ⑥ | actions + future wrench | imitation + online RL, π0.5 | full |
| [TER-DAgger](ter-dagger.html) | 03/2026 | wrench from joint torque | ④ ⑥ | base + residual | DAgger, ACT (not a VLA) | full |
| [VTLA](https://arxiv.org/abs/2505.09577) | 05/2025 | tactile | ① | actions | preference learning (DPO) | abstract |
| [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 07/2025 | tactile | ① ④ | to hybrid position-force control | few demonstrations | abstract |
| [VLH](https://arxiv.org/abs/2508.01361) | 08/2025 | none (haptics is an output to a human) | – | motion + haptic commands | LoRA, OpenVLA | abstract |
| [OmniVTLA](https://arxiv.org/abs/2508.08706) | 08/2025 | vision- and force-based tactile | ① | actions | semantic-aligned encoder | abstract |
| [TA-VLA](https://arxiv.org/abs/2509.07962) | 09/2025 | torque | ③ ⑥ | actions + torque | n/s | abstract |
| [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 01/2026 | F/T at the controller | ④ | stiffness + damping | VLM-guided | abstract |
| [CRAFT](https://arxiv.org/abs/2602.12532) | 02/2026 | force | ⑤ | actions | curriculum fine-tuning | abstract |
| [FAVLA](https://arxiv.org/abs/2602.23648) | 02/2026 | F/T | ③ | fast actions | fast–slow | abstract |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | 06/2026 | unnamed high-rate modality | ③ | 100 Hz actions | n/s | abstract |
| [UniTacVLA](https://arxiv.org/abs/2606.31723) | 06/2026 | tactile | ④ ⑥ | chunk + fast corrections | n/s | abstract |
| [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 07/2026 | tactile, human video | ⑤ ⑥ | actions + future touch | human pretraining | abstract |
| [LIFT](https://arxiv.org/abs/2607.14236) | 07/2026 | 6D end-effector force | ③ | actions | post-training + DAgger | abstract |
| [FM-VLA](https://arxiv.org/abs/2607.18231) | 07/2026 | force history | ③ | actions | VAE memory | abstract |
| [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 08/2026 | force, ultrasound probe | ② | probe motion | n/s | abstract |
| [TacPAC](https://arxiv.org/abs/2609.05266) | 09/2026 | tactile images | ④ ⑥ | corrected chunk | n/s | abstract |
| [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 09/2026 | F/T sequence | ② ④ | via compliance controller | multi-stage imitation | abstract |
| [DeCAL](https://arxiv.org/abs/2609.09119) | 09/2026 | tactile | ② ⑥ | actions | n/s | abstract |
| [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 09/2026 | force history | ④ | corrected actions | distillation | abstract |
| [CompVLA](https://arxiv.org/abs/2609.23614) | 09/2026 | none stated (RGB + language) | ④ | stiffness + virtual displacement | n/s | abstract |
| [ForceRFT](https://arxiv.org/abs/2609.22840) | 09/2026 | wrist wrench | ④ | pose residuals | residual RL, SmolVLA prior | abstract |
| [Opt2VLA](https://arxiv.org/abs/2609.23968) | 09/2026 | n/s | ④ | motion + force references | trajectory-optimisation data | abstract |
| [DexTacWAM](https://arxiv.org/abs/2609.24976) | 09/2026 | fingertip tactile | ⑥ | actions + predicted touch | video world model | abstract |

## 5. Further reading and caveats

- Broader surveys: *Learning Physical Interaction* ([arXiv 2608.07558](https://arxiv.org/abs/2608.07558), TF-ART taxonomy) and *Tactile-based Multimodal Fusion in Embodied Intelligence* ([arXiv 2605.17336](https://arxiv.org/abs/2605.17336)).
- 22 rows come from abstracts only; "n/s" means I could not tell, not that it is absent. The list reflects a search in October 2026.

**Carry forward:** the map says *where* force enters. Before that: *what* is measured, and in what form it reaches the network. See [Survey 2](survey-force-sensing.html).

**Check question:** 3 × 256 image tokens, 30 text tokens, 1 force token. What is $p_F$ under uniform attention, and what $\Delta$ gives $p_F = 0.5$?

<details markdown="1">
<summary>Answer</summary>

$N = 799$: $p_F = 1/799 \approx 0.00125$. $e^{\Delta} = 798$, so $\Delta = \ln 798 \approx 6.7$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 1 / 3 · [Survey 2: cảm biến](survey-force-sensing.html) · [Survey 3: đầu ra và cách học](survey-force-output.html)

**VẤN ĐỀ CẢ NGÀNH GIẢI QUYẾT** Các VLA như π0, OpenVLA, RDT thấy ảnh và chữ, không thấy lực. Chúng hỏng đúng lúc tiếp xúc quyết định task: lắp ghép, lau chùi, nắm đồ dễ vỡ, tay bị che.

**VÌ SAO CÁCH SỬA HIỂN NHIÊN THẤT BẠI** Nối lực vào state của robot: π0-base +2,9 điểm, π0-fast −16,8 ([ForceVLA](forcevla.html)). Một token lực lạc giữa ~800 token ảnh và chữ (tính bên dưới).

**BẢN ĐỒ** Sáu chỗ lực có thể đi vào: đầu vào VLM, sau VLM, trong action expert, ngoài VLA, chỉ khi huấn luyện, hoặc được dự đoán.

**RÚT RA** Hầu hết phương pháp gần đây cho lực một đường *riêng, được bảo vệ, nhanh*, và ngày càng nhiều phương pháp bỏ cảm biến lúc chạy.
</div>

## 1. Vì sao một token lực bị bỏ qua

[[flow]]
- Ngây thơ~lực giữa đám đông | 768 token ảnh + 20 token chữ > !+ 1 token lực! > Attention của VLM | chỉ nhận ~0,1% attention
+ Hầu hết phương pháp | lực > *Đường riêng~MoE, adapter, bypass, bộ điều khiển* > Hành động | lực không bị nhấn chìm
[[/flow]] Khuôn mẫu đứng sau gần như mọi thiết kế trong survey này.

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Ước lượng một token lực nhận bao nhiêu attention giữa các token của một VLM kiểu π0, và nó cần lợi thế lớn cỡ nào. Điều này giải thích vì sao các phương pháp dựng đường riêng cho lực.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $N$ | tổng số token: 3 góc × 256 + chữ + 1 lực | input | $768 + 20 + 1 = 789$ |
| $\Delta$ | logit của token lực lớn hơn logit mỗi token khác bao nhiêu | ẩn số | – |
| $p_F$ | phần attention dành cho token lực | output | – |

**Công thức** (softmax, mọi logit khác bằng nhau)

$$p_F = \frac{e^{\Delta}}{e^{\Delta} + (N - 1)}$$

**Từng bước**

1. Attention đều ($\Delta = 0$): $p_F = 1/789 \approx 0.0013$.
2. Muốn $p_F = 0.5$: $e^{\Delta} = N - 1 = 788$.
3. $\Delta = \ln 788 \approx 6.7$.

**Kết quả.** Token lực phải hơn mỗi token khác khoảng 6,7 logit mới giành được một nửa attention.

**Ý nghĩa.** Khoảng cách đó phải học từ vài trăm demo và chỉ ở các bước có tiếp xúc. Một đường riêng tránh hẳn cuộc tranh giành này.
</div>

## 2. Bản đồ: sáu điểm vào

[[fig:survey-force-map]] Sáu điểm vào cho lực, mô men hoặc xúc giác trong pipeline VLA, kèm các phương pháp dùng từng điểm. DAM-VLA (*) xử lý một modality tần số cao không nêu tên.

| # | Điểm vào | Nghĩa là | Dạng thường gặp |
|---|---|---|---|
| ① | Đầu vào VLM | lực thành token hoặc chữ cạnh ảnh | token, văn bản, prompt |
| ② | Sau VLM | module gộp trên đặc trưng thị giác-ngôn ngữ đã xong | MoE, cross-attention |
| ③ | Trong action expert | điều kiện trực tiếp bộ giải mã hành động | token thêm, adapter, expert ghép |
| ④ | Ngoài VLA | bộ điều khiển, bộ tinh chỉnh hoặc residual đổi hành động được thực thi | vòng nhanh cạnh VLA |
| ⑤ | Chỉ khi huấn luyện | lực định hình trọng số, vắng mặt lúc chạy | teacher, phần thưởng, giáo trình |
| ⑥ | Dự đoán | mô hình dự báo lực/xúc giác tương lai | mục tiêu phụ, world model |

[[bars:]] ① Đầu vào VLM=7; ② Sau VLM=7; ③ Action expert=7; *④ Ngoài VLA=13*; ⑤ Chỉ huấn luyện=5; ⑥ Dự đoán=8 || Số phương pháp (trên 33) dùng mỗi điểm vào (nhiều phương pháp dùng hai).

## 3. Năm khuôn mẫu

| Khuôn mẫu | Bằng chứng | Phương pháp |
|---|---|---|
| Sau VLM thắng trước VLM | MoE trước VLM 0%, sau VLM 80% (ForceVLA); adapter trong decoder thắng encoder (TA-VLA) | ForceVLA, TA-VLA |
| Bảo vệ mô hình đã pretrain | residual, đường khởi tạo 0, cross-attention có gate đều bắt đầu từ "không cộng gì" | MoDE-VLA, TORL-VLA, LIFT, DAM-VLA |
| Nhanh cạnh chậm | lực đổi trong vài ms, VLA chỉ lập kế hoạch vài lần mỗi giây | FAVLA, LIFT, ForceDelta-VLA, DAM-VLA, TacPAC, TER-DAgger |
| Bỏ cảm biến | cảm biến chỉ khi huấn luyện, hoặc ước lượng từ mô men khớp | FD-VLA, HapticVLA, FWBC-VLA |
| Xuất nhiều hơn pose | lực mục tiêu hoặc độ cứng ([Survey 3](survey-force-output.html)) | ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CompVLA |

## 4. Bảng đầy đủ

"Đọc": **full** = có ghi chú chi tiết trên trang này; **abstract** = phân loại chỉ từ abstract trên arXiv. n/s = không nêu trong phần tôi đọc.

| Phương pháp | Ngày | Tín hiệu | Vào ở | Đầu ra | Cách học | Đọc |
|---|---|---|---|---|---|---|
| [ForceVLA](forcevla.html) | 05/2025 | F/T cổ tay | ② | pose | bắt chước, π0 | full |
| [VLA-Touch](vla-touch.html) | 07/2025 | GelSight | ① chữ cho planner, ④ bộ tinh chỉnh | chunk đã tinh chỉnh | chỉ bộ tinh chỉnh, RDT | full |
| [ForceVLA2](forcevla2.html) | 03/2026 | F/T cổ tay, force prompt | ① ② | pose + lực | bắt chước, π0 | full |
| [MoDE-VLA](mode-vla.html) | 03/2026 | mô men khớp, xúc giác đầu ngón | ② | residual tay | bắt chước + kỹ năng RL, π0 | full |
| [TaF-VLA](taf-vla.html) | 01/2026 | xúc giác thị giác căn với F/T | ③ ⑤ | hành động | pretrain tương phản, π0.5 | full |
| [Tabero](tabero.html) | 05/2026 | xúc giác mô phỏng + lực đầu ngón | ① ④ | pose + lực kẹp/tác dụng | LoRA bắt chước, π0 | full |
| [FD-VLA](fd-vla.html) | 02/2026 | F/T (chỉ khi huấn luyện) | ① ⑤ | hành động | chưng cất, SmolVLA | full |
| [HapticVLA](hapticvla.html) | 03/2026 | mảng taxel (chỉ khi huấn luyện) | ⑤ | hành động | trọng số phần thưởng + chưng cất, SmolVLA | full |
| [FWBC-VLA](fwbc-vla.html) | 09/2026 | không cảm biến, từ mô men khớp | ③ ④ | hành động + residual thân | bắt chước, π0.5 | full |
| [TORL-VLA](torl-vla.html) | 06/2026 | miếng áp điện → wrench | ② ⑥ | hành động + wrench tương lai | bắt chước + RL online, π0.5 | full |
| [TER-DAgger](ter-dagger.html) | 03/2026 | wrench từ mô men khớp | ④ ⑥ | nền + residual | DAgger, ACT (không phải VLA) | full |
| [VTLA](https://arxiv.org/abs/2505.09577) | 05/2025 | xúc giác | ① | hành động | học theo sở thích (DPO) | abstract |
| [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 07/2025 | xúc giác | ① ④ | sang điều khiển lai vị trí-lực | ít demo | abstract |
| [VLH](https://arxiv.org/abs/2508.01361) | 08/2025 | không (haptic là đầu ra cho người) | – | chuyển động + lệnh haptic | LoRA, OpenVLA | abstract |
| [OmniVTLA](https://arxiv.org/abs/2508.08706) | 08/2025 | xúc giác thị giác và lực | ① | hành động | encoder căn ngữ nghĩa | abstract |
| [TA-VLA](https://arxiv.org/abs/2509.07962) | 09/2025 | mô men | ③ ⑥ | hành động + mô men | n/s | abstract |
| [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 01/2026 | F/T ở bộ điều khiển | ④ | độ cứng + giảm chấn | VLM dẫn hướng | abstract |
| [CRAFT](https://arxiv.org/abs/2602.12532) | 02/2026 | lực | ⑤ | hành động | fine-tune theo giáo trình | abstract |
| [FAVLA](https://arxiv.org/abs/2602.23648) | 02/2026 | F/T | ③ | hành động nhanh | nhanh–chậm | abstract |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | 06/2026 | modality tần số cao không nêu tên | ③ | hành động 100 Hz | n/s | abstract |
| [UniTacVLA](https://arxiv.org/abs/2606.31723) | 06/2026 | xúc giác | ④ ⑥ | chunk + hiệu chỉnh nhanh | n/s | abstract |
| [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 07/2026 | xúc giác, video người | ⑤ ⑥ | hành động + xúc giác tương lai | pretrain từ người | abstract |
| [LIFT](https://arxiv.org/abs/2607.14236) | 07/2026 | lực end-effector 6D | ③ | hành động | post-training + DAgger | abstract |
| [FM-VLA](https://arxiv.org/abs/2607.18231) | 07/2026 | lịch sử lực | ③ | hành động | bộ nhớ VAE | abstract |
| [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 08/2026 | lực, đầu dò siêu âm | ② | chuyển động đầu dò | n/s | abstract |
| [TacPAC](https://arxiv.org/abs/2609.05266) | 09/2026 | ảnh xúc giác | ④ ⑥ | chunk đã hiệu chỉnh | n/s | abstract |
| [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 09/2026 | chuỗi F/T | ② ④ | qua bộ điều khiển compliance | bắt chước nhiều giai đoạn | abstract |
| [DeCAL](https://arxiv.org/abs/2609.09119) | 09/2026 | xúc giác | ② ⑥ | hành động | n/s | abstract |
| [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 09/2026 | lịch sử lực | ④ | hành động đã hiệu chỉnh | chưng cất | abstract |
| [CompVLA](https://arxiv.org/abs/2609.23614) | 09/2026 | không nêu (RGB + ngôn ngữ) | ④ | độ cứng + dịch chuyển ảo | n/s | abstract |
| [ForceRFT](https://arxiv.org/abs/2609.22840) | 09/2026 | wrench cổ tay | ④ | residual pose | RL residual, nền SmolVLA | abstract |
| [Opt2VLA](https://arxiv.org/abs/2609.23968) | 09/2026 | n/s | ④ | chuyển động + lực tham chiếu | dữ liệu tối ưu quỹ đạo | abstract |
| [DexTacWAM](https://arxiv.org/abs/2609.24976) | 09/2026 | xúc giác đầu ngón | ⑥ | hành động + xúc giác dự đoán | video world model | abstract |

## 5. Đọc thêm và lưu ý

- Survey rộng hơn: *Learning Physical Interaction* ([arXiv 2608.07558](https://arxiv.org/abs/2608.07558), phân loại TF-ART) và *Tactile-based Multimodal Fusion in Embodied Intelligence* ([arXiv 2605.17336](https://arxiv.org/abs/2605.17336)).
- 22 dòng chỉ dựa trên abstract; "n/s" nghĩa là tôi không xác định được, không phải là không có. Danh sách phản ánh lần tìm kiếm tháng 10/2026.

**Mang sang bài sau:** bản đồ cho biết lực vào *ở đâu*. Trước đó: đo *cái gì*, và nó tới mạng dưới dạng nào. Xem [Survey 2](survey-force-sensing.html).

**Câu kiểm tra:** 3 × 256 token ảnh, 30 token chữ, 1 token lực. $p_F$ khi attention đều là bao nhiêu, và $\Delta$ bao nhiêu thì $p_F = 0.5$?

<details markdown="1">
<summary>Đáp án</summary>

$N = 799$: $p_F = 1/799 \approx 0.00125$. $e^{\Delta} = 798$, nên $\Delta = \ln 798 \approx 6.7$.
</details>
:::
