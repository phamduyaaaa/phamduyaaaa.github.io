---
slug: taf-vla
date: 2026-10-18
title_en: "TaF-VLA: Aligning Tactile Images with Force Before the VLA"
title_vi: "TaF-VLA: Căn chỉnh ảnh xúc giác với lực trước khi vào VLA"
excerpt_en: "Earlier visuo-tactile policies such as FreeTacMan read a gel image as texture. TaF-VLA first aligns tactile images with real force over 10 million paired frames, then plugs the frozen adapter into π0.5: 64.8% vs 42.8%."
excerpt_vi: "Các chính sách thị giác-xúc giác trước, như FreeTacMan, đọc ảnh gel như một kết cấu bề mặt. TaF-VLA trước hết căn ảnh xúc giác với lực thật trên 10 triệu cặp khung, rồi gắn adapter đóng băng vào π0.5: 64,8% so với 42,8%."
tags: [VLA, Force, Tactile, Paper Notes, π0.5]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) · 01/2026 · built on π0.5

**PROBLEM** A vision-based tactile sensor shows how the gel *deforms*, not how hard it is pressed. VLAs built on it remain "force-blind".

**WHAT FAILED BEFORE** Methods such as FreeTacMan treat tactile images "as auxiliary visual textures" (the paper's words), missing the link between deformation and force. FreeTacMan scores 42.8%.

**IDEA** Pretrain a TaF-Adapter that pulls each tactile-image sequence towards the matching real force (6-axis F/T + 12×12 pressure map) by contrastive learning, then feed its tokens, frozen, to π0.5's action expert.

**RESULT** 64.8% average success vs 37.1% for vision-only π0.5 and 42.8% for FreeTacMan.
</div>

## 1. The problem: tactile read as texture

[[flow]]
- Before~FreeTacMan | Tactile image > !Image encoder~learns texture! > Policy | knows how the gel looks, not how hard it is pressed: 42.8%
+ TaF-VLA | Tactile image > *TaF-Adapter~aligned to F/T + pressure* > π0.5 action expert | tokens carry force meaning: 64.8%
[[/flow]] The change is in what the tactile encoder is trained to agree with: real force instead of nothing.

## 2. Architecture

[[fig:taf-vla]] Stage (a) aligns a tactile encoder with quantised force codes by InfoNCE; stage (b) plugs the frozen adapter into the π0.5 action expert.

| Block | Input | Output | Role |
|---|---|---|---|
| Force encoder | window of 5: pressure map $F'$ (12×12), wrench $F''$ (6) | codes $c^*$ (two VQ codebooks) | stable "physical anchors" |
| Tactile encoder | window of 5 tactile images | $z^*$ (ViT + causal Transformer) | what the adapter outputs later |
| InfoNCE | pairs $(z^*, c^*)$ | loss | pull matching pairs together |
| π0.5 action expert | VLM features $\phi_t$, $z^{tac}_t$, proprio $q_t$ | action chunk | policy, Euler step 0.1 |

## 3. Work it by hand: one InfoNCE term

<div class="calc" markdown="1">
Calculation card

**What and why.** InfoNCE is the loss that teaches the tactile encoder to agree with real force. Computing it shows when it is small (well aligned) and when it is large.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $z^*_1$ | tactile embedding of sample 1 | input | – |
| $s_+$ | cosine similarity of $z^*_1$ with its own force code $c^*_1$ | input | 0.9 |
| $s_-$ | similarity with the other force code $c^*_2$ | input | 0.2 |
| $\tau$ | temperature | constant | 0.1 (illustrative; not given in the paper) |
| $L_1$ | loss for sample 1 | output | – |

**Formula** (batch of two pairs)

$$L_1 = -\log \frac{e^{s_+/\tau}}{e^{s_+/\tau} + e^{s_-/\tau}} = \log\left(1 + e^{(s_- - s_+)/\tau}\right)$$

**Steps**

1. $(s_- - s_+)/\tau = (0.2 - 0.9)/0.1 = -7$.
2. $e^{-7} \approx 0.00091$.
3. $L_1 = \log(1.00091) \approx 0.0009$.

Badly aligned case, $s_+ = 0.5$, $s_- = 0.4$: $(0.4 - 0.5)/0.1 = -1$, $L_1 = \log(1 + e^{-1}) = \log 1.368 \approx 0.313$.

**Result.** 0.0009 when the tactile embedding is clearly closer to its own force; 0.313 when it barely is.

**Why it matters.** The loss only goes to zero when each tactile sequence points to *its own* force reading, so the adapter's output becomes a force-like signal.
</div>

## 4. Results

[[bars:%]] ACT=26.7; Diffusion Policy=29.5; π0.5 (vision only)=37.1; FreeTacMan=42.8; *TaF-VLA=64.8* || Average success, 15 rollouts per task.

- The adapter helps other backbones too: ACT 26.7% → 47.6%, Diffusion Policy 29.5% → 44.7%.
- Ablation (whiteboard): full 60.0%, no history 26.7%, one shared codebook 13.3%.

## 5. Data

| Item | Value |
|---|---|
| TaF-Dataset | > 10 million synchronised tactile, 6-axis F/T and 12×12 pressure frames |
| Rig | automated press-and-perturb device, > 60 indenters, 30 Hz |
| Policy data | > 10,000 force-aware episodes, > 20 scenarios |

## 6. Caveats

- The task count (8 in text, 7 in Table I) and the number of baselines are inconsistent in the paper.
- The adapter is called frozen, yet the text also mentions task-specific fine-tuning.

**Carry forward:** TaF-VLA needed a custom rig and 10 million real frames. [Tabero](tabero.html) gets vision–touch–force data by replaying existing trajectories in a tactile simulator.

**Check question:** $\tau = 0.1$, $s_+ = 0.8$, $s_- = 0.6$. What is $L_1$?

<details markdown="1">
<summary>Answer</summary>

$(0.6 - 0.8)/0.1 = -2$; $L_1 = \log(1 + e^{-2}) = \log 1.135 \approx 0.127$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) · 01/2026 · nền π0.5

