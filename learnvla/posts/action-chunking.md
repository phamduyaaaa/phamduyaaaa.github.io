---
slug: action-chunking
date: 2026-10-18
title_en: "Action Chunking: Predict k Steps, Blend the Overlaps"
title_vi: "Action Chunking: Dự đoán k bước, trộn các đoạn chồng nhau"
excerpt_en: "A single-step policy makes a decision at every step, so small errors compound. ACT predicts a chunk of k future actions, which shrinks the effective horizon k-fold, and blends overlapping chunks into smooth motion."
excerpt_vi: "Chính sách từng bước quyết định ở mọi bước nên lỗi nhỏ cộng dồn. ACT dự đoán một đoạn k hành động tương lai, thu ngắn horizon hiệu dụng k lần, rồi trộn các đoạn chồng nhau thành chuyển động mượt."
tags: [VLA, Foundations, Action Chunking, ACT, Imitation Learning]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Zhao et al., *Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware* (ACT, ALOHA), [arXiv 2304.13705](https://arxiv.org/abs/2304.13705) · 04/2023

**PROBLEM** Learn precise two-arm tasks (the paper's examples include inserting a battery and opening a cup lid) from about 50 demonstrations, about 10 minutes of data.

**WHAT FAILED BEFORE** Single-step behavior cloning. The paper names "compounding errors": errors from earlier steps accumulate and push the robot off its training distribution into "hard-to-recover states". It also notes such a policy struggles with temporally correlated pauses in human demonstrations.

**IDEA** Predict the next $k$ actions at once (an *action chunk*), which implies "a k-fold reduction in the effective horizon". Query the policy every step and average the overlapping chunks with exponential weights (*temporal ensembling*).

**RESULT** With only human demonstrations, ACT reaches 88% and 96% final success on Slide Ziploc and Slot Battery; the baselines in the same table score 0%. Modern VLAs such as π0 reuse chunking ($H = 50$).
</div>

## 1. The problem: one decision per step

[[flow]]
- Before~Single-step BC | State s_t > !Predict a_t~one step ahead! > Execute | T decisions; each small error compounds
+ ACT | State s_t > *Predict chunk a_t..a_t+k~k steps at once* > Execute k steps | T/k decisions; fewer chances to drift
[[/flow]] The change is the unit of prediction: a short plan instead of a single action.

## 2. How it works

[[fig:action-chunking]] Top: a single-step policy decides every step. Bottom: ACT predicts a chunk, but is still queried at every step, so the current step gets several predictions, which are blended.

| Block | Input | Output | Role |
|---|---|---|---|
| Image backbone (ResNet18) | camera images | feature tokens | what the scene looks like |
| Transformer encoder-decoder | image tokens, joint positions, latent $z$ | chunk of $k$ target joint positions | the policy $\pi_\theta(a_{t:t+k} \mid s_t)$ |
| CVAE encoder (training only) | action sequence, joint positions | latent $z$ | captures the many ways a human can do the same thing; discarded at test time |
| Test time | $z = 0$ (prior mean) | deterministic chunk | no sampling at run time |
| Temporal ensembling | all chunks that cover step $t$ | one action $a_t$ | smoothness at no training cost |

Teleoperation and recording run at 50 Hz; the model has about 80M parameters and is trained from scratch per task (paper's figures).

[[bars:%]] Slide Ziploc, ACT=88; Slot Battery, ACT=96; Both tasks, other methods=0 || Final-stage success on two real tasks, human demonstrations only (paper's Table I; 25 evaluations).

<div class="calc" markdown="1">

Calculation card

**What and why.** How does temporal ensembling turn several overlapping predictions for the same step into one action? This is the step that makes chunked motion smooth.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $A_t[i]$ | prediction for step $t$ from the $i$-th chunk covering it, $i = 0$ the oldest | input | 1.0, 1.2, 1.5 |
| $m$ | decay rate; smaller $m$ lets new observations in faster | constant | 0.1 (illustrative; the paper's value was not read) |
| $w_i$ | weight of the $i$-th prediction | derived | – |
| $a_t$ | executed action | output | – |

**Formula**

$$w_i = e^{-m\,i}, \qquad a_t = \frac{\sum_i w_i\, A_t[i]}{\sum_i w_i}$$

**Steps**

1. $w_0 = 1$, $w_1 = e^{-0.1} = 0.905$, $w_2 = e^{-0.2} = 0.819$. Sum $= 2.724$.
2. Numerator: $1 \times 1.0 + 0.905 \times 1.2 + 0.819 \times 1.5 = 1.0 + 1.086 + 1.228 = 3.314$.
3. $a_t = 3.314 / 2.724 = 1.217$.

**Result.** The executed action is 1.217, between the oldest (1.0) and newest (1.5) predictions. Plain averaging ($m = 0$) would give 1.233.

**Why it matters.** The average is over predictions for the *same* step, not over neighbouring steps, so motion is smoothed without lagging behind. It costs only inference time, no training. Note the text says the oldest prediction gets $w_0$, the largest weight.
</div>

**Chunk horizon, in numbers.** An episode of $T = 500$ steps with $k = 50$ needs $T/k = 10$ chunk decisions instead of 500 single-step decisions (illustrative $T$ and $k$; the paper states the $k$-fold reduction).

## 3. Why the CVAE?

Humans solve the same task in different ways, and are more variable where precision does not matter. A policy trained with a plain regression loss averages those ways. The CVAE gives the model a latent $z$ for "which way", used in training and set to zero at test time.

## 4. In VLA

- π0 outputs a chunk of $H = 50$ actions and runs at up to 50 Hz: [π0](pi0.html).
- Chunks are produced differently there (flow matching instead of a CVAE): [flow matching](flowmatching.html).
- In force-sensitive tasks a long open-loop chunk reacts late to contact; this is a recurring trade-off in the force papers.

## 5. Caveats

- The chunk size used in the experiments and the value of $m$ were not in the part of the paper I read verbatim; the examples use illustrative values.
- Ablation numbers (effect of $k$, of temporal ensembling, of the CVAE) came from a summary and are not quoted.
- Table II (more real tasks) was read in flattened form; I quote only the two tasks above.

**Carry forward:** chunks predicted by ACT are a deterministic decode of one latent. π0 replaces that with flow matching: [π0](pi0.html).

**Check question:** $T = 600$, $k = 20$. How many chunk decisions does one episode need, and by what factor did the number of decisions shrink?

<details markdown="1">
<summary>Answer</summary>

$600 / 20 = 30$ decisions, instead of 600: a factor of $k = 20$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Zhao et al., *Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware* (ACT, ALOHA), [arXiv 2304.13705](https://arxiv.org/abs/2304.13705) · 04/2023

**VẤN ĐỀ** Học các tác vụ hai tay chính xác (ví dụ trong paper có lắp pin và mở nắp cốc) từ khoảng 50 bản demo, cỡ 10 phút dữ liệu.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Behavior cloning từng bước. Paper gọi tên "compounding errors": lỗi ở các bước trước cộng dồn và đẩy robot ra khỏi phân phối huấn luyện vào "trạng thái khó phục hồi". Paper cũng chỉ ra chính sách như vậy khó với các quãng dừng có tương quan theo thời gian trong demo của người.

**Ý TƯỞNG** Dự đoán $k$ hành động kế tiếp cùng lúc (một *action chunk*), tức "giảm horizon hiệu dụng k lần". Truy vấn chính sách ở mọi bước và lấy trung bình các đoạn chồng nhau với trọng số mũ (*temporal ensembling*).

**KẾT QUẢ** Chỉ với demo của người, ACT đạt 88% và 96% thành công ở bước cuối trên Slide Ziploc và Slot Battery; các baseline trong cùng bảng đạt 0%. VLA hiện đại như π0 dùng lại chunking ($H = 50$).
</div>

## 1. Vấn đề: một quyết định mỗi bước

[[flow]]
- Trước~BC từng bước | Trạng thái s_t > !Dự đoán a_t~đi trước một bước! > Thực thi | T quyết định; mỗi lỗi nhỏ cộng dồn
+ ACT | Trạng thái s_t > *Dự đoán đoạn a_t..a_t+k~k bước cùng lúc* > Thực thi k bước | T/k quyết định; ít cơ hội trôi hơn
[[/flow]] Thay đổi là đơn vị dự đoán: một kế hoạch ngắn thay cho một hành động.

## 2. Cách hoạt động

[[fig:action-chunking]] Trên: chính sách từng bước quyết định mỗi bước. Dưới: ACT dự đoán một đoạn nhưng vẫn được truy vấn ở mọi bước, nên bước hiện tại nhận nhiều dự đoán và được trộn lại.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Backbone ảnh (ResNet18) | ảnh camera | token đặc trưng | cảnh trông thế nào |
| Transformer encoder-decoder | token ảnh, vị trí khớp, latent $z$ | đoạn $k$ vị trí khớp mục tiêu | chính sách $\pi_\theta(a_{t:t+k} \mid s_t)$ |
| Encoder CVAE (chỉ khi huấn luyện) | chuỗi hành động, vị trí khớp | latent $z$ | nắm bắt nhiều cách người làm cùng một việc; bỏ khi chạy thật |
| Lúc chạy | $z = 0$ (trung bình prior) | đoạn xác định | không lấy mẫu khi chạy |
| Temporal ensembling | mọi đoạn phủ bước $t$ | một hành động $a_t$ | mượt mà, không tốn huấn luyện |

Teleoperation và ghi dữ liệu chạy 50 Hz; mô hình khoảng 80M tham số, huấn luyện từ đầu cho từng tác vụ (số liệu của paper).

[[bars:%]] Slide Ziploc, ACT=88; Slot Battery, ACT=96; Cả hai tác vụ, phương pháp khác=0 || Thành công ở giai đoạn cuối trên hai tác vụ thật, chỉ dùng demo của người (Bảng I của paper; 25 lần đánh giá).

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Temporal ensembling biến nhiều dự đoán chồng nhau cho cùng một bước thành một hành động thế nào? Đây là bước làm cho chuyển động theo đoạn mượt.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $A_t[i]$ | dự đoán cho bước $t$ từ đoạn thứ $i$ phủ nó, $i = 0$ là cũ nhất | input | 1,0; 1,2; 1,5 |
| $m$ | tốc độ suy giảm; $m$ nhỏ thì quan sát mới vào nhanh hơn | hằng số | 0,1 (minh họa; chưa đọc giá trị của paper) |
| $w_i$ | trọng số của dự đoán thứ $i$ | suy ra | – |
| $a_t$ | hành động được thực thi | output | – |

**Công thức**

$$w_i = e^{-m\,i}, \qquad a_t = \frac{\sum_i w_i\, A_t[i]}{\sum_i w_i}$$

**Các bước**

1. $w_0 = 1$, $w_1 = e^{-0{,}1} = 0{,}905$, $w_2 = e^{-0{,}2} = 0{,}819$. Tổng $= 2{,}724$.
2. Tử số: $1 \times 1{,}0 + 0{,}905 \times 1{,}2 + 0{,}819 \times 1{,}5 = 1{,}0 + 1{,}086 + 1{,}228 = 3{,}314$.
3. $a_t = 3{,}314 / 2{,}724 = 1{,}217$.

**Kết quả.** Hành động thực thi là 1,217, nằm giữa dự đoán cũ nhất (1,0) và mới nhất (1,5). Trung bình thường ($m = 0$) cho 1,233.

**Ý nghĩa.** Trung bình lấy trên các dự đoán cho *cùng một* bước, không phải các bước lân cận, nên chuyển động mượt mà không bị trễ. Chỉ tốn thời gian suy luận, không tốn huấn luyện. Lưu ý theo paper, dự đoán cũ nhất có $w_0$, trọng số lớn nhất.
</div>

**Horizon theo số liệu.** Một episode $T = 500$ bước với $k = 50$ cần $T/k = 10$ quyết định theo đoạn thay vì 500 quyết định từng bước ($T$ và $k$ minh họa; paper nêu mức giảm $k$ lần).

## 3. Vì sao có CVAE?

Con người giải cùng một tác vụ theo nhiều cách, và thay đổi nhiều hơn ở chỗ không cần chính xác. Chính sách huấn luyện bằng loss hồi quy thuần sẽ lấy trung bình các cách đó. CVAE cho mô hình một latent $z$ chỉ "cách nào", dùng khi huấn luyện và đặt bằng 0 khi chạy.

## 4. Trong VLA

- π0 xuất đoạn $H = 50$ hành động và chạy tới 50 Hz: [π0](pi0.html).
- Ở đó đoạn được tạo theo cách khác (flow matching thay cho CVAE): [flow matching](flowmatching.html).
- Với tác vụ nhạy lực, đoạn dài chạy hở phản ứng muộn khi chạm; đây là sự đánh đổi lặp lại trong các paper lực.

## 5. Lưu ý

- Cỡ chunk dùng trong thí nghiệm và giá trị $m$ không nằm trong phần paper tôi đọc nguyên văn; các ví dụ dùng giá trị minh họa.
- Số liệu ablation (ảnh hưởng của $k$, temporal ensembling, CVAE) đến từ bản tóm tắt nên không trích.
- Bảng II (thêm tác vụ thật) đọc ở dạng bị làm phẳng; tôi chỉ trích hai tác vụ ở trên.

**Mang theo:** các đoạn do ACT dự đoán là giải mã xác định từ một latent. π0 thay bằng flow matching: [π0](pi0.html).

**Câu hỏi kiểm tra:** $T = 600$, $k = 20$. Một episode cần bao nhiêu quyết định theo đoạn, và số quyết định giảm bao nhiêu lần?

<details markdown="1">
<summary>Đáp án</summary>

$600 / 20 = 30$ quyết định, thay vì 600: giảm $k = 20$ lần.
</details>
:::
