---
slug: survey-force-map
date: 2026-10-18
title_en: "Survey 1: Where Does Force Enter a VLA?"
title_vi: "Survey 1: Lực đi vào VLA ở đâu?"
excerpt_en: "A map of 33 force, torque and tactile VLA methods (2025–2026), sorted by the one design choice they all have to make: at which point of the pipeline the contact signal comes in."
excerpt_vi: "Bản đồ 33 phương pháp VLA dùng lực, mô men và xúc giác (2025–2026), xếp theo lựa chọn thiết kế mà phương pháp nào cũng phải đưa ra: tín hiệu tiếp xúc đi vào pipeline ở điểm nào."
tags: [VLA, Force, Tactile, Survey]
---

:::en
This is the first of three survey notes. [Survey 2](survey-force-sensing.html) covers sensors and representations; [Survey 3](survey-force-output.html) covers outputs and learning.

## The pain

A camera sees where the plug is, not how hard it is pressing. Contact force is hidden at exactly the moments that decide a contact-rich task: the plug catches on the socket rim, the hand covers the egg, the sponge is already flat on the board. A VLA trained on images and language must guess force from geometry, and the guesses fail when friction, stiffness or a millimetre of misalignment change.

## The naive fix, and why it is not enough

Append the force reading to the robot state and fine-tune. [ForceVLA](forcevla.html) measured this: π0-base improved from 37.3% to 40.2%, while π0-fast fell from 31.0% to 14.2%.

## Work it by hand: one token in a crowd

Why does a single force token get ignored? Count the tokens a π0-style VLM sees: 3 camera views × 256 patch tokens = 768, plus about 20 language tokens, plus 1 force token: 789 tokens in all.

If a query spreads its attention evenly, the force token receives

$$\frac{1}{789} \approx 0.0013$$

of it. For the force token to take half of the attention, its logit must beat each other token's logit by $\Delta$ with

$$\frac{e^{\Delta}}{e^{\Delta} + 788} = 0.5 \;\Rightarrow\; e^{\Delta} = 788 \;\Rightarrow\; \Delta = \ln 788 \approx 6.7$$

A gap of 6.7 logits has to be learned from a few hundred demonstrations, and only on the steps where contact happens. That is why most methods below give force a **dedicated path**: a fusion module, an adapter, a bypass, or a separate controller.

## The map: six places force can enter

[[fig:survey-force-map]] Six entry points for force, torque or touch in a VLA pipeline, with the methods that use each one. Many methods use two. DAM-VLA (*) handles an unnamed high-frequency modality.

1. **① VLM input.** Force becomes a token or **text** next to the image and the instruction. This reuses the VLM's reasoning, but the signal passes through a model pretrained without it.
2. **② After the VLM.** A fusion module (often a **mixture of experts**) mixes force with the finished vision-language features. This is the most common choice for force/torque.
3. **③ Inside the action expert.** Force conditions the action decoder directly: extra tokens, adapters in several layers, cross-attention, or a grafted reactive expert.
4. **④ Outside the VLA.** The VLA stays as it is. A controller, refiner or small residual policy uses force to change the executed action, at a higher rate than the VLA.
5. **⑤ Training only.** Force shapes the weights (as a teacher, a reward or a curriculum) and is absent at run time.
6. **⑥ Predicted.** The model forecasts future touch, torque or force, either as an auxiliary target or inside a world model.

## The full table

"Read" says how deeply I read the paper: **full** = a detailed note on this site; **abstract** = classified from the arXiv abstract only, so entry points and outputs may be incomplete. n/s = not stated in what I read. Numbers in the entry column refer to the map above.

