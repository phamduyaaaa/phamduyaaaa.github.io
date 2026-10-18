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

## Try the naive way first

Feed the tactile image to the policy as one more camera view. FreeTacMan, built on ACT, does essentially this. In TaF-VLA's tests it averaged 42.8%: better than vision-only π0.5 (37.1%), far below 64.8%. An image encoder learns what the gel looks like, not how hard it is pressed.

## Work it by hand

**Quantising a force feature.** Say the pressure MLP outputs $z' = (0.9,\ 0.1)$ and the codebook holds $(1,0)$, $(0,1)$, $(0.5,0.5)$. Squared distances:

$$(0.9-1)^2 + 0.1^2 = 0.02,\qquad 0.9^2 + 0.9^2 = 1.62,\qquad 0.4^2 + 0.4^2 = 0.32$$

The nearest code is $(1, 0)$, so the continuous feature snaps to that "physical anchor". Similar contacts land on the same code, which gives the contrastive step a stable target.

**One InfoNCE term.** A batch of two pairs. The tactile embedding $z_1$ has cosine similarity $0.9$ with its own force code $c_1$ and $0.2$ with the other one, $c_2$. With temperature $\tau = 0.1$ (an illustrative value; the paper does not give it):

$$L_1 = -\log\frac{e^{0.9/0.1}}{e^{0.9/0.1} + e^{0.2/0.1}} = -\log\frac{e^{9}}{e^{9} + e^{2}} = \log(1 + e^{-7}) \approx 0.0009$$

If instead the similarities were $0.5$ and $0.4$, the loss would be $\log(1 + e^{-1}) \approx 0.313$. The loss is small only when a tactile embedding is clearly closer to **its own** force code than to anyone else's.

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
**Carry forward:** TaF-VLA needed a custom rig and 10 million real frames. [Tabero](tabero.html) gets vision–touch–force data by replaying existing trajectories in a tactile simulator, and makes the word "gently" actually lower the force.

**Check question:** with $\tau = 0.1$, the positive pair has similarity $0.8$ and the only negative $0.6$. What is the InfoNCE loss?

*Answer:* $L = \log(1 + e^{(0.6-0.8)/0.1}) = \log(1 + e^{-2}) = \log(1.135) \approx 0.127$.
:::

:::vi
Bài báo: [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) (tháng 1/2026).

## Vấn đề cần chữa

Các VLA xúc giác trước đây coi ảnh từ cảm biến xúc giác thị giác (VBTS) như thêm một bức ảnh. Nhưng ảnh chỉ cho thấy gel **biến dạng** ra sao, không cho biết ấn mạnh đến đâu. Ý tưởng của TaF-VLA: dạy bộ mã hóa xúc giác dự đoán **latent giống lực** trước, dùng một bộ dữ liệu lớn ghép ảnh xúc giác với cảm biến F/T 6 trục thật và ma trận áp suất, rồi mới đưa các token đó cho chính sách.

## Thử cách ngây thơ trước

Đưa ảnh xúc giác cho chính sách như thêm một góc camera. FreeTacMan, xây trên ACT, về cơ bản làm vậy. Trong thử nghiệm của TaF-VLA nó đạt trung bình 42,8%: hơn π0.5 chỉ dùng thị giác (37,1%), nhưng kém xa 64,8%. Một encoder ảnh học được gel trông thế nào, chứ không học được nó bị ấn mạnh đến đâu.

## Tính tay

**Lượng tử hóa một đặc trưng lực.** Giả sử MLP áp suất cho ra $z' = (0.9,\ 0.1)$ và codebook có $(1,0)$, $(0,1)$, $(0.5,0.5)$. Bình phương khoảng cách:

$$(0.9-1)^2 + 0.1^2 = 0.02,\qquad 0.9^2 + 0.9^2 = 1.62,\qquad 0.4^2 + 0.4^2 = 0.32$$

Mã gần nhất là $(1, 0)$, nên đặc trưng liên tục bị "hút" về mỏ neo vật lý đó. Các tiếp xúc giống nhau rơi vào cùng một mã, cho bước tương phản một mục tiêu ổn định.

**Một số hạng InfoNCE.** Batch có hai cặp. Embedding xúc giác $z_1$ có cosine similarity $0.9$ với mã lực của chính nó $c_1$ và $0.2$ với mã còn lại $c_2$. Với nhiệt độ $\tau = 0.1$ (giá trị minh họa; bài không nêu):

$$L_1 = -\log\frac{e^{0.9/0.1}}{e^{0.9/0.1} + e^{0.2/0.1}} = -\log\frac{e^{9}}{e^{9} + e^{2}} = \log(1 + e^{-7}) \approx 0.0009$$

Nếu hai similarity là $0.5$ và $0.4$ thì loss là $\log(1 + e^{-1}) \approx 0.313$. Loss chỉ nhỏ khi embedding xúc giác gần mã lực **của chính nó** rõ rệt hơn mã của cặp khác.

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

**Mang theo sang bài sau:** TaF-VLA cần một thiết bị tự chế và 10 triệu khung hình thật. [Tabero](tabero.html) có dữ liệu thị giác–xúc giác–lực bằng cách phát lại quỹ đạo có sẵn trong mô phỏng xúc giác, và làm cho chữ "gently" thực sự giảm lực.

**Câu kiểm tra:** với $\tau = 0.1$, cặp dương có similarity $0.8$ và cặp âm duy nhất $0.6$. Loss InfoNCE bằng bao nhiêu?

*Đáp án:* $L = \log(1 + e^{(0.6-0.8)/0.1}) = \log(1 + e^{-2}) = \log(1.135) \approx 0.127$.
:::
