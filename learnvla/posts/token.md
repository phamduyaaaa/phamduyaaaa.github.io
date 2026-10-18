---
slug: token
date: 2026-10-18
title_en: "Token: One Currency for Text, Images and Actions"
title_vi: "Token: Một đơn vị chung cho chữ, ảnh và hành động"
excerpt_en: "A token is a small piece of input turned into a vector by table lookup. Once text, image patches and actions are all tokens, one Transformer can read them together. Worked example: turning an action value into a token id."
excerpt_vi: "Token là một mẩu đầu vào nhỏ được đổi thành vector bằng tra bảng. Khi chữ, patch ảnh và hành động đều là token, một Transformer đọc được tất cả. Ví dụ tính tay: đổi một giá trị hành động thành id token."
tags: [VLA, Foundations, Token, Tokenizer]
---

:::en
<div class="tldr" markdown="1">
**CONCEPT** Token. No single paper; the text version is byte-pair encoding, [arXiv 1508.07909](https://arxiv.org/abs/1508.07909) · 08/2015

**PROBLEM** A neural network eats numbers. Text is characters, images are pixels, actions are joint values. Each needs a way into the same network.

**WHAT FAILED BEFORE** One specialised model per modality (a CNN for images, an RNN for text, a regression head for actions), glued by hand. Words as units fail on rare words; characters as units make sequences very long.

**IDEA** Cut every input into small pieces, give each piece an integer id, and look up its vector in a learned table. A sequence of vectors is all a Transformer needs.

**RESULT** A VLA reads "pick up the cup" (text tokens), 196 image-patch tokens and action tokens in one sequence.
</div>

## 1. The problem: three modalities, one network

[[flow]]
- Before~Separate models | Text, image, action > !One model each~RNN, CNN, regression head! > Fusion by hand | glued together manually
+ Tokens | Text / image / action > *Cut into pieces → ids~lookup table* > One Transformer | one sequence, one model
[[/flow]] The change is the shared interface: everything becomes a list of vectors of the same size $d$.

## 2. Three ways to make a token

| Modality | Piece | How | Count (example) |
|---|---|---|---|
| Text | sub-word | BPE: merge the most frequent symbol pairs | a short sentence: a few to ~10 |
| Image | patch | cut into squares, flatten, project ([ViT](vit.html)) | 224×224 with 16×16 patches: 196 |
| Action | bin | quantise each action dimension ([action tokenization](action-tokenization.html)) | one token per dimension per step |

[[bars:tokens]] One token per pixel=50176; *16×16 patches=196* || Tokens for a 224×224 image. Patches cut the count by 256×.

<div class="calc" markdown="1">

Calculation card

**What and why.** How is a continuous action value turned into a token id, and how much is lost? This is the simplest "action tokenizer", binning (used with 256 bins per dimension in RT-1/RT-2-style models).

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $a$ | one action dimension, in $[-1, 1]$ | input | 0.30 |
| $K$ | number of bins | constant | 256 |
| $i$ | token id | output | – |
| $\hat a$ | value decoded from the id | output | – |

**Formula**

$$i = \left\lfloor \frac{a+1}{2}\,K \right\rfloor \qquad \hat a = \frac{i + 0.5}{K}\cdot 2 - 1$$

**Steps**

1. $(0.30 + 1)/2 = 0.65$.
2. $0.65 \times 256 = 166.4$, so $i = 166$.
3. Decode: $(166 + 0.5)/256 = 0.6504$, then $0.6504 \times 2 - 1 = 0.3008$.

**Result.** The value 0.30 becomes token id 166 and decodes back to 0.3008. Error 0.0008.

**Why it matters.** The worst error is half a bin, $1/K = 0.0039$. More bins give a finer action but a bigger vocabulary; fewer bins are coarse. This is why later work such as FAST compresses whole action chunks instead.
</div>

## 3. From id to vector

The id is just a row number. A table $E$ of shape (vocabulary size $V$) × ($d$) is learned with the model; the token's vector is row $i$ of $E$.

Example with $V = 5$, $d = 3$: ids $[2, 4]$ pick rows 2 and 4 of $E$ and give a $2 \times 3$ matrix. No arithmetic, only lookup.

**Carry forward:** a sequence of vectors still has no way for tokens to talk to each other. That is [Attention](attention.html).

**Check question:** $a = -0.5$, $K = 256$. What is $i$?

<details markdown="1">
<summary>Answer</summary>

$(-0.5 + 1)/2 = 0.25$; $0.25 \times 256 = 64$; $i = 64$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**KHÁI NIỆM** Token. Không có paper riêng; bản cho văn bản là byte-pair encoding, [arXiv 1508.07909](https://arxiv.org/abs/1508.07909) · 08/2015

**VẤN ĐỀ** Mạng nơ-ron ăn số. Văn bản là ký tự, ảnh là pixel, hành động là giá trị khớp. Mỗi thứ cần một đường vào cùng một mạng.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Mỗi phương thức một mô hình riêng (CNN cho ảnh, RNN cho chữ, đầu hồi quy cho hành động) rồi ghép bằng tay. Dùng từ làm đơn vị thì thất bại với từ hiếm; dùng ký tự thì chuỗi quá dài.

**Ý TƯỞNG** Cắt mọi đầu vào thành các mẩu nhỏ, gán mỗi mẩu một id nguyên, rồi tra vector của nó trong một bảng học được. Một dãy vector là tất cả những gì Transformer cần.

**KẾT QUẢ** VLA đọc "pick up the cup" (token chữ), 196 token patch ảnh và token hành động trong cùng một chuỗi.
</div>

## 1. Vấn đề: ba phương thức, một mạng

[[flow]]
- Trước~Mô hình riêng | Chữ, ảnh, hành động > !Mỗi thứ một mô hình~RNN, CNN, đầu hồi quy! > Ghép bằng tay | phải ghép thủ công
+ Token | Chữ / ảnh / hành động > *Cắt thành mẩu → id~bảng tra* > Một Transformer | một chuỗi, một mô hình
[[/flow]] Thay đổi nằm ở giao diện chung: mọi thứ thành một danh sách vector cùng kích thước $d$.

## 2. Ba cách tạo token

| Phương thức | Mẩu | Cách làm | Số lượng (ví dụ) |
|---|---|---|---|
| Chữ | sub-word | BPE: gộp các cặp ký hiệu hay gặp nhất | một câu ngắn: vài đến ~10 |
| Ảnh | patch | cắt ô vuông, duỗi phẳng, chiếu ([ViT](vit.html)) | 224×224 patch 16×16: 196 |
| Hành động | bin | lượng tử hóa từng chiều ([action tokenization](action-tokenization.html)) | một token mỗi chiều mỗi bước |

[[bars:token]] Một token mỗi pixel=50176; *patch 16×16=196* || Số token của ảnh 224×224. Patch giảm số token 256 lần.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Một giá trị hành động liên tục được đổi thành id token thế nào, và mất bao nhiêu? Đây là "tokenizer hành động" đơn giản nhất, chia bin (256 bin mỗi chiều như các mô hình kiểu RT-1/RT-2).

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $a$ | một chiều hành động, trong $[-1, 1]$ | input | 0,30 |
| $K$ | số bin | hằng số | 256 |
| $i$ | id token | output | – |
| $\hat a$ | giá trị giải mã từ id | output | – |

**Công thức**

$$i = \left\lfloor \frac{a+1}{2}\,K \right\rfloor \qquad \hat a = \frac{i + 0{,}5}{K}\cdot 2 - 1$$

**Các bước**

1. $(0{,}30 + 1)/2 = 0{,}65$.
2. $0{,}65 \times 256 = 166{,}4$, nên $i = 166$.
3. Giải mã: $(166 + 0{,}5)/256 = 0{,}6504$, rồi $0{,}6504 \times 2 - 1 = 0{,}3008$.

**Kết quả.** Giá trị 0,30 thành token id 166 và giải mã lại 0,3008. Sai số 0,0008.

**Ý nghĩa.** Sai số tệ nhất là nửa bin, $1/K = 0{,}0039$. Nhiều bin thì hành động mịn hơn nhưng từ vựng lớn hơn; ít bin thì thô. Vì vậy các công trình sau như FAST nén cả đoạn hành động thay vì chia bin.
</div>

## 3. Từ id đến vector

Id chỉ là số thứ tự hàng. Một bảng $E$ kích thước (cỡ từ vựng $V$) × ($d$) được học cùng mô hình; vector của token là hàng $i$ của $E$.

Ví dụ $V = 5$, $d = 3$: các id $[2, 4]$ lấy hàng 2 và 4 của $E$, cho ma trận $2 \times 3$. Không có phép tính, chỉ tra bảng.

**Mang theo:** một chuỗi vector vẫn chưa cho các token nói chuyện với nhau. Đó là [Attention](attention.html).

**Câu hỏi kiểm tra:** $a = -0{,}5$, $K = 256$. $i$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$(-0{,}5 + 1)/2 = 0{,}25$; $0{,}25 \times 256 = 64$; $i = 64$.
</details>
:::