| Method | Year | Signal | Enters at | Output | Learning | Read |
|---|---|---|---|---|---|---|
| [ForceVLA](forcevla.html) | 2025 | wrist F/T | ② | pose | imitation, π0 | full |
| [VLA-Touch](vla-touch.html) | 2025 | GelSight | ① planner text, ④ refiner | refined chunk | refiner only, RDT | full |
| [ForceVLA2](forcevla2.html) | 2026 | wrist F/T, force prompt | ① ② | pose + force | imitation, π0 | full |
| [MoDE-VLA](mode-vla.html) | 2026 | joint torque, fingertip tactile | ② | arm/hand residual | imitation + RL hand skill, π0 | full |
| [TaF-VLA](taf-vla.html) | 2026 | vision tactile aligned to F/T | ③ ⑤ | actions | contrastive pretraining, π0.5 | full |
| [Tabero](tabero.html) | 2026 | simulated tactile + fingertip force | ① ④ | pose + grip/applied force | LoRA imitation, π0 | full |
| [FD-VLA](fd-vla.html) | 2026 | F/T (training only) | ① ⑤ | actions | distillation, SmolVLA | full |
| [HapticVLA](hapticvla.html) | 2026 | taxel arrays (training only) | ⑤ | actions | reward-weighted + distillation, SmolVLA | full |
| [FWBC-VLA](fwbc-vla.html) | 2026 | sensorless, from joint torque | ③ ④ | actions + base residual | imitation, π0.5 | full |
| [TORL-VLA](torl-vla.html) | 2026 | piezo pads → wrench | ② ⑥ | actions + future wrench | imitation + online RL, π0.5 | full |
| [TER-DAgger](ter-dagger.html) | 2026 | wrench from joint torque | ④ ⑥ | base + residual | DAgger, ACT (not a VLA) | full |
| [VTLA](https://arxiv.org/abs/2505.09577) | 2025 | tactile | ① | actions | preference learning (DPO) | abstract |
| [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 2025 | tactile | ① ④ | to hybrid position-force control | few demonstrations | abstract |
| [VLH](https://arxiv.org/abs/2508.01361) | 2025 | none (haptics is an output to a human) | – | motion + haptic commands | LoRA, OpenVLA | abstract |
| [OmniVTLA](https://arxiv.org/abs/2508.08706) | 2025 | vision- and force-based tactile | ① | actions | semantic-aligned encoder | abstract |
| [TA-VLA](https://arxiv.org/abs/2509.07962) | 2025 | torque | ③ ⑥ | actions + torque | n/s | abstract |
| [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 2026 | F/T at the controller | ④ | stiffness + damping | VLM-guided | abstract |
| [CRAFT](https://arxiv.org/abs/2602.12532) | 2026 | force | ⑤ | actions | curriculum fine-tuning | abstract |
| [FAVLA](https://arxiv.org/abs/2602.23648) | 2026 | F/T | ③ | fast actions | fast–slow | abstract |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | 2026 | unnamed high-rate modality | ③ | 100 Hz actions | n/s | abstract |
| [UniTacVLA](https://arxiv.org/abs/2606.31723) | 2026 | tactile | ④ ⑥ | chunk + fast corrections | n/s | abstract |
| [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 2026 | tactile, human video | ⑤ ⑥ | actions + future touch | human pretraining | abstract |
| [LIFT](https://arxiv.org/abs/2607.14236) | 2026 | 6D end-effector force | ③ | actions | post-training + DAgger | abstract |
| [FM-VLA](https://arxiv.org/abs/2607.18231) | 2026 | force history | ③ | actions | VAE memory | abstract |
| [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 2026 | force, ultrasound probe | ② | probe motion | n/s | abstract |
| [TacPAC](https://arxiv.org/abs/2609.05266) | 2026 | tactile images | ④ ⑥ | corrected chunk | n/s | abstract |
| [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 2026 | F/T sequence | ② ④ | via compliance controller | multi-stage imitation | abstract |
| [DeCAL](https://arxiv.org/abs/2609.09119) | 2026 | tactile | ② ⑥ | actions | n/s | abstract |
| [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 2026 | force history | ④ | corrected actions | distillation | abstract |
| [CompVLA](https://arxiv.org/abs/2609.23614) | 2026 | none stated (RGB + language) | ④ | stiffness + virtual displacement | n/s | abstract |
| [ForceRFT](https://arxiv.org/abs/2609.22840) | 2026 | wrist wrench | ④ | pose residuals | residual RL, SmolVLA prior | abstract |
| [Opt2VLA](https://arxiv.org/abs/2609.23968) | 2026 | n/s | ④ | motion + force references | trajectory-optimisation data | abstract |
| [DexTacWAM](https://arxiv.org/abs/2609.24976) | 2026 | fingertip tactile | ⑥ | actions + predicted touch | video world model | abstract |

## Five patterns across the table

1. **"After the VLM" beats "before".** ForceVLA's ablation (0% for a MoE before the VLM, 80% after) and TA-VLA's abstract (adapters in the decoder beat the encoder) point the same way: let vision and language finish first.
2. **Protect the pretrained model.** Residual connections (MoDE-VLA), zero-initialised paths (TORL-VLA, LIFT) and gated cross-attention (DAM-VLA) all start from "add nothing", so the new signal cannot damage what the VLA already knows.
3. **Fast and slow.** Force changes in milliseconds, a VLA replans a few times per second. FAVLA, LIFT, ForceDelta-VLA, DAM-VLA, TacPAC and TER-DAgger all add a faster path next to the slow one.
4. **Remove the sensor.** FD-VLA and HapticVLA keep the sensor only for training; FWBC-VLA estimates force from joint torques. Sensors are expensive and fragile, so this direction is growing.
5. **Output more than a pose.** ForceVLA2, Tabero, Tactile-VLA and Opt2VLA output force targets; CompVLA and CompliantVLA-adaptor output stiffness. [Survey 3](survey-force-output.html) explains why.

## Further reading

Two broader surveys exist: *Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning* ([arXiv 2608.07558](https://arxiv.org/abs/2608.07558)), which proposes the TF-ART taxonomy, and *Tactile-based Multimodal Fusion in Embodied Intelligence* ([arXiv 2605.17336](https://arxiv.org/abs/2605.17336)), covering work up to early 2026. Both go beyond VLAs; this note stays with VLA-style policies.

## Caveats

Twenty-two rows are classified from abstracts only. Abstracts rarely state the backbone or the sensor type, so "n/s" means "I could not tell", not "they do not have one". The list is what I found by searching in October 2026, not an exhaustive census.

**Carry forward:** the map says *where* force enters. Before that comes a more basic choice: *what* is measured, and in what form it reaches the network. See [Survey 2](survey-force-sensing.html).

**Check question:** a VLM sees 3 × 256 image tokens, 30 language tokens and 1 force token. What share of attention does the force token get under uniform attention, and what logit advantage $\Delta$ gives it half?

*Answer:* $N = 768 + 30 + 1 = 799$, so $1/799 \approx 0.00125$. Half needs $e^{\Delta} = 798$, so $\Delta = \ln 798 \approx 6.7$.
:::

:::vi
Đây là bài đầu trong ba ghi chú survey. [Survey 2](survey-force-sensing.html) nói về cảm biến và biểu diễn; [Survey 3](survey-force-output.html) nói về đầu ra và cách học.

## Vấn đề

Camera thấy phích đang ở đâu, không thấy nó đang ấn mạnh đến đâu. Lực tiếp xúc bị che đúng vào lúc quyết định một task giàu tiếp xúc: phích vướng vào mép ổ, bàn tay che kín quả trứng, miếng bọt biển đã áp phẳng lên bảng. Một VLA học từ ảnh và ngôn ngữ phải đoán lực từ hình học, và đoán sai khi ma sát, độ cứng hay một milimét lệch thay đổi.

## Cách sửa ngây thơ, và vì sao chưa đủ

Nối số đo lực vào state của robot rồi fine-tune. [ForceVLA](forcevla.html) đã đo điều này: π0-base tăng từ 37,3% lên 40,2%, còn π0-fast tụt từ 31,0% xuống 14,2%.

## Tính tay: một token giữa đám đông

Vì sao một token lực bị bỏ qua? Đếm số token mà một VLM kiểu π0 nhìn thấy: 3 góc camera × 256 token patch = 768, cộng khoảng 20 token ngôn ngữ, cộng 1 token lực: tổng cộng 789 token.

Nếu một query rải attention đều, token lực nhận được

$$\frac{1}{789} \approx 0.0013$$

phần attention. Để token lực chiếm một nửa, logit của nó phải hơn logit của mỗi token khác một khoảng $\Delta$ với

$$\frac{e^{\Delta}}{e^{\Delta} + 788} = 0.5 \;\Rightarrow\; e^{\Delta} = 788 \;\Rightarrow\; \Delta = \ln 788 \approx 6.7$$

Khoảng cách 6,7 logit phải được học từ vài trăm demo, và chỉ ở những bước có tiếp xúc. Đó là lý do hầu hết các phương pháp dưới đây cho lực một **đường đi riêng**: một module gộp, một adapter, một bypass hoặc một bộ điều khiển riêng.

## Bản đồ: sáu chỗ lực có thể đi vào

[[fig:survey-force-map]] Sáu điểm vào cho lực, mô men hoặc xúc giác trong pipeline VLA, kèm các phương pháp dùng từng điểm. Nhiều phương pháp dùng hai điểm. DAM-VLA (*) xử lý một modality tần số cao không được nêu tên.

1. **① Đầu vào VLM.** Lực thành một token hoặc **văn bản** cạnh ảnh và câu lệnh. Cách này tận dụng khả năng suy luận của VLM, nhưng tín hiệu phải đi qua một mô hình được pretrain không có nó.
2. **② Sau VLM.** Một module gộp (thường là **mixture of experts**) trộn lực với đặc trưng thị giác-ngôn ngữ đã hoàn chỉnh. Đây là lựa chọn phổ biến nhất cho lực/mô men.
3. **③ Bên trong action expert.** Lực điều kiện trực tiếp bộ giải mã hành động: token thêm, adapter ở nhiều lớp, cross-attention, hoặc một expert phản xạ được ghép thêm.
4. **④ Bên ngoài VLA.** VLA giữ nguyên. Một bộ điều khiển, bộ tinh chỉnh hoặc chính sách residual nhỏ dùng lực để thay đổi hành động được thực thi, ở tần số cao hơn VLA.
5. **⑤ Chỉ lúc huấn luyện.** Lực định hình trọng số (làm teacher, phần thưởng hoặc giáo trình) và vắng mặt lúc chạy.
6. **⑥ Dự đoán.** Mô hình dự báo xúc giác, mô men hoặc lực tương lai, dưới dạng mục tiêu phụ hoặc bên trong một world model.

## Bảng đầy đủ

Cột "Đọc" cho biết tôi đọc bài sâu đến đâu: **full** = có ghi chú chi tiết trên trang này; **abstract** = phân loại chỉ từ abstract trên arXiv, nên điểm vào và đầu ra có thể chưa đủ. n/s = không được nêu trong phần tôi đọc. Các số ở cột "Vào ở" ứng với bản đồ trên.

| Phương pháp | Năm | Tín hiệu | Vào ở | Đầu ra | Cách học | Đọc |
|---|---|---|---|---|---|---|
| [ForceVLA](forcevla.html) | 2025 | F/T cổ tay | ② | pose | bắt chước, π0 | full |
| [VLA-Touch](vla-touch.html) | 2025 | GelSight | ① văn bản cho planner, ④ bộ tinh chỉnh | chunk đã tinh chỉnh | chỉ huấn luyện bộ tinh chỉnh, RDT | full |
| [ForceVLA2](forcevla2.html) | 2026 | F/T cổ tay, force prompt | ① ② | pose + lực | bắt chước, π0 | full |
| [MoDE-VLA](mode-vla.html) | 2026 | mô men khớp, xúc giác đầu ngón | ② | residual tay-cánh tay | bắt chước + kỹ năng RL, π0 | full |
| [TaF-VLA](taf-vla.html) | 2026 | xúc giác thị giác căn với F/T | ③ ⑤ | hành động | pretrain tương phản, π0.5 | full |
| [Tabero](tabero.html) | 2026 | xúc giác mô phỏng + lực đầu ngón | ① ④ | pose + lực kẹp/lực tác dụng | LoRA bắt chước, π0 | full |
| [FD-VLA](fd-vla.html) | 2026 | F/T (chỉ khi huấn luyện) | ① ⑤ | hành động | chưng cất, SmolVLA | full |
| [HapticVLA](hapticvla.html) | 2026 | mảng taxel (chỉ khi huấn luyện) | ⑤ | hành động | trọng số phần thưởng + chưng cất, SmolVLA | full |
| [FWBC-VLA](fwbc-vla.html) | 2026 | không cảm biến, từ mô men khớp | ③ ④ | hành động + residual thân | bắt chước, π0.5 | full |
| [TORL-VLA](torl-vla.html) | 2026 | miếng áp điện → wrench | ② ⑥ | hành động + wrench tương lai | bắt chước + RL online, π0.5 | full |
| [TER-DAgger](ter-dagger.html) | 2026 | wrench từ mô men khớp | ④ ⑥ | nền + residual | DAgger, ACT (không phải VLA) | full |
| [VTLA](https://arxiv.org/abs/2505.09577) | 2025 | xúc giác | ① | hành động | học theo sở thích (DPO) | abstract |
| [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 2025 | xúc giác | ① ④ | sang điều khiển lai vị trí-lực | ít demo | abstract |
| [VLH](https://arxiv.org/abs/2508.01361) | 2025 | không (haptic là đầu ra cho người) | – | chuyển động + lệnh haptic | LoRA, OpenVLA | abstract |
| [OmniVTLA](https://arxiv.org/abs/2508.08706) | 2025 | xúc giác thị giác và xúc giác lực | ① | hành động | encoder căn ngữ nghĩa | abstract |
| [TA-VLA](https://arxiv.org/abs/2509.07962) | 2025 | mô men | ③ ⑥ | hành động + mô men | n/s | abstract |
| [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 2026 | F/T ở bộ điều khiển | ④ | độ cứng + giảm chấn | VLM dẫn hướng | abstract |
| [CRAFT](https://arxiv.org/abs/2602.12532) | 2026 | lực | ⑤ | hành động | fine-tune theo giáo trình | abstract |
| [FAVLA](https://arxiv.org/abs/2602.23648) | 2026 | F/T | ③ | hành động nhanh | nhanh–chậm | abstract |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | 2026 | modality tần số cao không nêu tên | ③ | hành động 100 Hz | n/s | abstract |
| [UniTacVLA](https://arxiv.org/abs/2606.31723) | 2026 | xúc giác | ④ ⑥ | chunk + hiệu chỉnh nhanh | n/s | abstract |
| [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 2026 | xúc giác, video người | ⑤ ⑥ | hành động + xúc giác tương lai | pretrain từ người | abstract |
| [LIFT](https://arxiv.org/abs/2607.14236) | 2026 | lực end-effector 6D | ③ | hành động | post-training + DAgger | abstract |
| [FM-VLA](https://arxiv.org/abs/2607.18231) | 2026 | lịch sử lực | ③ | hành động | bộ nhớ VAE | abstract |
| [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 2026 | lực, đầu dò siêu âm | ② | chuyển động đầu dò | n/s | abstract |
| [TacPAC](https://arxiv.org/abs/2609.05266) | 2026 | ảnh xúc giác | ④ ⑥ | chunk đã hiệu chỉnh | n/s | abstract |
| [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 2026 | chuỗi F/T | ② ④ | qua bộ điều khiển compliance | bắt chước nhiều giai đoạn | abstract |
| [DeCAL](https://arxiv.org/abs/2609.09119) | 2026 | xúc giác | ② ⑥ | hành động | n/s | abstract |
| [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 2026 | lịch sử lực | ④ | hành động đã hiệu chỉnh | chưng cất | abstract |
| [CompVLA](https://arxiv.org/abs/2609.23614) | 2026 | không nêu (RGB + ngôn ngữ) | ④ | độ cứng + dịch chuyển ảo | n/s | abstract |
| [ForceRFT](https://arxiv.org/abs/2609.22840) | 2026 | wrench cổ tay | ④ | residual pose | RL residual, nền SmolVLA | abstract |
| [Opt2VLA](https://arxiv.org/abs/2609.23968) | 2026 | n/s | ④ | chuyển động + lực tham chiếu | dữ liệu tối ưu quỹ đạo | abstract |
| [DexTacWAM](https://arxiv.org/abs/2609.24976) | 2026 | xúc giác đầu ngón | ⑥ | hành động + xúc giác dự đoán | video world model | abstract |

## Năm khuôn mẫu xuyên suốt bảng

1. **"Sau VLM" thắng "trước VLM".** Ablation của ForceVLA (MoE trước VLM 0%, sau VLM 80%) và abstract của TA-VLA (adapter trong decoder tốt hơn trong encoder) cùng chỉ một hướng: để thị giác và ngôn ngữ xử lý xong trước.
2. **Bảo vệ mô hình đã pretrain.** Kết nối residual (MoDE-VLA), đường khởi tạo bằng 0 (TORL-VLA, LIFT) và cross-attention có gate (DAM-VLA) đều bắt đầu từ "không cộng gì", để tín hiệu mới không làm hỏng những gì VLA đã biết.
3. **Nhanh và chậm.** Lực đổi trong vài mili giây, còn VLA chỉ lập kế hoạch lại vài lần mỗi giây. FAVLA, LIFT, ForceDelta-VLA, DAM-VLA, TacPAC và TER-DAgger đều thêm một đường nhanh cạnh đường chậm.
4. **Bỏ cảm biến.** FD-VLA và HapticVLA chỉ giữ cảm biến lúc huấn luyện; FWBC-VLA ước lượng lực từ mô men khớp. Cảm biến đắt và dễ hỏng, nên hướng này đang lớn dần.
5. **Xuất nhiều hơn một pose.** ForceVLA2, Tabero, Tactile-VLA và Opt2VLA xuất lực mục tiêu; CompVLA và CompliantVLA-adaptor xuất độ cứng. [Survey 3](survey-force-output.html) giải thích vì sao.

## Đọc thêm

Có hai survey rộng hơn: *Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning* ([arXiv 2608.07558](https://arxiv.org/abs/2608.07558)), đề xuất phân loại TF-ART, và *Tactile-based Multimodal Fusion in Embodied Intelligence* ([arXiv 2605.17336](https://arxiv.org/abs/2605.17336)), bao quát tới đầu năm 2026. Cả hai vượt ra ngoài VLA; ghi chú này chỉ bàn các chính sách kiểu VLA.

## Lưu ý

Hai mươi hai dòng được phân loại chỉ từ abstract. Abstract hiếm khi nêu backbone hay loại cảm biến, nên "n/s" nghĩa là "tôi không xác định được", không phải "họ không có". Danh sách là những gì tôi tìm được vào tháng 10/2026, không phải thống kê đầy đủ.

**Mang theo sang bài sau:** bản đồ cho biết lực vào *ở đâu*. Trước đó còn một lựa chọn cơ bản hơn: đo *cái gì*, và nó tới mạng dưới dạng nào. Xem [Survey 2](survey-force-sensing.html).

**Câu kiểm tra:** VLM thấy 3 × 256 token ảnh, 30 token ngôn ngữ và 1 token lực. Với attention đều, token lực nhận bao nhiêu phần, và cần lợi thế logit $\Delta$ bao nhiêu để nó nhận một nửa?

*Đáp án:* $N = 768 + 30 + 1 = 799$, nên $1/799 \approx 0.00125$. Một nửa cần $e^{\Delta} = 798$, nên $\Delta = \ln 798 \approx 6.7$.
:::
