---
slug: hapticvla
date: 2026-10-18
title_en: "HapticVLA: Tactile-aware Manipulation Without Tactile Sensing at Inference"
title_vi: "HapticVLA: Thao tác nhận biết xúc giác mà không cần cảm biến lúc suy luận"
excerpt_en: "HapticVLA trains a teacher SmolVLA with a safety-aware tactile reward, then distils it into a student that sees only vision and state. A 0.45B model with no tactile hardware at run time."
excerpt_vi: "HapticVLA huấn luyện một SmolVLA teacher với phần thưởng xúc giác có nhận biết an toàn, rồi chưng cất sang student chỉ thấy thị giác và state. Mô hình 0,45B không cần phần cứng xúc giác lúc chạy."
tags: [VLA, Tactile, Distillation, Paper Notes, SmolVLA]
---

:::en
Paper: [arXiv 2603.15257](https://arxiv.org/abs/2603.15257) (March 2026), Skoltech; project page linked from the abstract.

## The pain it cures

Pick a jar, a waffle and an egg with the same gripper. The jar tolerates force; the waffle and the egg do not. Success must mean "object intact", not just "object moved". HapticVLA gets there with **two stages**: first learn gentleness using tactile data, then make the policy independent of the tactile sensor.

## Try the naive way first

Two obvious options:

1. **Give the VLA the tactile signal at inference.** The abstract reports that HapticVLA beats baseline VLAs "including versions provided with direct tactile feedback during inference". Having the sensor is not the same as knowing what force is safe.
2. **Plain imitation on all demonstrations.** The dataset deliberately contains 20–30 faulty episodes per task in which the object was damaged. Plain behaviour cloning copies those as faithfully as the good ones.

HapticVLA's answer is to **weight** each demonstration by how safe its contact was, then remove the sensor.

## Work it by hand: reward weights in one batch

Four samples have advantages $A = (-4,\ 0,\ 2,\ 6)$ (already clipped to $[-6, 6]$). With $\alpha = 0.25$, $w_{raw} = e^{\alpha A}$:

$$w_{raw} = (e^{-1},\ e^{0},\ e^{0.5},\ e^{1.5}) = (0.368,\ 1.000,\ 1.649,\ 4.482)$$

Clip to $[0.25,\ 4]$: $(0.368,\ 1.000,\ 1.649,\ 4.000)$. Divide by the batch mean $1.754$:

$$w = (0.210,\ 0.570,\ 0.940,\ 2.281)$$

The safest sample counts about 11 times as much as the riskiest in the flow-matching loss, and the clip stops one sample from taking over the batch.

**The distillation target.** For one action dimension, the ground truth is $a^{GT} = 0.020$ and the teacher says $\hat a^T = 0.012$. With the blend weight $\alpha = 0.5$ (the paper reuses the letter $\alpha$ for a different quantity here), the student's target is $0.5 \times 0.020 + 0.5 \times 0.012 = 0.016$. The student is pulled towards the teacher's gentler action without losing the demonstration.

## Architecture

[[fig:hapticvla]] Stage 1 trains a teacher with a tactile reward as an extra condition; stage 2 distils the teacher's action targets into a student that never sees tactile data.

**Stage 1: the teacher (SA-RWFM).**

- **Offline tactile reward.** From the two 10×10 tactile maps (100 taxels per finger) the method computes per-step statistics: mean force, peak pressure, how concentrated the pressure is, centre of pressure and slip. A per-step reward $r_t$ sums squared penalties for over-force, under-force while holding, peak pressure, concentration and asymmetry plus a slip term. An episode reward adds success and subtracts drop, damage and risk.
- **Reward-weighted flow matching (RWFM).** The SmolVLA action expert is trained with a flow-matching loss in which each sample is weighted by $w = \exp(\alpha A)$, with advantage $A$ built from the episode and chunk-level rewards ($\alpha = 0.25$, weights clipped to $[0.25, 4]$). An anchor term keeps parameters near the pretrained model. Faulty demonstrations (the object was damaged) are kept and receive negative rewards.

**Stage 2: tactile distillation.**

- The teacher generates action targets $\hat a^T$ offline for $N = 51{,}251$ samples.
- The student is a standard SmolVLA with the teacher's weights except the tactile encoder; its state projection shrinks from $134 \to 6$ inputs.
- Training target: $\tilde a = (1-\alpha)\,a^{GT} + \alpha\,\hat a^T$ with $\alpha = 0.5$, trained by flow matching.

## Hardware and data

Two LeRobot SO-101 arms (one with a tactile parallel gripper; 100 taxels per electrode, 120 Hz), a RealSense D435, wrist cameras, and a Jetson Orin NX. 310 real episodes over three tasks (70 good plus 20 faulty per single-arm task, 100 plus 30 for the bimanual one), plus 1,000 Isaac Sim episodes.

## Results

20 trials per task (Jar, Waffles, Egg): HapticVLA reaches **86.7%** mean (75%, 90%, 95%), the teacher-style SmolVLA with the SA-RWFM expert alone **75%**, and X-VLA and VLA-0 score 0%. On the egg task it is a 45-point improvement over the base model. Asynchronous chunking sometimes lowers success because of added latency.

## Caveats

The abstract says the student predicts a "compact tactile token", but the loss in the paper is only the action-level flow-matching distillation. No token size or token loss is given, so the figure marks that box as unspecified. Optimiser, learning rate, batch size, steps and control rate are not stated.
**Carry forward:** all the arms so far stand on a fixed base. On a wheeled-legged robot, pushing a door also pushes the body, and there may be no force sensor at all. See [FWBC-VLA](fwbc-vla.html).

**Check question:** a batch has only two samples, $A = (-6,\ 6)$, $\alpha = 0.25$. What are the final weights? And what is the blended target if $a^{GT} = 0.030$ and $\hat a^T = 0.010$?

*Answer:* $w_{raw} = (e^{-1.5},\ e^{1.5}) = (0.223,\ 4.482)$, clipped to $(0.25,\ 4.0)$, mean $2.125$, so $w = (0.118,\ 1.882)$. Target $= 0.5 \times 0.030 + 0.5 \times 0.010 = 0.020$.
:::

:::vi
Bài báo: [arXiv 2603.15257](https://arxiv.org/abs/2603.15257) (tháng 3/2026), Skoltech; trang dự án có link trong abstract.

## Vấn đề cần chữa

Nhặt một hũ, một cái bánh waffle và một quả trứng bằng cùng một kẹp. Hũ chịu được lực; waffle và trứng thì không. Thành công phải nghĩa là "vật còn nguyên vẹn", không chỉ "vật đã di chuyển". HapticVLA làm được qua **hai giai đoạn**: học sự nhẹ nhàng bằng dữ liệu xúc giác trước, rồi làm chính sách không còn phụ thuộc cảm biến xúc giác.

## Thử cách ngây thơ trước

Hai lựa chọn hiển nhiên:

1. **Cho VLA tín hiệu xúc giác lúc suy luận.** Abstract nêu HapticVLA thắng các VLA baseline, "kể cả những bản được cho phản hồi xúc giác trực tiếp lúc suy luận". Có cảm biến không đồng nghĩa với biết lực nào là an toàn.
2. **Bắt chước thuần trên mọi demo.** Bộ dữ liệu cố ý chứa 20–30 episode lỗi mỗi task, trong đó vật bị hỏng. Behavior cloning thuần sẽ chép các episode đó trung thành y như episode tốt.

Lời giải của HapticVLA là **gán trọng số** cho mỗi demo theo mức an toàn của tiếp xúc, rồi bỏ cảm biến.

## Tính tay: trọng số phần thưởng trong một batch

Bốn mẫu có advantage $A = (-4,\ 0,\ 2,\ 6)$ (đã cắt trong $[-6, 6]$). Với $\alpha = 0.25$, $w_{raw} = e^{\alpha A}$:

$$w_{raw} = (e^{-1},\ e^{0},\ e^{0.5},\ e^{1.5}) = (0.368,\ 1.000,\ 1.649,\ 4.482)$$

Cắt trong $[0.25,\ 4]$: $(0.368,\ 1.000,\ 1.649,\ 4.000)$. Chia cho trung bình batch $1.754$:

$$w = (0.210,\ 0.570,\ 0.940,\ 2.281)$$

Mẫu an toàn nhất có trọng lượng gấp khoảng 11 lần mẫu rủi ro nhất trong loss flow-matching, và việc cắt ngăn một mẫu chiếm hết batch.

**Mục tiêu chưng cất.** Với một chiều hành động, giá trị thật là $a^{GT} = 0.020$ và teacher nói $\hat a^T = 0.012$. Với trọng số trộn $\alpha = 0.5$ (bài dùng lại chữ $\alpha$ cho một đại lượng khác ở đây), mục tiêu của student là $0.5 \times 0.020 + 0.5 \times 0.012 = 0.016$. Student bị kéo về hành động nhẹ nhàng hơn của teacher mà không đánh mất demo.

## Kiến trúc

[[fig:hapticvla]] Giai đoạn 1 huấn luyện teacher với phần thưởng xúc giác làm điều kiện phụ; giai đoạn 2 chưng cất mục tiêu hành động của teacher sang student không bao giờ thấy dữ liệu xúc giác.

**Giai đoạn 1: teacher (SA-RWFM).**

- **Phần thưởng xúc giác offline.** Từ hai bản đồ xúc giác 10×10 (100 taxel mỗi ngón), phương pháp tính thống kê từng bước: lực trung bình, áp suất đỉnh, mức tập trung áp suất, tâm áp suất và trượt. Phần thưởng mỗi bước $r_t$ cộng các phạt bình phương cho lực quá lớn, lực quá nhỏ khi đang giữ, áp suất đỉnh, độ tập trung, mất đối xứng, cộng một số hạng trượt. Phần thưởng cả episode cộng thành công và trừ rơi, hỏng, rủi ro.
- **Flow matching có trọng số theo phần thưởng (RWFM).** Action expert của SmolVLA được huấn luyện bằng loss flow-matching trong đó mỗi mẫu có trọng số $w = \exp(\alpha A)$, với advantage $A$ xây từ phần thưởng mức episode và mức chunk ($\alpha = 0{,}25$, trọng số bị cắt trong $[0{,}25, 4]$). Một số hạng neo giữ tham số gần mô hình pretrain. Demo lỗi (vật bị hỏng) được giữ lại và nhận phần thưởng âm.

**Giai đoạn 2: chưng cất xúc giác.**

- Teacher sinh mục tiêu hành động $\hat a^T$ offline cho $N = 51{.}251$ mẫu.
- Student là SmolVLA chuẩn với trọng số của teacher trừ bộ mã hóa xúc giác; phép chiếu state thu từ 134 xuống 6 đầu vào.
- Mục tiêu huấn luyện: $\tilde a = (1-\alpha)\,a^{GT} + \alpha\,\hat a^T$ với $\alpha = 0{,}5$, huấn luyện bằng flow matching.

## Phần cứng và dữ liệu

Hai tay LeRobot SO-101 (một tay có kẹp song song xúc giác; 100 taxel mỗi điện cực, 120 Hz), RealSense D435, camera cổ tay và Jetson Orin NX. 310 episode thật trên ba task (70 tốt cộng 20 lỗi cho mỗi task một tay, 100 cộng 30 cho task hai tay), thêm 1.000 episode trong Isaac Sim.

## Kết quả

20 lượt mỗi task (Jar, Waffles, Egg): HapticVLA đạt **86,7%** trung bình (75%, 90%, 95%), SmolVLA chỉ có expert SA-RWFM đạt **75%**, X-VLA và VLA-0 đạt 0%. Ở task trứng, mô hình hơn mô hình gốc 45 điểm. Chunking bất đồng bộ đôi khi làm giảm thành công vì thêm độ trễ.

## Lưu ý

Abstract nói student dự đoán một "token xúc giác gọn", nhưng loss trong bài chỉ là chưng cất flow-matching ở mức hành động. Không có kích thước token hay loss riêng cho token, nên hình đánh dấu ô đó là chưa được đặc tả. Optimizer, learning rate, batch size, số bước và tần số điều khiển không được nêu.

**Mang theo sang bài sau:** mọi cánh tay tới đây đều đứng trên đế cố định. Trên robot bánh-chân, đẩy cửa cũng là đẩy cả thân, và có thể không có cảm biến lực nào. Xem [FWBC-VLA](fwbc-vla.html).

**Câu kiểm tra:** batch chỉ có hai mẫu, $A = (-6,\ 6)$, $\alpha = 0.25$. Trọng số cuối là bao nhiêu? Và mục tiêu trộn là bao nhiêu nếu $a^{GT} = 0.030$ và $\hat a^T = 0.010$?

*Đáp án:* $w_{raw} = (e^{-1.5},\ e^{1.5}) = (0.223,\ 4.482)$, cắt thành $(0.25,\ 4.0)$, trung bình $2.125$, nên $w = (0.118,\ 1.882)$. Mục tiêu $= 0.5 \times 0.030 + 0.5 \times 0.010 = 0.020$.
:::
