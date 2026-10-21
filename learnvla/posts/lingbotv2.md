---
slug: lingbotv2
date: 2026-10-21
title_en: "LingBot-VLA 2.0: 60,000 Hours, Whole-Body Actions and Predicted Futures"
title_vi: "LingBot-VLA 2.0: 60.000 giờ, hành động toàn thân và dự đoán tương lai"
excerpt_en: "LingBot-VLA 2.0 (Robbyant / Ant Group) pre-trains on ~60,000 hours (50,000 h of robot data from 20 configurations plus 10,000 h of human egocentric video), adds head, waist, base and hand degrees of freedom, a sparse MoE action expert, and distils depth and video-future features into the VLM. On nine GM-100 tasks it reaches 66.2 progress / 34.4% success, ahead of π0.5 (59.1 / 32.2)."
excerpt_vi: "LingBot-VLA 2.0 (Robbyant / Ant Group) tiền huấn luyện trên ~60.000 giờ (50.000 giờ dữ liệu robot từ 20 cấu hình cộng 10.000 giờ video người góc nhìn thứ nhất), thêm bậc tự do cho đầu, eo, đế và bàn tay, một action expert MoE thưa, và chưng cất đặc trưng độ sâu và tương lai video vào VLM. Trên chín tác vụ GM-100 nó đạt 66,2 tiến độ / 34,4% thành công, hơn π0.5 (59,1 / 32,2)."
tags: [VLA, Paper Notes, LingBot, MoE]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Robbyant (Ant Group), *From Foundation to Application: Improving VLA Models in Practice* (LingBot-VLA 2.0), [arXiv 2607.06403](https://arxiv.org/abs/2607.06403) · 07/2026. Weights on Hugging Face (Apache-2.0).

**PROBLEM** Move a VLA from benchmark results to robots in use: many embodiments, whole-body robots (heads, waists, mobile bases, dexterous hands), and scenes that change while the robot acts.

**WHAT FAILED BEFORE** The paper's diagnosis of its own first version and of similar VLAs: limited data coverage across tasks and bodies; action spaces built for two arms only; and VLMs that encode the current frame well but do not model how the scene will evolve. It notes that image features such as DINOv3 capture geometry but "not the causal temporal dynamics required for robotic control".

**IDEA** Three changes. (1) Data: a rebuilt pipeline and ~60,000 hours (50,000 h robot, 20 configurations; 10,000 h egocentric human video with hands lifted to 3D). (2) Action space: whole-body degrees of freedom, and a token-level sparse MoE in the action expert with loss-free load balancing. (3) Predictive dynamics: two learnable queries (now and one chunk ahead) distilled from a depth teacher and a new causal video teacher, DINO-Video.

**RESULT** GM-100, nine tasks, generalist setting, Agilex Cobot Magic: 66.2 progress / 34.4% success vs π0.5 59.1 / 32.2 and LingBot-VLA 1.0 58.2 / 30.0. Galaxea R1 Pro: 34.6 / 15.6 vs π0.5 27.4 / 8.9. Long-horizon mobile tasks: ahead of π0.5 in and out of distribution.
</div>

## 1. The problem: from lab VLA to deployed whole-body robot

[[flow]]
- Before~LingBot-VLA 1.0 / π0.5 | Dual-arm data > !Current-frame VLM~arms only, no future prediction! > Bimanual actions | gaps on bodies, scenes and timing
+ LingBot-VLA 2.0 | 60,000 h robot + human video > *Future query distilled from depth + video~sparse MoE action expert* > Whole-body actions | head, waist, base, hands
[[/flow]] The change is spread across data, action space and an auxiliary objective, rather than one new block.

## 2. Architecture and data

[[fig:lingbotv2]] Two queries appended to the VLM tokens are trained to match a depth teacher and a video teacher, for the current frame and the frame one chunk ahead; the action expert uses sparse MoE layers.

| Part | LingBot-VLA 2.0 |
|---|---|
| Robot data | ~50,000 h, 20 robot configurations, standardised into a unified action representation |
| Human data | ~10,000 h egocentric video; SLAM for camera poses, hand pose estimation (MANO), hand trajectories in world frame, quality filtering |
| Annotation | a VLM (Qwen3.6-27B) segments each video into subtasks, writes instructions and assigns an atomic action label |
| Action expert | token-level sparse MoE in the FFN branch; auxiliary-loss-free load balancing with router bias updates |
| Predictive dynamics | queries $Q_t$, $Q_{t+T}$ ($T$ = chunk size) distilled from LingBot-Depth and DINO-Video |
| DINO-Video | built on DINOv3 with causal temporal attention: a step's feature depends only on current and past frames |

Two connections to the foundation posts: the MoE balancing replaces the auxiliary loss of [MoE](moe.html) with a bias that is nudged after each step towards under-used experts, and the future query is a form of [distillation](distillation.html) where the teachers are perception models, not a bigger policy.

<div class="calc" markdown="1">

Calculation card

**What and why.** On GM-100 (Cobot Magic) LingBot-VLA 2.0 averages 34.4% success and π0.5 32.2%. Is a 2.2-point gap over nine tasks meaningful? (Assumption: 10 trials per task, which fits the table, where every success value is a multiple of 10; the paper does not state it for this table.)

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n$ | total trials | input | $9 \times 10 = 90$ |
| $k$ | successes | input | LingBot: $0.344 \times 90 \approx 31$; π0.5: $0.322 \times 90 \approx 29$ |
| CI | Wilson 95% interval | output | – |

**Formula** (Wilson)

$$\frac{\hat p + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat p(1-\hat p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

**Steps**

1. LingBot: $\hat p = 31/90 = 0.344$ → interval 25.4% to 44.7%.
2. π0.5: $\hat p = 29/90 = 0.322$ → interval 23.5% to 42.4%.
3. The intervals overlap almost entirely.

**Result.** The success-rate gap is about 2 successes out of 90; it does not separate the two models.

**Why it matters.** Per task the picture is mixed: π0.5 is far ahead on block sorting (60% vs 0%) and tool packing (30% vs 0%), LingBot-VLA 2.0 far ahead on retrieving a keychain (100% vs 20%). The progress score, which counts sub-steps, separates them more (66.2 vs 59.1), and on the second robot (Galaxea R1 Pro) the gap is larger. Read the average together with the per-task table.
</div>

## 3. Results

| GM-100, 9 tasks, average (Table 5) | GR00T N1.7 | π0.5 | LingBot 1.0 | LingBot 2.0 |
|---|---|---|---|---|
| Cobot Magic, progress / success | 36.3 / 17.8 | 59.1 / 32.2 | 58.2 / 30.0 | 66.2 / 34.4 |
| Galaxea R1 Pro, progress / success | 16.4 / 5.6 | 27.4 / 8.9 | 32.7 / 15.6 | 34.6 / 15.6 |

| Long-horizon mobile (15 trials per setting) | LingBot 2.0 | π0.5 |
|---|---|---|
| Astribot S1, fridge sorting, in-domain | 77.1 / 60.0 | 65.3 / 46.7 |
| same, out-of-distribution | 37.0 / 13.3 | 30.3 / 6.7 |
| Cobot Magic-ARX X5, stove cleaning, in-domain | 84.3 / 66.7 | 79.9 / 60.0 |
| same, out-of-distribution | 67.5 / 40.0 | 62.5 / 33.3 |

- The paper itself points out that several tasks show partial progress but fail at the final placement or release step, and that the gap between the two robots shows embodiment-specific factors (kinematics, cameras, action-space alignment) are still hard.
- Under matched *active* parameters, the sparse MoE model reached lower training loss and lower validation action error on GM-100 than the dense one.

## 4. Caveats

- Checked against the full text: data sizes, pipeline, MoE and distillation design, Tables 5 and 6, stated limitations.
- I did not find the exact VLM backbone and total parameter count in the text I read; the Hugging Face model card lists a 6B checkpoint.
- Trials per task for Table 5 are my assumption (see the calculation card).
- Like the other generalist VLAs here, it has no force input; the GM-100 tasks are judged by vision-defined steps.

**Carry forward:** [GM-100](gm-100.html) explains the progress and success scores used here. [GR00T N1](gr00t-n1.html) also turns human video into training signal, with latent actions instead of reconstructed 3D hands.

**Check question:** on a task with 10 trials, model A succeeds 7 times and model B 5 times. Using the normal approximation, are their 95% intervals overlapping?

<details markdown="1">
<summary>Answer</summary>

A: $0.7 \pm 1.96\sqrt{0.21/10} = 0.7 \pm 0.28$ → 0.42 to 0.98. B: $0.5 \pm 1.96\sqrt{0.25/10} = 0.5 \pm 0.31$ → 0.19 to 0.81. Yes, they overlap widely; 10 trials cannot separate 70% from 50%.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Robbyant (Ant Group), *From Foundation to Application: Improving VLA Models in Practice* (LingBot-VLA 2.0), [arXiv 2607.06403](https://arxiv.org/abs/2607.06403) · 07/2026. Trọng số trên Hugging Face (Apache-2.0).

**VẤN ĐỀ** Đưa VLA từ kết quả benchmark tới robot được dùng thật: nhiều thân robot, robot toàn thân (đầu, eo, đế di động, bàn tay khéo), và cảnh thay đổi trong lúc robot làm.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Paper chẩn đoán phiên bản đầu của chính họ và các VLA tương tự: dữ liệu phủ chưa đủ rộng về tác vụ và thân robot; không gian hành động chỉ làm cho hai tay; và VLM mã hóa tốt khung hiện tại nhưng không mô hình hóa cảnh sẽ diễn biến ra sao. Paper lưu ý đặc trưng ảnh như DINOv3 nắm được hình học nhưng "không nắm được động lực học thời gian nhân quả mà điều khiển robot cần".

**Ý TƯỞNG** Ba thay đổi. (1) Dữ liệu: dựng lại quy trình và ~60.000 giờ (50.000 giờ robot, 20 cấu hình; 10.000 giờ video người góc nhìn thứ nhất với bàn tay được dựng lại trong 3D). (2) Không gian hành động: bậc tự do toàn thân, và MoE thưa theo token trong action expert với cân bằng tải không cần loss phụ. (3) Động lực học dự đoán: hai query học được (hiện tại và một chunk sau) được chưng cất từ một mô hình độ sâu và một mô hình video nhân quả mới, DINO-Video.

**KẾT QUẢ** GM-100, chín tác vụ, chế độ tổng quát, Agilex Cobot Magic: 66,2 tiến độ / 34,4% thành công so với π0.5 59,1 / 32,2 và LingBot-VLA 1.0 58,2 / 30,0. Galaxea R1 Pro: 34,6 / 15,6 so với π0.5 27,4 / 8,9. Tác vụ di động tầm dài: hơn π0.5 cả trong lẫn ngoài phân phối.
</div>

## 1. Vấn đề: từ VLA trong lab tới robot toàn thân triển khai thật

[[flow]]
- Trước~LingBot-VLA 1.0 / π0.5 | Dữ liệu hai tay > !VLM chỉ nhìn khung hiện tại~chỉ có tay, không dự đoán tương lai! > Hành động hai tay | hụt về thân robot, cảnh và thời gian
+ LingBot-VLA 2.0 | 60.000 giờ robot + video người > *Query tương lai chưng cất từ độ sâu + video~action expert MoE thưa* > Hành động toàn thân | đầu, eo, đế, bàn tay
[[/flow]] Thay đổi trải đều trên dữ liệu, không gian hành động và một mục tiêu phụ, chứ không phải một khối mới.

## 2. Kiến trúc và dữ liệu

[[fig:lingbotv2]] Hai query nối thêm vào token của VLM được học để khớp với một mô hình độ sâu và một mô hình video, cho khung hiện tại và khung sau một chunk; action expert dùng các lớp MoE thưa.

| Phần | LingBot-VLA 2.0 |
|---|---|
| Dữ liệu robot | ~50.000 giờ, 20 cấu hình robot, chuẩn hóa về một biểu diễn hành động chung |
| Dữ liệu người | ~10.000 giờ video góc nhìn thứ nhất; SLAM để lấy tư thế camera, ước lượng tư thế bàn tay (MANO), quỹ đạo tay trong hệ thế giới, lọc chất lượng |
| Gán nhãn | một VLM (Qwen3.6-27B) chia mỗi video thành tác vụ con, viết câu lệnh và gán nhãn hành động nguyên tử |
| Action expert | MoE thưa theo token ở nhánh FFN; cân bằng tải không cần loss phụ, cập nhật bias của router |
| Động lực học dự đoán | query $Q_t$, $Q_{t+T}$ ($T$ = kích thước chunk) chưng cất từ LingBot-Depth và DINO-Video |
| DINO-Video | xây trên DINOv3 với attention thời gian nhân quả: đặc trưng ở một bước chỉ phụ thuộc khung hiện tại và quá khứ |

Hai mối nối với các bài nền tảng: cách cân bằng MoE thay loss phụ của [MoE](moe.html) bằng một bias được đẩy dần sau mỗi bước về phía expert ít được dùng, và query tương lai là một dạng [chưng cất](distillation.html) trong đó thầy là mô hình tri giác, không phải một policy lớn hơn.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Trên GM-100 (Cobot Magic) LingBot-VLA 2.0 trung bình 34,4% thành công, π0.5 32,2%. Chênh 2,2 điểm trên chín tác vụ có ý nghĩa không? (Giả định: 10 lượt mỗi tác vụ, khớp với bảng vì mọi giá trị thành công đều là bội của 10; paper không nêu rõ cho bảng này.)

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n$ | tổng số lượt | đầu vào | $9 \times 10 = 90$ |
| $k$ | số lần thành công | đầu vào | LingBot: $0{,}344 \times 90 \approx 31$; π0.5: $0{,}322 \times 90 \approx 29$ |
| CI | khoảng Wilson 95% | đầu ra | – |

**Công thức** (Wilson)

$$\frac{\hat p + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat p(1-\hat p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

**Các bước**

1. LingBot: $\hat p = 31/90 = 0{,}344$ → khoảng 25,4% tới 44,7%.
2. π0.5: $\hat p = 29/90 = 0{,}322$ → khoảng 23,5% tới 42,4%.
3. Hai khoảng chồng lên nhau gần hết.

**Kết quả.** Chênh lệch tỉ lệ thành công chỉ khoảng 2 lần thành công trên 90; nó không tách được hai mô hình.

**Vì sao quan trọng.** Theo từng tác vụ thì bức tranh lẫn lộn: π0.5 hơn xa ở xếp khối (60% so với 0%) và đóng gói dụng cụ (30% so với 0%), LingBot-VLA 2.0 hơn xa ở lấy chùm chìa khóa (100% so với 20%). Điểm tiến độ, đếm từng bước con, tách hai mô hình rõ hơn (66,2 so với 59,1), và trên robot thứ hai (Galaxea R1 Pro) khoảng cách lớn hơn. Hãy đọc con số trung bình cùng với bảng từng tác vụ.
</div>

## 3. Kết quả

| GM-100, 9 tác vụ, trung bình (Bảng 5) | GR00T N1.7 | π0.5 | LingBot 1.0 | LingBot 2.0 |
|---|---|---|---|---|
| Cobot Magic, tiến độ / thành công | 36,3 / 17,8 | 59,1 / 32,2 | 58,2 / 30,0 | 66,2 / 34,4 |
| Galaxea R1 Pro, tiến độ / thành công | 16,4 / 5,6 | 27,4 / 8,9 | 32,7 / 15,6 | 34,6 / 15,6 |

| Di động tầm dài (15 lượt mỗi chế độ) | LingBot 2.0 | π0.5 |
|---|---|---|
| Astribot S1, xếp đồ vào tủ lạnh, trong phân phối | 77,1 / 60,0 | 65,3 / 46,7 |
| như trên, ngoài phân phối | 37,0 / 13,3 | 30,3 / 6,7 |
| Cobot Magic-ARX X5, lau bếp, trong phân phối | 84,3 / 66,7 | 79,9 / 60,0 |
| như trên, ngoài phân phối | 67,5 / 40,0 | 62,5 / 33,3 |

- Chính paper chỉ ra nhiều tác vụ có tiến triển từng phần nhưng hỏng ở bước đặt hoặc thả cuối cùng, và khoảng cách giữa hai robot cho thấy các yếu tố riêng của từng thân (động học, camera, khớp không gian hành động) vẫn còn khó.
- Với số tham số *hoạt động* bằng nhau, mô hình MoE thưa đạt loss huấn luyện thấp hơn và sai số hành động kiểm định trên GM-100 thấp hơn mô hình dày đặc.

## 4. Lưu ý

- Đã đối chiếu với toàn văn: kích thước dữ liệu, quy trình, thiết kế MoE và chưng cất, Bảng 5 và 6, các giới hạn paper tự nêu.
- Mình không tìm thấy tên backbone VLM chính xác và tổng số tham số trong phần đã đọc; model card trên Hugging Face ghi checkpoint 6B.
- Số lượt mỗi tác vụ ở Bảng 5 là giả định của mình (xem thẻ tính tay).
- Như các VLA tổng quát khác ở đây, nó không có đầu vào lực; tác vụ GM-100 được chấm theo các bước định nghĩa bằng mắt.

**Mang theo:** [GM-100](gm-100.html) giải thích điểm tiến độ và thành công dùng ở đây. [GR00T N1](gr00t-n1.html) cũng biến video người thành tín hiệu huấn luyện, nhưng bằng latent action thay vì dựng lại bàn tay 3D.

**Câu hỏi kiểm tra:** ở một tác vụ 10 lượt, mô hình A thành công 7 lần, mô hình B 5 lần. Dùng xấp xỉ chuẩn, khoảng 95% của chúng có chồng nhau không?

<details markdown="1">
<summary>Đáp án</summary>

A: $0{,}7 \pm 1{,}96\sqrt{0{,}21/10} = 0{,}7 \pm 0{,}28$ → 0,42 tới 0,98. B: $0{,}5 \pm 1{,}96\sqrt{0{,}25/10} = 0{,}5 \pm 0{,}31$ → 0,19 tới 0,81. Có, chồng nhau rộng; 10 lượt không tách được 70% với 50%.
</details>
:::
