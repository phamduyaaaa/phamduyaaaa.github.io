---
slug: calvin
date: 2026-10-21
title_en: "CALVIN: Long Chains of Language Instructions"
title_vi: "CALVIN: Chuỗi dài các câu lệnh ngôn ngữ"
excerpt_en: "CALVIN gives the policy five instructions in a row in a simulated room and stops at the first failure. Its headline number, average length, is the expected number of tasks completed in a row; the hard split trains on three rooms and tests on a fourth."
excerpt_vi: "CALVIN đưa cho policy năm câu lệnh liên tiếp trong một căn phòng mô phỏng và dừng ở lần thất bại đầu tiên. Con số chính, average length, là số tác vụ kỳ vọng làm được liên tiếp; phần khó nhất học trên ba phòng và kiểm tra trên phòng thứ tư."
tags: [VLA, Benchmark, CALVIN, Long-horizon]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Mees, Hermann, Rosete-Beas, Burgard, *CALVIN: A Benchmark for Language-Conditioned Policy Learning for Long-Horizon Robot Manipulation Tasks*, [arXiv 2112.03227](https://arxiv.org/abs/2112.03227) · 12/2021 · RA-L 2022

**PROBLEM** A home robot gets a sequence of requests ("open the drawer, then put the block in it"), not one isolated task, and it should handle rooms it has not seen.

**WHAT FAILED BEFORE** The closest prior setup (multi-context imitation learning, MCIL) had 18 sub-tasks, chains of 4, no public implementation, and no test on an unseen environment. Single-task benchmarks score each task in isolation, so they never see errors that carry over from one task to the next.

**IDEA** Four similar simulated rooms (A, B, C, D), about 24 hours of unscripted teleoperated "play" with language labels, 34 tasks, and an evaluation of 1,000 chains of five instructions that stops at the first failure.

**RESULT** The MCIL baseline finishes the first instruction in 48.9% of chains but all five in only 0.08% (train and test on room D). The metric later VLA papers quote is the *average length* on the ABC→D split (0 to 5).
</div>

## 1. The problem: tasks scored one at a time hide error carry-over

[[flow]]
- Before~Isolated tasks | Reset scene > !Score one task~fresh start every time! > Success % | a messy end state never hurts the next task
+ CALVIN | Neutral start > *5 instructions in a row~stop at the first failure* > Average length | errors carry over, as in a real home
[[/flow]] The change is to score sequences, so a policy is punished for leaving the scene in a state it cannot continue from.

## 2. Setup and splits

[[fig:calvin]] Training data is unscripted play in some rooms; evaluation follows five instructions in a row. The task names in the chain are an example; the percentages are the MCIL baseline's (D→D).

| Element | CALVIN |
|---|---|
| Robot | 7-DoF Franka Panda with a parallel gripper, actions sent at 30 Hz |
| Observations | static camera RGB-D (200×200), gripper camera RGB-D (84×84), vision-based tactile image, proprioception (EE pose, gripper width, 7 joints) |
| Actions | absolute or relative cartesian pose + gripper, or 7 joint positions + gripper |
| Data | ~24 h of teleoperated play, 20K language directives, 400+ crowd-sourced instructions for 34 tasks |
| Splits | D→D (same room), ABCD→D (all rooms), ABC→D (test room never seen: the hardest) |
| Long-horizon test | 1,000 unique chains of five, filtered for feasibility, cycles and redundancy |

The test instructions are new phrasings not in the training set, so language generalisation is tested too.

<div class="calc" markdown="1">

Calculation card

**What and why.** Average length is the expected number of instructions completed in a row. Computing it from the chain percentages shows why it moves so slowly at first and so fast once a policy is reliable.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $P_k$ | fraction of chains that complete the first $k$ instructions | input | MCIL D→D: 0.489, 0.129, 0.026, 0.005, 0.0008 |
| $s$ | per-instruction success, if every step had the same chance | input | 0.9 |
| $L$ | average length | output | – |

**Formula**

$$L = \sum_{k=1}^{5} P_k, \qquad \text{if } P_k = s^k: \quad L = \frac{s\,(1 - s^5)}{1 - s}$$

**Steps**

1. MCIL: $L = 0.489 + 0.129 + 0.026 + 0.005 + 0.0008 = 0.650$.
2. Uniform $s = 0.9$: $P_k = 0.9, 0.81, 0.729, 0.656, 0.590$, so $L = 3.686$ (the closed form gives $0.9 \times 0.410 / 0.1 = 3.686$).
3. Uniform $s = 0.5$: $L = 0.5 \times (1 - 0.03125) / 0.5 = 0.969$.

**Result.** The baseline averages 0.65 tasks per chain. Going from 50% to 90% per-instruction success multiplies $L$ by about 3.8.

**Why it matters.** $L$ rewards reliability, not single-task peaks: a policy only reaches task 5 if it rarely fails. When a paper reports $L$, also look at $P_5$, the fraction of full chains, which is the strictest number.
</div>

## 3. What the paper found with its baseline

- On single tasks (34 tasks, same room) MCIL reaches 53.9%; adding a gripper camera, depth or tactile sensing did not change that much.
- On chains, results collapse: 48.9% → 12.9% → 2.6% → 0.5% → 0.08% (D→D). With three rooms of training data and a new test room, MCIL completes the first instruction in roughly 17–30% of chains, depending on the sensors, and the second in under 2%.
- The authors' reading: long horizons and unseen rooms are the open problem. That is why later VLA papers use ABC→D average length as their headline.

## 4. Why it matters for a force-minded reader

CALVIN is one of the few standard benchmarks with a simulated vision-based tactile sensor and selectable action spaces, so it can host a contact-signal ablation. The baseline found no gain from tactile input, because most of its tasks (drawers, buttons, blocks) are decided by position, not by force. A task set where force matters (insertion, wiping) has to come from elsewhere; see the [force survey](survey-force-map.html).

## 5. Caveats

- Checked against the full CALVIN paper: environments, sensors, action spaces, 34 tasks, 1,000 chains and the MCIL table.
- I do not quote later VLA scores on CALVIN here because I have not checked each paper's protocol; when you read one, check the split (ABC→D or ABCD→D) and whether the policy used the gripper camera.

**Carry forward:** [LIBERO](libero.html) checks single tasks per knowledge type; CALVIN checks chains. [SimplerEnv](simplerenv.html) asks a different question: does the simulation ranking predict the real one?

**Check question:** a policy has $P = 0.95, 0.85, 0.70, 0.55, 0.40$. What is its average length, and what fraction of chains finish all five instructions?

<details markdown="1">
<summary>Answer</summary>

$L = 0.95 + 0.85 + 0.70 + 0.55 + 0.40 = 3.45$. Full chains: $P_5 = 40\%$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Mees, Hermann, Rosete-Beas, Burgard, *CALVIN: A Benchmark for Language-Conditioned Policy Learning for Long-Horizon Robot Manipulation Tasks*, [arXiv 2112.03227](https://arxiv.org/abs/2112.03227) · 12/2021 · RA-L 2022

**VẤN ĐỀ** Robot trong nhà nhận một chuỗi yêu cầu ("mở ngăn kéo, rồi bỏ khối vào"), không phải một tác vụ riêng lẻ, và phải xử lý được căn phòng chưa từng thấy.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Bộ thử gần nhất trước đó (học bắt chước đa ngữ cảnh, MCIL) có 18 tác vụ con, chuỗi dài 4, không có mã công khai, và không kiểm tra trên môi trường chưa thấy. Benchmark một tác vụ chấm từng tác vụ riêng, nên không bao giờ thấy lỗi dồn từ tác vụ này sang tác vụ kế.

**Ý TƯỞNG** Bốn căn phòng mô phỏng giống nhau (A, B, C, D), khoảng 24 giờ "chơi" tự do do người điều khiển từ xa có gắn nhãn ngôn ngữ, 34 tác vụ, và bài đánh giá gồm 1.000 chuỗi năm câu lệnh, dừng ở lần thất bại đầu tiên.

**KẾT QUẢ** Baseline MCIL làm xong câu lệnh đầu ở 48,9% số chuỗi nhưng xong cả năm chỉ ở 0,08% (học và thử cùng phòng D). Con số mà các paper VLA sau này trích là *average length* trên phần ABC→D (từ 0 đến 5).
</div>

## 1. Vấn đề: chấm từng tác vụ riêng che mất lỗi dồn

[[flow]]
- Trước~Tác vụ riêng lẻ | Đặt lại cảnh > !Chấm một tác vụ~mỗi lần bắt đầu lại từ đầu! > Tỉ lệ thành công | trạng thái lộn xộn cuối tác vụ không ảnh hưởng tác vụ sau
+ CALVIN | Bắt đầu trung tính > *5 câu lệnh liên tiếp~dừng ở lần hỏng đầu tiên* > Average length | lỗi dồn sang, như trong nhà thật
[[/flow]] Thay đổi là chấm theo chuỗi, nên policy bị phạt nếu để cảnh ở trạng thái không làm tiếp được.

## 2. Thiết lập và các phần chia

[[fig:calvin]] Dữ liệu huấn luyện là phần chơi tự do ở một số phòng; bài đánh giá theo năm câu lệnh liên tiếp. Tên tác vụ trong chuỗi chỉ là ví dụ; các phần trăm là của baseline MCIL (D→D).

| Thành phần | CALVIN |
|---|---|
| Robot | Franka Panda 7 bậc với tay kẹp song song, gửi hành động ở 30 Hz |
| Quan sát | RGB-D camera cố định (200×200), RGB-D camera tay kẹp (84×84), ảnh xúc giác dựa trên camera, cảm thụ bản thể (tư thế đầu cuối, độ mở kẹp, 7 khớp) |
| Hành động | tư thế Descartes tuyệt đối hoặc tương đối + tay kẹp, hoặc 7 vị trí khớp + tay kẹp |
| Dữ liệu | ~24 giờ chơi điều khiển từ xa, 20K câu chỉ dẫn, hơn 400 câu lệnh thu từ cộng đồng cho 34 tác vụ |
| Phần chia | D→D (cùng phòng), ABCD→D (mọi phòng), ABC→D (phòng thử chưa từng thấy: khó nhất) |
| Bài thử tầm dài | 1.000 chuỗi năm câu lệnh khác nhau, đã lọc tính khả thi, vòng lặp và trùng lặp |

Câu lệnh lúc thử là cách diễn đạt mới không có trong tập huấn luyện, nên khả năng tổng quát ngôn ngữ cũng được kiểm tra.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Average length là số câu lệnh kỳ vọng làm xong liên tiếp. Tính nó từ phần trăm của chuỗi cho thấy vì sao lúc đầu nó tăng rất chậm và tăng rất nhanh khi policy đã đáng tin.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $P_k$ | tỉ lệ chuỗi làm xong $k$ câu lệnh đầu | đầu vào | MCIL D→D: 0,489, 0,129, 0,026, 0,005, 0,0008 |
| $s$ | xác suất thành công mỗi câu lệnh, nếu mọi bước như nhau | đầu vào | 0,9 |
| $L$ | average length | đầu ra | – |

**Công thức**

$$L = \sum_{k=1}^{5} P_k, \qquad \text{nếu } P_k = s^k: \quad L = \frac{s\,(1 - s^5)}{1 - s}$$

**Các bước**

1. MCIL: $L = 0{,}489 + 0{,}129 + 0{,}026 + 0{,}005 + 0{,}0008 = 0{,}650$.
2. $s = 0{,}9$ đều: $P_k = 0{,}9;\ 0{,}81;\ 0{,}729;\ 0{,}656;\ 0{,}590$, nên $L = 3{,}686$ (công thức đóng cho $0{,}9 \times 0{,}410 / 0{,}1 = 3{,}686$).
3. $s = 0{,}5$ đều: $L = 0{,}5 \times (1 - 0{,}03125) / 0{,}5 = 0{,}969$.

**Kết quả.** Baseline trung bình làm được 0,65 tác vụ mỗi chuỗi. Đi từ 50% lên 90% thành công mỗi câu lệnh nhân $L$ lên khoảng 3,8 lần.

**Vì sao quan trọng.** $L$ thưởng cho độ ổn định, không cho đỉnh của một tác vụ: policy chỉ tới được tác vụ 5 nếu hiếm khi hỏng. Khi paper báo $L$, hãy xem thêm $P_5$, tỉ lệ làm trọn chuỗi, là con số khắt khe nhất.
</div>

## 3. Paper thấy gì với baseline của nó

- Với từng tác vụ (34 tác vụ, cùng phòng) MCIL đạt 53,9%; thêm camera tay kẹp, độ sâu hay xúc giác không thay đổi nhiều.
- Với chuỗi, kết quả sụp: 48,9% → 12,9% → 2,6% → 0,5% → 0,08% (D→D). Khi học trên ba phòng và thử ở phòng mới, MCIL xong câu lệnh đầu ở khoảng 17–30% số chuỗi, tùy bộ cảm biến, và câu thứ hai dưới 2%.
- Cách đọc của tác giả: tầm dài và phòng chưa thấy là bài toán còn mở. Vì vậy các paper VLA sau này lấy average length trên ABC→D làm con số chính.

## 4. Vì sao đáng quan tâm với người làm lực

CALVIN là một trong ít benchmark chuẩn có cảm biến xúc giác dựa trên camera trong mô phỏng và cho chọn không gian hành động, nên có thể dùng làm nơi thử bỏ/thêm tín hiệu tiếp xúc. Baseline không thấy lợi từ xúc giác, vì phần lớn tác vụ (ngăn kéo, nút bấm, khối) được quyết định bởi vị trí chứ không phải lực. Bộ tác vụ mà lực quan trọng (lắp ghép, lau) phải tìm ở nơi khác; xem [survey về lực](survey-force-map.html).

## 5. Lưu ý

- Đã đối chiếu với toàn văn paper CALVIN: môi trường, cảm biến, không gian hành động, 34 tác vụ, 1.000 chuỗi và bảng MCIL.
- Mình không trích điểm CALVIN của các VLA sau này vì chưa kiểm tra quy trình của từng paper; khi đọc, hãy xem phần chia (ABC→D hay ABCD→D) và policy có dùng camera tay kẹp không.

**Mang theo:** [LIBERO](libero.html) kiểm tra từng tác vụ theo loại kiến thức; CALVIN kiểm tra chuỗi. [SimplerEnv](simplerenv.html) hỏi một câu khác: thứ hạng trong mô phỏng có đoán được thứ hạng thật không?

**Câu hỏi kiểm tra:** một policy có $P = 0{,}95;\ 0{,}85;\ 0{,}70;\ 0{,}55;\ 0{,}40$. Average length là bao nhiêu, và bao nhiêu phần trăm chuỗi làm xong cả năm câu lệnh?

<details markdown="1">
<summary>Đáp án</summary>

$L = 0{,}95 + 0{,}85 + 0{,}70 + 0{,}55 + 0{,}40 = 3{,}45$. Trọn chuỗi: $P_5 = 40\%$.
</details>
:::
