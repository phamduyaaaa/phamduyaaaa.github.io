---
slug: libero
date: 2026-10-21
title_en: "LIBERO: The Simulation Benchmark Most VLAs Report"
title_vi: "LIBERO: Benchmark mô phỏng mà hầu hết VLA đều báo cáo"
excerpt_en: "LIBERO was built to study lifelong learning with four 10-task suites, and became the standard sim score for VLAs. What each suite tests, what the usual protocol is, and why a 2-point gap near 90% needs about 900 trials to mean anything."
excerpt_vi: "LIBERO được làm để nghiên cứu học suốt đời với bốn bộ 10 tác vụ, rồi trở thành điểm mô phỏng chuẩn của VLA. Mỗi bộ kiểm tra gì, quy trình thường dùng ra sao, và vì sao chênh 2 điểm quanh 90% cần khoảng 900 lần thử mới có nghĩa."
tags: [VLA, Benchmark, LIBERO, Simulation]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Liu et al., *LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning*, [arXiv 2306.03310](https://arxiv.org/abs/2306.03310) · 06/2023 · NeurIPS 2023 Datasets and Benchmarks

**PROBLEM** To compare robot policies we need tasks that anyone can re-run, with a clear idea of *what kind* of knowledge each task tests.

**WHAT FAILED BEFORE** Lifelong-learning benchmarks in vision and language test the transfer of *declarative* knowledge (concepts, entities). The paper argues that decision-making also needs *procedural* knowledge (how to move), and existing setups did not separate the two.

**IDEA** A procedural generator of tabletop tasks, and four fixed suites, three of which change exactly one factor: layout (Spatial), object (Object), or goal (Goal). The fourth (LIBERO-100) mixes everything. Every task ships with 50 human-teleoperated demonstrations.

**RESULT** 130 tasks in total. The VLA community later adopted the four 10-task suites (Spatial, Object, Goal, Long) as a standard fine-tuning benchmark. OpenVLA reports 76.5% average there; SmolVLA (0.45B) reports 87.3%.
</div>

## 1. The problem: one score that says nothing about *why*

[[flow]]
- Before~Mixed task set | Train on tasks > !One success %~layout, object, goal all change at once! > Score | a failure cannot be traced to a cause
+ LIBERO | Train on a suite > *Change one factor~Spatial · Object · Goal* > Score per suite | a low Spatial score points at spatial reasoning
[[/flow]] The suites act like a controlled experiment: hold everything fixed, change one thing.

## 2. The four suites

[[fig:libero]] Spatial, Object and Goal hold all but one factor fixed. Long mixes them over long horizons and is usually the hardest suite.

| Suite | What changes | Knowledge type (paper) | Tasks | Demos per task |
|---|---|---|---|---|
| LIBERO-Spatial | layout; two identical bowls differ only by position | declarative (where) | 10 | 50 |
| LIBERO-Object | which object is picked and placed | declarative (what) | 10 | 50 |
| LIBERO-Goal | the goal, with the same objects and layout | procedural (how) | 10 | 50 |
| LIBERO-100 | everything: 90 short tasks (LIBERO-90) + 10 long tasks (LIBERO-Long, also called LIBERO-10) | entangled | 100 | 50 |

In the original paper, LIBERO-90 is the pre-training source and LIBERO-Long is the downstream lifelong-learning test, scored by forward transfer, backward transfer and area under the success curve. VLA papers ignore that lifelong protocol: they fine-tune once per suite and report plain success rates.

## 3. The VLA protocol, and where it varies

OpenVLA's appendix fixed what most later papers copy, and also shows how many hidden choices there are:

- **Data cleaning.** Replay every demo and drop the failures: 68, 46, 72 and 121 of 500 demos were removed from Spatial, Object, Goal and Long. Drop "no-op" steps (near-zero motion, no gripper change); OpenVLA says expressive single-step policies otherwise learn to freeze.
- **Inputs.** Only the third-person camera (no wrist camera) in OpenVLA; images rotated 180° because the simulator renders them upside down.
- **Trials.** OpenVLA: 500 trials per suite × 3 seeds. SmolVLA: 10 trials per task, so 100 per suite.

| Policy (as reported in SmolVLA, Table 2) | Robot pre-training | Spatial | Object | Goal | Long | Avg |
|---|---|---|---|---|---|---|
| Diffusion Policy | no | 78.3 | 92.5 | 68.3 | 50.5 | 72.4 |
| Octo (0.09B) | yes | 78.9 | 85.7 | 84.6 | 51.1 | 75.1 |
| OpenVLA (7B) | yes | 84.7 | 88.4 | 79.2 | 53.7 | 76.5 |
| π0 (3.3B) | yes | 90 | 86 | 95 | 73 | 86.0 |
| SmolVLA (0.45B) | no | 90 | 96 | 92 | 71 | 87.3 |

The first three rows are copied from OpenVLA (1,500 trials each); the last two come from a different protocol with 100 trials per suite. Putting them in one table is common practice, and it is exactly the kind of comparison the [evaluation post](danh-gia-vla.html) warns about.

<div class="calc" markdown="1">

Calculation card

**What and why.** Near the top of LIBERO, papers differ by 1-3 points. How many trials per suite does it take before a gap that small is larger than the noise?

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $p$ | true success rate | input | 0.90 |
| $d$ | half-width of the 95% interval we want | input | 0.02 (±2 points) |
| $z$ | 95% normal quantile | constant | 1.96 |
| $n$ | trials needed | output | – |
| $h$ | half-width actually reached with $n = 100$ | output | – |

**Formula** (normal approximation, good enough when $np$ and $n(1-p)$ are both above about 10)

$$n = \frac{z^2\,p(1-p)}{d^2}, \qquad h = z\sqrt{\frac{p(1-p)}{n}}$$

**Steps**

1. $p(1-p) = 0.9 \times 0.1 = 0.09$.
2. $n = 3.8416 \times 0.09 / 0.0004 = 864.4$, so about 865 trials.
3. With $n = 100$: $h = 1.96 \times \sqrt{0.09/100} = 1.96 \times 0.03 = 0.0588$.

**Result.** About 865 trials per suite for ±2 points; 100 trials give about ±5.9 points.

**Why it matters.** SmolVLA (0.45B) scores 71% on Long and π0 73%, each from 100 trials. Their Wilson intervals are 61.5–79.0% and 63.6–80.7%: they overlap almost completely, so the table does not rank them on that suite. OpenVLA's 1,500 trials give 51.2–56.2% for its 53.7%, a much tighter claim.
</div>

## 4. What LIBERO does and does not tell you

- **Does:** whether a policy can learn ten related tabletop tasks from 50 demos each, and which factor (layout, object, goal) it struggles with.
- **Does not:** contact, force or friction realism; real camera noise; generalisation to unseen scenes (tasks at test time are the trained tasks with the same initial states).
- Scores near the top are saturated, so newer papers add harder splits or move to [SimplerEnv](simplerenv.html), [RoboTwin](robotwin.html) or real robots.

## 5. Caveats

- Checked against the full LIBERO paper (suite definitions, 50 demos, 90/10 split, metrics) and the OpenVLA and SmolVLA papers (protocol, cleaning, table values).
- I do not quote the many later LIBERO numbers (above 95%) because each uses its own protocol; read the protocol before the number.

**Carry forward:** the same counting applies to every benchmark here. Next, [CALVIN](calvin.html) scores long chains of tasks, and [SimplerEnv](simplerenv.html) asks whether simulation ranks policies the way real robots do.

**Check question:** a paper reports 95% on Goal from 50 trials. What is the 95% half-width with the normal approximation, and would you trust a claim that it beats another method's 92%?

<details markdown="1">
<summary>Answer</summary>

$h = 1.96\sqrt{0.95 \times 0.05 / 50} = 1.96 \times 0.0308 = 0.060$, so about ±6 points (the normal approximation is rough here since $n(1-p) = 2.5$; Wilson gives about 85–98%). A 3-point gap is well inside the noise.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Liu và cộng sự, *LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning*, [arXiv 2306.03310](https://arxiv.org/abs/2306.03310) · 06/2023 · NeurIPS 2023 Datasets and Benchmarks

**VẤN ĐỀ** Muốn so các policy robot, ta cần tác vụ mà ai cũng chạy lại được, và biết rõ mỗi tác vụ kiểm tra *loại* kiến thức nào.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các benchmark học suốt đời trong thị giác và ngôn ngữ kiểm tra việc chuyển giao kiến thức *khai báo* (khái niệm, thực thể). Paper lập luận rằng ra quyết định còn cần kiến thức *thủ tục* (cử động thế nào), và các bộ thử có sẵn không tách hai loại này ra.

**Ý TƯỞNG** Một bộ sinh tác vụ trên bàn theo quy trình, và bốn bộ cố định, trong đó ba bộ chỉ đổi đúng một yếu tố: bố cục (Spatial), vật (Object), hoặc mục tiêu (Goal). Bộ thứ tư (LIBERO-100) trộn tất cả. Mỗi tác vụ có sẵn 50 demo do người điều khiển từ xa.

**KẾT QUẢ** Tổng cộng 130 tác vụ. Cộng đồng VLA sau đó lấy bốn bộ 10 tác vụ (Spatial, Object, Goal, Long) làm benchmark fine-tune chuẩn. OpenVLA báo cáo trung bình 76,5% ở đó; SmolVLA (0,45B) báo cáo 87,3%.
</div>

## 1. Vấn đề: một điểm số không nói được *vì sao*

[[flow]]
- Trước~Tập tác vụ trộn | Học trên tác vụ > !Một tỉ lệ thành công~bố cục, vật, mục tiêu đổi cùng lúc! > Điểm | không lần ra được nguyên nhân thất bại
+ LIBERO | Học trên một bộ > *Đổi một yếu tố~Spatial · Object · Goal* > Điểm theo bộ | điểm Spatial thấp chỉ thẳng vào suy luận không gian
[[/flow]] Các bộ giống một thí nghiệm có kiểm soát: giữ mọi thứ cố định, chỉ đổi một thứ.

## 2. Bốn bộ tác vụ

[[fig:libero]] Spatial, Object và Goal giữ cố định mọi yếu tố trừ một. Long trộn chúng trên tầm dài và thường là bộ khó nhất.

| Bộ | Cái gì thay đổi | Loại kiến thức (theo paper) | Số tác vụ | Demo mỗi tác vụ |
|---|---|---|---|---|
| LIBERO-Spatial | bố cục; hai cái bát giống hệt chỉ khác vị trí | khai báo (ở đâu) | 10 | 50 |
| LIBERO-Object | vật được gắp và đặt | khai báo (cái gì) | 10 | 50 |
| LIBERO-Goal | mục tiêu, với cùng vật và bố cục | thủ tục (làm thế nào) | 10 | 50 |
| LIBERO-100 | mọi thứ: 90 tác vụ ngắn (LIBERO-90) + 10 tác vụ dài (LIBERO-Long, còn gọi LIBERO-10) | đan xen | 100 | 50 |

Trong paper gốc, LIBERO-90 là nguồn tiền huấn luyện, còn LIBERO-Long là bài kiểm tra học suốt đời, chấm bằng chuyển giao xuôi, chuyển giao ngược và diện tích dưới đường tỉ lệ thành công. Các paper VLA bỏ qua giao thức học suốt đời đó: fine-tune một lần cho mỗi bộ và báo cáo tỉ lệ thành công thuần.

## 3. Quy trình của VLA, và chỗ nó khác nhau

Phụ lục của OpenVLA chốt quy trình mà phần lớn paper sau chép lại, đồng thời cho thấy có bao nhiêu lựa chọn ẩn:

- **Làm sạch dữ liệu.** Chạy lại mọi demo và bỏ demo thất bại: bỏ 68, 46, 72 và 121 trên 500 demo ở Spatial, Object, Goal và Long. Bỏ bước "no-op" (gần như không cử động, tay kẹp không đổi); OpenVLA nói nếu không bỏ, policy một bước đủ mạnh sẽ học cách đứng im.
- **Đầu vào.** OpenVLA chỉ dùng camera góc thứ ba (không dùng camera cổ tay); ảnh xoay 180° vì trình mô phỏng xuất ảnh lộn ngược.
- **Số lần thử.** OpenVLA: 500 lần mỗi bộ × 3 seed. SmolVLA: 10 lần mỗi tác vụ, tức 100 lần mỗi bộ.

| Policy (theo Bảng 2 của SmolVLA) | Tiền huấn luyện robot | Spatial | Object | Goal | Long | TB |
|---|---|---|---|---|---|---|
| Diffusion Policy | không | 78,3 | 92,5 | 68,3 | 50,5 | 72,4 |
| Octo (0,09B) | có | 78,9 | 85,7 | 84,6 | 51,1 | 75,1 |
| OpenVLA (7B) | có | 84,7 | 88,4 | 79,2 | 53,7 | 76,5 |
| π0 (3,3B) | có | 90 | 86 | 95 | 73 | 86,0 |
| SmolVLA (0,45B) | không | 90 | 96 | 92 | 71 | 87,3 |

Ba dòng đầu chép từ OpenVLA (1.500 lần thử mỗi số); hai dòng cuối theo quy trình khác, 100 lần mỗi bộ. Gộp chung một bảng là chuyện thường gặp, và đúng là kiểu so sánh mà [bài đánh giá](danh-gia-vla.html) cảnh báo.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Ở vùng điểm cao của LIBERO, các paper chênh nhau 1-3 điểm. Cần bao nhiêu lần thử mỗi bộ thì khoảng chênh nhỏ như vậy mới lớn hơn nhiễu?

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $p$ | tỉ lệ thành công thật | đầu vào | 0,90 |
| $d$ | nửa độ rộng khoảng tin cậy 95% mong muốn | đầu vào | 0,02 (±2 điểm) |
| $z$ | phân vị chuẩn 95% | hằng số | 1,96 |
| $n$ | số lần thử cần | đầu ra | – |
| $h$ | nửa độ rộng thực tế khi $n = 100$ | đầu ra | – |

**Công thức** (xấp xỉ chuẩn, đủ dùng khi $np$ và $n(1-p)$ đều trên khoảng 10)

$$n = \frac{z^2\,p(1-p)}{d^2}, \qquad h = z\sqrt{\frac{p(1-p)}{n}}$$

**Các bước**

1. $p(1-p) = 0{,}9 \times 0{,}1 = 0{,}09$.
2. $n = 3{,}8416 \times 0{,}09 / 0{,}0004 = 864{,}4$, tức khoảng 865 lần thử.
3. Với $n = 100$: $h = 1{,}96 \times \sqrt{0{,}09/100} = 1{,}96 \times 0{,}03 = 0{,}0588$.

**Kết quả.** Khoảng 865 lần thử mỗi bộ cho ±2 điểm; 100 lần thử chỉ cho khoảng ±5,9 điểm.

**Vì sao quan trọng.** SmolVLA (0,45B) đạt 71% ở Long còn π0 đạt 73%, mỗi số từ 100 lần thử. Khoảng Wilson của chúng là 61,5–79,0% và 63,6–80,7%: chồng lên nhau gần hết, nên bảng không xếp hạng được hai mô hình ở bộ này. 1.500 lần thử của OpenVLA cho 51,2–56,2% quanh 53,7%, một khẳng định chặt hơn nhiều.
</div>

## 4. LIBERO cho biết gì và không cho biết gì

- **Cho biết:** policy có học được mười tác vụ trên bàn liên quan nhau từ 50 demo mỗi tác vụ không, và nó yếu ở yếu tố nào (bố cục, vật, mục tiêu).
- **Không cho biết:** độ thật của tiếp xúc, lực, ma sát; nhiễu camera thật; khả năng tổng quát sang cảnh chưa thấy (lúc kiểm tra vẫn là các tác vụ đã học, cùng trạng thái ban đầu).
- Điểm ở vùng cao đã bão hòa, nên paper mới thêm phần khó hơn hoặc chuyển sang [SimplerEnv](simplerenv.html), [RoboTwin](robotwin.html) hay robot thật.

## 5. Lưu ý

- Đã đối chiếu với toàn văn paper LIBERO (định nghĩa các bộ, 50 demo, chia 90/10, thước đo) và với paper OpenVLA, SmolVLA (quy trình, làm sạch, số trong bảng).
- Mình không trích các số LIBERO mới hơn (trên 95%) vì mỗi paper dùng quy trình riêng; đọc quy trình trước khi đọc con số.

**Mang theo:** cách đếm này áp dụng cho mọi benchmark ở đây. Tiếp theo, [CALVIN](calvin.html) chấm chuỗi tác vụ dài, còn [SimplerEnv](simplerenv.html) hỏi liệu mô phỏng có xếp hạng policy giống robot thật không.

**Câu hỏi kiểm tra:** một paper báo 95% ở Goal từ 50 lần thử. Nửa độ rộng 95% theo xấp xỉ chuẩn là bao nhiêu, và bạn có tin khẳng định nó hơn 92% của phương pháp khác không?

<details markdown="1">
<summary>Đáp án</summary>

$h = 1{,}96\sqrt{0{,}95 \times 0{,}05 / 50} = 1{,}96 \times 0{,}0308 = 0{,}060$, tức khoảng ±6 điểm (xấp xỉ chuẩn ở đây khá thô vì $n(1-p) = 2{,}5$; Wilson cho khoảng 85–98%). Chênh 3 điểm nằm gọn trong nhiễu.
</details>
:::
