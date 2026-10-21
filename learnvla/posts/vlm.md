---
slug: vlm
date: 2026-10-21
title_en: "VLM: Giving a Language Model Eyes"
title_vi: "VLM: Cho mô hình ngôn ngữ đôi mắt"
excerpt_en: "A language model reads words; a vision encoder produces vectors in a different space. A small projector maps image vectors into the language model's input space, and the pair becomes a vision-language model. Worked: the size of PaliGemma's projector and a VLA's token budget."
excerpt_vi: "Mô hình ngôn ngữ đọc chữ; bộ mã hóa ảnh sinh vector trong một không gian khác. Một bộ chiếu nhỏ ánh xạ vector ảnh vào không gian đầu vào của mô hình ngôn ngữ, và cả hai thành mô hình thị giác-ngôn ngữ. Tính tay: kích thước bộ chiếu của PaliGemma và ngân sách token của một VLA."
tags: [VLA, Foundations, VLM, PaliGemma]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** LLaVA, *Visual Instruction Tuning*, [arXiv 2304.08485](https://arxiv.org/abs/2304.08485) · 04/2023. PaliGemma, [arXiv 2407.07726](https://arxiv.org/abs/2407.07726) · 07/2024

**PROBLEM** "Pick up the red cup on the left" needs both seeing (which cup, where) and language (what to do with it). A language model cannot see; an image encoder cannot follow instructions.

**WHAT FAILED BEFORE** Language models were text-only. Contrastive encoders such as CLIP match a whole image to a whole caption but cannot answer questions or reason about the scene. Earlier systems glued separate models together by hand.

**IDEA** Turn the vision encoder's patch vectors into vectors the language model accepts as if they were words, with a small projector, and let the language model read image tokens and text tokens in one sequence. Train the projector first, then fine-tune on instructions.

**RESULT** LLaVA reached an 85.1% relative score against GPT-4 on its synthetic instruction benchmark. PaliGemma (SigLIP-So400m + Gemma-2B, 3B parameters) is the base of π0. A VLA is a VLM whose output is extended to actions.
</div>

## 1. The problem: two models that speak different languages

[[flow]]
- Before~Text-only LLM | Instruction > !No access to the image! > Text | cannot tell which cup
- Before~Contrastive encoder | Image + caption > !One similarity score! > Match / no match | sees, but cannot follow or reason
+ VLM | Image > *Encoder + projector~image tokens* > *Language model~reads image and text* > Answer or action | one sequence, one model
[[/flow]] The change is a translation layer: image vectors are moved into the space where the language model's word vectors live.

## 2. The parts

[[fig:vlm]] Encoder, projector, language model. A VLA keeps this front and changes the back: either actions as tokens (RT-2, OpenVLA) or a separate action expert (π0).

| Part | PaliGemma (π0's base) | Role |
|---|---|---|
| Vision encoder | SigLIP So400m, patch 14: 256 tokens of width 1152 for a 224×224 image | what is in the picture ([ViT](vit.html), [contrastive learning](contrastive-learning.html)) |
| Projector | one linear layer, 1152 → 2048 | translate image vectors into the language model's input space |
| Language model | Gemma-2B, width 2048 | reasons over image and text tokens together |
| Attention pattern | full attention over image + prompt, causal over the generated text | the prompt can use the whole image; the answer is written left to right |

<div class="calc" markdown="1">
Calculation card

**What and why.** How big is the part that joins the two models, and how much of a VLA's sequence do images take? Both numbers explain design choices in robot VLAs.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $d_v$ | vision encoder width | constant | 1152 (SigLIP So400m) |
| $d_l$ | language model width | constant | 2048 (Gemma-2B) |
| $P$ | projector parameters | output | – |
| $C$ | cameras | input | 3 |
| $T$ | text tokens of the instruction | input | 32 |
| $N$ | total tokens before any action | output | – |

**Formulas**

$$P = d_v \times d_l + d_l, \qquad N = 256\,C + T$$

**Steps**

1. Weights: $1152 \times 2048 = 2{,}359{,}296$; bias: $2048$; $P = 2{,}361{,}344$.
2. As a share of a 3B model: $2.36\text{M} / 3\text{B} \approx 0.08\%$.
3. Tokens: $256 \times 3 + 32 = 800$; images are $768 / 800 = 96\%$ of them.

**Result.** The bridge is 2.4 million parameters, under a tenth of a percent of the model. Images make up 96% of the sequence.

**Why it matters.** The projector is tiny because both sides are already trained; it only has to rotate and scale one space into another, which is why it can be trained first, alone, on image–caption pairs. The token count is why every extra camera costs inference time, and why π0 caches the image and text part while denoising actions ([cross-attention](cross-attention.html)).
</div>

## 3. From VLM to VLA

- **Actions as words.** RT-2 and OpenVLA keep the VLM unchanged and write actions as tokens ([action tokenization](action-tokenization.html)). OpenVLA uses Llama 2 7B with a fused DINOv2 + SigLIP encoder, trained on 970k robot demonstrations.
- **A separate action expert.** π0 adds 300M parameters of action expert to PaliGemma's 3B; the expert reads the VLM's tokens and outputs continuous chunks with [flow matching](flowmatching.html).
- **What the VLM brings.** Recognising "the red cup" or "the charger" from internet-scale image–text data that no robot dataset could provide. What it does not bring: force, contact and fine motion, which come from robot data and, on this site, from force sensing.

**Carry forward:** the VLM is the pretrained *backbone* of a VLA. How much of it to retrain, and how cheaply: [backbone and fine-tuning](backbone.html).

**Check question:** A VLA uses 2 cameras at 256 tokens each and a 20-token instruction. How many tokens precede the actions, and what share are images?

<details markdown="1">
<summary>Answer</summary>

$2 \times 256 + 20 = 532$ tokens; images are $512 / 532 = 96.2\%$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** LLaVA, *Visual Instruction Tuning*, [arXiv 2304.08485](https://arxiv.org/abs/2304.08485) · 04/2023. PaliGemma, [arXiv 2407.07726](https://arxiv.org/abs/2407.07726) · 07/2024

**VẤN ĐỀ** "Nhặt cái cốc đỏ bên trái" cần cả nhìn (cốc nào, ở đâu) lẫn ngôn ngữ (làm gì với nó). Mô hình ngôn ngữ không nhìn được; bộ mã hóa ảnh không làm theo được câu lệnh.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Mô hình ngôn ngữ chỉ có chữ. Bộ mã hóa contrastive như CLIP so khớp cả bức ảnh với cả câu chú thích nhưng không trả lời câu hỏi hay suy luận về khung cảnh được. Các hệ thống trước đó ghép các mô hình riêng rẽ bằng tay.

**Ý TƯỞNG** Dùng một bộ chiếu nhỏ biến các vector patch của bộ mã hóa ảnh thành những vector mà mô hình ngôn ngữ nhận như thể chúng là chữ, rồi cho mô hình ngôn ngữ đọc token ảnh và token chữ trong cùng một dãy. Huấn luyện bộ chiếu trước, sau đó fine-tune trên dữ liệu chỉ dẫn.

**KẾT QUẢ** LLaVA đạt điểm tương đối 85,1% so với GPT-4 trên bộ đánh giá chỉ dẫn tổng hợp của nó. PaliGemma (SigLIP-So400m + Gemma-2B, 3 tỉ tham số) là nền của π0. VLA là một VLM có đầu ra được mở rộng sang hành động.
</div>

## 1. Vấn đề: hai mô hình nói hai thứ tiếng

[[flow]]
- Trước~LLM chỉ có chữ | Câu lệnh > !Không thấy ảnh! > Chữ | không biết là cốc nào
- Trước~Bộ mã hóa contrastive | Ảnh + chú thích > !Một điểm tương đồng! > Khớp / không khớp | thấy được, nhưng không làm theo hay suy luận được
+ VLM | Ảnh > *Bộ mã hóa + bộ chiếu~token ảnh* > *Mô hình ngôn ngữ~đọc ảnh và chữ* > Câu trả lời hoặc hành động | một dãy, một mô hình
[[/flow]] Thay đổi là một lớp phiên dịch: vector ảnh được dời vào không gian nơi các vector chữ của mô hình ngôn ngữ sống.

## 2. Các bộ phận

[[fig:vlm]] Bộ mã hóa, bộ chiếu, mô hình ngôn ngữ. VLA giữ phần đầu này và đổi phần đuôi: hoặc hành động dạng token (RT-2, OpenVLA), hoặc một action expert riêng (π0).

| Bộ phận | PaliGemma (nền của π0) | Vai trò |
|---|---|---|
| Bộ mã hóa ảnh | SigLIP So400m, patch 14: 256 token độ rộng 1152 cho ảnh 224×224 | trong ảnh có gì ([ViT](vit.html), [contrastive learning](contrastive-learning.html)) |
| Bộ chiếu | một lớp tuyến tính, 1152 → 2048 | dịch vector ảnh sang không gian đầu vào của mô hình ngôn ngữ |
| Mô hình ngôn ngữ | Gemma-2B, độ rộng 2048 | suy luận trên token ảnh và chữ cùng lúc |
| Kiểu attention | attention đầy đủ trên ảnh + câu lệnh, nhân quả trên phần chữ được sinh | câu lệnh dùng được cả bức ảnh; câu trả lời được viết từ trái sang phải |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Phần nối hai mô hình lớn cỡ nào, và ảnh chiếm bao nhiêu trong dãy của một VLA? Cả hai con số giải thích các lựa chọn thiết kế trong VLA cho robot.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $d_v$ | độ rộng bộ mã hóa ảnh | hằng số | 1152 (SigLIP So400m) |
| $d_l$ | độ rộng mô hình ngôn ngữ | hằng số | 2048 (Gemma-2B) |
| $P$ | số tham số bộ chiếu | output | – |
| $C$ | số camera | input | 3 |
| $T$ | số token chữ của câu lệnh | input | 32 |
| $N$ | tổng số token trước phần hành động | output | – |

**Công thức**

$$P = d_v \times d_l + d_l, \qquad N = 256\,C + T$$

**Từng bước**

1. Trọng số: $1152 \times 2048 = 2.359.296$; bias: $2048$; $P = 2.361.344$.
2. Tỉ lệ trong mô hình 3 tỉ tham số: $2{,}36\text{ triệu} / 3\text{ tỉ} \approx 0{,}08\%$.
3. Token: $256 \times 3 + 32 = 800$; ảnh chiếm $768 / 800 = 96\%$.

**Kết quả.** Cây cầu nối là 2,4 triệu tham số, chưa tới một phần mười phần trăm của mô hình. Ảnh chiếm 96% dãy.

**Ý nghĩa.** Bộ chiếu nhỏ vì cả hai phía đều đã được huấn luyện; nó chỉ cần xoay và co giãn không gian này sang không gian kia, vì vậy nó có thể được huấn luyện trước, một mình, trên các cặp ảnh–chú thích. Số token là lý do mỗi camera thêm vào đều tốn thời gian suy luận, và vì sao π0 lưu đệm phần ảnh và chữ khi khử nhiễu hành động ([cross-attention](cross-attention.html)).
</div>

## 3. Từ VLM tới VLA

- **Hành động là chữ.** RT-2 và OpenVLA giữ nguyên VLM và viết hành động thành token ([action tokenization](action-tokenization.html)). OpenVLA dùng Llama 2 7B với bộ mã hóa gộp DINOv2 + SigLIP, huấn luyện trên 970 nghìn demo robot.
- **Một action expert riêng.** π0 thêm 300 triệu tham số action expert vào 3 tỉ của PaliGemma; expert đọc token của VLM và xuất chunk liên tục bằng [flow matching](flowmatching.html).
- **VLM mang lại gì.** Nhận ra "cái cốc đỏ" hay "cái sạc" nhờ dữ liệu ảnh–chữ cỡ internet mà không bộ dữ liệu robot nào cung cấp nổi. Nó không mang lại: lực, tiếp xúc và chuyển động tinh, những thứ đến từ dữ liệu robot và, trên trang này, từ cảm biến lực.

**Mang theo:** VLM là *backbone* đã pretrain của VLA. Huấn luyện lại bao nhiêu phần của nó, và rẻ tới đâu: [backbone và fine-tuning](backbone.html).

**Câu kiểm tra:** Một VLA dùng 2 camera, mỗi camera 256 token, và câu lệnh 20 token. Có bao nhiêu token đứng trước phần hành động, và ảnh chiếm bao nhiêu phần?

<details markdown="1">
<summary>Đáp án</summary>

$2 \times 256 + 20 = 532$ token; ảnh chiếm $512 / 532 = 96{,}2\%$.
</details>
:::