**VẤN ĐỀ** Cảm biến xúc giác thị giác cho thấy gel *biến dạng* ra sao, không cho biết bị ấn mạnh đến đâu. VLA xây trên nó vẫn "mù lực".

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các phương pháp như FreeTacMan coi ảnh xúc giác "như kết cấu thị giác phụ trợ" (lời bài báo), bỏ lỡ mối liên hệ giữa biến dạng và lực. FreeTacMan đạt 42,8%.

**Ý TƯỞNG** Pretrain một TaF-Adapter kéo mỗi chuỗi ảnh xúc giác về phía lực thật tương ứng (F/T 6 trục + bản đồ áp suất 12×12) bằng học tương phản, rồi đưa token của nó (đóng băng) vào action expert của π0.5.

**KẾT QUẢ** Thành công trung bình 64,8%, so với 37,1% của π0.5 chỉ dùng thị giác và 42,8% của FreeTacMan.
</div>

## 1. Vấn đề: xúc giác bị đọc như kết cấu bề mặt

[[flow]]
- Trước~FreeTacMan | Ảnh xúc giác > !Encoder ảnh~học kết cấu! > Chính sách | biết gel trông thế nào, không biết bị ấn mạnh đến đâu: 42,8%
+ TaF-VLA | Ảnh xúc giác > *TaF-Adapter~căn với F/T + áp suất* > Action expert π0.5 | token mang nghĩa lực: 64,8%
[[/flow]] Thay đổi nằm ở thứ mà bộ mã hóa xúc giác được dạy để khớp với: lực thật, thay vì không gì cả.

## 2. Kiến trúc

