---
slug: danh-gia-vla
date: 2026-10-18
title_en: "How to Evaluate a VLA: Success Rate Is Not Enough"
title_vi: "Cách đánh giá VLA: Tỉ lệ thành công là chưa đủ"
excerpt_en: "A bare success rate from 15 trials hides huge uncertainty, and the same method scores 12% to 60.5% across papers. A cheatsheet of what to report, how to read a confidence interval, and which benchmark measures what."
excerpt_vi: "Một tỉ lệ thành công trần từ 15 lần thử che giấu độ bất định lớn, và cùng một phương pháp ra từ 12% đến 60,5% giữa các paper. Cheatsheet về nên báo cáo gì, đọc khoảng tin cậy ra sao, và benchmark nào đo điều gì."
tags: [VLA, Benchmark, Evaluation]
---

:::en
<div class="tldr" markdown="1">
**TOPIC** Evaluating VLA policies. No single paper; benchmarks are covered on their own pages (LIBERO, SimplerEnv, CALVIN, RoboTwin).

**PROBLEM** To say "method A beats method B" we need a number we can trust. Robot trials are slow and costly, so each number comes from few rollouts.

**WHAT FAILED BEFORE** Papers report one success percentage, often from about 15 rollouts per task, with different tasks, scenes and protocols. [Survey 3](survey-force-output.html) shows ForceVLA scored anywhere from 12% to 60.5% depending on the paper that ran it, so a bare number does not travel between papers.

**IDEA** Report the number *with* its uncertainty, a partial-credit score, the protocol, and the generalisation split. Compare only under the same protocol.

**RESULT** A checklist (below) and one calculation: the Wilson confidence interval for a success rate.
</div>

## 1. The problem: a number without error bars

[[flow]]
- Before~Typical report | Run ~15 trials > !One success %~no interval, own protocol! > Ranking | "A beats B" from overlapping noise
+ Better report | Run n trials > *Success + interval + progress~+ protocol, + splits* > Comparison | only claim what the interval supports
[[/flow]] The change is to say how sure we are, and under which conditions.

## 2. What to measure

| Metric | Input | Output | Tells you | Misses |
|---|---|---|---|---|
| Success rate | pass/fail per rollout | fraction in [0, 1] | does the task finish | *how close* a failure was |
| Progress / partial score | sub-goal checkpoints | score per rollout | where it breaks (reach, grasp, insert) | depends on how checkpoints are defined |
| Average length (CALVIN) | chain of tasks | tasks done in a row | long-horizon robustness | one early failure ends the chain |
| Time / steps | rollout | duration | speed | quality |
| Contact quality (force papers) | force log | peak or mean force | gentle vs crushing | not shown by pass/fail |
| Generalisation split | held-out objects, scenes, instructions | success per split | does it transfer | needs a separate test set |

Rule of thumb: a force-sensitive task can "succeed" while crushing the object, so contact papers should also report force, not only pass/fail.

## 3. Which benchmark measures what

| Benchmark | Date | Setting | Main reading |
|---|---|---|---|
| CALVIN | 12/2021 | simulation, long-horizon, language-conditioned | average number of tasks completed in a row (the usual metric; chains of 5) |
| LIBERO | 06/2023 | simulation, built for lifelong learning: 130 tasks in four suites | success per suite; originally a knowledge-transfer benchmark, now widely used to score VLAs |
| SimplerEnv | 05/2024 | simulation built to track real-robot results | does the sim ranking match the real ranking |
| RoboTwin | 09/2024 | generative digital twins: data generation and a sim + real benchmark for dual-arm tasks | bimanual coordination, sim-to-real alignment |
| Real robot | – | your own tasks | closest to deployment, least comparable |

Simulation is cheap and repeatable. Real robots show what simulation hides (friction, sensor noise), but a lab's setup cannot be copied exactly.

<div class="calc" markdown="1">

Calculation card

**What and why.** With $n$ rollouts and $k$ successes, how wide is the plausible range for the true success rate? This decides whether "9/15 beats 6/15" means anything. We use the Wilson interval, which behaves well for small $n$.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n$ | number of rollouts | input | 15 |
| $k$ | successes | input | 9 |
| $\hat p = k/n$ | observed success rate | derived | 0.60 |
| $z$ | normal quantile for 95% | constant | 1.96 |
| $[L, U]$ | interval for the true rate | output | – |

**Formula**

