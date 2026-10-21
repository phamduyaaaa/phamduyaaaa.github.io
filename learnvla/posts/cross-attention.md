---
slug: cross-attention
date: 2026-10-21
title_en: "Cross-Attention: Letting One Sequence Read Another"
title_vi: "Cross-attention: Cho một dãy đọc một dãy khác"
excerpt_en: "An action expert has to read hundreds of VLM tokens without rewriting them. Cross-attention takes queries from one sequence and keys and values from the other. Worked cost: why caching the VLM side makes ten denoising steps cheap, and why π0's block mask costs the same."
excerpt_vi: "Action expert phải đọc hàng trăm token của VLM mà không viết lại chúng. Cross-attention lấy query từ dãy này, key và value từ dãy kia. Tính chi phí: vì sao lưu đệm phía VLM làm mười bước khử nhiễu trở nên rẻ, và vì sao mask theo khối của π0 tốn đúng bằng vậy."
tags: [VLA, Foundations, Attention, Transformer]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Encoder–decoder attention in Vaswani et al., [arXiv 1706.03762](https://arxiv.org/abs/1706.03762) · 06/2017. Perceiver, [arXiv 2103.03206](https://arxiv.org/abs/2103.03206) · 03/2021

**PROBLEM** Two sequences of different kinds must talk: 50 action tokens need the scene and instruction held in about 800 VLM tokens, and the VLM side should not be disturbed by the actions.

**WHAT FAILED BEFORE** Squeezing the condition into one vector (a pooled embedding, or FiLM scaling) recreates the bottleneck that [attention](attention.html) removed. Concatenating everything into one self-attention lets every token rewrite every other and makes the cost grow with $(n+m)^2$; Perceiver notes this does not scale to very large inputs.

**IDEA** Take queries from the sequence being updated and keys and values from the other one. Each action token picks what it needs from the VLM tokens, which are only read.

**RESULT** GR00T N1's action module cross-attends to the VLM's tokens (from its 12th layer in the 2B model); FACT's refiner cross-attends to cached planner states. π0 reaches the same effect inside one Transformer with a block mask.
</div>

## 1. The problem: two sequences, one direction of reading

[[flow]]
- Before~One condition vector | 800 VLM tokens > !Pooled to 1 vector! > Action head | detail lost, the old bottleneck
- Before~One big self-attention | 850 tokens > !Everyone updates everyone~(n+m)² pairs! > Actions | VLM tokens disturbed by noisy actions
+ Cross-attention | Action queries > *Read VLM keys and values~n×m pairs* > Updated actions | VLM side read-only, cacheable
[[/flow]] The change is direction: information flows from the scene to the actions, not back.

## 2. The mechanism

[[fig:cross-attention]] Queries come from the action tokens, keys and values from the VLM tokens. The arithmetic is the same as self-attention; only the sources differ.

| Block | Input | Output | Role |
|---|---|---|---|
| $Q = Y W_Q$ | action tokens $Y$ ($n \times d$) | queries | what each action step is looking for |
| $K = X W_K,\ V = X W_V$ | VLM tokens $X$ ($m \times d$) | keys, values | what the scene offers |
| Scores, softmax | $Q, K$ | $n \times m$ weights | which scene tokens each action step uses |
| Weights × $V$ | weights, $V$ | $n \times d$ | scene information added to the actions |

A one-line example: an action query $q = (1, 0)$ meets a "cup" token with $k = (1, 0)$, $v = (5, 0)$ and a "table" token with $k = (0, 1)$, $v = (0, 5)$. With $d = 2$ the scores are $0.707$ and $0$, the weights $0.67$ and $0.33$, and the output $(3.35,\ 1.65)$: mostly cup, a little table.

<div class="calc" markdown="1">
Calculation card

**What and why.** A flow-matching action expert runs 10 denoising steps per chunk. Count attention pairs with and without caching the VLM side, and compare cross-attention with π0's single-Transformer design.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $m$ | VLM tokens (3 images × 256 + text) | input | 800 |
| $n$ | action tokens in the chunk | input | 50 |
| $S$ | denoising steps | input | 10 |
| $P$ | attention pairs per layer, summed over the steps | output | – |

**Formulas**

$$P_{\text{no cache}} = S\,(n+m)^2, \qquad P_{\text{cache}} = m^2 + S\,(n\,m + n^2)$$

**Steps**

1. No cache, one joint self-attention redone each step: $10 \times 850^2 = 10 \times 722{,}500 = 7{,}225{,}000$.
2. Cache: the VLM tokens attend to themselves once, $800^2 = 640{,}000$.
3. Each step, the 50 action tokens read 800 VLM tokens and each other: $50 \times 800 + 50^2 = 40{,}000 + 2{,}500 = 42{,}500$; ten steps give $425{,}000$.
4. Total with cache: $640{,}000 + 425{,}000 = 1{,}065{,}000$.

**Result.** About 6.8× fewer pairs with the VLM side computed once.

**Why it matters.** Step 3 is exactly what cross-attention computes, and it is also what π0 computes: its block mask stops the prefix from looking at the actions, so the prefix keys and values can be cached, as the π0 paper describes. The cost is the same; the difference is architectural. In π0 the action expert sits in the *same* layer stack and reads the prefix at every layer; in a cross-attention design such as GR00T N1 the action module reads one chosen set of VLM features.
</div>

## 3. Where you meet it

- **Action expert reading a VLM:** GR00T N1 (cross-attention), π0 and π0.5 (shared stack with a block mask).
- **Refiners reading a coarse plan:** FACT's force–action refiner reads the planner's frozen states through cached cross-attention.
- **Compressing a large input:** Perceiver lets a small array of latents cross-attend to a huge input, so cost grows with the input once, not squared; force-history encoders in CR-VLA-Force use one learnable token that cross-attends over force segments in the same spirit.

**Carry forward:** the VLM tokens being read here start as image patches. How an image becomes tokens: [ViT](vit.html).

**Check question:** With $m = 600$, $n = 50$ and $S = 10$, how many attention pairs per layer with caching?

<details markdown="1">
<summary>Answer</summary>

$600^2 + 10 \times (50 \times 600 + 50^2) = 360{,}000 + 10 \times 32{,}500 = 360{,}000 + 325{,}000 = 685{,}000$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Attention encoder–decoder trong Vaswani và cộng sự, [arXiv 1706.03762](https://arxiv.org/abs/1706.03762) · 06/2017. Perceiver, [arXiv 2103.03206](https://arxiv.org/abs/2103.03206) · 03/2021

**VẤN ĐỀ** Hai dãy khác loại phải nói chuyện với nhau: 50 token hành động cần khung cảnh và câu lệnh nằm trong khoảng 800 token của VLM, và phía VLM không nên bị hành động làm xáo trộn.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Ép điều kiện vào một vector (embedding gộp, hoặc phép co giãn FiLM) tạo lại đúng nút thắt mà [attention](attention.html) đã gỡ bỏ. Nối mọi thứ vào một self-attention thì mọi token viết lại mọi token khác và chi phí tăng theo $(n+m)^2$; Perceiver chỉ ra cách này không mở rộng được cho đầu vào rất lớn.

**Ý TƯỞNG** Lấy query từ dãy cần cập nhật, key và value từ dãy kia. Mỗi token hành động tự chọn thứ nó cần từ các token VLM, vốn chỉ được đọc.

**KẾT QUẢ** Mô-đun hành động của GR00T N1 cross-attend tới token của VLM (lấy từ lớp thứ 12 trong mô hình 2B); refiner của FACT cross-attend tới trạng thái planner đã lưu đệm. π0 đạt cùng hiệu quả bên trong một Transformer duy nhất bằng mask theo khối.
</div>

## 1. Vấn đề: hai dãy, một chiều đọc

[[flow]]
- Trước~Một vector điều kiện | 800 token VLM > !Gộp thành 1 vector! > Đầu hành động | mất chi tiết, nút thắt cũ
- Trước~Một self-attention lớn | 850 token > !Ai cũng cập nhật mọi người~(n+m)² cặp! > Hành động | token VLM bị hành động nhiễu làm xáo trộn
+ Cross-attention | Query hành động > *Đọc key và value của VLM~n×m cặp* > Hành động đã cập nhật | phía VLM chỉ đọc, lưu đệm được
[[/flow]] Thay đổi nằm ở chiều: thông tin chảy từ khung cảnh sang hành động, không chảy ngược lại.

## 2. Cơ chế

[[fig:cross-attention]] Query đến từ token hành động, key và value đến từ token VLM. Phép tính giống self-attention; chỉ có nguồn là khác.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| $Q = Y W_Q$ | token hành động $Y$ ($n \times d$) | query | mỗi bước hành động đang tìm gì |
| $K = X W_K,\ V = X W_V$ | token VLM $X$ ($m \times d$) | key, value | khung cảnh có gì để đưa |
| Điểm, softmax | $Q, K$ | trọng số $n \times m$ | mỗi bước hành động dùng token cảnh nào |
| Trọng số × $V$ | trọng số, $V$ | $n \times d$ | thông tin khung cảnh được cộng vào hành động |

Ví dụ một dòng: query hành động $q = (1, 0)$ gặp token "cốc" có $k = (1, 0)$, $v = (5, 0)$ và token "bàn" có $k = (0, 1)$, $v = (0, 5)$. Với $d = 2$ điểm là $0{,}707$ và $0$, trọng số $0{,}67$ và $0{,}33$, đầu ra $(3{,}35;\ 1{,}65)$: chủ yếu là cốc, một chút bàn.

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một action expert flow matching chạy 10 bước khử nhiễu cho mỗi chunk. Đếm số cặp attention khi có và không có lưu đệm phía VLM, và so cross-attention với thiết kế một-Transformer của π0.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $m$ | token VLM (3 ảnh × 256 + chữ) | input | 800 |
| $n$ | token hành động trong chunk | input | 50 |
| $S$ | số bước khử nhiễu | input | 10 |
| $P$ | số cặp attention mỗi lớp, cộng qua các bước | output | – |

**Công thức**

$$P_{\text{không đệm}} = S\,(n+m)^2, \qquad P_{\text{có đệm}} = m^2 + S\,(n\,m + n^2)$$

**Từng bước**

1. Không đệm, một self-attention chung tính lại mỗi bước: $10 \times 850^2 = 10 \times 722.500 = 7.225.000$.
2. Có đệm: token VLM attend lẫn nhau một lần, $800^2 = 640.000$.
3. Mỗi bước, 50 token hành động đọc 800 token VLM và đọc nhau: $50 \times 800 + 50^2 = 40.000 + 2.500 = 42.500$; mười bước được $425.000$.
4. Tổng khi có đệm: $640.000 + 425.000 = 1.065.000$.

**Kết quả.** Ít hơn khoảng 6,8 lần số cặp khi phía VLM chỉ tính một lần.

**Ý nghĩa.** Bước 3 chính là thứ cross-attention tính, và cũng là thứ π0 tính: mask theo khối của nó chặn phần tiền tố nhìn sang hành động, nên key và value của tiền tố lưu đệm được, như paper π0 mô tả. Chi phí như nhau; khác biệt nằm ở kiến trúc. Trong π0, action expert nằm *cùng* chồng lớp và đọc tiền tố ở mọi lớp; trong thiết kế cross-attention như GR00T N1, mô-đun hành động đọc một bộ đặc trưng VLM được chọn sẵn.
</div>

## 3. Gặp nó ở đâu

- **Action expert đọc VLM:** GR00T N1 (cross-attention), π0 và π0.5 (chung chồng lớp với mask theo khối).
- **Refiner đọc kế hoạch thô:** refiner lực–hành động của FACT đọc trạng thái đóng băng của planner qua cross-attention có lưu đệm.
- **Nén một đầu vào lớn:** Perceiver cho một mảng latent nhỏ cross-attend tới đầu vào khổng lồ, nên chi phí tăng theo đầu vào một lần chứ không bình phương; bộ mã hóa lịch sử lực trong CR-VLA-Force dùng một token học được cross-attend lên các đoạn lực theo cùng tinh thần.

**Mang theo:** các token VLM được đọc ở đây khởi đầu là những patch ảnh. Ảnh trở thành token thế nào: [ViT](vit.html).

**Câu kiểm tra:** Với $m = 600$, $n = 50$ và $S = 10$, có lưu đệm thì mỗi lớp có bao nhiêu cặp attention?

<details markdown="1">
<summary>Đáp án</summary>

$600^2 + 10 \times (50 \times 600 + 50^2) = 360.000 + 10 \times 32.500 = 360.000 + 325.000 = 685.000$.
</details>
:::
