---
slug: moe
date: 2026-10-21
title_en: "Mixture of Experts: Many Sub-Networks, Only One at a Time"
title_vi: "Mixture of Experts: Nhiều mạng con, mỗi lúc chỉ dùng một"
excerpt_en: "A dense layer uses every parameter for every token. A sparse mixture of experts keeps several expert networks and lets a router pick one per token, adding capacity without adding compute. Router and load-balancing loss worked by hand, and why π0's 'action expert' is something else."
excerpt_vi: "Một lớp dày đặc dùng mọi tham số cho mọi token. Mixture of experts thưa giữ nhiều mạng chuyên gia và để một router chọn một mạng cho mỗi token, thêm sức chứa mà không thêm tính toán. Tính tay router và loss cân bằng tải, và vì sao 'action expert' của π0 là một thứ khác."
tags: [VLA, Foundations, MoE, Force]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Shazeer et al., *Sparsely-Gated Mixture-of-Experts Layer*, [arXiv 1701.06538](https://arxiv.org/abs/1701.06538) · 01/2017. Switch Transformers, [arXiv 2101.03961](https://arxiv.org/abs/2101.03961) · 01/2021

**PROBLEM** More parameters store more knowledge, but in a normal (dense) layer every parameter is used for every token, so compute grows with size. In robotics there is a second wish: different situations (free motion, first contact, sliding) may need different processing.

**WHAT FAILED BEFORE** Dense networks: capacity and compute rise together. Earlier mixture-of-experts work had the right idea but suffered from complexity, communication cost and training instability, which Switch Transformers set out to fix.

**IDEA** Keep $N$ expert networks and a small router. For each token the router scores the experts and only the top $k$ (often $k = 1$) run. An auxiliary loss keeps the experts evenly used.

**RESULT** Shazeer et al. report over 1000× more capacity with minor efficiency loss; Switch Transformers up to 7× faster pre-training at equal compute. In force VLAs: ForceVLA (4 experts, top-1), MoDE-VLA (8 experts, top-1), CR-VLA-Force (4 experts) route force and vision tokens through sparse MoEs.
</div>

## 1. The problem: capacity costs compute

[[flow]]
- Before~Dense layer | Every token > !All parameters used~cost grows with size! > Output | bigger model, slower model
+ Sparse MoE | Every token > *Router picks 1 of N experts~N× parameters, 1× compute* > Output | capacity without the cost
[[/flow]] The change is conditional computation: which parameters run depends on the token.

## 2. The layer

[[fig:moe]] The router turns a token into probabilities over experts; only the chosen expert runs, and its output is scaled by the router's probability so the router still gets a gradient.

| Block | Input | Output | Role |
|---|---|---|---|
| Router $W_r$ | token $x$ | $N$ probabilities | which expert should handle this token |
| Top-$k$ | probabilities | chosen expert(s) | sparsity: the others do not run |
| Expert $E_i$ | token $x$ | vector | a normal feed-forward network |
| Combine | $p_i$, $E_i(x)$ | $p_i E_i(x)$, added to $x$ | gating keeps the router trainable |
| Balancing loss | routing statistics of a batch | scalar | stops one expert from taking everything |

<div class="calc" markdown="1">
Calculation card

**What and why.** Route one token, then check whether a batch is balanced. The second part shows what the auxiliary loss rewards.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $r$ | router logits for 4 experts | input | $(2.0,\ 0.5,\ 0.1,\ -1.0)$ (illustrative) |
| $p$ | router probabilities | output | – |
| $f_i$ | share of the batch's tokens sent to expert $i$ | input | $(0.5,\ 0.25,\ 0.25,\ 0)$ |
| $P_i$ | average router probability for expert $i$ | input | $(0.4,\ 0.3,\ 0.2,\ 0.1)$ |
| $\alpha$ | loss weight | constant | 0.01 (the value Switch Transformers use) |
| $L_{bal}$ | balancing loss | output | – |

**Formulas**

$$p = \mathrm{softmax}(r), \qquad L_{bal} = \alpha\,N \sum_{i=1}^{N} f_i\,P_i$$

**Steps**

1. $e^{2.0} = 7.389$, $e^{0.5} = 1.649$, $e^{0.1} = 1.105$, $e^{-1.0} = 0.368$; sum $= 10.511$.
2. $p = (0.703,\ 0.157,\ 0.105,\ 0.035)$. Top-1 picks expert 1; the layer outputs $0.703 \times E_1(x)$.
3. Unbalanced batch: $\sum f_i P_i = 0.5 \times 0.4 + 0.25 \times 0.3 + 0.25 \times 0.2 + 0 = 0.325$; $L_{bal} = 0.01 \times 4 \times 0.325 = 0.013$.
4. Perfectly balanced batch, all $f_i = P_i = 0.25$: $\sum = 4 \times 0.0625 = 0.25$; $L_{bal} = 0.010$.

**Result.** The token goes to expert 1 with weight 0.703. The unbalanced batch costs 0.013, the balanced one the minimum 0.010.

**Why it matters.** Routing is self-reinforcing: an expert that gets more tokens trains faster, becomes better, and gets even more tokens. Multiplying the share of tokens $f$ by the router's own probability $P$ penalises exactly that concentration and is smallest when work is spread evenly.
</div>

## 3. Two things called "expert" in VLAs

- **Sparse MoE (this post).** Several feed-forward experts, a router, one or a few active per token. ForceVLA's FVLMoE fuses a force token with the VLM tokens this way, and its analysis shows experts specialising by task phase; MoDE-VLA routes force and touch through an 8-expert sparse path added as a residual.
- **π0's "action expert" is not a sparse MoE.** It is a second set of Transformer weights that always processes the action tokens, while the VLM weights process image and text. Every token always goes to its own set; there is no router. The name means "separate weights per kind of token", sometimes called a mixture of transformers.

**Carry forward:** a router chooses among a few discrete options. Another way to make continuous signals discrete, with a learned codebook instead of a router: [VQ-VAE](vq-vae.html).

**Check question:** Router logits $(1.0,\ 1.0,\ 0.0,\ 0.0)$. What are the probabilities, and which expert does top-1 choose?

<details markdown="1">
<summary>Answer</summary>

$e^1 = 2.718$ twice, $e^0 = 1$ twice; sum $= 7.437$. $p = (0.366,\ 0.366,\ 0.134,\ 0.134)$. Experts 1 and 2 tie; implementations break the tie by index, so top-1 picks expert 1 with weight 0.366.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Shazeer và cộng sự, *Sparsely-Gated Mixture-of-Experts Layer*, [arXiv 1701.06538](https://arxiv.org/abs/1701.06538) · 01/2017. Switch Transformers, [arXiv 2101.03961](https://arxiv.org/abs/2101.03961) · 01/2021

**VẤN ĐỀ** Nhiều tham số hơn thì chứa được nhiều kiến thức hơn, nhưng trong một lớp bình thường (dày đặc), mọi tham số được dùng cho mọi token, nên chi phí tính toán tăng theo kích thước. Trong robot còn một mong muốn thứ hai: những tình huống khác nhau (chuyển động tự do, lúc vừa chạm, lúc trượt) có thể cần cách xử lý khác nhau.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Mạng dày đặc: sức chứa và tính toán tăng cùng nhau. Các công trình mixture-of-experts trước đó có ý tưởng đúng nhưng vướng sự phức tạp, chi phí truyền thông và huấn luyện bất ổn, những thứ mà Switch Transformers đặt mục tiêu sửa.

**Ý TƯỞNG** Giữ $N$ mạng chuyên gia và một router nhỏ. Với mỗi token, router chấm điểm các chuyên gia và chỉ $k$ chuyên gia điểm cao nhất (thường $k = 1$) được chạy. Một loss phụ giữ cho các chuyên gia được dùng đều nhau.

**KẾT QUẢ** Shazeer và cộng sự báo cáo sức chứa tăng hơn 1000 lần mà hiệu quả chỉ giảm nhẹ; Switch Transformers pretrain nhanh tới 7 lần với cùng lượng tính toán. Trong VLA có lực: ForceVLA (4 chuyên gia, top-1), MoDE-VLA (8 chuyên gia, top-1), CR-VLA-Force (4 chuyên gia) đưa token lực và token thị giác qua các MoE thưa.
</div>

## 1. Vấn đề: sức chứa thì tốn tính toán

[[flow]]
- Trước~Lớp dày đặc | Mọi token > !Dùng mọi tham số~chi phí tăng theo kích thước! > Đầu ra | mô hình lớn hơn, chậm hơn
+ MoE thưa | Mọi token > *Router chọn 1 trong N chuyên gia~N lần tham số, 1 lần tính toán* > Đầu ra | có sức chứa mà không tốn thêm
[[/flow]] Thay đổi là tính toán có điều kiện: tham số nào chạy phụ thuộc vào token.

## 2. Lớp MoE

[[fig:moe]] Router biến một token thành xác suất trên các chuyên gia; chỉ chuyên gia được chọn chạy, và đầu ra của nó được nhân với xác suất của router để router vẫn nhận được gradient.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Router $W_r$ | token $x$ | $N$ xác suất | chuyên gia nào nên xử lý token này |
| Top-$k$ | các xác suất | chuyên gia được chọn | tính thưa: các chuyên gia khác không chạy |
| Chuyên gia $E_i$ | token $x$ | vector | một mạng feed-forward bình thường |
| Kết hợp | $p_i$, $E_i(x)$ | $p_i E_i(x)$, cộng vào $x$ | nhân với cổng giữ cho router học được |
| Loss cân bằng | thống kê định tuyến của một batch | một số | ngăn một chuyên gia ôm hết mọi việc |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Định tuyến một token, rồi kiểm tra xem một batch có cân bằng không. Phần thứ hai cho thấy loss phụ thưởng cho điều gì.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $r$ | logit của router cho 4 chuyên gia | input | $(2{,}0;\ 0{,}5;\ 0{,}1;\ -1{,}0)$ (minh họa) |
| $p$ | xác suất của router | output | – |
| $f_i$ | tỉ lệ token trong batch được gửi tới chuyên gia $i$ | input | $(0{,}5;\ 0{,}25;\ 0{,}25;\ 0)$ |
| $P_i$ | xác suất router trung bình cho chuyên gia $i$ | input | $(0{,}4;\ 0{,}3;\ 0{,}2;\ 0{,}1)$ |
| $\alpha$ | trọng số loss | hằng số | 0,01 (giá trị Switch Transformers dùng) |
| $L_{bal}$ | loss cân bằng | output | – |

**Công thức**

$$p = \mathrm{softmax}(r), \qquad L_{bal} = \alpha\,N \sum_{i=1}^{N} f_i\,P_i$$

**Từng bước**

1. $e^{2{,}0} = 7{,}389$, $e^{0{,}5} = 1{,}649$, $e^{0{,}1} = 1{,}105$, $e^{-1{,}0} = 0{,}368$; tổng $= 10{,}511$.
2. $p = (0{,}703;\ 0{,}157;\ 0{,}105;\ 0{,}035)$. Top-1 chọn chuyên gia 1; lớp xuất ra $0{,}703 \times E_1(x)$.
3. Batch lệch: $\sum f_i P_i = 0{,}5 \times 0{,}4 + 0{,}25 \times 0{,}3 + 0{,}25 \times 0{,}2 + 0 = 0{,}325$; $L_{bal} = 0{,}01 \times 4 \times 0{,}325 = 0{,}013$.
4. Batch cân bằng hoàn hảo, mọi $f_i = P_i = 0{,}25$: $\sum = 4 \times 0{,}0625 = 0{,}25$; $L_{bal} = 0{,}010$.

**Kết quả.** Token đi tới chuyên gia 1 với trọng số 0,703. Batch lệch tốn 0,013, batch cân bằng đạt mức nhỏ nhất 0,010.

**Ý nghĩa.** Việc định tuyến tự củng cố: chuyên gia nhận nhiều token hơn thì học nhanh hơn, giỏi hơn, rồi nhận càng nhiều token. Nhân tỉ lệ token $f$ với chính xác suất $P$ của router phạt đúng sự dồn cục đó, và nhỏ nhất khi việc được chia đều.
</div>

## 3. Hai thứ được gọi là "expert" trong VLA

- **MoE thưa (bài này).** Nhiều chuyên gia feed-forward, một router, một hoặc vài chuyên gia hoạt động cho mỗi token. FVLMoE của ForceVLA trộn một token lực với các token VLM theo cách này, và phân tích của nó cho thấy các chuyên gia chuyên hóa theo giai đoạn của tác vụ; MoDE-VLA đưa lực và xúc giác qua một đường MoE thưa 8 chuyên gia, cộng vào dạng residual.
- **"Action expert" của π0 không phải MoE thưa.** Đó là một bộ trọng số Transformer thứ hai luôn xử lý các token hành động, trong khi trọng số của VLM xử lý token ảnh và chữ. Mỗi token luôn đi vào đúng bộ của nó; không có router. Cái tên có nghĩa là "mỗi loại token một bộ trọng số riêng", đôi khi được gọi là mixture of transformers.

**Mang theo:** router chọn giữa vài phương án rời rạc. Một cách khác để biến tín hiệu liên tục thành rời rạc, bằng một codebook học được thay vì router: [VQ-VAE](vq-vae.html).

**Câu kiểm tra:** Logit router $(1{,}0;\ 1{,}0;\ 0{,}0;\ 0{,}0)$. Xác suất là bao nhiêu, và top-1 chọn chuyên gia nào?

<details markdown="1">
<summary>Đáp án</summary>

$e^1 = 2{,}718$ hai lần, $e^0 = 1$ hai lần; tổng $= 7{,}437$. $p = (0{,}366;\ 0{,}366;\ 0{,}134;\ 0{,}134)$. Chuyên gia 1 và 2 hòa nhau; các cài đặt phá thế hòa theo chỉ số, nên top-1 chọn chuyên gia 1 với trọng số 0,366.
</details>
:::
