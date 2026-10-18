---
slug: forcevla
date: 2026-10-18
title_en: "ForceVLA: Force-aware MoE for Contact-rich Manipulation"
title_vi: "ForceVLA: MoE nhận biết lực cho thao tác giàu tiếp xúc"
excerpt_en: "Appending force to π0's state barely helps. ForceVLA gives force its own token and fuses it after the VLM with a 4-expert MoE: 60.5% vs 37.3% on five contact tasks."
excerpt_vi: "Nối lực vào state của π0 gần như vô ích. ForceVLA cho lực một token riêng và gộp sau VLM bằng MoE 4 expert: 60,5% so với 37,3% trên năm task tiếp xúc."
tags: [VLA, Force, Paper Notes, MoE, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) · 05/2025 · NeurIPS 2025 · built on π0

**PROBLEM** π0 sees only images, so it is blind to force exactly when contact decides the task: inserting a plug, wiping a board, or when the hand hides the object.

**WHAT FAILED BEFORE** The common fix, appending the 6 force numbers to π0's state, adds +2.9 points to π0-base and *costs* π0-fast 16.8 points.

**IDEA** Treat force as its own modality (one token) and fuse it **after** the VLM with a sparse mixture of experts (FVLMoE).

**RESULT** 60.5% vs 37.3% for π0-base on five contact-rich tasks (+23.2 points).
</div>

## 1. The problem: what earlier approaches left unsolved

[[flow]]
- Before~π0 + force in state | RGB + instruction > VLM > !Action expert~state + 6 force numbers! | six numbers drown in the state: π0-fast falls 31.0% → 14.2%
- Also tried~MoE before VLM | F/T + RGB > !MoE~before the VLM! > VLM > Action expert | a VLM pretrained without force is disrupted: 0% in the ablation
+ ForceVLA | RGB + instruction > VLM > *FVLMoE~fuse force AFTER VLM* > Action expert | force gets its own path: 60.5%
[[/flow]] Three ways to add force to π0. Red marks where earlier attempts break; yellow marks ForceVLA's change.

- A camera cannot see how hard the plug is pressed, and occlusion makes it worse.
- *Where* force is fused matters more than *whether* it is fused:

[[bars:%]] Linear before VLM=55; MoE before VLM=0; Concat after VLM=60; *FVLMoE after VLM=80* || Ablation on fusion position (one task, success rate).

## 2. Architecture

[[fig:forcevla]] The force token joins the VLM output, passes an encoder and a top-1 MoE, and is added to the action expert's input before flow-matching decoding.

| Block | Input | Output | Role |
|---|---|---|---|
| VLM (PaliGemma, SigLIP) | base + wrist RGB, instruction | $E_{VL}$, $N \times 2048$ | understand scene and command |
| Linear $\phi_F$ | force $f \in \mathbb{R}^6$ | $E_F$, $1 \times 2048$ | turn force into one token |
| Encoder (8 heads) | $[E_{VL}; E_F]$ | $E_{enc}$ | let the force token talk to image tokens |
| FVLMoE | $E_{enc}$ | $E_{fused}$ | 4 expert MLPs, top-1 router, + residual |
| Linear, add | $E_{fused}$ | $G$ added to $S_{suffix}$ | inject into the action expert |
| Flow-matching head | $S_{suffix} + G$ | action chunk $A_t$ | generate actions |

## 3. Work it by hand: one top-1 routing step

<div class="calc" markdown="1">
Calculation card

**What and why.** The FVLMoE router sends each token to one of 4 experts. Computing it shows how a "touching" token and a "moving" token end up in different experts without any label.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $h$ | one token after the encoder | input | – |
| $r = (r_1, \dots, r_4)$ | router logits, one per expert | input | $(2.0,\ 0.5,\ 0.1,\ -1.0)$ (illustrative) |
| $p_k$ | probability of expert $k$ | intermediate | – |
| $k^*$ | chosen expert | output | – |
| $E_k(\cdot)$ | expert $k$, a small MLP | – | – |

**Formula**

$$p_k = \frac{e^{r_k}}{\sum_{j=1}^{4} e^{r_j}}, \qquad k^* = \arg\max_k p_k, \qquad \text{out} = h + E_{k^*}(h)$$

**Steps** for a free-space token, $r = (2.0,\ 0.5,\ 0.1,\ -1.0)$:

1. Exponentiate: $e^{2.0} = 7.389$, $e^{0.5} = 1.649$, $e^{0.1} = 1.105$, $e^{-1.0} = 0.368$.
2. Sum: $7.389 + 1.649 + 1.105 + 0.368 = 10.511$.
3. Divide: $p = (0.703,\ 0.157,\ 0.105,\ 0.035)$.
4. Largest: $k^* = 1$.