$$\text{centre} = \frac{\hat p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}}, \qquad \text{half-width} = \frac{z\sqrt{\frac{\hat p(1-\hat p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

**Steps** ($n = 15$, $k = 9$)

1. $z^2 = 3.8416$; $z^2/n = 0.2561$; denominator $= 1.2561$.
2. Centre $= (0.60 + 0.1281)/1.2561 = 0.580$.
3. Inside the root: $0.6 \times 0.4/15 + 3.8416/900 = 0.0160 + 0.0043 = 0.0203$; root $= 0.1424$.
4. Half-width $= 1.96 \times 0.1424 / 1.2561 = 0.222$.
5. Interval $= [0.36,\ 0.80]$.

For 6/15 ($\hat p = 0.4$) the same steps give $[0.20,\ 0.64]$.

**Result.** 9/15 gives 36% to 80%; 6/15 gives 20% to 64%. The intervals overlap broadly, so 60% vs 40% from 15 trials does **not** show that one method is better.

**Why it matters.** The interval narrows slowly, like $1/\sqrt{n}$ (computed with the same steps, $\hat p = 0.6$):
</div>

[[bars:pp]] n = 15 trials=22; n = 50 trials=13; *n = 100 trials=9* || Half-width of the 95% Wilson interval for a measured 60% success rate.

## 4. Reading a results table: checklist

- How many rollouts per task, and how many tasks? (Small $n$ means wide intervals.)
- Same tasks, scenes, instruction wording and initial conditions for every method?
- Were baselines re-run by the authors, or copied from other papers? (Copied numbers may use another protocol.)
- Is there a held-out split (new objects, scenes, instructions), or only the training setup?
- Do failures count partially? Is force or damage reported for contact tasks?
- Is the gain larger than the interval?

**Carry forward:** every force paper on this site reports success rates; use this card to judge how much each gap really shows. Next: [LIBERO](libero.html) in detail.

**Check question:** 3 successes in 5 rollouts gives $\hat p = 0.6$. Is the interval narrower or wider than for 9 in 15?

<details markdown="1">
<summary>Answer</summary>

Wider. $n = 5$ gives $z^2/n = 0.768$, denominator $1.768$, centre $(0.6 + 0.384)/1.768 = 0.557$; inside the root $0.048 + 0.0384 = 0.0864$ (root $0.294$), half-width $= 1.96 \times 0.294/1.768 = 0.326$. Interval about $[0.23,\ 0.88]$, much wider than $[0.36, 0.80]$ for 9/15.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**CHỦ ĐỀ** Đánh giá chính sách VLA. Không có paper riêng; các benchmark có trang riêng (LIBERO, SimplerEnv, CALVIN, RoboTwin).

**VẤN ĐỀ** Để nói "phương pháp A hơn B" ta cần một con số đáng tin. Thử trên robot chậm và đắt, nên mỗi con số đến từ ít lần chạy.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các paper báo cáo một tỉ lệ thành công duy nhất, thường từ khoảng 15 lần chạy mỗi tác vụ, với tác vụ, cảnh và quy trình khác nhau. [Survey 3](survey-force-output.html) cho thấy ForceVLA đạt từ 12% đến 60,5% tùy paper chạy nó, nên một con số trần không mang sang paper khác được.

**Ý TƯỞNG** Báo cáo con số *kèm* độ bất định, điểm từng phần, quy trình và phần tách kiểm tra tổng quát hóa. Chỉ so sánh khi cùng quy trình.

**KẾT QUẢ** Một danh sách kiểm tra (bên dưới) và một phép tính: khoảng tin cậy Wilson cho tỉ lệ thành công.
</div>

## 1. Vấn đề: con số không có thanh sai số

[[flow]]
- Trước~Báo cáo thường gặp | Chạy ~15 lần > !Một % thành công~không khoảng tin cậy, quy trình riêng! > Xếp hạng | "A hơn B" từ nhiễu chồng lấn
+ Báo cáo tốt hơn | Chạy n lần > *Thành công + khoảng + tiến độ~+ quy trình, + các split* > So sánh | chỉ khẳng định điều khoảng tin cậy ủng hộ
[[/flow]] Thay đổi là nói rõ ta chắc đến đâu, và trong điều kiện nào.

## 2. Đo cái gì

| Chỉ số | Input | Output | Cho biết | Bỏ sót |
|---|---|---|---|---|
| Tỉ lệ thành công | đạt/không mỗi lần chạy | tỉ lệ trong [0, 1] | tác vụ có xong không | thất bại *gần đến đâu* |
| Tiến độ / điểm từng phần | các mốc con | điểm mỗi lần chạy | hỏng ở đâu (với, nắm, lắp) | phụ thuộc cách định nghĩa mốc |
| Độ dài trung bình (CALVIN) | chuỗi tác vụ | số tác vụ liên tiếp xong | độ bền dài hạn | một lỗi sớm cắt cả chuỗi |
| Thời gian / số bước | lần chạy | thời lượng | tốc độ | chất lượng |
| Chất lượng tiếp xúc (paper lực) | log lực | lực đỉnh hoặc trung bình | nhẹ tay hay bóp nát | pass/fail không thấy |
| Split tổng quát hóa | vật, cảnh, câu lệnh chưa thấy | thành công mỗi split | có chuyển được không | cần tập kiểm tra riêng |

Quy tắc: tác vụ nhạy lực có thể "thành công" mà vẫn bóp nát vật, nên paper về tiếp xúc cần báo cáo cả lực, không chỉ pass/fail.

## 3. Benchmark nào đo gì

| Benchmark | Ngày | Bối cảnh | Cách đọc chính |
|---|---|---|---|
| CALVIN | 12/2021 | mô phỏng, dài hạn, điều kiện theo ngôn ngữ | số tác vụ hoàn thành liên tiếp trung bình (thước đo thông dụng; chuỗi 5 tác vụ) |
| LIBERO | 06/2023 | mô phỏng, xây cho lifelong learning: 130 tác vụ trong bốn suite | thành công theo suite; ban đầu là benchmark chuyển giao tri thức, nay được dùng rộng rãi để chấm VLA |
| SimplerEnv | 05/2024 | mô phỏng được thiết kế để bám kết quả robot thật | thứ hạng trong mô phỏng có khớp thứ hạng thật không |
| RoboTwin | 09/2024 | digital twin sinh tạo: sinh dữ liệu và benchmark mô phỏng + thật cho tác vụ hai tay | phối hợp hai tay, độ khớp giữa mô phỏng và thật |
| Robot thật | – | tác vụ của bạn | gần triển khai nhất, khó so sánh nhất |

Mô phỏng rẻ và lặp lại được. Robot thật cho thấy điều mô phỏng che (ma sát, nhiễu cảm biến), nhưng thiết lập của một phòng thí nghiệm không sao chép nguyên được.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Với $n$ lần chạy và $k$ thành công, khoảng hợp lý cho tỉ lệ thành công thật rộng bao nhiêu? Điều này quyết định "9/15 hơn 6/15" có ý nghĩa không. Dùng khoảng Wilson, hoạt động tốt với $n$ nhỏ.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n$ | số lần chạy | input | 15 |
| $k$ | số lần thành công | input | 9 |
| $\hat p = k/n$ | tỉ lệ quan sát | suy ra | 0,60 |
| $z$ | phân vị chuẩn cho 95% | hằng số | 1,96 |
| $[L, U]$ | khoảng cho tỉ lệ thật | output | – |

**Công thức**

$$\text{tâm} = \frac{\hat p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}}, \qquad \text{nửa rộng} = \frac{z\sqrt{\frac{\hat p(1-\hat p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

**Các bước** ($n = 15$, $k = 9$)

1. $z^2 = 3{,}8416$; $z^2/n = 0{,}2561$; mẫu số $= 1{,}2561$.
2. Tâm $= (0{,}60 + 0{,}1281)/1{,}2561 = 0{,}580$.
3. Trong căn: $0{,}6 \times 0{,}4/15 + 3{,}8416/900 = 0{,}0160 + 0{,}0043 = 0{,}0203$; căn $= 0{,}1424$.
4. Nửa rộng $= 1{,}96 \times 0{,}1424 / 1{,}2561 = 0{,}222$.
5. Khoảng $= [0{,}36;\ 0{,}80]$.

Với 6/15 ($\hat p = 0{,}4$) cùng các bước cho $[0{,}20;\ 0{,}64]$.

**Kết quả.** 9/15 cho 36% đến 80%; 6/15 cho 20% đến 64%. Hai khoảng chồng lấn nhiều, nên 60% so với 40% từ 15 lần chạy **không** chứng minh một phương pháp tốt hơn.

**Ý nghĩa.** Khoảng thu hẹp chậm, như $1/\sqrt{n}$ (tính cùng các bước, $\hat p = 0{,}6$):
</div>

[[bars:pp]] n = 15 lần=22; n = 50 lần=13; *n = 100 lần=9* || Nửa rộng khoảng Wilson 95% khi đo được tỉ lệ thành công 60%.

## 4. Đọc bảng kết quả: danh sách kiểm tra

- Bao nhiêu lần chạy mỗi tác vụ, bao nhiêu tác vụ? ($n$ nhỏ nghĩa là khoảng rộng.)
- Mọi phương pháp dùng cùng tác vụ, cảnh, cách diễn đạt câu lệnh và điều kiện ban đầu không?
- Baseline được tác giả chạy lại, hay chép số từ paper khác? (Số chép có thể theo quy trình khác.)
- Có split giữ lại (vật, cảnh, câu lệnh mới), hay chỉ thiết lập lúc huấn luyện?
- Thất bại có tính điểm từng phần không? Với tác vụ tiếp xúc có báo cáo lực hay hư hại không?
- Mức cải thiện có lớn hơn khoảng tin cậy không?

**Mang theo:** mọi paper lực trên trang này đều báo cáo tỉ lệ thành công; dùng thẻ này để đánh giá mỗi khoảng chênh thực sự cho thấy bao nhiêu. Tiếp theo: [LIBERO](libero.html) chi tiết.

**Câu hỏi kiểm tra:** 3 thành công trong 5 lần chạy cho $\hat p = 0{,}6$. Khoảng hẹp hơn hay rộng hơn 9 trên 15?

<details markdown="1">
<summary>Đáp án</summary>

Rộng hơn. $n = 5$ cho $z^2/n = 0{,}768$, mẫu số $1{,}768$, tâm $(0{,}6 + 0{,}384)/1{,}768 = 0{,}557$; trong căn $0{,}048 + 0{,}0384 = 0{,}0864$ (căn $0{,}294$), nửa rộng $= 1{,}96 \times 0{,}294/1{,}768 = 0{,}326$. Khoảng $[0{,}23;\ 0{,}88]$, rộng hơn nhiều so với $[0{,}36; 0{,}80]$ của 9/15.
</details>
:::
