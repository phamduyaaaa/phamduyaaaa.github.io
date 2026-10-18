---
slug: torl-vla
date: 2026-10-18
title_en: "TORL-VLA: Tactile-guided Online RL on Top of a Wrench-aware VLA"
title_vi: "TORL-VLA: RL online dẫn hướng bằng xúc giác trên nền VLA nhận biết wrench"
excerpt_en: "ForceVLA and TA-VLA are fixed after offline training, and standard online refinement credits human rescues to the policy. TORL-VLA adds a small online actor-critic with an intervention-censored critic: 28/30 full tasks vs 15/30."
excerpt_vi: "ForceVLA và TA-VLA đứng yên sau khi huấn luyện offline, còn tinh chỉnh online thông thường ghi công cho chính sách cả những lần con người cứu. TORL-VLA thêm một actor-critic online nhỏ với critic bị kiểm duyệt theo can thiệp: 28/30 cả chuỗi so với 15/30."
tags: [VLA, Tactile, RL, Paper Notes, π0.5]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2606.09337](https://arxiv.org/abs/2606.09337) · 06/2026 · built on π0.5 · [project](https://torl-vla.github.io/)

**PROBLEM** A long contact task (cup into a tight holder, lock a latch, place an egg) where contact conditions keep shifting from what was in the data.

**WHAT FAILED BEFORE** Tactile/force VLAs such as [ForceVLA](forcevla.html) and TA-VLA are "deployed as offline policies" and cannot adapt, so the same failure repeats. Standard reference-guided online refinement (RLT) lets the critic credit the policy for chunks a human actually rescued.

**IDEA** Stage I: a wrench-aware π0.5 that also predicts the future wrench. Stage II: freeze it, and train small stage-specific actor heads online with two critics, one of which stops bootstrapping across human takeovers.

**RESULT** 28/30 full-task successes (π0.5: 12, ForceVLA: 15, RLT: 23), and 17% faster.
</div>

## 1. The problem: offline policies cannot fix their own mistakes

[[flow]]
- Before~ForceVLA, TA-VLA | wrench + RGB > Force-aware VLA > !Fixed after training! | the same failure repeats: 15/30 full tasks
- Before~RLT | VLA reference > Online RL > !Critic~credits human rescues! | 23/30
+ TORL-VLA | wrench > *Wrench-aware VLA~frozen reference* > *Stage actor + censored critic* > Robot | 28/30, 17% faster
[[/flow]] Keep the strong offline model as a reference; learn only a small correction online, and be careful about who earned the reward.

[[bars:/30]] π0.5=12; TA-VLA=12; ForceVLA=15; TORL-VLA without RL=21; RLT=23; *TORL-VLA=28* || Full latch-box task, successes out of 30 autonomous trials.

## 2. Architecture

[[fig:torl-vla]] Stage I trains a wrench-aware reference VLA; Stage II freezes it and trains stage-specific actor heads and two critics online.

| Block | Input | Output | Role |
|---|---|---|---|
| Tactile pads → wrench | two 6×8 piezo arrays | $w_t \in \mathbb{R}^{12}$ | touch as force/torque |
| MLP encoder | wrench window | one token $z^{tac}$ | contact summary |
| Late fusion + MoE | VLM prefix $P_t$, $z^{tac}$ | routed feature | fuse after the VLM |
| Zero-init bypass | $z^{tac}$ | $\alpha P(z^{tac})$, $\alpha$ starts at 0 | add contact without disturbing π0.5 |
| Flow-matching expert | conditioning | $A^{ref}$, future wrench $\hat W^{ref}$ | reference actions |
| Stage estimator + actors | VLA tokens, wrench, $A^{ref}$, $\hat W^{ref}$ | refined chunk | online correction |
| Critics $Q_{task}$, $Q_{ic}$ | context, action | values | train the actor |

## 3. Work it by hand: who gets the credit?

<div class="calc" markdown="1">
Calculation card

**What and why.** After a human takes over and succeeds, an ordinary critic gives the *preceding policy chunk* a high value. The intervention-censored critic cuts that link. Computing both targets shows the difference.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $R$ | reward earned during the policy chunk | input | 0 |
| $\gamma^K$ | discount over one chunk of $K$ steps | constant | 0.9 (illustrative) |
| $Q_{next}$ | value of the next state (human in control) | input | 1.0 |
| $m^{int}$ | 1 if the next chunk is a human takeover | input | 1 |
| $c_{int}$ | penalty for causing a takeover | constant | 1 (illustrative) |
| $d$ | 1 if the episode ended | input | 0 |
| $y_{task}$, $y_{ic}$ | training targets of the two critics | output | – |

**Formula**

$$y_{task} = R + (1-d)\,\gamma^K Q_{next}, \qquad y_{ic} = R - c_{int}\,m^{int} + (1-d)(1-m^{int})\,\gamma^K Q_{next}$$

**Steps**

1. $y_{task} = 0 + 1 \times 0.9 \times 1.0 = 0.9$.
2. $y_{ic} = 0 - 1 \times 1 + 1 \times 0 \times 0.9 \times 1.0 = -1$.

**Result.** The ordinary critic scores the chunk $+0.9$; the censored critic scores it $-1$.

**Why it matters.** The chunk that drove the robot towards unsafe contact *caused* the takeover. Only the censored target teaches the actor to avoid it. Human actions still stay in the replay buffer for imitation.
</div>

## 4. Training

| Stage | What is trained | Data / signal |
|---|---|---|
| I | wrench-aware reference VLA (π0.5) | demonstrations; loss on actions + future wrench |
| II | stage actors, $Q_{task}$, $Q_{ic}$ (VLA frozen) | online rollouts, human interventions, binary success per subtask |

## 5. Caveats

- I read the paper verbatim only up to the middle of the experiments; chunk length, control rate and update ratios are not quoted here.
- The number of MoE experts and the tactile sample rate are not stated in the part I read.

**Carry forward:** TORL-VLA needs a human ready to intervene. [TER-DAgger](ter-dagger.html) asks when exactly to call the human and how to turn a messy correction into clean data.

**Check question:** $R = 0.5$, $\gamma^K = 0.9$, $Q_{next} = 0.8$, $d = 0$, $c_{int} = 1$, takeover next ($m^{int} = 1$). Compute $y_{task}$ and $y_{ic}$.

<details markdown="1">
<summary>Answer</summary>

$y_{task} = 0.5 + 0.9 \times 0.8 = 1.22$. $y_{ic} = 0.5 - 1 + 0 = -0.5$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2606.09337](https://arxiv.org/abs/2606.09337) · 06/2026 · nền π0.5 · [trang dự án](https://torl-vla.github.io/)

**VẤN ĐỀ** Một task tiếp xúc chuỗi dài (đặt cốc vào khay chặt, khóa chốt, đặt trứng) mà điều kiện tiếp xúc cứ lệch khỏi dữ liệu.

**PAPER TRƯỚC HỎNG Ở ĐÂU** VLA xúc giác/lực như [ForceVLA](forcevla.html) và TA-VLA "được triển khai như chính sách offline" nên không thích nghi được, cùng một lỗi cứ lặp lại. Tinh chỉnh online tiêu chuẩn (RLT) để critic ghi công cho chính sách cả những chunk thực ra do con người cứu.

**Ý TƯỞNG** Giai đoạn I: π0.5 nhận biết wrench, dự đoán cả wrench tương lai. Giai đoạn II: đóng băng nó, huấn luyện online các đầu actor nhỏ theo pha với hai critic, trong đó một critic ngừng bootstrap qua các lần con người tiếp quản.

**KẾT QUẢ** 28/30 lần thành công cả chuỗi (π0.5: 12, ForceVLA: 15, RLT: 23), và nhanh hơn 17%.
</div>

## 1. Vấn đề: chính sách offline không tự sửa được lỗi

[[flow]]
- Trước~ForceVLA, TA-VLA | wrench + RGB > VLA nhận biết lực > !Đứng yên sau huấn luyện! | cùng lỗi lặp lại: 15/30 cả chuỗi
- Trước~RLT | VLA tham chiếu > RL online > !Critic~ghi công cả lần người cứu! | 23/30
+ TORL-VLA | wrench > *VLA nhận biết wrench~tham chiếu đóng băng* > *Actor theo pha + critic kiểm duyệt* > Robot | 28/30, nhanh hơn 17%
[[/flow]] Giữ mô hình offline mạnh làm tham chiếu; chỉ học online một phần hiệu chỉnh nhỏ, và cẩn thận xem ai thực sự kiếm được phần thưởng.

[[bars:/30]] π0.5=12; TA-VLA=12; ForceVLA=15; TORL-VLA không RL=21; RLT=23; *TORL-VLA=28* || Cả chuỗi hộp chốt, số lần thành công trên 30 lượt tự động.

## 2. Kiến trúc

[[fig:torl-vla]] Giai đoạn I huấn luyện VLA tham chiếu nhận biết wrench; giai đoạn II đóng băng nó và huấn luyện online các đầu actor theo pha cùng hai critic.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Miếng xúc giác → wrench | hai mảng áp điện 6×8 | $w_t \in \mathbb{R}^{12}$ | xúc giác thành lực/mô men |
| Bộ mã hóa MLP | cửa sổ wrench | một token $z^{tac}$ | tóm tắt tiếp xúc |
| Gộp muộn + MoE | prefix VLM $P_t$, $z^{tac}$ | đặc trưng đã định tuyến | gộp sau VLM |
| Bypass khởi tạo 0 | $z^{tac}$ | $\alpha P(z^{tac})$, $\alpha$ bắt đầu từ 0 | thêm tiếp xúc mà không xáo trộn π0.5 |
| Expert flow-matching | điều kiện | $A^{ref}$, wrench tương lai $\hat W^{ref}$ | hành động tham chiếu |
| Ước lượng pha + actor | token VLA, wrench, $A^{ref}$, $\hat W^{ref}$ | chunk đã tinh chỉnh | hiệu chỉnh online |
| Critic $Q_{task}$, $Q_{ic}$ | ngữ cảnh, hành động | giá trị | huấn luyện actor |

## 3. Tính tay: ai được ghi công?

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Sau khi con người tiếp quản và thành công, một critic thông thường cho *chunk của chính sách ngay trước đó* giá trị cao. Critic kiểm duyệt theo can thiệp cắt mối liên hệ đó. Tính cả hai mục tiêu để thấy khác biệt.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $R$ | phần thưởng trong chunk của chính sách | input | 0 |
| $\gamma^K$ | hệ số chiết khấu qua một chunk $K$ bước | hằng số | 0.9 (minh họa) |
| $Q_{next}$ | giá trị trạng thái kế (con người điều khiển) | input | 1.0 |
| $m^{int}$ | bằng 1 nếu chunk kế là con người tiếp quản | input | 1 |
| $c_{int}$ | mức phạt vì gây ra tiếp quản | hằng số | 1 (minh họa) |
| $d$ | bằng 1 nếu episode kết thúc | input | 0 |
| $y_{task}$, $y_{ic}$ | mục tiêu huấn luyện của hai critic | output | – |

**Công thức**

$$y_{task} = R + (1-d)\,\gamma^K Q_{next}, \qquad y_{ic} = R - c_{int}\,m^{int} + (1-d)(1-m^{int})\,\gamma^K Q_{next}$$

**Từng bước**

1. $y_{task} = 0 + 1 \times 0.9 \times 1.0 = 0.9$.
2. $y_{ic} = 0 - 1 \times 1 + 1 \times 0 \times 0.9 \times 1.0 = -1$.

**Kết quả.** Critic thông thường chấm chunk $+0{,}9$; critic kiểm duyệt chấm $-1$.

**Ý nghĩa.** Chunk đẩy robot về phía tiếp xúc không an toàn chính là thứ *gây ra* việc tiếp quản. Chỉ mục tiêu kiểm duyệt mới dạy actor tránh nó. Hành động của con người vẫn nằm trong replay buffer để bắt chước.
</div>

## 4. Huấn luyện

| Giai đoạn | Thứ được huấn luyện | Dữ liệu / tín hiệu |
|---|---|---|
| I | VLA tham chiếu nhận biết wrench (π0.5) | demo; loss trên hành động + wrench tương lai |
| II | actor theo pha, $Q_{task}$, $Q_{ic}$ (VLA đóng băng) | lượt chạy online, can thiệp của người, thành công nhị phân mỗi subtask |

## 5. Lưu ý

- Tôi chỉ đọc nguyên văn tới khoảng giữa phần thực nghiệm; độ dài chunk, tần số điều khiển và tỉ lệ cập nhật không được trích ở đây.
- Số expert của MoE và tần số lấy mẫu xúc giác không được nêu trong phần tôi đọc.

**Mang sang bài sau:** TORL-VLA cần một người sẵn sàng can thiệp. [TER-DAgger](ter-dagger.html) hỏi chính xác khi nào nên gọi con người và làm sao biến bản sửa lộn xộn thành dữ liệu sạch.

**Câu kiểm tra:** $R = 0.5$, $\gamma^K = 0.9$, $Q_{next} = 0.8$, $d = 0$, $c_{int} = 1$, chunk kế là tiếp quản ($m^{int} = 1$). Tính $y_{task}$ và $y_{ic}$.

<details markdown="1">
<summary>Đáp án</summary>

$y_{task} = 0.5 + 0.9 \times 0.8 = 1.22$. $y_{ic} = 0.5 - 1 + 0 = -0.5$.
</details>
:::
