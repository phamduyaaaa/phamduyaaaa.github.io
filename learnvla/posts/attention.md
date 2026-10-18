---
slug: attention
date: 2026-10-18
title_en: "Attention: Letting Each Token Look at the Others"
title_vi: "Attention: Cho mỗi token nhìn sang các token khác"
excerpt_en: "Earlier encoder-decoder models squeezed a whole sentence into one fixed vector. Attention lets the decoder look back at every input position and weight them. Worked by hand with two tokens."
excerpt_vi: "Các mô hình encoder-decoder trước nén cả câu vào một vector cố định. Attention cho decoder nhìn lại từng vị trí đầu vào và đánh trọng số. Tính tay với hai token."
tags: [VLA, Foundations, Attention, Transformer]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Bahdanau, Cho, Bengio, *Neural Machine Translation by Jointly Learning to Align and Translate*, [arXiv 1409.0473](https://arxiv.org/abs/1409.0473) · 09/2014

**PROBLEM** To generate each output, a model must find which input pieces matter.

**WHAT FAILED BEFORE** Encoder-decoder RNNs compressed the whole source sentence into one fixed-length vector. The paper argues this is a bottleneck, and quality drops on long sentences.

**IDEA** Keep one vector per input position. For each output, score every position, softmax the scores into weights, and take the weighted sum. The model learns where to look.

**RESULT** Better translation on long sentences. The Transformer later made this the only mechanism, with every token attending to every other token (self-attention).
</div>

## 1. The problem: a fixed-size bottleneck

[[flow]]
- Before~Encoder-decoder RNN | Source sentence > !One fixed vector~all information squeezed! > Decoder | long inputs lose detail
+ Attention | Source tokens > *One vector per token~weights by softmax* > Decoder | looks at what it needs, per output
[[/flow]] The change is that the decoder is no longer limited to one summary vector.

## 2. The mechanism

[[fig:attention]] Each token makes a query (what it needs), a key (what it offers) and a value (what it carries). Scores come from query·key; softmax gives weights; the output is a weighted mix of values.

| Block | Input | Output | Role |
|---|---|---|---|
| $W_Q, W_K, W_V$ | $X$ ($n \times d$) | $Q, K, V$ | three learned views of the same tokens |
| Scores | $Q, K$ | $n \times n$ matrix | how well each query matches each key |
| Divide by $\sqrt{d}$ | scores | scaled scores | keeps values from growing with $d$ |
| Softmax | scaled scores | weights, each row sums to 1 | turns scores into a distribution |
| Weights × $V$ | weights, $V$ | output ($n \times d$) | context-aware token vectors |

<div class="calc" markdown="1">

Calculation card

**What and why.** What does attention output for two tokens? This shows that the output is a *weighted average* of the values.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $x_1, x_2$ | token vectors | input | $[1,0]$, $[0,1]$ |
| $Q = K = V$ | to keep the example short, identity projections | assumption | $= X$ |
| $d$ | vector size | constant | 2 |
| $A$ | attention weights | output | – |
| $O$ | output vectors | output | – |

**Formula**

$$A = \mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d}}\right), \qquad O = A\,V$$

**Steps** (token 1)

1. Scores with $K$: $q_1 \cdot k_1 = 1$, $q_1 \cdot k_2 = 0$. Divide by $\sqrt{2} = 1.414$: $[0.707,\ 0]$.
2. Exponentials: $e^{0.707} = 2.028$, $e^{0} = 1$. Sum $= 3.028$.
3. Weights: $[2.028/3.028,\ 1/3.028] = [0.670,\ 0.330]$.
4. Output: $0.670\,[1,0] + 0.330\,[0,1] = [0.670,\ 0.330]$.

**Result.** Token 1 now carries 67% of itself and 33% of token 2. By symmetry, token 2 gets $[0.330, 0.670]$.

**Why it matters.** Both tokens became vectors that contain information from the other. The $\sqrt{d}$ keeps scores from growing as vectors get longer, which would make softmax saturate to a one-hot.
</div>

## 3. Cost and variants

- $n$ tokens give an $n \times n$ score matrix: $N^2$ pairs. This is the reason ViT cuts images into patches.
- **Self-attention:** $Q$, $K$, $V$ all come from the same sequence (this post).
- **Cross-attention:** $Q$ from one sequence, $K, V$ from another (action expert reading the VLM: see [cross-attention](cross-attention.html)).

**Carry forward:** attention alone only mixes vectors. The [Transformer](transformer.html) stacks it with feed-forward layers and residual connections.

**Check question:** Same setup, but $x_1 = [2, 0]$, $x_2 = [0, 1]$. What is the first score $q_1 \cdot k_1$ before dividing by $\sqrt{d}$?

<details markdown="1">
<summary>Answer</summary>

