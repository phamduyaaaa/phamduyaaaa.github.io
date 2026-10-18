---
slug: transformer
date: 2026-10-18
title_en: "Transformer: Attention Without Recurrence"
title_vi: "Transformer: Attention không cần hồi quy"
excerpt_en: "RNNs read tokens one by one, so they cannot run in parallel and distant tokens are many steps apart. The Transformer stacks self-attention and feed-forward blocks so every token sees every other in one hop."
excerpt_vi: "RNN đọc từng token một nên không chạy song song được và hai token xa nhau cách nhiều bước. Transformer xếp chồng self-attention và feed-forward để mọi token thấy mọi token khác chỉ trong một bước."
tags: [VLA, Foundations, Transformer, Attention]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Vaswani et al., *Attention Is All You Need*, [arXiv 1706.03762](https://arxiv.org/abs/1706.03762) · 06/2017

**PROBLEM** Sequence models must connect distant tokens and train fast on big data.

**WHAT FAILED BEFORE** Recurrent networks (LSTM, GRU) process token $t$ only after token $t-1$. Training cannot be parallelised along the sequence, and information between two far tokens must pass through many steps. Attention was used, but only on top of the RNN.

**IDEA** Drop the recurrence. Use self-attention to mix tokens, a feed-forward layer per token, residual connections and layer norm, and add position information because attention itself has no order.

**RESULT** 28.4 BLEU on WMT14 English→German (the paper's headline), with far less training cost than recurrent models. Every VLA backbone since is a Transformer.
</div>

## 1. The problem: sequential and far apart

[[flow]]
- Before~RNN / LSTM | Token 1 > !Token 2~waits for token 1! > !Token n~n steps from token 1! | cannot parallelise; long path
+ Transformer | All tokens > *Self-attention~every pair in one layer* > All outputs at once | path length 1
[[/flow]] The change is that the n tokens are processed together and any two are connected directly.

[[bars:steps]] RNN, token 1 to token 256=256; *Self-attention=1* || Maximum steps between two positions for a 256-token sequence.

## 2. The block

[[fig:transformer]] One block = multi-head self-attention, then a per-token feed-forward network. Each is wrapped by "add the input back" (residual) and layer norm. The stack repeats this N times.

| Block | Input | Output | Role |
|---|---|---|---|
| Position info | token vectors | vectors with order | attention is order-blind, so add positions |
| Multi-head self-attention | $n \times d$ | $n \times d$ | several attention "views" in parallel; tokens exchange information |
| Add + Norm | $x$, sublayer($x$) | $x + $ sublayer($x$), normalised | keeps gradients flowing in deep stacks |
| Feed-forward | $n \times d$ | $n \times d$ | same small MLP applied to each token |

The base model in the paper: $d = 512$, 8 heads, feed-forward width 2048, 6 layers.

<div class="calc" markdown="1">

Calculation card

**What and why.** Why is self-attention better than a recurrent layer for long sequences with fast hardware? Compare the cost of a layer and the path between positions (the paper's Table 1).

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n$ | sequence length | input | 256 |
| $d$ | vector size | input | 512 (paper's base model) |
| $C_{attn}$ | operations in self-attention | output | – |
| $C_{rnn}$ | operations in a recurrent layer | output | – |

**Formula** (per layer, up to constants)

$$C_{attn} = n^2 d \ (\text{sequential steps } O(1)) \qquad C_{rnn} = n\, d^2 \ (\text{sequential steps } O(n))$$

**Steps**

1. $C_{attn} = 256^2 \times 512 = 65{,}536 \times 512 = 33{,}554{,}432$.
2. $C_{rnn} = 256 \times 512^2 = 256 \times 262{,}144 = 67{,}108{,}864$.
3. Sequential steps: attention 1, recurrent 256.

**Result.** For $n = 256 < d = 512$, attention needs about half the operations of the RNN, and they can all run at once; the RNN's 256 steps must run in order.

**Why it matters.** Attention wins when $n < d$. When $n$ becomes large, $n^2$ explodes. That is why images are cut into patches (ViT) and why long contexts are costly.
</div>

## 3. Why VLAs use it

- A VLA puts image tokens, text tokens and action tokens in one sequence; one Transformer lets them all attend to each other.
- Variants you will meet: decoder-only (next-token prediction, e.g. language models), encoder (ViT), and the action expert of π0, a smaller Transformer that reads the VLM's tokens.

**Carry forward:** a Transformer is a general sequence machine. Next, how to make it *generate continuous actions*: [Flow matching](flowmatching.html).

**Check question:** $n = 1024$, $d = 512$. Which is cheaper per layer, attention or RNN?

<details markdown="1">
<summary>Answer</summary>

$C_{attn} = 1024^2 \times 512 = 536{,}870{,}912$; $C_{rnn} = 1024 \times 512^2 = 268{,}435{,}456$. Now the RNN needs half the operations, because $n > d$; but attention is still parallel and has path length 1.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Vaswani et al., *Attention Is All You Need*, [arXiv 1706.03762](https://arxiv.org/abs/1706.03762) · 06/2017

**VẤN ĐỀ** Mô hình chuỗi phải nối các token xa nhau và huấn luyện nhanh trên dữ liệu lớn.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Mạng hồi quy (LSTM, GRU) chỉ xử lý token $t$ sau khi xong token $t-1$. Không song song hóa được theo chiều chuỗi, và thông tin giữa hai token xa phải đi qua nhiều bước. Attention đã được dùng, nhưng chỉ đặt trên RNN.

**Ý TƯỞNG** Bỏ hồi quy. Dùng self-attention để trộn token, một lớp feed-forward cho từng token, kết nối residual và layer norm, cộng thêm thông tin vị trí vì bản thân attention không biết thứ tự.

**KẾT QUẢ** 28,4 BLEU trên WMT14 Anh→Đức (số nổi bật của paper), với chi phí huấn luyện thấp hơn nhiều so với mô hình hồi quy. Mọi backbone VLA từ đó đều là Transformer.
</div>

## 1. Vấn đề: tuần tự và cách xa nhau

[[flow]]
- Trước~RNN / LSTM | Token 1 > !Token 2~chờ token 1! > !Token n~cách token 1 n bước! | không song song được; đường đi dài
+ Transformer | Mọi token > *Self-attention~mọi cặp trong một lớp* > Mọi đầu ra cùng lúc | đường đi dài 1
[[/flow]] Thay đổi là n token được xử lý cùng lúc và hai token bất kỳ nối trực tiếp với nhau.

[[bars:bước]] RNN, token 1 đến token 256=256; *Self-attention=1* || Số bước tối đa giữa hai vị trí với chuỗi 256 token.

## 2. Khối cơ bản

[[fig:transformer]] Một khối = self-attention nhiều đầu, rồi mạng feed-forward cho từng token. Mỗi phần được bọc bởi "cộng đầu vào trở lại" (residual) và layer norm. Chồng này lặp N lần.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Thông tin vị trí | vector token | vector có thứ tự | attention không biết thứ tự nên phải cộng vị trí |
| Self-attention nhiều đầu | $n \times d$ | $n \times d$ | nhiều "góc nhìn" attention song song; token trao đổi thông tin |
| Add + Norm | $x$, sublayer($x$) | $x + $ sublayer($x$), đã chuẩn hóa | giữ gradient chảy trong chồng sâu |
| Feed-forward | $n \times d$ | $n \times d$ | cùng một MLP nhỏ áp cho từng token |

Mô hình base trong paper: $d = 512$, 8 đầu, độ rộng feed-forward 2048, 6 lớp.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Vì sao self-attention tốt hơn lớp hồi quy với chuỗi dài trên phần cứng nhanh? So chi phí một lớp và đường đi giữa các vị trí (Bảng 1 của paper).

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n$ | độ dài chuỗi | input | 256 |
| $d$ | cỡ vector | input | 512 (mô hình base của paper) |
| $C_{attn}$ | số phép tính của self-attention | output | – |
| $C_{rnn}$ | số phép tính của lớp hồi quy | output | – |

**Công thức** (mỗi lớp, sai khác hằng số)

$$C_{attn} = n^2 d \ (\text{số bước tuần tự } O(1)) \qquad C_{rnn} = n\, d^2 \ (\text{số bước tuần tự } O(n))$$

**Các bước**

1. $C_{attn} = 256^2 \times 512 = 65\,536 \times 512 = 33\,554\,432$.
2. $C_{rnn} = 256 \times 512^2 = 256 \times 262\,144 = 67\,108\,864$.
3. Số bước tuần tự: attention 1, hồi quy 256.

**Kết quả.** Với $n = 256 < d = 512$, attention cần khoảng một nửa số phép tính của RNN, và chạy được tất cả cùng lúc; 256 bước của RNN phải chạy lần lượt.

**Ý nghĩa.** Attention thắng khi $n < d$. Khi $n$ rất lớn, $n^2$ bùng nổ. Vì vậy ảnh được cắt thành patch (ViT) và ngữ cảnh dài tốn kém.
</div>

## 3. Vì sao VLA dùng nó

- VLA đặt token ảnh, token chữ và token hành động vào một chuỗi; một Transformer cho chúng chú ý lẫn nhau.
- Các biến thể sẽ gặp: decoder-only (dự đoán token kế tiếp, như mô hình ngôn ngữ), encoder (ViT), và action expert của π0, một Transformer nhỏ đọc token của VLM.

**Mang theo:** Transformer là cỗ máy chuỗi tổng quát. Tiếp theo: làm sao để nó *sinh hành động liên tục*: [Flow matching](flowmatching.html).

**Câu hỏi kiểm tra:** $n = 1024$, $d = 512$. Mỗi lớp, attention hay RNN rẻ hơn?

<details markdown="1">
<summary>Đáp án</summary>

$C_{attn} = 1024^2 \times 512 = 536\,870\,912$; $C_{rnn} = 1024 \times 512^2 = 268\,435\,456$. Lúc này RNN cần ít phép tính hơn một nửa, vì $n > d$; nhưng attention vẫn song song và có đường đi dài 1.
</details>
:::
