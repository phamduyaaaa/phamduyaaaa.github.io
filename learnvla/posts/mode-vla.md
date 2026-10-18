---
slug: mode-vla
date: 2026-10-18
title_en: "MoDE-VLA: Mixture-of-Dexterous-Experts for Force and Touch"
title_vi: "MoDE-VLA: Mixture-of-Dexterous-Experts cho lực và xúc giác"
excerpt_en: "π0 is blind to arm torque and fingertip touch, and mixing them into shared layers risks overwriting what it learned. MoDE-VLA gives them a separate sparse-MoE path that only adds residual corrections."
excerpt_vi: "π0 mù mô men tay và xúc giác đầu ngón, còn trộn chúng vào các lớp dùng chung dễ ghi đè những gì nó đã học. MoDE-VLA cho chúng một đường MoE thưa riêng, chỉ cộng thêm hiệu chỉnh residual."
tags: [VLA, Force, Tactile, Paper Notes, MoE, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.08122](https://arxiv.org/abs/2603.08122) · 03/2026 · built on π0 · 63-DoF bimanual robot with two 22-DoF hands

**PROBLEM** Dexterous contact tasks (gear assembling, charger plugging, apple peeling) need arm torque *and* fingertip touch.

**WHAT FAILED BEFORE** π0 sees neither. Feeding 74 new numbers through π0's shared layers risks overwriting pretrained knowledge, and one shared mapping must cover reaching, first contact, grasping and in-hand rotation alike.

**IDEA** A separate path: force and touch tokens go through a sparse MoE (8 experts, top-1) and are added as **residuals**: force corrects the arm, touch corrects the hand. An RL skill (IMCopilot) can take over in-hand rotation.

**RESULT** The abstract reports a doubled success rate over the π0 baseline.
</div>

## 1. The problem: what π0 cannot do here

[[flow]]
- Before~π0 | RGB + language + state > VLM + action expert > !Arm + hand actions~no torque, no touch! | contact is invisible
- Naive~concat into state | torque + touch > !Shared π0 layers! > Actions | new signals can overwrite pretrained knowledge
+ MoDE-VLA | torque + touch > *Sparse MoE~own path, 8 experts* > *Residual~force→arm, touch→hand* > Arm + hand velocity | pretrained path kept, corrections added
[[/flow]] The paper's three design principles: a dedicated path, routing by modality, residual injection.

## 2. Architecture

[[fig:mode-vla]] Force and tactile tokens pass a sparse MoE and become residual corrections for arm and hand velocity; an RL skill can take over the hand.

| Block | Input | Output | Role |
|---|---|---|---|
| SigLIP + PaliGemma (Gemma-3B) | 3 RGB views, language, proprioception | prefix $Z_{prefix}$ | π0's perception |
| Action expert (Gemma-300M) | noisy action $x_t$, timestep | suffix $Z_{suffix}$ | π0's action path |
| $W_f$, $W_g$ + copies | force $f \in \mathbb{R}^{14}$, touch $g \in \mathbb{R}^{60}$ | $\tilde Z_f$, $\tilde Z_g$ ($H$ copies) | one slot per future step |
| Self-attention + MoE | all four token groups | $Z_f$, $Z_g$ | 8 experts, top-1 routing |
| $W_1$, $W_2$ | $Z_f + Z_{suffix}$, $Z_g + Z_{suffix}$ | arm, hand velocity | residual injection |
| IMCopilot (PPO) | hand state, fingertip forces | hand actions | takes over if trigger $c > 0.5$ |

## 3. Work it by hand: why copy the force token H times

<div class="calc" markdown="1">
Calculation card

**What and why.** One force reading gives one vector, but the action chunk has $H = 50$ future steps that may need different corrections (just touching vs holding). Copying the vector per step and adding a step encoding lets the router send each step to a different expert.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $z_f$ | projected force vector | input | $(1,\ 0)$ (toy, 2-D) |
| $\text{pos}_i$ | step encoding for future step $i$ | input | $\text{pos}_1 = (0, 0)$, $\text{pos}_2 = (0, 2)$ |
| $\tilde z^{(i)}$ | copy for step $i$ | intermediate | – |
| $\ell_A, \ell_B$ | router logits for experts A, B | intermediate | toy router: $\ell_A$ = 1st coord, $\ell_B$ = 2nd |
| $e_i$ | expert chosen for step $i$ | output | – |

**Formula**

$$\tilde z^{(i)} = z_f + \text{pos}_i, \qquad e_i = \arg\max(\ell_A, \ell_B)$$

**Steps**

1. Step 1: $\tilde z^{(1)} = (1, 0) + (0, 0) = (1, 0)$, so $\ell_A = 1 > \ell_B = 0$: expert **A**.
2. Step 2: $\tilde z^{(2)} = (1, 0) + (0, 2) = (1, 2)$, so $\ell_B = 2 > \ell_A = 1$: expert **B**.
3. Without step encodings both copies are $(1, 0)$: both go to A.

**Result.** Same force reading, different experts for different future steps.

**Why it matters.** The paper motivates routing by contact regime; the copies are what make per-step routing possible. (The router here is a toy; the real one is learned.)
</div>

## 4. Training and data

| Item | Value |
|---|---|
| Init | π0 checkpoint; MoDE module and projections from scratch |
| Schedule | 60,000 steps, AdamW, cosine decay, colour jitter |
| Loss | flow matching, $t \sim \text{Beta}(1.5, 1)$; 10 Euler steps at inference, $H = 50$ |
| Data | exoskeleton + VR teleoperation with force/tactile feedback; foot pedals trigger hand skills |
| Sizes | $14 = 7 \times 2$ torques, $60 = 5 \times 6 \times 2$ tactile values, $63 = (7+22)\times 2 + 2 + 3$ DoF |

## 5. Results

[[bars:%]] π0 (baseline)=15; w/o force=23; w/o touch=26; *MoDE-VLA=34* || Average success over four tasks, 20 trials per task (Table II of the paper).

| Task | π0 | MoDE-VLA | w/o force | w/o touch |
|---|---|---|---|---|
| Apple peeling (success / ring completed) | 0% / 8% | 30% / 73% | 15% / 48% | 30% / 70% |
| Tube rearranging | 15% | 30% | 25% | 15% |
| Gear assembling | 40% | 60% | 45% | 45% |
| Charger plugging | 5% | 15% | 5% | 15% |

- Removing force costs the most (−11 points on average); removing touch costs 8 (the paper's figures). Without the IMCopilot RL skill, apple peeling falls from 30% to 0% success and from 73% to 25% ring completion.
- Data collection: operators with force and touch feedback succeed in 89% of in-hand trials (80/90), against 34% (31/90) for plain teleoperation.

## 6. Caveats

- Checked against the full text; the success rates are small in absolute terms (34% best), so with 20 trials per task the differences between rows are within noise for several cells (see [how to evaluate a VLA](danh-gia-vla.html)).
- The body says π0, the Fig. 3 caption says "OpenPI-0"; control frequency is not stated.

**Carry forward:** ForceVLA, ForceVLA2 and MoDE-VLA all fine-tune the VLA on the new signal. [VLA-Touch](vla-touch.html) asks whether touch can be added without changing the VLA at all.

**Check question:** same toy, $\text{pos}_3 = (0,\ 0.5)$. Which expert gets step 3? Which actions does the tactile path correct?

<details markdown="1">
<summary>Answer</summary>

$(1, 0) + (0, 0.5) = (1, 0.5)$; $\ell_A = 1 > 0.5$, so expert A. The tactile path corrects **hand** actions (via $W_2$); force corrects the **arm** (via $W_1$).
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.08122](https://arxiv.org/abs/2603.08122) · 03/2026 · nền π0 · robot hai tay 63 bậc tự do, hai bàn tay 22 bậc

**VẤN ĐỀ** Task tiếp xúc khéo léo (lắp bánh răng, cắm sạc, gọt táo) cần cả mô men cánh tay *lẫn* xúc giác đầu ngón.

**PAPER TRƯỚC HỎNG Ở ĐÂU** π0 không thấy cái nào. Đưa 74 con số mới qua các lớp dùng chung của π0 dễ ghi đè tri thức đã pretrain, và một ánh xạ chung phải lo cả với tới, chạm đầu tiên, nắm và xoay trong tay.

**Ý TƯỞNG** Một đường riêng: token lực và xúc giác qua MoE thưa (8 expert, top-1) rồi được cộng vào dưới dạng **residual**: lực hiệu chỉnh cánh tay, xúc giác hiệu chỉnh bàn tay. Một kỹ năng RL (IMCopilot) có thể tiếp quản việc xoay trong tay.

**KẾT QUẢ** Abstract nêu tỉ lệ thành công tăng gấp đôi so với baseline π0.
</div>

## 1. Vấn đề: π0 không làm được gì ở đây

[[flow]]
- Trước~π0 | RGB + ngôn ngữ + state > VLM + action expert > !Hành động tay~không mô men, không xúc giác! | tiếp xúc vô hình
- Ngây thơ~nối vào state | mô men + xúc giác > !Lớp dùng chung của π0! > Hành động | tín hiệu mới có thể ghi đè tri thức đã pretrain
+ MoDE-VLA | mô men + xúc giác > *MoE thưa~đường riêng, 8 expert* > *Residual~lực→cánh tay, chạm→bàn tay* > Vận tốc tay | giữ đường pretrain, chỉ cộng hiệu chỉnh
[[/flow]] Ba nguyên tắc thiết kế của bài: đường riêng, định tuyến theo modality, tiêm residual.

## 2. Kiến trúc

[[fig:mode-vla]] Token lực và xúc giác qua MoE thưa và thành hiệu chỉnh residual cho vận tốc cánh tay và bàn tay; một kỹ năng RL có thể tiếp quản bàn tay.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| SigLIP + PaliGemma (Gemma-3B) | 3 góc RGB, ngôn ngữ, proprioception | prefix $Z_{prefix}$ | phần cảm nhận của π0 |
| Action expert (Gemma-300M) | action nhiễu $x_t$, timestep | suffix $Z_{suffix}$ | đường hành động của π0 |
| $W_f$, $W_g$ + nhân bản | lực $f \in \mathbb{R}^{14}$, xúc giác $g \in \mathbb{R}^{60}$ | $\tilde Z_f$, $\tilde Z_g$ ($H$ bản) | mỗi bước tương lai một ô |
| Self-attention + MoE | cả bốn nhóm token | $Z_f$, $Z_g$ | 8 expert, định tuyến top-1 |
| $W_1$, $W_2$ | $Z_f + Z_{suffix}$, $Z_g + Z_{suffix}$ | vận tốc cánh tay, bàn tay | tiêm residual |
| IMCopilot (PPO) | trạng thái bàn tay, lực đầu ngón | hành động bàn tay | tiếp quản nếu tín hiệu $c > 0{,}5$ |

## 3. Tính tay: vì sao nhân bản token lực H lần

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một lần đọc lực cho một vector, nhưng chunk hành động có $H = 50$ bước tương lai có thể cần hiệu chỉnh khác nhau (vừa chạm và đang giữ). Nhân bản vector cho mỗi bước và cộng mã hóa bước giúp router gửi mỗi bước tới một expert khác nhau.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $z_f$ | vector lực đã chiếu | input | $(1,\ 0)$ (đồ chơi, 2 chiều) |
| $\text{pos}_i$ | mã hóa của bước tương lai $i$ | input | $\text{pos}_1 = (0, 0)$, $\text{pos}_2 = (0, 2)$ |
| $\tilde z^{(i)}$ | bản sao cho bước $i$ | trung gian | – |
| $\ell_A, \ell_B$ | logit router cho expert A, B | trung gian | router đồ chơi: $\ell_A$ = tọa độ 1, $\ell_B$ = tọa độ 2 |
| $e_i$ | expert được chọn cho bước $i$ | output | – |

**Công thức**

$$\tilde z^{(i)} = z_f + \text{pos}_i, \qquad e_i = \arg\max(\ell_A, \ell_B)$$

**Từng bước**

1. Bước 1: $\tilde z^{(1)} = (1, 0) + (0, 0) = (1, 0)$, nên $\ell_A = 1 > \ell_B = 0$: expert **A**.
2. Bước 2: $\tilde z^{(2)} = (1, 0) + (0, 2) = (1, 2)$, nên $\ell_B = 2 > \ell_A = 1$: expert **B**.
3. Không có mã hóa bước, cả hai bản đều là $(1, 0)$: đều đi tới A.

**Kết quả.** Cùng một lần đọc lực, các bước tương lai khác nhau đi tới expert khác nhau.

**Ý nghĩa.** Bài lý giải định tuyến bằng các chế độ tiếp xúc; việc nhân bản là thứ cho phép định tuyến theo từng bước. (Router ở đây là đồ chơi; router thật được học.)
</div>

## 4. Huấn luyện và dữ liệu

| Mục | Giá trị |
|---|---|
| Khởi tạo | checkpoint π0; module MoDE và các lớp chiếu từ đầu |
| Lịch | 60.000 bước, AdamW, giảm cosine, đổi màu ảnh |
| Loss | flow matching, $t \sim \text{Beta}(1.5, 1)$; 10 bước Euler khi suy luận, $H = 50$ |
| Dữ liệu | teleoperation bằng exoskeleton + VR có phản hồi lực/xúc giác; bàn đạp chân kích hoạt kỹ năng tay |
| Kích thước | $14 = 7 \times 2$ mô men, $60 = 5 \times 6 \times 2$ giá trị xúc giác, $63 = (7+22)\times 2 + 2 + 3$ bậc tự do |

## 5. Kết quả

[[bars:%]] π0 (baseline)=15; Bỏ lực=23; Bỏ xúc giác=26; *MoDE-VLA=34* || Tỉ lệ thành công trung bình trên bốn tác vụ, 20 lượt mỗi tác vụ (Bảng II của paper).

| Tác vụ | π0 | MoDE-VLA | Bỏ lực | Bỏ xúc giác |
|---|---|---|---|---|
| Gọt táo (thành công / hoàn thành vòng gọt) | 0% / 8% | 30% / 73% | 15% / 48% | 30% / 70% |
| Sắp xếp ống | 15% | 30% | 25% | 15% |
| Lắp bánh răng | 40% | 60% | 45% | 45% |
| Cắm sạc | 5% | 15% | 5% | 15% |

- Bỏ lực làm giảm nhiều nhất (−11 điểm trung bình); bỏ xúc giác giảm 8 điểm (số của paper). Bỏ kỹ năng RL IMCopilot thì gọt táo từ 30% thành công xuống 0%, và mức hoàn thành vòng gọt từ 73% xuống 25%.
- Thu dữ liệu: người vận hành có phản hồi lực và xúc giác thành công 89% các lượt thao tác trong tay (80/90), so với 34% (31/90) khi teleoperation thường.

## 6. Lưu ý

- Đã đối chiếu với toàn văn. Tỉ lệ thành công tuyệt đối còn nhỏ (cao nhất 34%), nên với 20 lượt mỗi tác vụ, chênh lệch giữa các hàng ở một số ô nằm trong vùng nhiễu (xem [cách đánh giá VLA](danh-gia-vla.html)).
- Thân bài ghi π0, chú thích Fig. 3 ghi "OpenPI-0"; tần số điều khiển không được nêu.

**Mang sang bài sau:** ForceVLA, ForceVLA2 và MoDE-VLA đều fine-tune VLA trên tín hiệu mới. [VLA-Touch](vla-touch.html) hỏi: có thêm được xúc giác mà không đổi gì ở VLA không?

**Câu kiểm tra:** cùng router đồ chơi, $\text{pos}_3 = (0,\ 0.5)$. Bước 3 đi tới expert nào? Đường xúc giác hiệu chỉnh hành động nào?

<details markdown="1">
<summary>Đáp án</summary>

$(1, 0) + (0, 0.5) = (1, 0.5)$; $\ell_A = 1 > 0{,}5$, nên expert A. Đường xúc giác hiệu chỉnh hành động **bàn tay** (qua $W_2$); lực hiệu chỉnh **cánh tay** (qua $W_1$).
</details>
:::