[[fig:taf-vla]] Giai đoạn (a) căn bộ mã hóa xúc giác với mã lực đã lượng tử hóa bằng InfoNCE; giai đoạn (b) gắn adapter đóng băng vào action expert của π0.5.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Bộ mã hóa lực | cửa sổ 5 bước: bản đồ áp suất $F'$ (12×12), wrench $F''$ (6) | mã $c^*$ (hai codebook VQ) | "mỏ neo vật lý" ổn định |
| Bộ mã hóa xúc giác | cửa sổ 5 ảnh xúc giác | $z^*$ (ViT + Transformer nhân quả) | thứ adapter xuất ra sau này |
| InfoNCE | các cặp $(z^*, c^*)$ | loss | kéo các cặp khớp lại gần |
| Action expert π0.5 | đặc trưng VLM $\phi_t$, $z^{tac}_t$, proprio $q_t$ | chunk hành động | chính sách, bước Euler 0,1 |

## 3. Tính tay: một số hạng InfoNCE

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** InfoNCE là loss dạy bộ mã hóa xúc giác khớp với lực thật. Tính nó để thấy khi nào loss nhỏ (căn tốt) và khi nào lớn.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $z^*_1$ | embedding xúc giác của mẫu 1 | input | – |
| $s_+$ | cosine similarity giữa $z^*_1$ và mã lực của chính nó $c^*_1$ | input | 0.9 |
| $s_-$ | similarity với mã lực còn lại $c^*_2$ | input | 0.2 |
| $\tau$ | nhiệt độ | hằng số | 0.1 (minh họa; bài không nêu) |
| $L_1$ | loss của mẫu 1 | output | – |

**Công thức** (batch hai cặp)

$$L_1 = -\log \frac{e^{s_+/\tau}}{e^{s_+/\tau} + e^{s_-/\tau}} = \log\left(1 + e^{(s_- - s_+)/\tau}\right)$$

**Từng bước**

1. $(s_- - s_+)/\tau = (0.2 - 0.9)/0.1 = -7$.
2. $e^{-7} \approx 0.00091$.
3. $L_1 = \log(1.00091) \approx 0.0009$.

Trường hợp căn kém, $s_+ = 0.5$, $s_- = 0.4$: $(0.4 - 0.5)/0.1 = -1$, $L_1 = \log(1 + e^{-1}) = \log 1.368 \approx 0.313$.

**Kết quả.** 0,0009 khi embedding xúc giác gần lực của chính nó rõ rệt; 0,313 khi chỉ gần hơn chút ít.

**Ý nghĩa.** Loss chỉ về 0 khi mỗi chuỗi xúc giác chỉ đúng về *lực của chính nó*, nên đầu ra của adapter trở thành một tín hiệu giống lực.
</div>

## 4. Kết quả

[[bars:%]] ACT=26.7; Diffusion Policy=29.5; π0.5 (chỉ thị giác)=37.1; FreeTacMan=42.8; *TaF-VLA=64.8* || Thành công trung bình, 15 lượt mỗi task.

- Adapter giúp cả backbone khác: ACT 26,7% → 47,6%, Diffusion Policy 29,5% → 44,7%.
- Ablation (lau bảng): đầy đủ 60,0%, không lịch sử 26,7%, dùng chung một codebook 13,3%.

## 5. Dữ liệu

| Mục | Giá trị |
|---|---|
| TaF-Dataset | > 10 triệu khung đồng bộ: xúc giác, F/T 6 trục, áp suất 12×12 |
| Thiết bị | máy ấn-và-nhiễu tự động, > 60 vật ấn, 30 Hz |
| Dữ liệu chính sách | > 10.000 episode có lực, > 20 kịch bản |

## 6. Lưu ý

- Số task (8 trong văn bản, 7 ở Bảng I) và số baseline không nhất quán trong bài.
- Adapter được gọi là đóng băng, nhưng văn bản cũng nhắc fine-tune theo task.

**Mang sang bài sau:** TaF-VLA cần một thiết bị tự chế và 10 triệu khung thật. [Tabero](tabero.html) có dữ liệu thị giác–xúc giác–lực bằng cách phát lại quỹ đạo sẵn có trong mô phỏng xúc giác.

**Câu kiểm tra:** $\tau = 0.1$, $s_+ = 0.8$, $s_- = 0.6$. $L_1$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$(0.6 - 0.8)/0.1 = -2$; $L_1 = \log(1 + e^{-2}) = \log 1.135 \approx 0.127$.
</details>
:::
