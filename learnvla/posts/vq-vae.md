---
slug: vq-vae
date: 2026-10-21
title_en: "VQ-VAE: Learning a Codebook of Discrete Tokens"
title_vi: "VQ-VAE: Học một codebook các token rời rạc"
excerpt_en: "Bins cut a signal on a fixed grid; a VQ-VAE learns where its codes should be. The encoder's output snaps to the nearest codebook vector, and a stop-gradient trick lets the whole thing train. Worked by hand, and where force and touch papers use it."
excerpt_vi: "Bin cắt tín hiệu theo một lưới cố định; VQ-VAE tự học xem các mã nên nằm ở đâu. Đầu ra của encoder bị kéo về vector codebook gần nhất, và một mẹo dừng gradient giúp cả hệ huấn luyện được. Tính tay, và các bài lực, xúc giác dùng nó ở đâu."
tags: [VLA, Foundations, VQ-VAE, Tokenizer]
---

:::en
<div class="tldr" markdown="1">
**PAPER** van den Oord, Vinyals, Kavukcuoglu, *Neural Discrete Representation Learning*, [arXiv 1711.00937](https://arxiv.org/abs/1711.00937) · 11/2017

**PROBLEM** We want discrete tokens for continuous signals (images, action chunks, force windows), so that a Transformer can read them as words and noise is rounded away, and we want the tokens chosen from data, not from a fixed grid.

**WHAT FAILED BEFORE** Fixed bins waste codes on values that never occur and do not capture patterns across dimensions. Continuous VAEs paired with a powerful decoder suffer "posterior collapse": the decoder learns to ignore the latent.

**IDEA** Keep a learnable codebook of $K$ vectors. The encoder's output is replaced by the nearest codebook vector, the decoder reconstructs from it, and the gradient is copied straight through the non-differentiable snap. Two extra loss terms move the codebook toward the encoder and keep the encoder committed to the codebook.

**RESULT** High-quality images, video and speech from discrete codes, with no posterior collapse. On this site: TaF-VLA quantises force with two VQ codebooks; FACT and T-Rex quantise touch; GR00T N1 learns a latent-action codebook from videos without actions.
</div>

## 1. The problem: a fixed grid, or a code the decoder ignores

[[flow]]
- Before~Fixed bins | Each value > !Uniform grid~codes wasted on empty regions! > Tokens | no shared patterns across dimensions
- Before~Continuous VAE | Encoder > !Latent ignored~posterior collapse! > Powerful decoder | the code carries nothing
+ VQ-VAE | Encoder > *Snap to nearest learned code* > Decoder | codes go where the data is, and must carry information
[[/flow]] The change is that the grid itself is learned, and the decoder can only see the snapped code.

## 2. The mechanism

[[fig:vq-vae]] The encoder output snaps to the closest codebook vector, whose index is the token. In the backward pass the gradient jumps over the snap.

| Block | Input | Output | Role |
|---|---|---|---|
| Encoder | signal $x$ | $z_e$ | compress |
| Quantise | $z_e$, codebook $\{e_k\}$ | $z_q = e_{k^*}$, $k^* = \arg\min_k \lVert z_e - e_k\rVert$ | the discrete choice; $k^*$ is the token |
| Decoder | $z_q$ | $\hat x$ | reconstruct |
| Straight-through | gradient at $z_q$ | same gradient at $z_e$ | the snap has no derivative, so pretend it is the identity |

Loss, with $\mathrm{sg}$ meaning "treat as a constant":

$$L = \lVert x - \hat x\rVert^2 + \lVert \mathrm{sg}[z_e] - e_{k^*}\rVert^2 + \beta\,\lVert z_e - \mathrm{sg}[e_{k^*}]\rVert^2$$

<div class="calc" markdown="1">
Calculation card

**What and why.** Quantise one encoder output and compute the two extra loss terms, to see which part of the model each one moves.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $z_e$ | encoder output | input | $(0.9,\ 0.2)$ |
| $e_1, e_2, e_3$ | codebook vectors | weights | $(1, 0)$, $(0, 1)$, $(0.5, 0.5)$ |
| $\beta$ | commitment weight | constant | 0.25 (the paper's value) |
| $k^*$ | chosen code, the token | output | – |
| $L_{code},\ L_{commit}$ | codebook and commitment terms | output | – |

**Steps**

1. Squared distances: to $e_1$: $0.1^2 + 0.2^2 = 0.05$; to $e_2$: $0.9^2 + 0.8^2 = 1.45$; to $e_3$: $0.4^2 + 0.3^2 = 0.25$.
2. Nearest is $e_1$, so $k^* = 1$ and $z_q = (1, 0)$.
3. $L_{code} = \lVert \mathrm{sg}[z_e] - e_1\rVert^2 = 0.05$. Its gradient moves only $e_1$, toward $(0.9, 0.2)$.
4. $L_{commit} = 0.25 \times \lVert z_e - \mathrm{sg}[e_1]\rVert^2 = 0.25 \times 0.05 = 0.0125$. Its gradient moves only the encoder, toward $e_1$.

**Result.** Token 1; the code is pulled toward the data with weight 1 and the encoder toward the code with weight 0.25.

**Why it matters.** The two stop-gradients split one distance into two jobs: the codebook learns where the data lives, and the encoder learns not to wander away from the codebook. The paper found results unchanged for $\beta$ from 0.1 to 2.0. A known failure is codebook collapse, where only a few codes are ever chosen; TaF-VLA adds a reconstruction term partly for this reason.
</div>

## 3. Bins, VQ and FAST compared

| Tokenizer | Grid | Learns from data? | Typical use |
|---|---|---|---|
| Uniform bins | fixed, per dimension | only the range | RT-2, OpenVLA actions ([action tokenization](action-tokenization.html)) |
| FAST | DCT + rounding + BPE | the BPE merges | high-frequency action chunks |
| VQ-VAE | learned vectors, across dimensions | yes, the codes themselves | force windows (TaF-VLA), touch (FACT, T-Rex), latent actions (GR00T N1) |

The FAST paper notes a weakness of VQ for actions: reconstruction quality "can be sensitive to hyperparameter choices and structure", which is one reason it chose a fixed transform.

**Carry forward:** tokens and codes describe actions; generating a whole continuous chunk of actions is a different route. The first widely used one in robotics: [diffusion policy](diffusion-policy.html).

**Check question:** Same codebook, $z_e = (0.4, 0.6)$. Which code is chosen, and what is $L_{commit}$ with $\beta = 0.25$?

<details markdown="1">
<summary>Answer</summary>

To $e_1$: $0.36 + 0.36 = 0.72$; to $e_2$: $0.16 + 0.16 = 0.32$; to $e_3$: $0.01 + 0.01 = 0.02$. Code 3 is chosen; $L_{commit} = 0.25 \times 0.02 = 0.005$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** van den Oord, Vinyals, Kavukcuoglu, *Neural Discrete Representation Learning*, [arXiv 1711.00937](https://arxiv.org/abs/1711.00937) · 11/2017

**VẤN ĐỀ** Ta muốn token rời rạc cho tín hiệu liên tục (ảnh, chunk hành động, cửa sổ lực), để Transformer đọc chúng như chữ và nhiễu được làm tròn đi, và muốn các token được chọn từ dữ liệu chứ không từ một lưới cố định.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Bin cố định phí mã cho những giá trị không bao giờ xuất hiện và không nắm được mẫu hình trải qua nhiều chiều. VAE liên tục ghép với một decoder mạnh bị "sụp hậu nghiệm" (posterior collapse): decoder học cách phớt lờ latent.

**Ý TƯỞNG** Giữ một codebook học được gồm $K$ vector. Đầu ra của encoder được thay bằng vector codebook gần nhất, decoder dựng lại từ đó, và gradient được chép thẳng qua bước "kéo về" vốn không khả vi. Hai số hạng loss phụ kéo codebook về phía encoder và giữ encoder bám sát codebook.

**KẾT QUẢ** Ảnh, video và giọng nói chất lượng cao từ mã rời rạc, không bị sụp hậu nghiệm. Trên trang này: TaF-VLA lượng tử hóa lực bằng hai codebook VQ; FACT và T-Rex lượng tử hóa xúc giác; GR00T N1 học một codebook hành động ẩn từ video không có hành động.
</div>

## 1. Vấn đề: một lưới cố định, hoặc một mã bị decoder phớt lờ

[[flow]]
- Trước~Bin cố định | Từng giá trị > !Lưới đều~phí mã cho vùng trống! > Token | không có mẫu hình chung giữa các chiều
- Trước~VAE liên tục | Encoder > !Latent bị bỏ qua~sụp hậu nghiệm! > Decoder mạnh | mã không chở gì cả
+ VQ-VAE | Encoder > *Kéo về mã học được gần nhất* > Decoder | mã nằm đúng chỗ có dữ liệu, và buộc phải chở thông tin
[[/flow]] Thay đổi là chính cái lưới được học, và decoder chỉ thấy được mã đã kéo về.

## 2. Cơ chế

[[fig:vq-vae]] Đầu ra encoder bị kéo về vector codebook gần nhất, chỉ số của vector đó là token. Ở lượt lan truyền ngược, gradient nhảy qua bước kéo về.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Encoder | tín hiệu $x$ | $z_e$ | nén |
| Lượng tử hóa | $z_e$, codebook $\{e_k\}$ | $z_q = e_{k^*}$, $k^* = \arg\min_k \lVert z_e - e_k\rVert$ | lựa chọn rời rạc; $k^*$ là token |
| Decoder | $z_q$ | $\hat x$ | dựng lại |
| Straight-through | gradient tại $z_q$ | cùng gradient tại $z_e$ | bước kéo về không có đạo hàm, nên giả như nó là phép đồng nhất |

Hàm loss, với $\mathrm{sg}$ nghĩa là "coi như hằng số":

$$L = \lVert x - \hat x\rVert^2 + \lVert \mathrm{sg}[z_e] - e_{k^*}\rVert^2 + \beta\,\lVert z_e - \mathrm{sg}[e_{k^*}]\rVert^2$$

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Lượng tử hóa một đầu ra encoder và tính hai số hạng loss phụ, để thấy mỗi số hạng di chuyển phần nào của mô hình.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $z_e$ | đầu ra encoder | input | $(0{,}9;\ 0{,}2)$ |
| $e_1, e_2, e_3$ | các vector codebook | trọng số | $(1, 0)$, $(0, 1)$, $(0{,}5;\ 0{,}5)$ |
| $\beta$ | trọng số cam kết | hằng số | 0,25 (giá trị của paper) |
| $k^*$ | mã được chọn, tức token | output | – |
| $L_{code},\ L_{commit}$ | số hạng codebook và số hạng cam kết | output | – |

**Từng bước**

1. Bình phương khoảng cách: tới $e_1$: $0{,}1^2 + 0{,}2^2 = 0{,}05$; tới $e_2$: $0{,}9^2 + 0{,}8^2 = 1{,}45$; tới $e_3$: $0{,}4^2 + 0{,}3^2 = 0{,}25$.
2. Gần nhất là $e_1$, nên $k^* = 1$ và $z_q = (1, 0)$.
3. $L_{code} = \lVert \mathrm{sg}[z_e] - e_1\rVert^2 = 0{,}05$. Gradient của nó chỉ dời $e_1$, về phía $(0{,}9;\ 0{,}2)$.
4. $L_{commit} = 0{,}25 \times \lVert z_e - \mathrm{sg}[e_1]\rVert^2 = 0{,}25 \times 0{,}05 = 0{,}0125$. Gradient của nó chỉ dời encoder, về phía $e_1$.

**Kết quả.** Token 1; mã bị kéo về phía dữ liệu với trọng số 1 và encoder bị kéo về phía mã với trọng số 0,25.

**Ý nghĩa.** Hai phép dừng gradient chia một khoảng cách thành hai việc: codebook học xem dữ liệu nằm ở đâu, còn encoder học cách không đi lạc khỏi codebook. Paper thấy kết quả không đổi khi $\beta$ chạy từ 0,1 tới 2,0. Một lỗi đã biết là codebook sụp, khi chỉ vài mã được chọn; TaF-VLA thêm một số hạng dựng lại một phần vì lý do này.
</div>

## 3. So sánh bin, VQ và FAST

| Tokenizer | Lưới | Học từ dữ liệu? | Dùng điển hình |
|---|---|---|---|
| Bin đều | cố định, theo từng chiều | chỉ học khoảng giá trị | hành động của RT-2, OpenVLA ([action tokenization](action-tokenization.html)) |
| FAST | DCT + làm tròn + BPE | học các phép gộp BPE | chunk hành động tần số cao |
| VQ-VAE | các vector học được, trải qua nhiều chiều | có, học chính các mã | cửa sổ lực (TaF-VLA), xúc giác (FACT, T-Rex), hành động ẩn (GR00T N1) |

Paper FAST chỉ ra một điểm yếu của VQ với hành động: chất lượng dựng lại "có thể nhạy với các lựa chọn siêu tham số và cấu trúc", một lý do họ chọn một phép biến đổi cố định.

**Mang theo:** token và mã mô tả hành động; sinh cả một chunk hành động liên tục là một con đường khác. Con đường đầu tiên được dùng rộng rãi trong robot: [diffusion policy](diffusion-policy.html).

**Câu kiểm tra:** Cùng codebook, $z_e = (0{,}4;\ 0{,}6)$. Mã nào được chọn, và $L_{commit}$ bằng bao nhiêu với $\beta = 0{,}25$?

<details markdown="1">
<summary>Đáp án</summary>

Tới $e_1$: $0{,}36 + 0{,}36 = 0{,}72$; tới $e_2$: $0{,}16 + 0{,}16 = 0{,}32$; tới $e_3$: $0{,}01 + 0{,}01 = 0{,}02$. Chọn mã 3; $L_{commit} = 0{,}25 \times 0{,}02 = 0{,}005$.
</details>
:::
