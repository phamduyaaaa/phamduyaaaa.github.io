---
slug: action-tokenization
date: 2026-10-18
title_en: "Action Tokenization: Turning Actions into Tokens"
title_vi: "Action Tokenization: Hành động trở thành token"
excerpt_en: An LLM picks words from a finite vocabulary, but robot actions are real numbers. Binning turns a continuous action into a token, worked by hand, with its benefits and costs.
excerpt_vi: LLM chọn một chữ trong từ điển hữu hạn, còn hành động robot là số thực. Chia thùng (bin) biến số liên tục thành token, tính tay một ví dụ, cùng cái lợi và cái giá.
tags: [VLA, Foundations, Tokenizer, Action]
---

:::en
## The pain to cure

An LLM generates tokens with a softmax over a finite vocabulary, so its output is a **discrete** variable. A robot action (for example moving the gripper by $\Delta x = 0.03$ m) is a **continuous** number.

Images were easy because they are only input. Actions must be spoken by the model. So how can a model that only knows how to "pick one word from a dictionary" control real numbers?

## The idea: turn a real number into a "word" by binning

Like rounding an exam score: instead of the exact 7.43, we only say "between 7 and 8". Split the value range into equal bins, and make each bin a word.

### A worked example

Suppose $\Delta x$ lies in $[-0.1,\, 0.1]$ metres. Split it into $K=10$ bins to keep things readable (OpenVLA uses $K=256$).

Bin width:

$$
\Delta = \frac{0.1-(-0.1)}{10} = 0.02
$$

**Encode** (real number $\to$ bin index):

$$
b = \left\lfloor \frac{a-(-0.1)}{\Delta} \right\rfloor
$$

For $a = 0.03$:

$$
b = \left\lfloor \frac{0.03+0.1}{0.02} \right\rfloor = \lfloor 6.5 \rfloor = 6
$$

Bin 6 covers $[0.02,\, 0.04)$. The index $b=6$ is the token: one "word" of the vocabulary.

**Decode** (index $\to$ real number): take the bin centre:

$$
\hat a = -0.1 + (6+0.5)\times 0.02 = 0.03
$$

Here it matches exactly because $0.03$ happens to sit in the middle of the bin. Try $a=0.027$: it still falls in bin 6 (since $\lfloor 6.35 \rfloor = 6$), decodes to $0.03$, an error of $0.003$.

The maximum error is always half a bin width:

$$
|a-\hat a| \le \frac{\Delta}{2} = 0.01
$$

For higher accuracy, increase $K$. With $K=256$, $\Delta = 0.2/256 \approx 0.00078$ and the maximum error is about $0.0004$ m, under half a millimetre.

## Plugging into an LLM

Each bin gets a token of the vocabulary (OpenVLA overwrites 256 rarely used tokens of the Llama tokenizer). A 7-dimensional action becomes 7 consecutive tokens:

$$
a=(\Delta x,\Delta y,\Delta z,\Delta\phi,\Delta\theta,\Delta\psi,g)\;\to\;(b_1,b_2,\dots,b_7)
$$

The model generates one token at a time, exactly like writing a sentence:

$$
\pi(a \mid \text{image},\text{command}) = \prod_{j=1}^{7} p(b_j \mid \text{image},\text{command},b_{<j})
$$

The loss is still cross-entropy. The whole LLM machinery is reused unchanged, with no architecture change. That is why the approach is attractive.

## Why classification instead of regressing the real number?

Consider a robot facing an obstacle. It can dodge left ($a=-1$) or right ($a=+1$), each 50% of the time in the data.

- **MSE regression** learns the mean: $\tfrac12(-1)+\tfrac12(+1)=0$, which drives straight into the obstacle.
- **Classification over bins** puts high probability on two bins (left and right) and low probability in the middle. Sampling then yields one valid direction.

So tokenization is not only a trick to reuse LLMs. It also lets the model represent several equally valid options (a multi-modal distribution).

## The price to pay (leading to the next stage)

1. **Order between bins is lost.** Cross-entropy treats bin 6 and bin 7 as two completely different labels. Guessing 7 when the answer is 6 is penalised exactly as much as guessing 0, although physically they are much closer.
2. **Sequences get long.** Each step costs 7 tokens. A robot controlled at 50 Hz over a 1-second chunk of 50 steps needs $50\times 7=350$ tokens, heavy for $O(N^2)$ attention.
3. **Redundant tokens.** At high frequency $a_t \approx a_{t-1}$, so the next token is almost predictable from the previous one, and each token carries very little new information.

Carry forward: binning solves the "continuous vs discrete" contradiction but creates long, redundant sequences. The next idea, FAST, borrows from JPEG: compress the trajectory first (DCT), then tokenize it, using the same BPE as text tokenizers.

**Check question:** with $K=10$ bins on $[-0.1, 0.1]$, which bin does the action $a=-0.095$ fall into, what does it decode to, and what is the error?

*Answer:* $b=\lfloor(-0.095+0.1)/0.02\rfloor=\lfloor 0.25\rfloor=0$. The bin covers $[-0.1,-0.08)$ with centre $-0.09$, so it decodes to $\hat a=-0.09$ and the error is $0.005$, within the bound $\Delta/2=0.01$.
:::

:::vi
## Cái đau cần chữa

LLM sinh token bằng softmax trên từ điển hữu hạn, nghĩa là đầu ra là một biến **rời rạc**. Còn hành động robot (ví dụ dịch tay máy $\Delta x = 0.03$ m) là số **liên tục**.

