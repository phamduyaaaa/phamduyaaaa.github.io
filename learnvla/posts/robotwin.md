---
slug: robotwin
date: 2026-10-21
title_en: "RoboTwin: Generated Bimanual Data and a Clean-vs-Randomised Benchmark"
title_vi: "RoboTwin: Dữ liệu hai tay sinh tự động và benchmark sạch so với ngẫu nhiên hóa"
excerpt_en: "RoboTwin 2.0 lets a multimodal LLM write and repair expert programs for 50 dual-arm tasks in simulation, on five robot bodies including a UR5. Its benchmark trains on 50 clean demos and tests clean and randomised scenes: π0 falls from 46.4% to 16.3%, and the best clean policy (DP3) falls to 5%."
excerpt_vi: "RoboTwin 2.0 để một LLM đa phương thức viết và sửa chương trình chuyên gia cho 50 tác vụ hai tay trong mô phỏng, trên năm thân robot gồm cả UR5. Benchmark học trên 50 demo sạch và thử ở cảnh sạch lẫn ngẫu nhiên hóa: π0 rơi từ 46,4% xuống 16,3%, còn policy tốt nhất ở cảnh sạch (DP3) rơi xuống 5%."
tags: [VLA, Benchmark, RoboTwin, Bimanual, Simulation]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Mu et al., *RoboTwin: Dual-Arm Robot Benchmark with Generative Digital Twins*, [arXiv 2409.02920](https://arxiv.org/abs/2409.02920) · 09/2024 (early version). Chen et al., *RoboTwin 2.0: A Scalable Data Generator and Benchmark with Strong Domain Randomization for Robust Bimanual Robotic Manipulation*, [arXiv 2506.18088](https://arxiv.org/abs/2506.18088) · 06/2025.

**PROBLEM** Two-arm tasks (handover, lifting a pot, stacking bowls) need a lot of demonstrations, and real two-arm teleoperation is slow and expensive.

**WHAT FAILED BEFORE** Scripted data generators in simulation depend on hand-written heuristics per task and on privileged state, and their scenes are clean, so policies trained on them overfit to one look. RoboTwin 1.0 already built digital twins from 2D images with generative 3D models and generated expert data with an LLM, but its scenes lacked variety and its grasps did not adapt to different arms.

**IDEA (2.0)** A 731-object library with manipulation labels; a multimodal LLM that writes the expert program for a task, runs it in simulation, reads the execution log and images, and repairs it; structured randomisation on five axes (clutter, lighting, background, table height, language); embodiment-aware grasps for five dual-arm robots.

**RESULT** 50 tasks, over 100,000 expert trajectories. On the benchmark (50 clean demos per task, 100 rollouts), pre-trained VLAs hold up best when the scene is randomised: π0 46.4% → 16.3%, RDT 34.5% → 13.7%, while DP3 drops from 55.2% to 5.0%.
</div>

## 1. The problem: clean training scenes, messy test scenes

[[flow]]
- Before~Clean sim data | Hand-scripted expert > !Clean scene~one table, one light, no clutter! > Policy | high clean score, collapses with clutter
+ RoboTwin 2.0 | LLM-written expert~repaired in the loop > *Randomised scenes~clutter, light, height, words* > Policy | trained and tested on variation
[[/flow]] The change is to make generation cheap enough that variety can be added everywhere, and to test on that variety.

## 2. Generator and benchmark

[[fig:robotwin]] The generator turns a task description into a working expert program, randomises scenes and adapts grasps to each robot. The benchmark trains on clean demos and tests under both conditions.

| Piece | What it is | Number |
|---|---|---|
| RoboTwin-OD | annotated object library | 731 instances, 147 categories |
| Expert code generation | MLLM writes code, runs it, reads logs and images, repairs | success of generated programs 71.3% with multimodal feedback vs 47.4% for 1.0's one-shot code (10 tasks) |
| Embodiments | dual-arm platforms | Aloha-AgileX, ARX-X5, Franka, Piper, UR5 |
| Benchmark protocol | single-task, Aloha-AgileX | 50 tasks, 50 clean demos each, 100 rollouts Easy + 100 Hard |

| Policy | Easy (%) | Hard (%) | Drop (points) |
|---|---|---|---|
| DP3 | 55.2 | 5.0 | 50.2 |
| π0 | 46.4 | 16.3 | 30.1 |
| RDT | 34.5 | 13.7 | 20.8 |
| ACT | 29.7 | 1.7 | 28.0 |
| DP | 28.0 | 0.6 | 27.4 |

[[bars:%]] DP3 Easy=55.2; DP3 Hard=5; *π0 Easy=46.4*; *π0 Hard=16.3*; RDT Easy=34.5; RDT Hard=13.7 || Average success over 50 tasks (RoboTwin 2.0, Table 5). The best clean policy is not the most robust one.

<div class="calc" markdown="1">

Calculation card

**What and why.** Is "best on Easy" the same as "best on Hard"? Compute how much of its clean score each policy keeps when the scene is randomised.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $E$ | Easy success (%) | input | π0 46.4 |
| $H$ | Hard success (%) | input | π0 16.3 |
| $\Delta$ | absolute drop | output | – |
| $\rho$ | retention $H/E$ | output | – |

**Formula**

$$\Delta = E - H, \qquad \rho = \frac{H}{E}$$

**Steps**

1. π0: $\Delta = 46.4 - 16.3 = 30.1$; $\rho = 16.3 / 46.4 = 0.351$.
2. RDT: $\Delta = 20.8$; $\rho = 13.7 / 34.5 = 0.397$.
3. DP3: $\Delta = 50.2$; $\rho = 5.0 / 55.2 = 0.091$.
4. Order on Easy: DP3 > π0 > RDT. Order on Hard: π0 > RDT > DP3.

**Result.** The two VLAs keep 35–40% of their clean score; DP3 keeps 9%. The ranking flips.

**Why it matters.** A benchmark with only clean scenes would have picked DP3. The paper reads the gap as evidence that VLA pre-training gives priors that survive visual change, and still calls robustness the main open problem.
</div>

## 3. Synthetic data for real robots

The point of the generator is training data, not only scores. On a real dual-arm setup, the paper mixes 1,000 randomised synthetic trajectories with 10 real demos and reports a 367% relative improvement over the 10-demo baseline; training on synthetic data alone gives a 228% relative gain. "Relative" means the new success rate is 4.67× (or 3.28×) the baseline, which matters when the baseline is low.

RoboTwin 1.0 (09/2024) was smaller: a real-plus-twin dataset on the AgileX COBOT Magic platform (four arms, four RealSense D435 cameras) and a few tasks scored with DP3, for example "Empty Cup Place" rising from 10% with 10 demos to 96% with 50.

## 4. For a UR10e reader

- UR5 is one of the five embodiments, so the generator can produce UR-style arm data, but only in dual-arm configurations and only in simulation.
- The randomisation is visual and geometric. Contact force is not part of the benchmark; a policy that crushes the bottle while lifting it still counts as a success.

## 5. Caveats

- Checked against the full RoboTwin 2.0 text (object library, code-generation table, embodiments, protocol, Table 5 averages, the 367% and 228% claims) and the RoboTwin 1.0 PDF.
- I did not read the real-robot table in full; the relative gains are quoted from the abstract.

**Carry forward:** [SimplerEnv](simplerenv.html) uses simulation to *rank* real-trained policies; RoboTwin uses it to *produce* training data. [GM-100](gm-100.html) moves the whole evaluation onto real robots.

**Check question:** a policy scores 60% Easy and 12% Hard; another 45% Easy and 18% Hard. Compute both retentions and say which you would deploy in a cluttered kitchen.

<details markdown="1">
<summary>Answer</summary>

$\rho_1 = 12/60 = 0.20$; $\rho_2 = 18/45 = 0.40$. The second: it is better on Hard (18% vs 12%), which is closer to the kitchen, and it loses less to variation.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Mu và cộng sự, *RoboTwin: Dual-Arm Robot Benchmark with Generative Digital Twins*, [arXiv 2409.02920](https://arxiv.org/abs/2409.02920) · 09/2024 (bản đầu). Chen và cộng sự, *RoboTwin 2.0: A Scalable Data Generator and Benchmark with Strong Domain Randomization for Robust Bimanual Robotic Manipulation*, [arXiv 2506.18088](https://arxiv.org/abs/2506.18088) · 06/2025.

**VẤN ĐỀ** Tác vụ hai tay (chuyền vật, nhấc nồi, xếp bát) cần rất nhiều demo, mà điều khiển từ xa hai tay thật thì chậm và tốn kém.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Bộ sinh dữ liệu viết kịch bản tay trong mô phỏng phụ thuộc vào luật viết riêng cho từng tác vụ và vào trạng thái đặc quyền, và cảnh của chúng sạch, nên policy học từ đó bị khớp quá vào một kiểu nhìn. RoboTwin 1.0 đã dựng bản sao số từ ảnh 2D bằng mô hình 3D sinh tạo và sinh dữ liệu chuyên gia bằng LLM, nhưng cảnh còn thiếu đa dạng và cách gắp không thích nghi theo từng loại tay.

**Ý TƯỞNG (2.0)** Thư viện 731 vật có nhãn thao tác; một LLM đa phương thức viết chương trình chuyên gia cho tác vụ, chạy trong mô phỏng, đọc log thực thi và ảnh, rồi sửa; ngẫu nhiên hóa có cấu trúc theo năm trục (vật lộn xộn, ánh sáng, nền, chiều cao bàn, ngôn ngữ); cách gắp theo từng thân robot cho năm robot hai tay.

**KẾT QUẢ** 50 tác vụ, hơn 100.000 quỹ đạo chuyên gia. Trên benchmark (50 demo sạch mỗi tác vụ, 100 lượt chạy), VLA đã tiền huấn luyện chịu đựng tốt nhất khi cảnh bị ngẫu nhiên hóa: π0 46,4% → 16,3%, RDT 34,5% → 13,7%, còn DP3 rơi từ 55,2% xuống 5,0%.
</div>

## 1. Vấn đề: học ở cảnh sạch, thử ở cảnh lộn xộn

[[flow]]
- Trước~Dữ liệu mô phỏng sạch | Chuyên gia viết tay > !Cảnh sạch~một bàn, một đèn, không đồ thừa! > Policy | điểm sạch cao, sụp khi có đồ lộn xộn
+ RoboTwin 2.0 | Chuyên gia do LLM viết~sửa trong vòng lặp > *Cảnh ngẫu nhiên~đồ thừa, ánh sáng, độ cao, câu chữ* > Policy | học và thử trên sự đa dạng
[[/flow]] Thay đổi là làm việc sinh dữ liệu đủ rẻ để thêm đa dạng ở mọi nơi, và thử trên chính sự đa dạng đó.

## 2. Bộ sinh và benchmark

[[fig:robotwin]] Bộ sinh biến mô tả tác vụ thành chương trình chuyên gia chạy được, ngẫu nhiên hóa cảnh và chỉnh cách gắp theo từng robot. Benchmark học trên demo sạch và thử ở cả hai điều kiện.

| Thành phần | Là gì | Con số |
|---|---|---|
| RoboTwin-OD | thư viện vật có chú thích | 731 vật, 147 loại |
| Sinh code chuyên gia | MLLM viết code, chạy, đọc log và ảnh, sửa | tỉ lệ chương trình chạy đúng 71,3% với phản hồi đa phương thức so với 47,4% của code một lần của bản 1.0 (10 tác vụ) |
| Thân robot | nền tảng hai tay | Aloha-AgileX, ARX-X5, Franka, Piper, UR5 |
| Quy trình benchmark | một tác vụ, Aloha-AgileX | 50 tác vụ, 50 demo sạch mỗi tác vụ, 100 lượt Easy + 100 lượt Hard |

| Policy | Easy (%) | Hard (%) | Giảm (điểm) |
|---|---|---|---|
| DP3 | 55,2 | 5,0 | 50,2 |
| π0 | 46,4 | 16,3 | 30,1 |
| RDT | 34,5 | 13,7 | 20,8 |
| ACT | 29,7 | 1,7 | 28,0 |
| DP | 28,0 | 0,6 | 27,4 |

[[bars:%]] DP3 Easy=55.2; DP3 Hard=5; *π0 Easy=46.4*; *π0 Hard=16.3*; RDT Easy=34.5; RDT Hard=13.7 || Thành công trung bình trên 50 tác vụ (RoboTwin 2.0, Bảng 5). Policy tốt nhất ở cảnh sạch không phải policy bền nhất.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** "Tốt nhất ở Easy" có phải là "tốt nhất ở Hard"? Tính xem mỗi policy giữ lại bao nhiêu phần điểm sạch khi cảnh bị ngẫu nhiên hóa.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $E$ | thành công Easy (%) | đầu vào | π0 46,4 |
| $H$ | thành công Hard (%) | đầu vào | π0 16,3 |
| $\Delta$ | mức giảm tuyệt đối | đầu ra | – |
| $\rho$ | tỉ lệ giữ lại $H/E$ | đầu ra | – |

**Công thức**

$$\Delta = E - H, \qquad \rho = \frac{H}{E}$$

**Các bước**

1. π0: $\Delta = 46{,}4 - 16{,}3 = 30{,}1$; $\rho = 16{,}3 / 46{,}4 = 0{,}351$.
2. RDT: $\Delta = 20{,}8$; $\rho = 13{,}7 / 34{,}5 = 0{,}397$.
3. DP3: $\Delta = 50{,}2$; $\rho = 5{,}0 / 55{,}2 = 0{,}091$.
4. Thứ tự ở Easy: DP3 > π0 > RDT. Thứ tự ở Hard: π0 > RDT > DP3.

**Kết quả.** Hai VLA giữ lại 35–40% điểm sạch; DP3 giữ 9%. Thứ hạng bị đảo.

**Vì sao quan trọng.** Một benchmark chỉ có cảnh sạch sẽ chọn DP3. Paper đọc khoảng chênh này như bằng chứng rằng tiền huấn luyện VLA cho tri thức nền sống sót qua thay đổi hình ảnh, nhưng vẫn coi độ bền là bài toán mở chính.
</div>

## 3. Dữ liệu tổng hợp cho robot thật

Mục đích của bộ sinh là dữ liệu huấn luyện, không chỉ là điểm số. Trên một bộ hai tay thật, paper trộn 1.000 quỹ đạo tổng hợp đã ngẫu nhiên hóa với 10 demo thật và báo cáo cải thiện tương đối 367% so với baseline 10 demo; chỉ học trên dữ liệu tổng hợp cho mức tăng tương đối 228%. "Tương đối" nghĩa là tỉ lệ thành công mới bằng 4,67 lần (hoặc 3,28 lần) baseline, điều này quan trọng khi baseline thấp.

RoboTwin 1.0 (09/2024) nhỏ hơn: bộ dữ liệu thật cộng bản sao số trên nền tảng AgileX COBOT Magic (bốn tay, bốn camera RealSense D435) và vài tác vụ chấm bằng DP3, ví dụ "Empty Cup Place" tăng từ 10% với 10 demo lên 96% với 50 demo.

## 4. Với người dùng UR10e

- UR5 là một trong năm thân robot, nên bộ sinh tạo được dữ liệu kiểu tay UR, nhưng chỉ ở cấu hình hai tay và chỉ trong mô phỏng.
- Ngẫu nhiên hóa là về hình ảnh và hình học. Lực tiếp xúc không nằm trong benchmark; một policy bóp méo chai khi nhấc vẫn được tính là thành công.

## 5. Lưu ý

- Đã đối chiếu với toàn văn RoboTwin 2.0 (thư viện vật, bảng sinh code, các thân robot, quy trình, trung bình ở Bảng 5, các con số 367% và 228%) và PDF của RoboTwin 1.0.
- Mình chưa đọc hết bảng robot thật; các mức tăng tương đối được trích từ abstract.

**Mang theo:** [SimplerEnv](simplerenv.html) dùng mô phỏng để *xếp hạng* policy học từ dữ liệu thật; RoboTwin dùng nó để *sản xuất* dữ liệu huấn luyện. [GM-100](gm-100.html) chuyển toàn bộ việc đánh giá lên robot thật.

**Câu hỏi kiểm tra:** một policy đạt 60% Easy và 12% Hard; policy khác đạt 45% Easy và 18% Hard. Tính tỉ lệ giữ lại của cả hai và nói bạn sẽ triển khai cái nào trong một căn bếp bừa bộn.

<details markdown="1">
<summary>Đáp án</summary>

$\rho_1 = 12/60 = 0{,}20$; $\rho_2 = 18/45 = 0{,}40$. Cái thứ hai: nó tốt hơn ở Hard (18% so với 12%), gần với căn bếp hơn, và mất ít hơn khi có biến đổi.
</details>
:::