$q_1 \cdot k_1 = 2 \times 2 + 0 \times 0 = 4$; $q_1 \cdot k_2 = 0$. Token 1 attends to itself much more strongly (after $/1.414$: 2.83 vs 0).
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Bahdanau, Cho, Bengio, *Neural Machine Translation by Jointly Learning to Align and Translate*, [arXiv 1409.0473](https://arxiv.org/abs/1409.0473) · 09/2014

**VẤN ĐỀ** Để sinh mỗi đầu ra, mô hình phải tìm ra mẩu đầu vào nào quan trọng.

**PAPER TRƯỚC HỎNG Ở ĐÂU** RNN encoder-decoder nén cả câu nguồn vào một vector độ dài cố định. Paper cho rằng đó là nút thắt cổ chai, và chất lượng giảm trên câu dài.

**Ý TƯỞNG** Giữ một vector cho mỗi vị trí đầu vào. Với mỗi đầu ra, chấm điểm mọi vị trí, softmax thành trọng số rồi lấy tổng có trọng số. Mô hình tự học nên nhìn vào đâu.

**KẾT QUẢ** Dịch tốt hơn trên câu dài. Về sau Transformer biến đây thành cơ chế duy nhất, mỗi token chú ý đến mọi token khác (self-attention).
</div>

## 1. Vấn đề: nút thắt kích thước cố định

[[flow]]
- Trước~RNN encoder-decoder | Câu nguồn > !Một vector cố định~mọi thông tin bị nén! > Decoder | đầu vào dài mất chi tiết
+ Attention | Token nguồn > *Một vector mỗi token~trọng số bằng softmax* > Decoder | mỗi đầu ra nhìn đúng chỗ cần
[[/flow]] Thay đổi là decoder không còn bị giới hạn bởi một vector tóm tắt.

## 2. Cơ chế

[[fig:attention]] Mỗi token tạo ra một query (cần gì), một key (có gì) và một value (mang gì). Điểm lấy từ query·key; softmax cho trọng số; đầu ra là tổ hợp có trọng số của các value.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| $W_Q, W_K, W_V$ | $X$ ($n \times d$) | $Q, K, V$ | ba góc nhìn học được của cùng các token |
| Điểm | $Q, K$ | ma trận $n \times n$ | mỗi query khớp mỗi key đến đâu |
| Chia $\sqrt{d}$ | điểm | điểm đã co | không cho giá trị lớn theo $d$ |
| Softmax | điểm đã co | trọng số, mỗi hàng tổng 1 | biến điểm thành phân phối |
| Trọng số × $V$ | trọng số, $V$ | đầu ra ($n \times d$) | vector token có ngữ cảnh |

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Attention cho ra gì với hai token? Ví dụ cho thấy đầu ra là một *trung bình có trọng số* của các value.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $x_1, x_2$ | vector token | input | $[1,0]$, $[0,1]$ |
| $Q = K = V$ | để ví dụ ngắn, dùng phép chiếu đơn vị | giả định | $= X$ |
| $d$ | cỡ vector | hằng số | 2 |
| $A$ | trọng số attention | output | – |
| $O$ | vector đầu ra | output | – |

**Công thức**

$$A = \mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d}}\right), \qquad O = A\,V$$

**Các bước** (token 1)

1. Điểm với $K$: $q_1 \cdot k_1 = 1$, $q_1 \cdot k_2 = 0$. Chia $\sqrt{2} = 1{,}414$: $[0{,}707,\ 0]$.
2. Hàm mũ: $e^{0{,}707} = 2{,}028$, $e^{0} = 1$. Tổng $= 3{,}028$.
3. Trọng số: $[2{,}028/3{,}028,\ 1/3{,}028] = [0{,}670,\ 0{,}330]$.
4. Đầu ra: $0{,}670\,[1,0] + 0{,}330\,[0,1] = [0{,}670,\ 0{,}330]$.

**Kết quả.** Token 1 giờ mang 67% chính nó và 33% token 2. Theo đối xứng, token 2 ra $[0{,}330, 0{,}670]$.

**Ý nghĩa.** Cả hai token thành vector chứa thông tin của token kia. Chia $\sqrt{d}$ để điểm không phình ra khi vector dài, nếu không softmax sẽ bão hòa thành one-hot.
</div>

## 3. Chi phí và biến thể

- $n$ token cho ma trận điểm $n \times n$: $N^2$ cặp. Đây là lý do ViT cắt ảnh thành patch.
- **Self-attention:** $Q$, $K$, $V$ đều từ cùng một chuỗi (bài này).
- **Cross-attention:** $Q$ từ chuỗi này, $K, V$ từ chuỗi khác (action expert đọc VLM: xem [cross-attention](cross-attention.html)).

**Mang theo:** attention chỉ trộn các vector. [Transformer](transformer.html) xếp nó cùng lớp feed-forward và kết nối residual.

**Câu hỏi kiểm tra:** Cùng thiết lập, nhưng $x_1 = [2, 0]$, $x_2 = [0, 1]$. Điểm đầu $q_1 \cdot k_1$ trước khi chia $\sqrt{d}$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$q_1 \cdot k_1 = 2 \times 2 + 0 \times 0 = 4$; $q_1 \cdot k_2 = 0$. Token 1 chú ý đến chính nó mạnh hơn nhiều (sau khi chia $1{,}414$: 2,83 so với 0).
</details>
:::