Same steps for a token while the plug is pushed in, $r = (0.2,\ 0.1,\ 2.5,\ 0.3)$: sum $= 15.858$, $p_3 = 12.182 / 15.858 = 0.768$, so $k^* = 3$.

**Result.** The two tokens go to experts 1 and 3.

**Why it matters.** Nobody labelled "contact"; the force token reaches every token through self-attention and shifts the logits. The residual $h + E_{k^*}(h)$ means an expert only learns a correction. (The paper does not say whether the expert output is also scaled by $p_{k^*}$.)
</div>

## 4. Results

[[bars:%]] π0-fast + force=14.2; π0-fast=31; π0-base=37.3; π0-base + force=40.2; *ForceVLA=60.5* || Average success over five tasks: bottle pumping, plug insertion, USB insertion, whiteboard wiping, cucumber peeling.

- Multi-task training: 67.5% average, plug insertion 100%.
- Under visual occlusion ForceVLA keeps 90% success.

## 5. Training and data

| Item | Value |
|---|---|
| Base | π0, conditional flow matching |
| Data | ForceVLA-Data: 244 trajectories, ~140k timesteps, 5 tasks |
| Robot | Flexiv Rizon arm, VR teleoperation |
| Optimiser | Adam, LR $2.5\times10^{-5} \to 2.5\times10^{-6}$, 30k steps, bfloat16 |

## 6. Caveats

- Checked against the full text: multi-task training used Adam with a peak learning rate of 2.5e-5 for 30,000 steps (about 12 hours on 2 GPUs), and the cameras run at 30 FPS. Control rate, chunk length and frozen modules are still not stated.
- The 37.3% baseline is labelled inconsistently in the paper; the ablation baseline (45%) is on a different footing.

**Carry forward:** ForceVLA reads force but still outputs only a pose, so it cannot say *how hard* to push. [ForceVLA2](forcevla2.html) changes the output.

**Check question:** router logits $(1.0,\ 1.0,\ 0.0,\ 3.0)$. Which expert, with what probability?

<details markdown="1">
<summary>Answer</summary>

$e^1 = 2.718$ (twice), $e^0 = 1$, $e^3 = 20.086$; sum $26.522$; $p_4 = 20.086 / 26.522 = 0.757$, so expert 4.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) · 05/2025 · NeurIPS 2025 · nền π0

**VẤN ĐỀ** π0 chỉ nhìn ảnh nên mù lực đúng lúc tiếp xúc quyết định task: cắm phích, lau bảng, hoặc khi tay che mất vật.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Cách sửa phổ biến, nối 6 số lực vào state của π0, chỉ giúp π0-base +2,9 điểm và còn *làm* π0-fast mất 16,8 điểm.

**Ý TƯỞNG** Coi lực là một modality riêng (một token) và gộp nó **sau** VLM bằng mixture of experts thưa (FVLMoE).

**KẾT QUẢ** 60,5% so với 37,3% của π0-base trên năm task giàu tiếp xúc (+23,2 điểm).
</div>

## 1. Vấn đề: các cách trước còn tồn đọng gì

[[flow]]
- Trước~π0 + lực vào state | RGB + câu lệnh > VLM > !Action expert~state + 6 số lực! | sáu con số chìm trong state: π0-fast tụt 31,0% → 14,2%
- Cũng đã thử~MoE trước VLM | F/T + RGB > !MoE~trước VLM! > VLM > Action expert | VLM pretrain không có lực bị xáo trộn: 0% trong ablation
+ ForceVLA | RGB + câu lệnh > VLM > *FVLMoE~gộp lực SAU VLM* > Action expert | lực có đường riêng: 60,5%
[[/flow]] Ba cách thêm lực vào π0. Ô đỏ là chỗ các cách trước hỏng; ô vàng là thay đổi của ForceVLA.

- Camera không thấy phích đang bị ấn mạnh đến đâu, và bị che khuất thì càng tệ.
- Gộp lực *ở đâu* quan trọng hơn *có* gộp hay không:

[[bars:%]] Linear trước VLM=55; MoE trước VLM=0; Concat sau VLM=60; *FVLMoE sau VLM=80* || Ablation vị trí gộp lực (một task, tỉ lệ thành công).

## 2. Kiến trúc

