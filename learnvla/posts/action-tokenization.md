---
slug: action-tokenization
date: 2026-10-18
title_en: "Action Tokenization: Turning Actions into Tokens"
title_vi: "Action Tokenization: Hành động trở thành token"
excerpt_en: "A language model picks words from a finite vocabulary, but robot actions are real numbers. Binning makes each value a token and breaks down at high control rates; FAST compresses the whole chunk with a DCT first. Both worked by hand."
excerpt_vi: "Mô hình ngôn ngữ chọn chữ trong một từ điển hữu hạn, còn hành động robot là số thực. Chia bin biến mỗi giá trị thành một token và gãy khi tần số điều khiển cao; FAST nén cả chunk bằng DCT trước. Tính tay cả hai."
tags: [VLA, Foundations, Tokenizer, Action]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Binning as used in RT-2 (07/2023) and OpenVLA, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024. FAST, [arXiv 2501.09747](https://arxiv.org/abs/2501.09747) · 01/2025

**PROBLEM** A language model outputs one token from a finite vocabulary at a time. A robot action, such as moving the gripper 0.03 m, is a real number.

**WHAT FAILED BEFORE** A regression head outputs a single number per dimension and, trained with squared error, averages different valid demonstrations. Plain binning fixes that, but at high control rates it produces hundreds of nearly identical tokens per chunk; FAST reports that OpenVLA worked on low-frequency data but struggled to fit the higher-frequency DROID dataset.

**IDEA** Binning: cut each dimension's range into $K$ bins and use the bin index as the token. FAST: compress the whole chunk first (DCT per dimension, scale and round, then BPE), so the number of tokens follows how complex the motion is.

**RESULT** FAST produces roughly 30 tokens per one-second chunk per arm whatever the control rate. The paper's π0-FAST needed 5× fewer GPU hours to train than the flow-matching π0.
</div>

## 1. The problem: real numbers out of a word picker

[[flow]]
- Before~Regression head | Features > !One number per dimension~squared error averages modes! > Action | left + right demos give "straight ahead"
- Before~Binning | Each value > !One token per value per step~256 bins! > H×D tokens | 350 tokens per second at 50 Hz, 7-D
+ FAST | Whole chunk > *DCT, round, BPE~compress first* > ~30 tokens per arm | fewer, more informative tokens
[[/flow]] The change is what one token stands for: a single value, or a piece of the chunk's overall shape.

## 2. The two pipelines

[[fig:action-tokenization]] Top: binning gives one token per value per step. Bottom: FAST transforms the chunk into frequencies, zeroes the small ones and lets BPE merge what is left.

| Step | Binning (OpenVLA) | FAST |
|---|---|---|
| Normalise | bins spread uniformly between the 1st and 99th percentile of each dimension | 1st and 99th percentile mapped to $[-1, 1]$ |
| Transform | none | DCT of each dimension over the chunk |
| Quantise | value to bin index, 256 bins | multiply by a scale $\gamma$ and round |
| Into the vocabulary | overwrite 256 rarely used tokens of the Llama tokenizer | BPE trained on action data, flattened with low frequencies first |
| Tokens per chunk | $H \times D$ | about 30 per arm in the paper's datasets |

[[bars:tokens]] Binning, 50 Hz × 7 dimensions=350; *FAST, one arm (paper's rough figure)=30* || Tokens for a one-second action chunk. The binning count is my arithmetic; FAST's is the paper's statement that it needs roughly 30 tokens per chunk per arm.

<div class="calc" markdown="1">
Calculation card 1: binning

**What and why.** Turn one action value into a token and back, to see the size of the rounding error.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $a$ | action value, range $[-0.1, 0.1]$ m | input | 0.027 |
| $K$ | number of bins | constant | 10 (OpenVLA uses 256) |
| $\Delta$ | bin width | derived | – |
| $b$ | bin index, the token | output | – |
| $\hat a$ | decoded value, the bin centre | output | – |

**Formula**

$$\Delta = \frac{a_{max} - a_{min}}{K}, \qquad b = \left\lfloor \frac{a - a_{min}}{\Delta} \right\rfloor, \qquad \hat a = a_{min} + (b + 0.5)\,\Delta$$

**Steps**

1. $\Delta = 0.2 / 10 = 0.02$.
2. $b = \lfloor (0.027 + 0.1) / 0.02 \rfloor = \lfloor 6.35 \rfloor = 6$.
3. $\hat a = -0.1 + 6.5 \times 0.02 = 0.03$; error $= 0.003$.

**Result.** 0.027 m becomes token 6 and comes back as 0.03 m.

**Why it matters.** The error is at most $\Delta/2$: 0.01 m with 10 bins, about 0.0004 m with 256. Values outside the range are clipped to the first or last bin, otherwise $a = 0.1$ would give $b = 10$, a bin that does not exist.
</div>

## 3. Why binning breaks at high frequency

A language model learns by predicting the next token from the previous ones, so it learns most from tokens it could not have guessed. At 5 Hz the next action value differs clearly from the last one. At 50 Hz a smooth motion changes ten times less per step, so the next token is nearly a copy of the previous one. The FAST paper shows exactly this on a toy task: as the sampling rate grows, a binning model ends up "simply copying the first action". Squared-error regression does not have this problem, but it has the averaging problem from [imitation learning](imitation-learning.html).

<div class="calc" markdown="1">
Calculation card 2: compressing a chunk with the DCT

**What and why.** Take a smooth 4-step motion of one dimension, move it to frequencies, round, and rebuild it. It shows why most coefficients vanish.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $a_0 \dots a_3$ | normalised action values over 4 steps | input | 0.1, 0.2, 0.3, 0.4 |
| $C_k$ | DCT coefficient $k$ ($k = 0$ is the average level) | derived | – |
| $\gamma$ | scale before rounding | constant | 10 (illustrative) |
| $\bar C_k$ | rounded coefficient, what BPE sees | output | – |

**Formula** (orthonormal DCT-II, $N = 4$)

$$C_k = s_k \sum_{n=0}^{N-1} a_n \cos\!\Big(\frac{\pi(2n+1)k}{2N}\Big),\quad s_0 = \sqrt{1/N},\ s_{k>0} = \sqrt{2/N}, \qquad \bar C_k = \mathrm{round}(\gamma C_k)$$

**Steps**

1. $C_0 = 0.5 \times (0.1 + 0.2 + 0.3 + 0.4) = 0.5$.
2. $C_1 = 0.707 \times (0.1 \times 0.924 + 0.2 \times 0.383 - 0.3 \times 0.383 - 0.4 \times 0.924) = 0.707 \times (-0.315) = -0.223$.
3. $C_2 = 0$ exactly, and $C_3 = -0.016$.
4. Round $\gamma C$: $(5,\ -2.23,\ 0,\ -0.16) \to (5,\ -2,\ 0,\ 0)$.
5. Rebuild from $(0.5, -0.2, 0, 0)$: $(0.119,\ 0.196,\ 0.304,\ 0.381)$, at most 0.019 from the original.

**Result.** Four values became two non-zero integers, and the motion comes back within 0.02.

**Why it matters.** A smooth motion puts almost all its energy in the lowest frequencies, so after rounding most coefficients are zero, and BPE packs runs of zeros into few tokens. Doubling the control rate adds more high-frequency coefficients, which are mostly zero, so the token count barely changes. The scale $\gamma$ trades token count against reconstruction error.
</div>

## 4. What carries over

- Autoregressive VLAs (RT-2, OpenVLA, π0-FAST) need some action tokenizer; flow-matching VLAs such as π0 skip it and output continuous values ([flow matching](flowmatching.html)).
- The reason to classify over bins rather than regress is still valid: a softmax over bins can put weight on both "left" and "right".
- FAST flattens low frequencies of all dimensions first, so the model commits to the overall shape of the motion before the details. The paper found this gives more stable rollouts.

**Carry forward:** tokens of text, images and actions now form one sequence. The mechanism that lets each token use the others is [attention](attention.html).

**Check question:** With $K = 10$ bins on $[-0.1, 0.1]$, which bin does $a = -0.095$ fall in, what does it decode to, and what is the error?

<details markdown="1">
<summary>Answer</summary>

$b = \lfloor (-0.095 + 0.1)/0.02 \rfloor = \lfloor 0.25 \rfloor = 0$. Bin 0 covers $[-0.1, -0.08)$ with centre $-0.09$, so $\hat a = -0.09$ and the error is $0.005$, within $\Delta/2 = 0.01$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Cách chia bin dùng trong RT-2 (07/2023) và OpenVLA, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024. FAST, [arXiv 2501.09747](https://arxiv.org/abs/2501.09747) · 01/2025

**VẤN ĐỀ** Mô hình ngôn ngữ mỗi lần xuất một token từ một từ điển hữu hạn. Hành động robot, ví dụ dời tay kẹp 0,03 m, là một số thực.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Một đầu hồi quy xuất một số cho mỗi chiều và, khi học bằng sai số bình phương, lấy trung bình các demo đúng nhưng khác nhau. Chia bin đơn giản sửa được điều đó, nhưng ở tần số điều khiển cao nó sinh ra hàng trăm token gần như giống hệt nhau cho mỗi chunk; FAST báo cáo rằng OpenVLA chạy tốt trên dữ liệu tần số thấp nhưng khó khớp bộ DROID tần số cao hơn.

**Ý TƯỞNG** Chia bin: cắt khoảng giá trị của mỗi chiều thành $K$ bin và dùng chỉ số bin làm token. FAST: nén cả chunk trước (DCT theo từng chiều, nhân hệ số rồi làm tròn, sau đó BPE), để số token theo độ phức tạp của chuyển động.

**KẾT QUẢ** FAST sinh khoảng 30 token cho mỗi chunk một giây mỗi cánh tay, bất kể tần số điều khiển. π0-FAST trong paper cần ít hơn 5 lần giờ GPU để huấn luyện so với π0 dùng flow matching.
</div>

## 1. Vấn đề: lấy số thực ra từ một cỗ máy chọn chữ

[[flow]]
- Trước~Đầu hồi quy | Đặc trưng > !Một số mỗi chiều~sai số bình phương lấy trung bình các mode! > Hành động | demo trái + demo phải thành "đi thẳng"
- Trước~Chia bin | Từng giá trị > !Mỗi giá trị mỗi bước một token~256 bin! > H×D token | 350 token mỗi giây ở 50 Hz, 7 chiều
+ FAST | Cả chunk > *DCT, làm tròn, BPE~nén trước* > ~30 token mỗi tay | ít token hơn, mỗi token nhiều thông tin hơn
[[/flow]] Thay đổi nằm ở chỗ một token đại diện cho gì: một giá trị đơn lẻ, hay một phần hình dạng tổng thể của chunk.

## 2. Hai quy trình

[[fig:action-tokenization]] Trên: chia bin cho mỗi giá trị mỗi bước một token. Dưới: FAST đổi chunk sang tần số, xóa các hệ số nhỏ và để BPE gộp phần còn lại.

| Bước | Chia bin (OpenVLA) | FAST |
|---|---|---|
| Chuẩn hóa | các bin trải đều giữa phân vị 1 và 99 của mỗi chiều | phân vị 1 và 99 ánh xạ về $[-1, 1]$ |
| Biến đổi | không có | DCT của từng chiều trên cả chunk |
| Lượng tử hóa | giá trị thành chỉ số bin, 256 bin | nhân với hệ số $\gamma$ rồi làm tròn |
| Vào từ điển | ghi đè 256 token ít dùng của tokenizer Llama | BPE huấn luyện trên dữ liệu hành động, duỗi phẳng với tần số thấp trước |
| Số token mỗi chunk | $H \times D$ | khoảng 30 mỗi tay trong các bộ dữ liệu của paper |

[[bars:token]] Chia bin, 50 Hz × 7 chiều=350; *FAST, một tay (số xấp xỉ của paper)=30* || Số token cho một chunk hành động một giây. Số của chia bin là phép tính của mình; số của FAST là nhận định của paper rằng nó cần khoảng 30 token mỗi chunk mỗi tay.

<div class="calc" markdown="1">
Thẻ tính tay 1: chia bin

**Tính gì và vì sao.** Biến một giá trị hành động thành token rồi giải ngược lại, để thấy sai số làm tròn lớn cỡ nào.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $a$ | giá trị hành động, khoảng $[-0{,}1;\ 0{,}1]$ m | input | 0,027 |
| $K$ | số bin | hằng số | 10 (OpenVLA dùng 256) |
| $\Delta$ | độ rộng bin | suy ra | – |
| $b$ | chỉ số bin, tức token | output | – |
| $\hat a$ | giá trị giải mã, tâm của bin | output | – |

**Công thức**

$$\Delta = \frac{a_{max} - a_{min}}{K}, \qquad b = \left\lfloor \frac{a - a_{min}}{\Delta} \right\rfloor, \qquad \hat a = a_{min} + (b + 0{,}5)\,\Delta$$

**Từng bước**

1. $\Delta = 0{,}2 / 10 = 0{,}02$.
2. $b = \lfloor (0{,}027 + 0{,}1) / 0{,}02 \rfloor = \lfloor 6{,}35 \rfloor = 6$.
3. $\hat a = -0{,}1 + 6{,}5 \times 0{,}02 = 0{,}03$; sai số $= 0{,}003$.

**Kết quả.** 0,027 m thành token 6 và quay về thành 0,03 m.

**Ý nghĩa.** Sai số tối đa là $\Delta/2$: 0,01 m với 10 bin, khoảng 0,0004 m với 256 bin. Giá trị ngoài khoảng bị kẹp về bin đầu hoặc cuối, nếu không thì $a = 0{,}1$ sẽ cho $b = 10$, một bin không tồn tại.
</div>

## 3. Vì sao chia bin gãy ở tần số cao

Mô hình ngôn ngữ học bằng cách đoán token kế tiếp từ các token trước, nên nó học được nhiều nhất từ những token mà nó không đoán trước được. Ở 5 Hz, giá trị hành động kế tiếp khác rõ so với giá trị trước. Ở 50 Hz, một chuyển động mượt thay đổi ít hơn mười lần mỗi bước, nên token kế tiếp gần như là bản sao của token trước. Paper FAST cho thấy đúng điều này trên một bài toán đồ chơi: khi tần số lấy mẫu tăng, mô hình chia bin cuối cùng "chỉ chép lại hành động đầu tiên". Hồi quy sai số bình phương không gặp vấn đề này, nhưng lại gặp vấn đề lấy trung bình ở bài [imitation learning](imitation-learning.html).

<div class="calc" markdown="1">
Thẻ tính tay 2: nén một chunk bằng DCT

**Tính gì và vì sao.** Lấy một chuyển động mượt 4 bước của một chiều, đổi sang tần số, làm tròn, rồi dựng lại. Phép tính cho thấy vì sao phần lớn hệ số biến mất.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $a_0 \dots a_3$ | giá trị hành động đã chuẩn hóa qua 4 bước | input | 0,1; 0,2; 0,3; 0,4 |
| $C_k$ | hệ số DCT thứ $k$ ($k = 0$ là mức trung bình) | suy ra | – |
| $\gamma$ | hệ số nhân trước khi làm tròn | hằng số | 10 (minh họa) |
| $\bar C_k$ | hệ số đã làm tròn, thứ BPE nhìn thấy | output | – |

**Công thức** (DCT-II trực chuẩn, $N = 4$)

$$C_k = s_k \sum_{n=0}^{N-1} a_n \cos\!\Big(\frac{\pi(2n+1)k}{2N}\Big),\quad s_0 = \sqrt{1/N},\ s_{k>0} = \sqrt{2/N}, \qquad \bar C_k = \mathrm{round}(\gamma C_k)$$

**Từng bước**

1. $C_0 = 0{,}5 \times (0{,}1 + 0{,}2 + 0{,}3 + 0{,}4) = 0{,}5$.
2. $C_1 = 0{,}707 \times (0{,}1 \times 0{,}924 + 0{,}2 \times 0{,}383 - 0{,}3 \times 0{,}383 - 0{,}4 \times 0{,}924) = 0{,}707 \times (-0{,}315) = -0{,}223$.
3. $C_2 = 0$ chính xác, và $C_3 = -0{,}016$.
4. Làm tròn $\gamma C$: $(5;\ -2{,}23;\ 0;\ -0{,}16) \to (5;\ -2;\ 0;\ 0)$.
5. Dựng lại từ $(0{,}5;\ -0{,}2;\ 0;\ 0)$: $(0{,}119;\ 0{,}196;\ 0{,}304;\ 0{,}381)$, lệch tối đa 0,019 so với ban đầu.

**Kết quả.** Bốn giá trị thành hai số nguyên khác 0, và chuyển động quay về với sai lệch dưới 0,02.

**Ý nghĩa.** Một chuyển động mượt dồn gần hết năng lượng vào các tần số thấp nhất, nên sau khi làm tròn phần lớn hệ số bằng 0, và BPE gói các dãy số 0 thành rất ít token. Tăng gấp đôi tần số điều khiển chỉ thêm các hệ số tần số cao, mà phần lớn bằng 0, nên số token hầu như không đổi. Hệ số $\gamma$ đánh đổi giữa số token và sai số dựng lại.
</div>

## 4. Những gì mang sang được

- VLA tự hồi quy (RT-2, OpenVLA, π0-FAST) cần một tokenizer hành động nào đó; VLA flow matching như π0 bỏ qua bước này và xuất giá trị liên tục ([flow matching](flowmatching.html)).
- Lý do phân loại trên bin thay vì hồi quy vẫn đúng: softmax trên các bin có thể đặt trọng số lên cả "trái" lẫn "phải".
- FAST duỗi phẳng tần số thấp của mọi chiều trước, nên mô hình chốt hình dạng tổng thể của chuyển động trước rồi mới tới chi tiết. Paper thấy cách này cho các lượt chạy ổn định hơn.

**Mang theo:** token chữ, ảnh và hành động giờ thành một dãy. Cơ chế cho mỗi token dùng thông tin của các token khác là [attention](attention.html).

**Câu kiểm tra:** Với $K = 10$ bin trên $[-0{,}1;\ 0{,}1]$, giá trị $a = -0{,}095$ rơi vào bin nào, giải mã ra bao nhiêu, và sai số là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$b = \lfloor (-0{,}095 + 0{,}1)/0{,}02 \rfloor = \lfloor 0{,}25 \rfloor = 0$. Bin 0 phủ $[-0{,}1;\ -0{,}08)$ với tâm $-0{,}09$, nên $\hat a = -0{,}09$ và sai số là $0{,}005$, nằm trong $\Delta/2 = 0{,}01$.
</details>
:::
