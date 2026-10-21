---
slug: rt-1-rt-2
date: 2026-10-21
title_en: "RT-1 and RT-2: From a Robot Transformer to the First VLA"
title_vi: "RT-1 và RT-2: Từ Robot Transformer tới VLA đầu tiên"
excerpt_en: "RT-1 showed that a 35M-parameter Transformer trained on 130k real demos can run 700+ instructions at 97% success. RT-2 replaced its backbone with a web-scale VLM and wrote actions as text tokens, doubling success on unseen objects, backgrounds and environments (32% → 62%). It named the model class: vision-language-action."
excerpt_vi: "RT-1 cho thấy một Transformer 35M tham số học từ 130k demo thật chạy được hơn 700 câu lệnh với 97% thành công. RT-2 thay backbone bằng một VLM cỡ web và viết hành động như token chữ, tăng gấp đôi thành công với vật, nền và môi trường chưa thấy (32% → 62%). Nó đặt tên cho lớp mô hình: vision-language-action."
tags: [VLA, Paper Notes, RT-1, RT-2]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Brohan et al., *RT-1: Robotics Transformer for Real-World Control at Scale*, [arXiv 2212.06817](https://arxiv.org/abs/2212.06817) · 12/2022. Brohan et al., *RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control*, [arXiv 2307.15818](https://arxiv.org/abs/2307.15818) · 07/2023.

**PROBLEM** One policy for hundreds of everyday instructions on a real mobile manipulator, which also handles objects, backgrounds and requests it was never shown.

**WHAT FAILED BEFORE** For RT-1: multi-task robot policies were trained on small, narrow datasets, and large models were too slow for closed-loop control (Gato at 1.2B took 1.9 s per step on the robot). For RT-2: RT-1 learns only from robot data, so it knows only the objects and words in its demos; on unseen objects, backgrounds and environments it averages 32%.

**IDEA** RT-1: compress images hard (FiLM-conditioned EfficientNet, then TokenLearner keeps 8 tokens per image) so a Transformer can run at 3 Hz, and train on 130k demos. RT-2: take a pre-trained VLM, write each action as a string of integers ("1 128 91 241 5 101 127"), and *co-fine-tune* on robot data together with the original web data.

**RESULT** RT-1: 97% on 200+ seen instructions, 76% on 21 unseen ones. RT-2: same seen-task success (91–93% vs RT-1's 92%), unseen average 62% vs 32%, and 60% vs 17% on "emergent" tests (symbols, reasoning, people) that need web knowledge.
</div>

## 1. The problem: robot data alone does not know the world

[[flow]]
- Before~RT-1 | Robot images + instruction > !Small transformer~trained on robot demos only! > Action tokens | strong on seen tasks, 32% unseen average
+ RT-2 | Robot images + instruction > *Web-pretrained VLM~co-fine-tuned with web data* > Action as text | 62% unseen average, follows "move banana near the sum of two plus one"
[[/flow]] The change is where knowledge comes from: a VLM already knows objects, symbols and words that never appear in robot data.

## 2. Two architectures, one action format

[[fig:rt-1-rt-2]] RT-1 is built for speed from robot data. RT-2 keeps the binned action format but makes the model a VLM that answers in action tokens.

| | RT-1 | RT-2 |
|---|---|---|
| Backbone | FiLM EfficientNet-B3 (16M) + TokenLearner + 8-layer Transformer (19M); 35M total | PaLI-X (5B, 55B) or PaLM-E (12B) |
| Input | 6 images (300×300), instruction via a sentence encoder | image + "Q: what action should the robot take to [task]? A:" |
| Action | 11 dims (arm 7, base 3, mode 1), 256 uniform bins each | 8 tokens: terminate, 6 end-effector deltas, gripper; 256 bins |
| Token for a bin | its own action vocabulary | PaLI-X: the existing token for the integer; PaLM-E: overwrite the 256 least-used tokens |
| Training data | ~130k demos, 700+ instructions, 13 robots, 17 months | the same robot data + the VLM's web data, robot data up-weighted |
| Rate | 3 Hz on the robot | 55B: 1–3 Hz, 5B: ~5 Hz, served from cloud TPUs |

Two training details carry over to later VLAs. RT-2 *constrains decoding* so that, when asked for an action, only valid action tokens can be sampled. And it shows that co-fine-tuning with web data generalises better than fine-tuning on robot data alone.

<div class="calc" markdown="1">

Calculation card

**What and why.** Why did RT-1 need TokenLearner to hit 3 Hz? Count the tokens and attention pairs its Transformer would see with and without it.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F$ | images in the history | input | 6 (paper) |
| $t_0$ | tokens per image from EfficientNet | input | 81 ($9 \times 9$ map) |
| $t_1$ | tokens per image after TokenLearner | input | 8 |
| $n$ | tokens the Transformer attends over | output | – |
| $n^2$ | attention pairs per layer | output | – |

**Formula**

$$n = F \times t, \qquad \text{pairs} = n^2$$

**Steps**

1. Without TokenLearner: $n = 6 \times 81 = 486$, pairs $= 486^2 = 236{,}196$.
2. With it: $n = 6 \times 8 = 48$, pairs $= 48^2 = 2{,}304$.
3. Ratio: $236{,}196 / 2{,}304 = 102.5$.

**Result.** About 100× fewer attention pairs in every one of the 8 layers.

**Why it matters.** The paper's latency budget was under 100 ms per step. RT-2 could not use this trick (the VLM is fixed), so it ran a 55B model on cloud TPUs at 1–3 Hz instead: the price of web knowledge was speed, which later work (OpenVLA at 7B, then π0's action chunks) set out to recover.
</div>

## 3. What the papers report

[[bars:%]] RT-1 seen=92; RT-1 unseen avg=32; *RT-2 PaLI-X seen=91*; *RT-2 PaLI-X unseen avg=62*; RT-1 emergent=17; *RT-2 PaLI-X emergent=60* || RT-2 Tables 6 and 7. Seen tasks stay the same; generalisation and web-knowledge tests roughly double or triple.

- **RT-1:** 97% on more than 200 seen instructions (25 points above BC-Z, 32 above Gato); 76% on 21 unseen instructions; 25%, 36% and 18% better than the next baseline on new tasks, distractors and backgrounds. Over 3,000 real trials.
- **RT-2:** about 6,000 real trials. Unseen objects, backgrounds and environments: both RT-2 variants average 62% against RT-1's 32% and MOO's 35%. Emergent tests: RT-2-PaLI-X 60% average, RT-2-PaLM-E 40%, RT-1 17%.
- **RT-2's stated limits:** it does not learn new *motions* from the web, only new semantics; the large models are expensive and slow.

## 4. What later VLAs kept and changed

| Kept | Changed later |
|---|---|
| a VLM backbone, co-training with web data | open weights and smaller size: [OpenVLA](openvla.html) (7B) |
| tokens for actions, one per dimension | compressed tokens ([FAST](action-tokenization.html)) or continuous chunks ([π0](pi0.html), flow matching) |
| one step per inference | chunks of 50 steps at up to 50 Hz |

## 5. Caveats

- Checked against both full texts: architecture numbers, action format, data counts, rates, and Tables 6 and 7 of RT-2.
- RT-2 weights were not released. RT-1 and RT-1-X checkpoints are public, and [SimplerEnv](simplerenv.html) ships inference code for them; its RT-2-X numbers come from the Google authors.

**Carry forward:** [OpenVLA](openvla.html) is the open, 7B version of the RT-2 recipe. [Action tokenization](action-tokenization.html) explains the binning both papers use.

**Check question:** RT-1 with a history of 4 images and TokenLearner keeping 6 tokens per image: how many attention pairs per layer, compared with 4 × 81 tokens?

<details markdown="1">
<summary>Answer</summary>

$n = 24$, pairs $= 576$. Without it: $n = 324$, pairs $= 104{,}976$. Ratio about 182.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Brohan và cộng sự, *RT-1: Robotics Transformer for Real-World Control at Scale*, [arXiv 2212.06817](https://arxiv.org/abs/2212.06817) · 12/2022. Brohan và cộng sự, *RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control*, [arXiv 2307.15818](https://arxiv.org/abs/2307.15818) · 07/2023.

**VẤN ĐỀ** Một policy cho hàng trăm câu lệnh hằng ngày trên một tay máy di động thật, xử lý được cả vật, nền và yêu cầu chưa từng được dạy.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Với RT-1: policy đa tác vụ được học trên bộ dữ liệu nhỏ, hẹp, còn mô hình lớn thì quá chậm cho điều khiển vòng kín (Gato 1,2B mất 1,9 s mỗi bước trên robot). Với RT-2: RT-1 chỉ học từ dữ liệu robot, nên chỉ biết những vật và từ có trong demo; với vật, nền và môi trường chưa thấy nó đạt trung bình 32%.

**Ý TƯỞNG** RT-1: nén ảnh thật mạnh (EfficientNet có điều kiện FiLM, rồi TokenLearner giữ 8 token mỗi ảnh) để Transformer chạy được 3 Hz, và học trên 130k demo. RT-2: lấy một VLM đã tiền huấn luyện, viết mỗi hành động thành chuỗi số nguyên ("1 128 91 241 5 101 127"), và *co-fine-tune* trên dữ liệu robot cùng với dữ liệu web gốc.

**KẾT QUẢ** RT-1: 97% trên hơn 200 câu lệnh đã thấy, 76% trên 21 câu lệnh chưa thấy. RT-2: thành công với tác vụ đã thấy giữ nguyên (91–93% so với 92% của RT-1), trung bình phần chưa thấy 62% so với 32%, và 60% so với 17% ở các bài thử "năng lực nổi lên" (ký hiệu, suy luận, nhận người) cần tri thức web.
</div>

## 1. Vấn đề: chỉ dữ liệu robot thì không biết về thế giới

[[flow]]
- Trước~RT-1 | Ảnh robot + câu lệnh > !Transformer nhỏ~chỉ học từ demo robot! > Token hành động | mạnh với tác vụ đã thấy, chưa thấy trung bình 32%
+ RT-2 | Ảnh robot + câu lệnh > *VLM tiền huấn luyện trên web~co-fine-tune cùng dữ liệu web* > Hành động dạng chữ | chưa thấy trung bình 62%, làm được "đưa quả chuối tới tổng của hai cộng một"
[[/flow]] Thay đổi là tri thức đến từ đâu: VLM đã biết những vật, ký hiệu và từ ngữ không bao giờ xuất hiện trong dữ liệu robot.

## 2. Hai kiến trúc, một định dạng hành động

[[fig:rt-1-rt-2]] RT-1 được dựng cho tốc độ từ dữ liệu robot. RT-2 giữ định dạng hành động chia bin nhưng biến mô hình thành một VLM trả lời bằng token hành động.

| | RT-1 | RT-2 |
|---|---|---|
| Backbone | FiLM EfficientNet-B3 (16M) + TokenLearner + Transformer 8 lớp (19M); tổng 35M | PaLI-X (5B, 55B) hoặc PaLM-E (12B) |
| Đầu vào | 6 ảnh (300×300), câu lệnh qua bộ mã hóa câu | ảnh + "Q: robot nên làm hành động gì để [tác vụ]? A:" |
| Hành động | 11 chiều (tay 7, đế 3, chế độ 1), mỗi chiều 256 bin đều | 8 token: kết thúc, 6 delta đầu cuối, tay kẹp; 256 bin |
| Token cho mỗi bin | từ vựng hành động riêng | PaLI-X: token sẵn có của số nguyên đó; PaLM-E: ghi đè 256 token ít dùng nhất |
| Dữ liệu học | ~130k demo, hơn 700 câu lệnh, 13 robot, 17 tháng | cùng dữ liệu robot + dữ liệu web của VLM, tăng trọng số dữ liệu robot |
| Tần số | 3 Hz trên robot | 55B: 1–3 Hz, 5B: ~5 Hz, chạy trên TPU đám mây |

Hai chi tiết huấn luyện được các VLA sau giữ lại. RT-2 *ràng buộc giải mã* để khi được hỏi hành động thì chỉ token hành động hợp lệ mới được lấy mẫu. Và nó cho thấy co-fine-tune cùng dữ liệu web tổng quát tốt hơn fine-tune chỉ trên dữ liệu robot.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Vì sao RT-1 cần TokenLearner để đạt 3 Hz? Đếm số token và số cặp attention mà Transformer phải xử lý khi có và không có nó.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F$ | số ảnh trong lịch sử | đầu vào | 6 (paper) |
| $t_0$ | token mỗi ảnh ra từ EfficientNet | đầu vào | 81 (bản đồ $9 \times 9$) |
| $t_1$ | token mỗi ảnh sau TokenLearner | đầu vào | 8 |
| $n$ | số token Transformer phải chú ý | đầu ra | – |
| $n^2$ | số cặp attention mỗi lớp | đầu ra | – |

**Công thức**

$$n = F \times t, \qquad \text{số cặp} = n^2$$

**Các bước**

1. Không có TokenLearner: $n = 6 \times 81 = 486$, số cặp $= 486^2 = 236.196$.
2. Có nó: $n = 6 \times 8 = 48$, số cặp $= 48^2 = 2.304$.
3. Tỉ lệ: $236.196 / 2.304 = 102{,}5$.

**Kết quả.** Ít hơn khoảng 100 lần số cặp attention ở mỗi lớp trong 8 lớp.

**Vì sao quan trọng.** Ngân sách độ trễ của paper là dưới 100 ms mỗi bước. RT-2 không dùng được mẹo này (VLM đã cố định), nên phải chạy mô hình 55B trên TPU đám mây ở 1–3 Hz: cái giá của tri thức web là tốc độ, và các công trình sau (OpenVLA 7B, rồi action chunk của π0) tìm cách lấy lại nó.
</div>

## 3. Các paper báo cáo gì

[[bars:%]] RT-1 seen=92; RT-1 unseen avg=32; *RT-2 PaLI-X seen=91*; *RT-2 PaLI-X unseen avg=62*; RT-1 emergent=17; *RT-2 PaLI-X emergent=60* || Bảng 6 và 7 của RT-2. Tác vụ đã thấy giữ nguyên; tổng quát hóa và các bài thử tri thức web tăng khoảng hai đến ba lần.

- **RT-1:** 97% trên hơn 200 câu lệnh đã thấy (hơn BC-Z 25 điểm, hơn Gato 32 điểm); 76% trên 21 câu lệnh chưa thấy; tốt hơn baseline kế tiếp 25%, 36% và 18% với tác vụ mới, vật gây nhiễu và nền mới. Hơn 3.000 lượt thử thật.
- **RT-2:** khoảng 6.000 lượt thử thật. Vật, nền và môi trường chưa thấy: cả hai biến thể RT-2 đạt trung bình 62% so với 32% của RT-1 và 35% của MOO. Bài thử năng lực nổi lên: RT-2-PaLI-X trung bình 60%, RT-2-PaLM-E 40%, RT-1 17%.
- **Giới hạn RT-2 tự nêu:** nó không học được *cử động* mới từ web, chỉ học ngữ nghĩa mới; mô hình lớn thì đắt và chậm.

## 4. VLA sau này giữ gì và đổi gì

| Giữ lại | Đổi về sau |
|---|---|
| backbone VLM, đồng huấn luyện với dữ liệu web | trọng số mở và nhỏ hơn: [OpenVLA](openvla.html) (7B) |
| token cho hành động, mỗi chiều một token | token nén ([FAST](action-tokenization.html)) hoặc chunk liên tục ([π0](pi0.html), flow matching) |
| mỗi lần suy luận một bước | chunk 50 bước, tới 50 Hz |

## 5. Lưu ý

- Đã đối chiếu với toàn văn cả hai paper: số liệu kiến trúc, định dạng hành động, số lượng dữ liệu, tần số, và Bảng 6, 7 của RT-2.
- Trọng số RT-2 không được công bố. Checkpoint RT-1 và RT-1-X là công khai, và [SimplerEnv](simplerenv.html) có sẵn mã suy luận cho chúng; số của RT-2-X trong đó do các tác giả Google chạy.

**Mang theo:** [OpenVLA](openvla.html) là phiên bản mở, 7B của công thức RT-2. [Action tokenization](action-tokenization.html) giải thích cách chia bin mà cả hai paper dùng.

**Câu hỏi kiểm tra:** RT-1 với lịch sử 4 ảnh và TokenLearner giữ 6 token mỗi ảnh: mỗi lớp có bao nhiêu cặp attention, so với 4 × 81 token?

<details markdown="1">
<summary>Đáp án</summary>

$n = 24$, số cặp $= 576$. Không có nó: $n = 324$, số cặp $= 104.976$. Tỉ lệ khoảng 182.
</details>
:::
