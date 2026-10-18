---
slug: mode-vla
date: 2026-10-18
title_en: "MoDE-VLA: Mixture-of-Dexterous-Experts for Force and Touch"
title_vi: "MoDE-VLA: Mixture-of-Dexterous-Experts cho lực và xúc giác"
excerpt_en: "MoDE-VLA adds force and tactile signals to π0 through a separate path with modality-aware routing and residual injection, so contact corrections do not overwrite pretrained knowledge."
excerpt_vi: "MoDE-VLA thêm tín hiệu lực và xúc giác vào π0 qua một đường riêng với routing theo modality và tiêm residual, để hiệu chỉnh tiếp xúc không ghi đè tri thức đã pretrain."
tags: [VLA, Force, Tactile, Paper Notes, MoE, π0]
---

:::en
Paper: [arXiv 2603.08122](https://arxiv.org/abs/2603.08122), *Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA* (the abstract names the architecture MoDE-VLA).

## The pain it cures

A dual-arm humanoid with two 22-DoF dexterous hands has force at the arms and touch at ten fingertips. Mixing those signals straight into a pretrained VLA risks erasing what it learned. The paper has two parts: a **data** side (teleoperation with force and tactile feedback, plus an RL hand skill called IMCopilot) and a **model** side (MoDE-VLA). This note covers the model.

## Architecture

[[fig:mode-vla]] MoDE-VLA on a π0 backbone: force and tactile tokens go through a sparse MoE, produce residual corrections for arm and hand velocity, and an RL skill can take over the hand.

1. **π0 backbone (left of the figure).** Three RGB views (224×224) go through a SigLIP So400m/14 encoder (256 tokens per view); with language and proprioception they form the PaliGemma (Gemma-3B) prefix. Noisy actions with a timestep form the suffix handled by a Gemma-300M action expert. Prefix and suffix share key-value pairs across layers.
2. **Force and tactile paths.** Force $f \in \mathbb{R}^{14}$ (joint torques, 7 joints × 2 arms) and tactile $g \in \mathbb{R}^{60}$ (6-DoF wrench × 5 fingers × 2 hands) each get a learned linear projection into the model width, then are replicated $H$ times with step encodings so that each timestep can be routed separately.
3. **Concatenate, then MoE.** $[Z_{prefix} \Vert Z_{suffix} \Vert \tilde Z_f \Vert \tilde Z_g]$ passes a self-attention layer and a token-level MoE (8 experts, top-1 routing). The routing is motivated by contact regimes (reaching, first contact, stable grasp, in-hand rotation).
4. **Residual injection.** The velocity is $v_\theta = [W_1(Z_f + Z_{suffix}) \Vert W_2(Z_g + Z_{suffix})]$: the **force** path corrects **arm** actions, the **tactile** path corrects **hand** actions.
5. **Sampling.** Flow matching with 10 Euler steps, action horizon $H=50$.
6. **IMCopilot.** The VLA also outputs a trigger $c \in [0,1]$. If $c > 0.5$, a PPO-trained policy (IsaacLab, teacher–student distillation) takes over the hand for in-hand rotation.

## Training

- Backbone initialised from the pretrained π0 checkpoint; the MoDE module and projections start from scratch.
- 60,000 steps, AdamW, cosine learning-rate decay, colour-jitter augmentation.
- Loss: flow matching $\lVert v_\theta(x_t,t) - (\epsilon - x_0)\rVert^2$ with $t \sim \text{Beta}(1.5, 1)$.

## Results and caveats

The abstract claims "doubled success rate improvement over the baseline" on dexterous contact-rich tasks (Gear Assembling, Charger Plugging, Apple Peeling, Tube Rearranging), with π0 as the baseline. Per-task numbers come from a part of the paper I could not read verbatim, so I do not quote them. Also note that the body says π0 while the Fig. 3 caption says "OpenPI-0", and the control frequency is not stated.
:::

:::vi
Bài báo: [arXiv 2603.08122](https://arxiv.org/abs/2603.08122), *Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA* (abstract gọi kiến trúc này là MoDE-VLA).

## Vấn đề cần chữa

Robot humanoid hai tay với hai bàn tay 22 bậc tự do có lực ở cánh tay và xúc giác ở mười đầu ngón. Trộn thẳng các tín hiệu đó vào một VLA đã pretrain dễ xóa mất những gì nó đã học. Bài có hai phần: phần **dữ liệu** (teleoperation có phản hồi lực/xúc giác, cộng một kỹ năng bàn tay học bằng RL tên IMCopilot) và phần **mô hình** (MoDE-VLA). Ghi chú này nói về mô hình.

## Kiến trúc

[[fig:mode-vla]] MoDE-VLA trên nền π0: token lực và xúc giác đi qua MoE thưa, tạo hiệu chỉnh residual cho vận tốc tay-cánh, và một kỹ năng RL có thể chiếm quyền điều khiển bàn tay.

1. **Backbone π0 (bên trái hình).** Ba góc nhìn RGB (224×224) qua encoder SigLIP So400m/14 (256 token mỗi góc); cùng ngôn ngữ và proprioception tạo prefix của PaliGemma (Gemma-3B). Action nhiễu kèm timestep là suffix do action expert Gemma-300M xử lý. Prefix và suffix dùng chung cặp key-value ở mọi lớp.
2. **Hai đường lực và xúc giác.** Lực $f \in \mathbb{R}^{14}$ (mô men khớp, 7 khớp × 2 tay) và xúc giác $g \in \mathbb{R}^{60}$ (wrench 6 bậc × 5 ngón × 2 bàn tay) mỗi cái qua một lớp linear học được vào chiều của mô hình, rồi nhân bản $H$ lần kèm mã hóa bước, để mỗi timestep có thể được định tuyến riêng.
3. **Nối rồi MoE.** $[Z_{prefix} \Vert Z_{suffix} \Vert \tilde Z_f \Vert \tilde Z_g]$ qua một lớp self-attention và MoE mức token (8 expert, top-1). Việc định tuyến được lý giải bằng các chế độ tiếp xúc (với tới, chạm đầu tiên, nắm ổn định, xoay trong tay).
4. **Tiêm residual.** Vận tốc là $v_\theta = [W_1(Z_f + Z_{suffix}) \Vert W_2(Z_g + Z_{suffix})]$: đường **lực** hiệu chỉnh hành động **cánh tay**, đường **xúc giác** hiệu chỉnh hành động **bàn tay**.
5. **Lấy mẫu.** Flow matching với 10 bước Euler, horizon hành động $H=50$.
6. **IMCopilot.** VLA còn xuất tín hiệu kích hoạt $c \in [0,1]$. Nếu $c > 0{,}5$, một chính sách học bằng PPO (IsaacLab, chưng cất teacher–student) tiếp quản bàn tay để xoay vật trong tay.

## Huấn luyện

- Backbone khởi tạo từ checkpoint π0 đã pretrain; module MoDE và các lớp chiếu khởi tạo từ đầu.
- 60.000 bước, AdamW, giảm learning rate kiểu cosine, augmentation đổi màu.
- Loss: flow matching $\lVert v_\theta(x_t,t) - (\epsilon - x_0)\rVert^2$ với $t \sim \text{Beta}(1.5, 1)$.

## Kết quả và lưu ý

Abstract nêu "tỉ lệ thành công tăng gấp đôi so với baseline" trên các task khéo léo giàu tiếp xúc (lắp bánh răng, cắm sạc, gọt táo, sắp xếp ống), baseline là π0. Số liệu từng task nằm ở phần bài tôi không đọc được nguyên văn nên không trích. Cũng lưu ý phần thân bài ghi π0 còn chú thích Fig. 3 ghi "OpenPI-0", và tần số điều khiển không được nêu.
:::