[[fig:forcevla]] Token lực nhập vào đầu ra của VLM, qua một encoder và MoE top-1, rồi được cộng vào đầu vào của action expert trước khi giải mã flow-matching.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| VLM (PaliGemma, SigLIP) | RGB nền + cổ tay, câu lệnh | $E_{VL}$, $N \times 2048$ | hiểu cảnh và câu lệnh |
| Linear $\phi_F$ | lực $f \in \mathbb{R}^6$ | $E_F$, $1 \times 2048$ | biến lực thành một token |
| Encoder (8 head) | $[E_{VL}; E_F]$ | $E_{enc}$ | cho token lực "nói chuyện" với token ảnh |
| FVLMoE | $E_{enc}$ | $E_{fused}$ | 4 expert MLP, router top-1, + residual |
| Linear, cộng | $E_{fused}$ | $G$ cộng vào $S_{suffix}$ | đưa vào action expert |
| Đầu flow-matching | $S_{suffix} + G$ | chunk hành động $A_t$ | sinh hành động |

## 3. Tính tay: một bước định tuyến top-1

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Router của FVLMoE gửi mỗi token tới một trong 4 expert. Tính thử để thấy token "đang chạm" và token "đang di chuyển" đi tới hai expert khác nhau mà không cần nhãn nào.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $h$ | một token sau encoder | input | – |
| $r = (r_1, \dots, r_4)$ | logit của router, mỗi expert một số | input | $(2.0,\ 0.5,\ 0.1,\ -1.0)$ (minh họa) |
| $p_k$ | xác suất chọn expert $k$ | trung gian | – |
| $k^*$ | expert được chọn | output | – |
| $E_k(\cdot)$ | expert $k$, một MLP nhỏ | – | – |

**Công thức**

$$p_k = \frac{e^{r_k}}{\sum_{j=1}^{4} e^{r_j}}, \qquad k^* = \arg\max_k p_k, \qquad \text{out} = h + E_{k^*}(h)$$

**Từng bước** với token di chuyển tự do, $r = (2.0,\ 0.5,\ 0.1,\ -1.0)$:

1. Lũy thừa: $e^{2.0} = 7.389$, $e^{0.5} = 1.649$, $e^{0.1} = 1.105$, $e^{-1.0} = 0.368$.
2. Cộng: $7.389 + 1.649 + 1.105 + 0.368 = 10.511$.
3. Chia: $p = (0.703,\ 0.157,\ 0.105,\ 0.035)$.
4. Lớn nhất: $k^* = 1$.

Làm lại với token lúc đang ấn phích, $r = (0.2,\ 0.1,\ 2.5,\ 0.3)$: tổng $= 15.858$, $p_3 = 12.182 / 15.858 = 0.768$, nên $k^* = 3$.

**Kết quả.** Hai token đi tới expert 1 và expert 3.

**Ý nghĩa.** Không ai gắn nhãn "đang chạm"; token lực lan tới mọi token qua self-attention và làm lệch logit. Residual $h + E_{k^*}(h)$ nghĩa là expert chỉ cần học phần hiệu chỉnh. (Bài không nói đầu ra expert có được nhân thêm $p_{k^*}$ hay không.)
</div>

## 4. Kết quả

[[bars:%]] π0-fast + lực=14.2; π0-fast=31; π0-base=37.3; π0-base + lực=40.2; *ForceVLA=60.5* || Thành công trung bình trên năm task: bơm chai, cắm phích, cắm USB, lau bảng, gọt dưa chuột.

- Huấn luyện đa task: trung bình 67,5%, cắm phích 100%.
- Khi camera bị che, ForceVLA vẫn giữ 90% thành công.

## 5. Huấn luyện và dữ liệu

| Mục | Giá trị |
|---|---|
| Nền | π0, conditional flow matching |
| Dữ liệu | ForceVLA-Data: 244 quỹ đạo, ~140k timestep, 5 task |
| Robot | tay Flexiv Rizon, teleoperation VR |
| Optimizer | Adam, LR $2.5\times10^{-5} \to 2.5\times10^{-6}$, 30k bước, bfloat16 |

## 6. Lưu ý

- Đã đối chiếu với toàn văn: huấn luyện đa tác vụ dùng Adam, learning rate đỉnh 2,5e-5, 30.000 bước (khoảng 12 giờ trên 2 GPU), camera chạy 30 FPS. Tần số điều khiển, độ dài chunk và module bị đóng băng vẫn không được nêu.
- Baseline 37,3% được gắn nhãn không nhất quán trong bài; baseline của ablation (45%) nằm trên một nền khác.

**Mang sang bài sau:** ForceVLA đọc được lực nhưng vẫn chỉ xuất pose, nên không nói được *ấn mạnh đến đâu*. [ForceVLA2](forcevla2.html) thay đổi đầu ra.

**Câu kiểm tra:** logit router $(1.0,\ 1.0,\ 0.0,\ 3.0)$. Token đi tới expert nào, với xác suất bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$e^1 = 2.718$ (hai lần), $e^0 = 1$, $e^3 = 20.086$; tổng $26.522$; $p_4 = 20.086 / 26.522 = 0.757$, nên expert 4.
</details>
:::
