---
slug: taf-vla
date: 2026-10-18
title_en: "TaF-VLA: Aligning Tactile Images with Force Before the VLA"
title_vi: "TaF-VLA: Căn chỉnh ảnh xúc giác với lực trước khi vào VLA"
excerpt_en: "A vision-based tactile image shows deformation, not force. TaF-VLA first aligns tactile sequences with real force/pressure signals by contrastive learning, then plugs the frozen adapter into π0.5."
excerpt_vi: "Ảnh xúc giác thị giác cho thấy biến dạng chứ không phải lực. TaF-VLA trước hết căn chỉnh chuỗi xúc giác với tín hiệu lực/áp suất thật bằng học tương phản, rồi gắn adapter đã đóng băng vào π0.5."
tags: [VLA, Force, Tactile, Paper Notes, π0.5]
---

:::en
Paper: [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) (January 2026).

## The pain it cures

Earlier tactile VLAs treat a vision-based tactile sensor (VBTS) image as one more picture. But the image shows how the gel **deforms**, not how hard it is pressed. TaF-VLA's idea: teach a tactile encoder to predict **force-like latents** first, using a large dataset that pairs tactile images with a real 6-axis F/T sensor and a pressure array, then feed the resulting tokens to the policy.

## Architecture

[[fig:taf-vla]] Stage (a) aligns a tactile encoder with a quantised force code by InfoNCE; stage (b) plugs the frozen adapter into the π0.5 action expert.

**(a) Tactile–force alignment (self-supervised).**

- **Force side.** Over a window of $N=5$ steps, a pressure map $F' \in \mathbb{R}^{12\times12}$ and a wrench $F'' \in \mathbb{R}^6$ each pass an MLP, then are quantised against two learnable codebooks (VQ-VAE style). The concatenated nearest codes form $c^*$. Decoders reconstruct the signals to prevent codebook collapse.
- **Tactile side.** Each tactile frame goes through a ViT; a learnable summary token and a causal Transformer give the holistic embedding $z^*$.
- **Loss.** $L = L_{NCE} + \lambda_1 L_{quant} + \lambda_2 L_{recon}$, with InfoNCE pulling $z^*$ towards its paired $c^*$.

**(b) Policy integration.** The backbone is π0.5, a flow-matching policy. A vision-language encoder turns the global and wrist images and the instruction into conditioning $\phi_t$. The frozen TaF-Adapter provides force-aligned tactile tokens $z^{tac}_t$. The action expert is conditioned on $(\phi_t, z^{tac}_t, q_t)$ and integrates the flow with step $\delta = 0.1$.

## Data

The TaF-Dataset has over 10 million synchronised tactile frames, 6-axis F/T and 12×12 pressure maps, collected by an automated device with more than 60 indenters (40 rigid, 20 deformable) at 30 Hz. Policy data: over 10,000 force-aware episodes across more than 20 scenarios.

## Results

Success rate, 15 rollouts per task, averaged over tasks:

| Method | Avg success |
|---|---|
| ACT | 26.7% |
| Diffusion Policy | 29.5% |
| π0.5 (vision only) | 37.1% |
| FreeTacMan | 42.8% |
| TaF-VLA | **64.8%** |

The adapter also helps other backbones: ACT 26.7% to 47.6%, Diffusion Policy 29.5% to 44.7%. On the alignment ablation (three tasks), removing history (N=1) or sharing one codebook between modalities cut success sharply (for example whiteboard 60.0% to 26.7% and 13.3%).

## Caveats

The paper is inconsistent about the task count (eight in the text, seven columns in Table I) and the number of baselines. The token position inside π0.5's sequence, the policy control rate and the action chunk length are not stated. The text says the adapter is frozen but also mentions task-specific fine-tuning; it is not reconciled.
:::

:::vi
Bài báo: [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) (tháng 1/2026).

## Vấn đề cần chữa

Các VLA xúc giác trước đây coi ảnh từ cảm biến xúc giác thị giác (VBTS) như thêm một bức ảnh. Nhưng ảnh chỉ cho thấy gel **biến dạng** ra sao, không cho biết ấn mạnh đến đâu. Ý tưởng của TaF-VLA: dạy bộ mã hóa xúc giác dự đoán **latent giống lực** trước, dùng một bộ dữ liệu lớn ghép ảnh xúc giác với cảm biến F/T 6 trục thật và ma trận áp suất, rồi mới đưa các token đó cho chính sách.

## Kiến trúc

[[fig:taf-vla]] Giai đoạn (a) căn chỉnh bộ mã hóa xúc giác với mã lực đã lượng tử hóa bằng InfoNCE; giai đoạn (b) gắn adapter đã đóng băng vào action expert của π0.5.

**(a) Căn chỉnh xúc giác–lực (tự giám sát).**

- **Phía lực.** Trong cửa sổ $N=5$ bước, bản đồ áp suất $F' \in \mathbb{R}^{12\times12}$ và wrench $F'' \in \mathbb{R}^6$ mỗi cái qua một MLP, rồi được lượng tử hóa theo hai codebook học được (kiểu VQ-VAE). Các mã gần nhất ghép lại thành $c^*$. Decoder tái tạo tín hiệu để tránh sụp codebook.
- **Phía xúc giác.** Mỗi khung xúc giác qua một ViT; token tóm tắt học được cùng một Transformer nhân quả cho ra embedding tổng thể $z^*$.
- **Loss.** $L = L_{NCE} + \lambda_1 L_{quant} + \lambda_2 L_{recon}$, trong đó InfoNCE kéo $z^*$ về $c^*$ cùng cặp.

**(b) Tích hợp chính sách.** Backbone là π0.5, chính sách flow-matching. Một encoder thị giác-ngôn ngữ biến ảnh toàn cảnh, ảnh cổ tay và câu lệnh thành điều kiện $\phi_t$. TaF-Adapter đã đóng băng cung cấp token xúc giác đã căn với lực $z^{tac}_t$. Action expert nhận điều kiện $(\phi_t, z^{tac}_t, q_t)$ và tích phân dòng với bước $\delta = 0{,}1$.

## Dữ liệu

TaF-Dataset có hơn 10 triệu khung xúc giác đồng bộ, F/T 6 trục và bản đồ áp suất 12×12, thu bằng thiết bị tự động với hơn 60 vật ấn (40 cứng, 20 biến dạng) ở 30 Hz. Dữ liệu chính sách: hơn 10.000 episode có nhận biết lực trên hơn 20 kịch bản.

## Kết quả

Tỉ lệ thành công, 15 lượt mỗi task, trung bình theo task:

| Phương pháp | Thành công TB |
|---|---|
| ACT | 26,7% |
| Diffusion Policy | 29,5% |
| π0.5 (chỉ thị giác) | 37,1% |
| FreeTacMan | 42,8% |
| TaF-VLA | **64,8%** |

Adapter cũng giúp các backbone khác: ACT từ 26,7% lên 47,6%, Diffusion Policy từ 29,5% lên 44,7%. Trong ablation căn chỉnh (ba task), bỏ lịch sử (N=1) hoặc dùng chung một codebook cho hai modality làm tụt mạnh (ví dụ whiteboard từ 60,0% xuống 26,7% và 13,3%).

## Lưu ý

Bài không nhất quán về số task (tám trong văn bản, bảy cột ở Bảng I) và số baseline. Vị trí token trong chuỗi của π0.5, tần số điều khiển và độ dài action chunk không được nêu. Văn bản nói adapter bị đóng băng nhưng cũng nhắc đến fine-tune theo task; hai điều này không được dung hòa.
:::
