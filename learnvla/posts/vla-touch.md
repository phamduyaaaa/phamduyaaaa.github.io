---
slug: vla-touch
date: 2026-10-18
title_en: "VLA-Touch: Dual-level Tactile Feedback Without Retraining the VLA"
title_vi: "VLA-Touch: Phản hồi xúc giác hai tầng mà không train lại VLA"
excerpt_en: "Adding touch usually means fine-tuning the VLA on paired tactile data. VLA-Touch leaves RDT unchanged and adds touch twice: as words for a GPT-4o planner, and as force for a small refiner of the action chunk."
excerpt_vi: "Thêm xúc giác thường nghĩa là fine-tune VLA trên dữ liệu xúc giác ghép đôi. VLA-Touch giữ nguyên RDT và thêm xúc giác hai lần: thành chữ cho planner GPT-4o, và thành lực cho một bộ tinh chỉnh action chunk."
tags: [VLA, Tactile, Paper Notes, RDT]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2507.17294](https://arxiv.org/abs/2507.17294) · 07/2025 · RA-L 2026 · base VLA RDT-1B · [code](https://github.com/jxbi1010/VLA-Touch)

**PROBLEM** Some decisions need touch: is the cup full, which mango is softer, is the sponge pressing hard enough.

**WHAT FAILED BEFORE** Giving a VLM planner raw tactile images: 50% correct on force, 60% on hardness. Fine-tuning the VLA on tactile input needs paired data and puts the pretrained VLA at risk.

**IDEA** Keep the VLA unchanged. Touch enters twice: tactile → language (Octopi) for a GPT-4o planner, and tactile force → an interpolant controller that refines the VLA's action chunk.

**RESULT** Up to 35% higher manipulation success than the vision-only VLA; wiping 5 → 12 successes out of 20.
</div>

## 1. The problem: two ways that did not work

[[flow]]
- Before~raw touch to planner | GelSight image > !GPT-4o planner~reads pixels! | 50% correct on force, 60% on hardness
- Before~fine-tune on touch | tactile + RGB > !Fine-tune RDT~needs paired data! > Actions | costly, risks the pretrained VLA
+ VLA-Touch | GelSight > *Octopi → text* > GPT-4o planner > RDT unchanged > *Refiner~+ marker force* | touch used twice, VLA untouched
[[/flow]] The planner gets touch as words; the controller gets touch as force. The VLA in between is not retrained.

## 2. Architecture

[[fig:vla-touch]] Outer loop: tactile text updates the GPT-4o instruction. Inner loop: tactile force refines the chunk from RDT.

| Block | Input | Output | Role |
|---|---|---|---|
| Octopi | 6 GelSight frames | words: hardness, roughness | touch → language |
| GPT-4o planner | goal, scene image, tactile text, last instruction | next instruction $I_{k+1}$ | re-plan with touch |
| RDT-1B (base VLA) | instruction, RGB, proprioception | chunk of $T_a = 64$ steps | motion proposal |
| Marker tracking | GelSight image | $m_t = (X, Y, M)$ | touch → 3 numbers |
| Interpolant controller | chunk, DINOv2 features, $m_t$ history | refined first 48 steps | correct contact, ≤ 8 Hz |

## 3. Work it by hand: turning markers into $m_t$

<div class="calc" markdown="1">
Calculation card

**What and why.** The refiner runs at up to 8 Hz and cannot digest a tactile image each step. VLA-Touch compresses the gel's marker motion into three numbers: total shear in $x$, in $y$, and its size.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $v_i = (x_i, y_i)$ | shear vector of marker $i$ | input | $(0.1, 0)$, $(0.2, 0.1)$, $(0.1, -0.05)$ (arbitrary units) |
| $X, Y$ | summed shear | output | – |
| $M$ | magnitude of the sum | output | – |

**Formula**

$$X = \sum_i x_i, \qquad Y = \sum_i y_i, \qquad M = \sqrt{X^2 + Y^2}$$

**Steps**

1. $X = 0.1 + 0.2 + 0.1 = 0.4$
2. $Y = 0 + 0.1 - 0.05 = 0.05$
3. $M = \sqrt{0.4^2 + 0.05^2} = \sqrt{0.1625} \approx 0.403$

**Result.** $m_t = (0.4,\ 0.05,\ 0.403)$.

**Why it matters.** Three numbers per step are cheap enough for a fast refiner, and they keep what matters for wiping and peeling: which way and how hard the gel is being dragged.
</div>

## 4. Results

[[bars:/20]] Cup place · RDT=7; *Cup place · + touch refiner=10*; Wipe · RDT=5; *Wipe · + touch refiner=12*; Peel · RDT=6; *Peel · + touch refiner=10* || Full-task successes out of 20.

- Planner with tactile language: force judged right 90%, hardness 75% (vs 50% and 60% from raw images).
- Removing touch from the controller cut cup placement by 50%.

## 5. Training

| Step | What |
|---|---|
| 1 | RDT fine-tuned on unrelated Franka data (100k steps) to align action spaces |
| 2 | Fine-tuned on task data **without** touch (20k steps per task) |
| 3 | Run RDT on task data to collect chunks; train the refiner with MSE against expert actions |

## 6. Caveats

- High-frequency touch (25 Hz and up) is not used yet; data were logged at 10 Hz.
- Whether Octopi and DINOv2 are frozen is not stated.

**Carry forward:** VLA-Touch passes touch on as words or as a summed shear, but a gel image shows deformation, not force. [TaF-VLA](taf-vla.html) trains the tactile encoder to produce force-like features first.

**Check question:** two markers read $(0.3,\ 0.1)$ and $(-0.1,\ 0.2)$. What is $m_t$?

<details markdown="1">
<summary>Answer</summary>

$X = 0.2$, $Y = 0.3$, $M = \sqrt{0.04 + 0.09} = \sqrt{0.13} \approx 0.361$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2507.17294](https://arxiv.org/abs/2507.17294) · 07/2025 · RA-L 2026 · VLA nền RDT-1B · [code](https://github.com/jxbi1010/VLA-Touch)

**VẤN ĐỀ** Có những quyết định cần xúc giác: cốc có đầy không, quả xoài nào mềm hơn, bọt biển đã ấn đủ mạnh chưa.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Đưa ảnh xúc giác thô cho planner VLM: đúng 50% về lực, 60% về độ cứng. Fine-tune VLA với xúc giác cần dữ liệu ghép đôi và đặt VLA đã pretrain vào rủi ro.

**Ý TƯỞNG** Giữ nguyên VLA. Xúc giác vào hai lần: xúc giác → ngôn ngữ (Octopi) cho planner GPT-4o, và lực xúc giác → một interpolant controller tinh chỉnh action chunk của VLA.

**KẾT QUẢ** Thao tác thành công cao hơn tới 35% so với VLA chỉ dùng thị giác; lau bảng 5 → 12 lần thành công trên 20.
</div>

## 1. Vấn đề: hai cách đã không ổn

[[flow]]
- Trước~xúc giác thô cho planner | Ảnh GelSight > !Planner GPT-4o~đọc pixel! | đúng 50% về lực, 60% về độ cứng
- Trước~fine-tune với xúc giác | xúc giác + RGB > !Fine-tune RDT~cần dữ liệu ghép đôi! > Hành động | tốn kém, rủi ro cho VLA đã pretrain
+ VLA-Touch | GelSight > *Octopi → chữ* > Planner GPT-4o > RDT giữ nguyên > *Bộ tinh chỉnh~+ lực từ marker* | dùng xúc giác hai lần, không động VLA
[[/flow]] Planner nhận xúc giác dưới dạng chữ; bộ điều khiển nhận xúc giác dưới dạng lực. VLA ở giữa không bị huấn luyện lại.

## 2. Kiến trúc

[[fig:vla-touch]] Vòng ngoài: văn bản xúc giác cập nhật chỉ dẫn của GPT-4o. Vòng trong: lực xúc giác tinh chỉnh chunk từ RDT.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Octopi | 6 khung GelSight | chữ: độ cứng, độ nhám | xúc giác → ngôn ngữ |
| Planner GPT-4o | mục tiêu, ảnh cảnh, chữ xúc giác, chỉ dẫn trước | chỉ dẫn kế $I_{k+1}$ | lập kế hoạch lại theo xúc giác |
| RDT-1B (VLA nền) | chỉ dẫn, RGB, proprioception | chunk $T_a = 64$ bước | đề xuất chuyển động |
| Marker tracking | ảnh GelSight | $m_t = (X, Y, M)$ | xúc giác → 3 con số |
| Interpolant controller | chunk, đặc trưng DINOv2, lịch sử $m_t$ | 48 bước đầu đã tinh chỉnh | sửa tiếp xúc, ≤ 8 Hz |

## 3. Tính tay: từ marker ra $m_t$

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Bộ tinh chỉnh chạy tới 8 Hz và không thể nuốt một ảnh xúc giác mỗi bước. VLA-Touch nén chuyển động của marker trên gel thành ba con số: tổng lực trượt theo $x$, theo $y$, và độ lớn.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $v_i = (x_i, y_i)$ | vector trượt của marker $i$ | input | $(0.1, 0)$, $(0.2, 0.1)$, $(0.1, -0.05)$ (đơn vị tùy ý) |
| $X, Y$ | tổng lực trượt | output | – |
| $M$ | độ lớn của tổng | output | – |

**Công thức**

$$X = \sum_i x_i, \qquad Y = \sum_i y_i, \qquad M = \sqrt{X^2 + Y^2}$$

**Từng bước**

1. $X = 0.1 + 0.2 + 0.1 = 0.4$
2. $Y = 0 + 0.1 - 0.05 = 0.05$
3. $M = \sqrt{0.4^2 + 0.05^2} = \sqrt{0.1625} \approx 0.403$

**Kết quả.** $m_t = (0.4,\ 0.05,\ 0.403)$.

**Ý nghĩa.** Ba con số mỗi bước đủ rẻ cho một bộ tinh chỉnh nhanh, và vẫn giữ điều quan trọng khi lau và gọt: gel đang bị kéo theo hướng nào và mạnh đến đâu.
</div>

## 4. Kết quả

[[bars:/20]] Đặt cốc · RDT=7; *Đặt cốc · + tinh chỉnh xúc giác=10*; Lau · RDT=5; *Lau · + tinh chỉnh xúc giác=12*; Gọt · RDT=6; *Gọt · + tinh chỉnh xúc giác=10* || Số lần thành công cả task trên 20.

- Planner dùng ngôn ngữ xúc giác: đoán đúng lực 90%, độ cứng 75% (so với 50% và 60% từ ảnh thô).
- Bỏ xúc giác khỏi bộ điều khiển làm giảm 50% ở bước đặt cốc.

## 5. Huấn luyện

| Bước | Nội dung |
|---|---|
| 1 | Fine-tune RDT trên dữ liệu Franka không liên quan (100k bước) để căn không gian hành động |
| 2 | Fine-tune trên dữ liệu task **không** có xúc giác (20k bước mỗi task) |
| 3 | Chạy RDT trên dữ liệu task để thu chunk; huấn luyện bộ tinh chỉnh bằng MSE so với hành động chuyên gia |

## 6. Lưu ý

- Chưa dùng xúc giác tần số cao (từ 25 Hz trở lên); dữ liệu ghi ở 10 Hz.
- Không nêu Octopi và DINOv2 có bị đóng băng không.

**Mang sang bài sau:** VLA-Touch truyền xúc giác dưới dạng chữ hoặc một lực trượt tổng, nhưng ảnh gel cho thấy biến dạng chứ không phải lực. [TaF-VLA](taf-vla.html) huấn luyện bộ mã hóa xúc giác cho ra đặc trưng giống lực trước.

**Câu kiểm tra:** hai marker đọc $(0.3,\ 0.1)$ và $(-0.1,\ 0.2)$. $m_t$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$X = 0.2$, $Y = 0.3$, $M = \sqrt{0.04 + 0.09} = \sqrt{0.13} \approx 0.361$.
</details>
:::
