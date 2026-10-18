---
slug: fd-vla
date: 2026-10-18
title_en: "FD-VLA: Force Distilled from Vision and State"
title_vi: "FD-VLA: Chưng cất lực từ thị giác và state"
excerpt_en: "FD-VLA learns a force token from images and robot state, supervised by a real force encoder only at training time, so a force-aware VLA runs without any force sensor."
excerpt_vi: "FD-VLA học một token lực từ ảnh và state của robot, chỉ được giám sát bởi bộ mã hóa lực thật lúc huấn luyện, nhờ đó VLA nhận biết lực chạy được mà không cần cảm biến lực."
tags: [VLA, Force, Distillation, Paper Notes, SmolVLA]
---

:::en
Paper: [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) (February 2026), built on SmolVLA.

## The pain it cures

Force sensors are costly, fragile and often absent on deployed robots. Yet the earlier force VLAs in this series ([ForceVLA](forcevla.html), [ForceVLA2](forcevla2.html)) need them at run time. FD-VLA's idea: the force during contact is largely **predictable from what the robot sees and how its arm is posed**, so train a small module to predict a latent force token and throw the sensor away at inference.

## Architecture

[[fig:fd-vla]] The Force Distillation Module predicts a force token from vision and state; during training it is pulled towards the encoding of real force; at inference only the prediction branch runs.

1. **Backbone and projection.** Following SmolVLA, the perception backbone is SmolVLM-2 with a SigLIP vision encoder. A single-layer MLP projects vision $f^V$, language $f^L$ and state $f^S$ to the VLM width $D$.
2. **Force Distillation Module (FDM).** A learnable query token $p \in \mathbb{R}^{1\times D}$ attends over the context $C = [p, f^V, f^S]$ with single-query multi-head attention; the output is $f^{pF} = \text{FFN}(\text{LN}([Z_1..Z_H] W_O + p))$, a single force token. Because $p$ is in the keys and values, the residual path gives self-conditioning.
3. **Teacher branch (training only).** The raw force from the F/T sensor goes through a light MLP to $f^{aF}$. The distillation loss is $L_{dist} = \lVert f^{pF} - f^{aF}\rVert_2^2$.
4. **Injection.** The VLM input is $[f^V, f^L, f^S, f^{pF}]$. The VLM is **frozen**. A directional attention mask (adapted from SmolVLA) makes information flow one way: percept tokens (vision, language) only see each other; control tokens (state, force) see percept tokens and earlier control tokens.
5. **Action expert.** A transformer head with a conditional flow-matching decoder produces the chunk $A_t$. Total loss $L = L^\tau(\theta) + \lambda L_{dist}$.

## Results

Hardware: UR5e with a wrist and a main camera; force from the arm's internal sensor during data collection. Tasks: Clean Whiteboard, Press Emergency Button, Insert Plug; 50 teleoperated demos per task, 30 evaluation trials each.

FD-VLA reaches a **61.1%** mean success, against 23.3% for SmolVLA without force, 46.7% for π0 without force and 11.1% for DP3. Ablation on the same three tasks:

| Variant | Mean success |
|---|---|
| No FDM (MLP force encoding) | 38.9% |
| FDM with the ground-truth force latent as the query | 51.1% |
| FDM with a learnable query (proposed) | 61.1% |

## Caveats

The text's gains for baselines given raw force ("+15.6%", "+20.0%") are ambiguous (points or relative), and the π0 numbers do not obviously add up against FD-VLA's 61.1%. Hidden sizes, $\lambda$, the chunk length, control rate and training schedule are not stated. The paper says the model has about one tenth of π0's parameters.
:::

:::vi
Bài báo: [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) (tháng 2/2026), xây trên SmolVLA.

## Vấn đề cần chữa

Cảm biến lực đắt, dễ hỏng và thường không có trên robot triển khai. Vậy mà các VLA lực trước trong series này ([ForceVLA](forcevla.html), [ForceVLA2](forcevla2.html)) cần chúng lúc chạy. Ý tưởng FD-VLA: lực khi tiếp xúc phần lớn **đoán được từ những gì robot thấy và tư thế cánh tay**, nên huấn luyện một module nhỏ dự đoán token lực ẩn rồi bỏ cảm biến lúc suy luận.

## Kiến trúc

[[fig:fd-vla]] Force Distillation Module dự đoán token lực từ thị giác và state; lúc huấn luyện nó được kéo về phía mã hóa của lực thật; lúc suy luận chỉ chạy nhánh dự đoán.

1. **Backbone và phép chiếu.** Theo SmolVLA, backbone cảm nhận là SmolVLM-2 với encoder ảnh SigLIP. Một MLP một lớp chiếu thị giác $f^V$, ngôn ngữ $f^L$ và state $f^S$ về chiều $D$ của VLM.
2. **Force Distillation Module (FDM).** Một token truy vấn học được $p \in \mathbb{R}^{1\times D}$ chú ý trên ngữ cảnh $C = [p, f^V, f^S]$ bằng multi-head attention một query; đầu ra $f^{pF} = \text{FFN}(\text{LN}([Z_1..Z_H] W_O + p))$, một token lực duy nhất. Vì $p$ nằm trong cả key và value, đường residual cho phép tự điều kiện hóa.
3. **Nhánh teacher (chỉ lúc huấn luyện).** Lực thô từ cảm biến F/T qua một MLP nhẹ thành $f^{aF}$. Loss chưng cất là $L_{dist} = \lVert f^{pF} - f^{aF}\rVert_2^2$.
4. **Tiêm vào VLM.** Đầu vào VLM là $[f^V, f^L, f^S, f^{pF}]$. VLM bị **đóng băng**. Một mask attention có hướng (lấy từ SmolVLA) làm thông tin chảy một chiều: token cảm nhận (thị giác, ngôn ngữ) chỉ nhìn nhau; token điều khiển (state, lực) nhìn được token cảm nhận và token điều khiển trước đó.
5. **Action expert.** Đầu transformer với bộ giải mã conditional flow-matching tạo chunk $A_t$. Loss tổng $L = L^\tau(\theta) + \lambda L_{dist}$.

## Kết quả

Phần cứng: UR5e có camera cổ tay và camera chính; lực lấy từ cảm biến trong của cánh tay khi thu dữ liệu. Task: Clean Whiteboard, Press Emergency Button, Insert Plug; 50 demo teleoperation mỗi task, 30 lượt đánh giá mỗi task.

FD-VLA đạt **61,1%** thành công trung bình, so với 23,3% của SmolVLA không lực, 46,7% của π0 không lực và 11,1% của DP3. Ablation trên cùng ba task:

| Biến thể | Thành công TB |
|---|---|
| Không FDM (mã hóa lực bằng MLP) | 38,9% |
| FDM dùng latent lực thật làm query | 51,1% |
| FDM với query học được (đề xuất) | 61,1% |

## Lưu ý

Mức cải thiện bài nêu cho baseline có dùng lực thô ("+15,6%", "+20,0%") không rõ là điểm hay tương đối, và số của π0 không khớp rõ ràng với 61,1% của FD-VLA. Kích thước ẩn, $\lambda$, độ dài chunk, tần số điều khiển và lịch huấn luyện không được nêu. Bài cho biết mô hình có khoảng một phần mười số tham số của π0.
:::