Ảnh thì dễ vì chỉ là đầu vào. Hành động thì mô hình phải nói ra. Vậy làm sao để một mô hình chỉ biết "chọn một chữ trong từ điển" điều khiển được số thực?

## Ý tưởng: biến số thực thành "chữ" bằng cách chia thùng (bin)

Giống như làm tròn điểm thi: thay vì điểm thật 7.43, ta chỉ nói "điểm thuộc khoảng 7 đến 8". Ta chia đoạn giá trị thành các thùng bằng nhau, mỗi thùng là một chữ.

### Làm tay một ví dụ

Giả sử $\Delta x$ chỉ nằm trong $[-0.1,\, 0.1]$ mét, ta chia thành $K=10$ thùng cho dễ nhìn (OpenVLA dùng $K=256$).

Bề rộng mỗi thùng:

$$
\Delta = \frac{0.1-(-0.1)}{10} = 0.02
$$

**Mã hóa** (số thực $\to$ chỉ số thùng):

$$
b = \left\lfloor \frac{a-(-0.1)}{\Delta} \right\rfloor
$$

Với $a = 0.03$:

$$
b = \left\lfloor \frac{0.03+0.1}{0.02} \right\rfloor = \lfloor 6.5 \rfloor = 6
$$

Thùng số 6 phủ khoảng $[0.02,\, 0.04)$. Chỉ số $b=6$ chính là token: một "chữ" trong từ điển.

**Giải mã** (chỉ số $\to$ số thực): lấy tâm thùng:

$$
\hat a = -0.1 + (6+0.5)\times 0.02 = 0.03
$$

Ở ví dụ này khớp đúng vì $0.03$ tình cờ nằm giữa thùng. Thử $a=0.027$: vẫn rơi vào thùng 6 (vì $\lfloor 6.35 \rfloor = 6$), giải mã ra $0.03$, sai lệch $0.003$.

Sai số tối đa luôn là nửa bề rộng thùng:

$$
|a-\hat a| \le \frac{\Delta}{2} = 0.01
$$

Muốn chính xác hơn thì tăng $K$. Với $K=256$, $\Delta = 0.2/256 \approx 0.00078$, sai số tối đa $\approx 0.0004$ m, tức dưới nửa milimét.

## Nối vào LLM như thế nào?

Mỗi thùng được gán một token trong từ điển (OpenVLA ghi đè 256 token ít dùng của tokenizer Llama). Một hành động 7 chiều trở thành 7 token liên tiếp:

$$
a=(\Delta x,\Delta y,\Delta z,\Delta\phi,\Delta\theta,\Delta\psi,g)\;\to\;(b_1,b_2,\dots,b_7)
$$

Mô hình sinh từng token một, y hệt sinh câu văn:

$$
\pi(a \mid \text{ảnh},\text{lệnh}) = \prod_{j=1}^{7} p(b_j \mid \text{ảnh},\text{lệnh},b_{<j})
$$

Và loss vẫn là cross-entropy. Toàn bộ máy móc của LLM dùng lại nguyên xi, không cần sửa kiến trúc. Đó là lý do cách này hấp dẫn.

## Vì sao chọn phân loại mà không hồi quy số thực trực tiếp?

Hãy xét một tình huống: robot gặp vật cản, có thể né trái ($a=-1$) hoặc phải ($a=+1$), mỗi hướng 50% trong dữ liệu.

- **Hồi quy MSE** học giá trị trung bình: $\tfrac12(-1)+\tfrac12(+1)=0$, tức đi thẳng vào vật cản.
- **Phân loại trên thùng** cho xác suất cao ở hai thùng (trái và phải), thấp ở giữa. Khi lấy mẫu sẽ ra một hướng hợp lệ.

Vậy token hóa không chỉ là mẹo để dùng LLM, mà còn cho mô hình biểu diễn được nhiều phương án đều hợp lý (phân phối đa đỉnh).

## Cái giá phải trả (dẫn sang bài sau)

1. **Mất thứ tự giữa các thùng.** Cross-entropy coi thùng 6 và thùng 7 là hai nhãn khác nhau hoàn toàn. Đoán thùng 7 khi đáp án là 6 bị phạt bằng đúng mức đoán thùng 0, dù về vật lý chúng gần nhau hơn rất nhiều.
2. **Dãy quá dài.** Mỗi bước tốn 7 token. Robot điều khiển ở 50 Hz, một đoạn 1 giây gồm 50 bước sẽ là $50\times 7=350$ token, nặng cho attention $O(N^2)$.
3. **Token dư thừa.** Ở tần số cao, $a_t \approx a_{t-1}$, nên token tiếp theo gần như đoán được ngay từ token trước, và mỗi token mang rất ít thông tin mới.

Mang theo sang chặng sau: cách chia thùng đơn giản giải được mâu thuẫn "liên tục vs rời rạc", nhưng tạo ra dãy dài và dư thừa. Ý tưởng tiếp theo, FAST, mượn từ JPEG: nén quỹ đạo trước (DCT) rồi mới token hóa, dùng chính BPE của tokenizer văn bản.

**Câu kiểm tra:** với $K=10$ thùng trên $[-0.1,0.1]$, hành động $a=-0.095$ rơi vào thùng số mấy, giải mã ra bao nhiêu, và sai số là bao nhiêu?

*Đáp án:* $b=\lfloor(-0.095+0.1)/0.02\rfloor=\lfloor 0.25\rfloor=0$. Thùng này phủ $[-0.1,-0.08)$, tâm là $-0.09$, nên giải mã ra $\hat a=-0.09$ và sai số là $0.005$, nằm trong giới hạn $\Delta/2=0.01$.
:::
