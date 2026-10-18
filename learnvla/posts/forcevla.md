---
slug: forcevla
date: 2026-10-18
title_en: "ForceVLA: Force-aware MoE for Contact-rich Manipulation"
title_vi: "ForceVLA: MoE nhận biết lực cho thao tác giàu tiếp xúc"
excerpt_en: "ForceVLA treats 6-axis force as its own modality and fuses it into π0 after the VLM with a sparse mixture of experts (FVLMoE). Architecture, training and results."
excerpt_vi: "ForceVLA coi lực 6 trục là một modality riêng và gộp vào π0 sau VLM bằng mixture-of-experts thưa (FVLMoE). Kiến trúc, cách huấn luyện và kết quả."
tags: [VLA, Force, Paper Notes, MoE, π0]
---

:::en
Paper: [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) (NeurIPS 2025), built on π0.

## The pain it cures

Vision-language-action models are good at coarse motion but fail when the task is decided by contact: inserting a plug, wiping a board, peeling a cucumber. Naively concatenating force to the robot state barely helps. ForceVLA's claim is that force should be a **first-class modality** with its own token, and that it should be fused **after** the VLM has already processed vision and language.

## Architecture

[[fig:forcevla]] ForceVLA: the force token E_F joins the VLM output, passes an encoder and a 4-expert top-1 MoE (FVLMoE), and the result is added to the action expert's suffix before flow-matching decoding.

Read it left to right:

1. **VLM.** Base and wrist RGB plus the instruction go through a SigLIP-based PaliGemma VLM, giving $E_{VL}$.
2. **Force token.** The raw 6-axis force-torque reading $f \in \mathbb{R}^6$ goes through one linear layer to $\mathbb{R}^{2048}$, giving a single token $E_F$.
3. **Concatenate and encode.** $E_{in} = [E_{VL}; E_F]$ passes a Transformer encoder block ($D=2048$, 8 heads) with self-attention and an FFN.
4. **FVLMoE.** A sparse MoE with 4 expert MLPs and a top-1 router picks one expert per token; a residual connection adds the input back.
5. **Inject into the action expert.** A linear layer maps $2048 \to 1024$, the last $H_{action}$ tokens become $G$, and $G$ is added element-wise to $S_{suffix}$ (the processed robot state plus noisy action). A flow-matching head decodes the action chunk.

The ablation supports the "after the VLM" choice: fusing with a linear layer before the VLM scored 55%, a MoE before the VLM collapsed to 0%, concatenation after the VLM 60%, and full ForceVLA 80% (on the ablation task).

## Training and data

- Base: π0 with a conditional flow-matching action generator.
- ForceVLA-Data: 244 trajectories, about 140 thousand synchronized timesteps, five tasks (bottle pumping, plug insertion, USB insertion, whiteboard wiping, cucumber peeling), collected by VR teleoperation on a Flexiv Rizon arm.
- Optimiser: Adam ($\beta_1=0.9$, $\beta_2=0.95$), peak learning rate $2.5\times10^{-5}$ decaying to $2.5\times10^{-6}$ over 30,000 steps, bfloat16, gradient clipping 1.0.

## Results

On the five tasks ForceVLA averages **60.5%** success against **37.3%** for a π0-base baseline, a gain of 23.2 points. In the multi-task setting it reaches 67.5% average (plug insertion 100%).

## Caveats from reading the paper

- Control frequency and the numeric action-chunk length are not stated.
- The paper labels the 37.3% baseline inconsistently ("with force" in one sentence, "without" elsewhere), and the ablation baseline (45%) is on a different footing.
- Which parts are frozen during fine-tuning is not stated.
:::

:::vi
Bài báo: [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) (NeurIPS 2025), xây trên π0.

## Vấn đề cần chữa

Các mô hình VLA làm tốt chuyển động thô nhưng thất bại khi nhiệm vụ do tiếp xúc quyết định: cắm phích, lau bảng, gọt dưa chuột. Chỉ nối lực vào state của robot gần như không giúp được gì. Ý tưởng của ForceVLA: lực phải là một **modality hạng nhất** với token riêng, và phải được gộp **sau** khi VLM đã xử lý xong ảnh và ngôn ngữ.

## Kiến trúc

[[fig:forcevla]] ForceVLA: token lực E_F nhập vào đầu ra của VLM, đi qua một encoder và MoE 4 expert top-1 (FVLMoE), kết quả được cộng vào suffix của action expert trước khi giải mã flow-matching.

Đọc từ trái sang phải:

1. **VLM.** Ảnh RGB từ camera nền và camera cổ tay cùng câu lệnh đi qua VLM PaliGemma (dựa trên SigLIP), cho ra $E_{VL}$.
2. **Token lực.** Số đo lực-mô men 6 trục $f \in \mathbb{R}^6$ qua một lớp linear lên $\mathbb{R}^{2048}$, thành một token $E_F$.
3. **Nối và mã hóa.** $E_{in} = [E_{VL}; E_F]$ đi qua một block Transformer encoder ($D=2048$, 8 head) gồm self-attention và FFN.
4. **FVLMoE.** MoE thưa với 4 expert MLP và router top-1 chọn một expert cho mỗi token; kết nối residual cộng đầu vào trở lại.
5. **Tiêm vào action expert.** Một lớp linear $2048 \to 1024$, lấy $H_{action}$ token cuối làm $G$, rồi cộng từng phần tử vào $S_{suffix}$ (state đã xử lý cộng với action nhiễu). Đầu flow-matching giải mã ra chuỗi hành động.

Ablation ủng hộ lựa chọn "sau VLM": gộp bằng linear trước VLM đạt 55%, MoE trước VLM sụp xuống 0%, concat sau VLM 60%, ForceVLA đầy đủ 80% (trên task dùng cho ablation).

## Huấn luyện và dữ liệu

- Nền: π0 với bộ sinh hành động conditional flow matching.
- ForceVLA-Data: 244 quỹ đạo, khoảng 140 nghìn timestep đồng bộ, năm task (bơm chai, cắm phích, cắm USB, lau bảng, gọt dưa chuột), thu bằng teleoperation VR trên tay Flexiv Rizon.
- Optimizer: Adam ($\beta_1=0.9$, $\beta_2=0.95$), learning rate đỉnh $2.5\times10^{-5}$ giảm về $2.5\times10^{-6}$ trong 30.000 bước, bfloat16, clip gradient 1.0.

## Kết quả

Trên năm task, ForceVLA trung bình **60,5%** thành công so với **37,3%** của baseline π0-base, hơn 23,2 điểm. Ở cài đặt multi-task đạt trung bình 67,5% (cắm phích 100%).

## Lưu ý khi đọc bài

- Tần số điều khiển và độ dài action chunk (con số cụ thể) không được nêu.
- Bài gắn nhãn baseline 37,3% không nhất quán (chỗ ghi "có lực", chỗ ghi "không lực"), và baseline của ablation (45%) nằm trên một nền khác.
- Không nêu phần nào bị đóng băng khi fine-tune.
:::
