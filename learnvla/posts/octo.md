---
slug: octo
date: 2026-10-21
title_en: "Octo: An Open Generalist Policy You Can Re-wire When Fine-tuning"
title_vi: "Octo: Policy tổng quát mã mở, nối lại được khi fine-tune"
excerpt_en: "Octo is a 27M/93M transformer policy pre-trained on 800k Open X-Embodiment episodes, with a diffusion action head. Its block-wise attention lets you add a new sensor (a wrist F/T sensor for 1.5 mm peg insertion) or a new action space at fine-tuning time, with ~100 demos and about 5 hours on one GPU."
excerpt_vi: "Octo là policy transformer 27M/93M tiền huấn luyện trên 800k episode Open X-Embodiment, với đầu ra hành động dạng diffusion. Attention theo khối cho phép thêm cảm biến mới (cảm biến F/T cổ tay cho lắp chốt dung sai 1,5 mm) hoặc không gian hành động mới lúc fine-tune, với khoảng 100 demo và khoảng 5 giờ trên một GPU."
tags: [VLA, Paper Notes, Octo, Generalist policy]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Octo Model Team (Ghosh, Walke, Pertsch, Black, Mees et al.), *Octo: An Open-Source Generalist Robot Policy*, [arXiv 2405.12213](https://arxiv.org/abs/2405.12213) · 05/2024

**PROBLEM** A pre-trained robot policy is only useful if a lab can adapt it to *its* robot: other cameras, other sensors, other action spaces, with a small dataset and modest compute.

**WHAT FAILED BEFORE** Earlier generalist robot policies fixed their inputs and outputs: models built from a pre-trained visual backbone fused with an MLP head "lock in the type and order of inputs", so a new sensor or action space means re-initialising much of the model. The best openly available one, RT-1-X, also supports only language instructions, and none released a full training pipeline.

**IDEA** A "transformer-first" policy: light tokenizers (t5-base for language, a shallow CNN for images), one transformer with *block-wise* masked attention, *readout* tokens that only read, and a diffusion head that outputs an action chunk. New inputs or heads can be added at fine-tuning time because nothing else depends on their position.

**RESULT** Pre-trained on 800k episodes from 25 OXE datasets. Zero-shot: 29% higher success than RT-1-X on average, similar to RT-2-X (55B). Fine-tuned on 6 new setups with ~100 demos each: 72% average vs 20% from scratch and 15% for VC-1, including 70% on a 1.5 mm peg insertion that uses a wrist force/torque sensor.
</div>

## 1. The problem: a policy you cannot re-wire is hard to reuse

[[flow]]
- Before~Fixed-input policy | Pre-trained encoder + MLP head > !Inputs locked~new sensor = re-initialise! > Your robot | train from scratch on your data
+ Octo | Tokens per input > *Block-wise masked transformer~readout tokens + diffusion head* > Your robot | add F/T tokens or a new head, fine-tune with ~100 demos
[[/flow]] The change is the layout: inputs are separate token groups and outputs are separate readouts, so they can be added or removed.

## 2. Architecture

[[fig:octo]] Each input becomes its own group of tokens. Observation tokens attend causally to earlier steps and to the task; readout tokens only read. A small diffusion head turns the readout embedding into an action chunk.

| Part | Octo |
|---|---|
| Language | pre-trained t5-base (111M) → 16 tokens; or a goal image instead |
| Images | shallow CNN, split into patches (as in ViT); 2 frames of history |
| Backbone | Octo-Small 12 layers, width 384, 27M; Octo-Base 12 layers, width 768, 93M |
| Attention | block-wise: observation tokens see the task and the same or earlier steps; tokens of missing inputs are fully masked |
| Readout tokens | attend to everything before them, nothing attends to them (like BERT's [CLS]) |
| Action head | 3-layer MLP (hidden 256) trained with the DDPM objective, predicts a chunk |
| Data | 25 curated OXE datasets, 800k episodes, re-weighted for size and diversity |
| Training | ViT-B sized model: 300k steps, batch 2048, 14 h on a TPU v4-128 pod; fine-tuning ~5 h on one 24 GB A5000 |

Lessons the paper lists that recur on this site: action chunking helped (temporal ensembling added nothing on top); **adding proprioception generally made policies worse**, which the authors attribute to causal confusion between state and future actions (the [copycat problem](proprioception.html)); diffusion beat MSE and discretised heads.

<div class="calc" markdown="1">

Calculation card

**What and why.** To fine-tune Octo on a robot with a wrist F/T sensor, a new tokenizer turns the 6-number wrench into a token of the backbone's width. How many new parameters is that, compared with the whole model? (Illustrative: one linear layer per reading; the paper does not spell out its F/T tokenizer.)

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $k$ | numbers per F/T reading | input | 6 ($F_x, F_y, F_z, T_x, T_y, T_z$) |
| $D$ | backbone width | input | 768 (Octo-Base) |
| $P_{new}$ | parameters of the new tokenizer | output | – |
| $P$ | Octo-Base parameters | input | 93M |

**Formula**

$$P_{new} = k \times D + D$$

**Steps**

1. Weights: $6 \times 768 = 4{,}608$.
2. Bias: $768$.
3. $P_{new} = 5{,}376$.
4. Share: $5{,}376 / 93{,}000{,}000 \approx 0.006\%$.

**Result.** About 5.4K new parameters on a 93M model.

**Why it matters.** The new token is tiny, so everything rests on the pre-trained backbone learning to *use* it from ~100 demos. That is why the block-wise mask matters: the force token can be added without disturbing what the other tokens attend to, and without re-initialising anything.
</div>

## 3. Results

[[bars:%]] Scratch=20; VC-1=15; *Octo=72* || Average over six fine-tuning setups, ~100 demos each, 20 trials per setup (Table I).

| Fine-tuning setup (20 trials each) | Scratch | VC-1 | Octo | What is new |
|---|---|---|---|---|
| Berkeley Insertion | 10% | 5% | 70% | F/T observation |
| Stanford Coffee | 45% | 0% | 75% | – |
| CMU Baking | 25% | 30% | 50% | – |
| Berkeley Pick-Up | 0% | 0% | 60% | joint-position actions |
| Berkeley Coke | 20% | 10% | 100% | new robot |
| Berkeley Bimanual | 20% | 50% | 80% | 14-D joint actions, two arms |

The insertion task is the one closest to contact-rich work: insert a pre-grasped peg into a slot with **1.5 mm tolerance**, searching through contact. The policy sees one side camera, the end-effector twist and the **end-effector force/torque**, and outputs end-effector twists at 5 Hz, which a 1 kHz impedance controller tracks. Fine-tuning data: 100 human demos from the FMB dataset.

## 4. For a UR10e reader

This is the most direct "generalist + F/T sensor" recipe among the classic VLA-era papers: a UR-type arm is in the pre-training mix (the Berkeley UR5 dataset is 1.5% of it) and the paper ran zero-shot evaluations on a UR5. The insertion setup maps onto a UR10e with its built-in F/T sensor: wrench in, twist or pose delta out, a compliant low-level controller underneath. Two warnings from the paper itself: proprioceptive inputs can cause copycat behaviour, and Octo has no VLM, so its language understanding is limited to what t5 embeddings and robot data give.

## 5. Caveats

- Checked against the full text: architecture table, data mix, training compute, Table I, the insertion setup and the "what did not work" list.
- The tokenizer in the calculation card is an illustration; read the released code for the actual F/T tokenizer before re-using it.

**Carry forward:** [OpenVLA](openvla.html) answers Octo's weak spot by putting a 7B VLM in front; [π0](pi0.html) keeps Octo's continuous action head idea but uses flow matching on top of a VLM.

**Check question:** Octo-Small has width 384. How many parameters does a linear tokenizer for a 6-D wrench plus a 1-D gripper width (7 numbers) add?

<details markdown="1">
<summary>Answer</summary>

$7 \times 384 + 384 = 2{,}688 + 384 = 3{,}072$ parameters.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Octo Model Team (Ghosh, Walke, Pertsch, Black, Mees và cộng sự), *Octo: An Open-Source Generalist Robot Policy*, [arXiv 2405.12213](https://arxiv.org/abs/2405.12213) · 05/2024

**VẤN ĐỀ** Một policy robot tiền huấn luyện chỉ có ích nếu một lab chỉnh được nó cho robot *của họ*: camera khác, cảm biến khác, không gian hành động khác, với bộ dữ liệu nhỏ và tài nguyên tính toán vừa phải.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các policy robot tổng quát trước đó cố định đầu vào và đầu ra: mô hình ghép backbone thị giác tiền huấn luyện với đầu MLP "khóa cứng loại và thứ tự đầu vào", nên thêm cảm biến hay không gian hành động mới là phải khởi tạo lại phần lớn mô hình. Policy mở tốt nhất lúc đó, RT-1-X, cũng chỉ nhận câu lệnh ngôn ngữ, và không ai công bố toàn bộ quy trình huấn luyện.

**Ý TƯỞNG** Một policy "transformer là chính": tokenizer nhẹ (t5-base cho ngôn ngữ, CNN nông cho ảnh), một transformer với attention có mask *theo khối*, các token *readout* chỉ đọc, và một đầu diffusion xuất ra chunk hành động. Đầu vào hay đầu ra mới thêm được lúc fine-tune vì không phần nào khác phụ thuộc vào vị trí của chúng.

**KẾT QUẢ** Tiền huấn luyện trên 800k episode từ 25 bộ OXE. Không fine-tune: thành công cao hơn RT-1-X trung bình 29%, tương đương RT-2-X (55B). Fine-tune trên 6 bộ mới với khoảng 100 demo mỗi bộ: trung bình 72% so với 20% khi học từ đầu và 15% với VC-1, gồm 70% ở bài lắp chốt dung sai 1,5 mm dùng cảm biến lực/mô-men cổ tay.
</div>

## 1. Vấn đề: policy không nối lại được thì khó tái sử dụng

[[flow]]
- Trước~Policy đầu vào cố định | Encoder tiền huấn luyện + đầu MLP > !Đầu vào bị khóa~cảm biến mới = khởi tạo lại! > Robot của bạn | học lại từ đầu trên dữ liệu của bạn
+ Octo | Mỗi đầu vào một nhóm token > *Transformer mask theo khối~token readout + đầu diffusion* > Robot của bạn | thêm token F/T hoặc đầu mới, fine-tune với ~100 demo
[[/flow]] Thay đổi là cách bố trí: đầu vào là các nhóm token riêng, đầu ra là các readout riêng, nên thêm hay bớt được.

## 2. Kiến trúc

[[fig:octo]] Mỗi đầu vào thành một nhóm token riêng. Token quan sát chú ý nhân quả tới các bước trước và tới tác vụ; token readout chỉ đọc. Một đầu diffusion nhỏ biến embedding của readout thành chunk hành động.

| Phần | Octo |
|---|---|
| Ngôn ngữ | t5-base đã tiền huấn luyện (111M) → 16 token; hoặc thay bằng ảnh đích |
| Ảnh | CNN nông, cắt thành ô (như ViT); lịch sử 2 khung |
| Backbone | Octo-Small 12 lớp, rộng 384, 27M; Octo-Base 12 lớp, rộng 768, 93M |
| Attention | theo khối: token quan sát thấy tác vụ và các bước cùng lúc hoặc trước đó; token của đầu vào không có thì bị che hoàn toàn |
| Token readout | chú ý tới mọi thứ trước nó, không gì chú ý tới nó (giống [CLS] của BERT) |
| Đầu hành động | MLP 3 lớp (ẩn 256) học bằng mục tiêu DDPM, dự đoán một chunk |
| Dữ liệu | 25 bộ OXE chọn lọc, 800k episode, cân lại theo kích thước và độ đa dạng |
| Huấn luyện | cỡ ViT-B: 300k bước, batch 2048, 14 giờ trên TPU v4-128; fine-tune ~5 giờ trên một A5000 24 GB |

Những bài học paper liệt kê mà trang này gặp lại nhiều lần: action chunking có ích (temporal ensembling không thêm gì); **thêm cảm thụ bản thể thường làm policy tệ hơn**, tác giả cho là do nhầm lẫn nhân quả giữa trạng thái và hành động tương lai ([bài toán copycat](proprioception.html)); diffusion thắng đầu MSE và đầu rời rạc.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Để fine-tune Octo cho robot có cảm biến F/T cổ tay, một tokenizer mới biến wrench 6 số thành một token có độ rộng của backbone. Nó thêm bao nhiêu tham số so với toàn mô hình? (Minh họa: một lớp tuyến tính cho mỗi lần đọc; paper không mô tả chi tiết tokenizer F/T.)

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $k$ | số giá trị mỗi lần đọc F/T | đầu vào | 6 ($F_x, F_y, F_z, T_x, T_y, T_z$) |
| $D$ | độ rộng backbone | đầu vào | 768 (Octo-Base) |
| $P_{new}$ | tham số của tokenizer mới | đầu ra | – |
| $P$ | tham số Octo-Base | đầu vào | 93M |

**Công thức**

$$P_{new} = k \times D + D$$

**Các bước**

1. Trọng số: $6 \times 768 = 4.608$.
2. Bias: $768$.
3. $P_{new} = 5.376$.
4. Tỉ lệ: $5.376 / 93.000.000 \approx 0{,}006\%$.

**Kết quả.** Khoảng 5,4K tham số mới trên mô hình 93M.

**Vì sao quan trọng.** Token mới rất nhỏ, nên mọi thứ dựa vào việc backbone đã tiền huấn luyện học cách *dùng* nó từ khoảng 100 demo. Vì vậy mask theo khối quan trọng: token lực được thêm vào mà không làm xáo trộn những gì các token khác đang chú ý, và không phải khởi tạo lại gì.
</div>

## 3. Kết quả

[[bars:%]] Học từ đầu=20; VC-1=15; *Octo=72* || Trung bình trên sáu bộ fine-tune, ~100 demo mỗi bộ, 20 lượt thử mỗi bộ (Bảng I).

| Bộ fine-tune (20 lượt mỗi bộ) | Từ đầu | VC-1 | Octo | Cái gì mới |
|---|---|---|---|---|
| Berkeley Insertion | 10% | 5% | 70% | quan sát F/T |
| Stanford Coffee | 45% | 0% | 75% | – |
| CMU Baking | 25% | 30% | 50% | – |
| Berkeley Pick-Up | 0% | 0% | 60% | hành động vị trí khớp |
| Berkeley Coke | 20% | 10% | 100% | robot mới |
| Berkeley Bimanual | 20% | 50% | 80% | hành động khớp 14 chiều, hai tay |

Bài lắp chốt là bài gần với công việc nhiều tiếp xúc nhất: cắm một chốt đã kẹp sẵn vào khe với **dung sai 1,5 mm**, dò tìm bằng tiếp xúc. Policy thấy một camera bên, twist của đầu cuối và **lực/mô-men ở đầu cuối**, và xuất twist đầu cuối ở 5 Hz, được một bộ điều khiển trở kháng 1 kHz bám theo. Dữ liệu fine-tune: 100 demo người từ bộ FMB.

## 4. Với người dùng UR10e

Đây là công thức "policy tổng quát + cảm biến F/T" trực tiếp nhất trong các paper VLA kinh điển: tay kiểu UR có trong dữ liệu tiền huấn luyện (bộ Berkeley UR5 chiếm 1,5%) và paper có đánh giá không fine-tune trên UR5. Bài lắp chốt ánh xạ thẳng lên UR10e với cảm biến F/T tích hợp: wrench vào, twist hoặc delta tư thế ra, bên dưới là một bộ điều khiển mềm. Hai cảnh báo từ chính paper: đầu vào cảm thụ bản thể có thể gây hành vi copycat, và Octo không có VLM, nên khả năng hiểu ngôn ngữ chỉ giới hạn ở những gì embedding t5 và dữ liệu robot cho.

## 5. Lưu ý

- Đã đối chiếu với toàn văn: bảng kiến trúc, tỉ lệ dữ liệu, tài nguyên huấn luyện, Bảng I, thiết lập bài lắp chốt và danh sách "những gì chưa hiệu quả".
- Tokenizer trong thẻ tính tay chỉ là minh họa; đọc mã đã công bố để biết tokenizer F/T thật trước khi dùng lại.

**Mang theo:** [OpenVLA](openvla.html) bù điểm yếu của Octo bằng cách đặt một VLM 7B phía trước; [π0](pi0.html) giữ ý tưởng đầu hành động liên tục của Octo nhưng dùng flow matching trên nền một VLM.

**Câu hỏi kiểm tra:** Octo-Small rộng 384. Một tokenizer tuyến tính cho wrench 6 chiều cộng độ mở tay kẹp 1 chiều (7 số) thêm bao nhiêu tham số?

<details markdown="1">
<summary>Đáp án</summary>

$7 \times 384 + 384 = 2.688 + 384 = 3.072$ tham số.
</details>
:::
