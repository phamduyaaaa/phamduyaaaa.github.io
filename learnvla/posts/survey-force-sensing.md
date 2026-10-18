---
slug: survey-force-sensing
date: 2026-10-18
title_en: "Survey 2: What Is Measured, and How It Becomes a Token"
title_vi: "Survey 2: Đo cái gì, và nó thành token ra sao"
excerpt_en: "'Force' in force-aware VLAs means five different measurements, and each reaches the network in one of six forms, from a raw number to a sentence. A cheatsheet of both, with the joint-torque-to-force calculation worked out."
excerpt_vi: "'Lực' trong các VLA nhận biết lực là năm phép đo khác nhau, và mỗi loại tới mạng dưới một trong sáu dạng, từ con số thô đến một câu văn. Cheatsheet cho cả hai, kèm phép tính từ mô men khớp ra lực."
tags: [VLA, Force, Tactile, Survey]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 2 of 3 · [Survey 1: where force enters](survey-force-map.html) · [Survey 3: outputs and learning](survey-force-output.html)

**PROBLEM** Two papers that both say "force-aware" may share no input at all: one reads a wrist sensor, one reads a gel image, one reads nothing and infers force from vision.

**FIVE MEASUREMENTS** wrist F/T · joint torque · vision-based tactile · taxel arrays · none at run time.

**SIX FORMS** raw token · history encoder · physically structured · aligned latent · language · predicted.

**TAKEAWAY** The higher the form, the more meaning and robustness, and the less detail and speed.
</div>

## 1. Five kinds of measurement

| Measurement | What it gives | Good at | Weak at | Examples |
|---|---|---|---|---|
| **Wrist F/T** | one 6D wrench for the whole tool | net push, insertion | which finger slips | ForceVLA, ForceVLA2, ForceRFT, CompliantVLA-adaptor |
| **Joint torque** (measured or estimated) | one number per joint | no extra hardware | must subtract own motion | MoDE-VLA, FWBC-VLA, TER-DAgger, TA-VLA |
| **Vision tactile** (GelSight-type) | image of gel deformation | shape, shear, slip | force needs calibration | VLA-Touch, TaF-VLA, Tabero, OmniVTLA |
| **Taxel / piezo arrays** | coarse pressure grid | pressure spread | low resolution | HapticVLA (10×10), TORL-VLA (6×8) |
| **None at run time** | force learned or inferred | no sensor to break | only as good as training | FD-VLA, HapticVLA, CompVLA |

Rates reported in the papers read in full: F/T 300 Hz (ForceVLA2), torque estimator 200 Hz (FWBC-VLA), taxels 120 Hz (HapticVLA), gel images 30 Hz (TaF-VLA).

## 2. Getting force without a force sensor

[[flow]]
= Sensorless chain | Measured joint torque > *Minus free-motion model* > Contact torque > *Jacobian inverse* > Fingertip force | used by FWBC-VLA and TER-DAgger
[[/flow]] Joint torques mix contact with gravity, friction and motion. Remove the part the robot's own motion explains, then map what remains to a force at the fingertip.

<div class="calc" markdown="1">
Calculation card

**What and why.** Recover the fingertip force from joint torques on a planar two-link arm. This is the core step of every sensorless method, and it shows why the free-motion model matters.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $q_1, q_2$ | joint angles (links 1 m each) | input | $0$, $90°$ |
| $J$ | Jacobian: joint speeds → fingertip speed | from $q$ | $\begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$ |
| $\tau_{meas}$ | measured joint torques | input | $(-12,\ -1.5)$ N·m |
| $\tau_{free}$ | torques the robot's own motion explains (model) | input | $(-2,\ -1.5)$ N·m |
| $\tau_{ext}$ | contact torques | intermediate | – |
| $F$ | force at the fingertip | output | – |

**Formula** (statics: $\tau = J^\top F$)

$$\tau_{ext} = \tau_{meas} - \tau_{free}, \qquad F = (J^\top)^{-1}\,\tau_{ext}, \qquad (J^\top)^{-1} = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}$$

**Steps**

1. Fingertip position: $(\cos 0 + \cos 90°,\ \sin 0 + \sin 90°) = (1, 1)$.
2. $\tau_{ext} = (-12, -1.5) - (-2, -1.5) = (-10,\ 0)$ N·m.
3. $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$ N.
4. Sanity check: joint 2 sits at $(1, 0)$; a vertical force at $x = 1$ passes through it, so its contact torque is 0. ✓

**Result.** A 10 N downward force at the fingertip.

**Why it matters.** Without step 2, gravity and friction would be read as contact. The free-motion model is what FWBC-VLA's HSR-Force learns.
</div>

**Why history matters.** Two contacts both read 5 N now: one came from $2, 3, 5$ (pressing harder), the other from $8, 6, 5$ (releasing). The last change ($+2$ vs $-1$) tells them apart; a single sample cannot. Hence windows and memories in rung 2 below.

## 3. Six forms a signal can take

| # | Form | Keeps | Loses | Examples |
|---|---|---|---|---|
| 1 | **Raw token** (one linear layer) | every number | context, trend | ForceVLA, ForceVLA2 |
| 2 | **History encoder** | trend over time | some detail | TORL-VLA (MLP window), FWBC-VLA (GRU, 13 steps), FM-VLA (VAE memory), LIFT, ForceDelta-VLA |
| 3 | **Physically structured** | meaning (wrench, grip vs push) | needs a model | TER-DAgger (wrench), Tabero (grip/applied), VLA-Touch (summed shear) |
| 4 | **Aligned latent** | agreement with another modality | interpretability | TaF-VLA (tactile ↔ force), OmniVTLA (tactile ↔ language) |
| 5 | **Language** | easy for a VLM to use | speed, precision | VLA-Touch (Octopi), ForceVLA2 (prompt), VTLA, Tactile-VLA |
| 6 | **Predicted** | works without a sensor | depends on training | FD-VLA, HapticVLA, TORL-VLA, TA-VLA, DexTacWAM |

## 4. Caveats

- FAVLA, LIFT, CompliantVLA-adaptor and CR-VLA-Force say "force/torque" or "6D force" without saying where it is measured; they may estimate it from joint torques.
- Rates are what the papers report, not properties of the sensor type.

**Carry forward:** once force is measured and encoded, the policy must do something with it: still output a pose, or a force, a stiffness, a correction? See [Survey 3](survey-force-output.html).

**Check question:** same arm and pose, $\tau_{ext} = (-5,\ -5)$ N·m. What force acts at the fingertip?

<details markdown="1">
<summary>Answer</summary>

$F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N: a 5 N push along $+x$. Check: $J^\top F = (-5, -5)$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 2 / 3 · [Survey 1: lực vào ở đâu](survey-force-map.html) · [Survey 3: đầu ra và cách học](survey-force-output.html)

**VẤN ĐỀ** Hai bài cùng gọi mình là "nhận biết lực" có thể không chung đầu vào nào: bài này đọc cảm biến cổ tay, bài kia đọc ảnh gel, bài thứ ba không đọc gì và suy ra lực từ thị giác.

**NĂM PHÉP ĐO** F/T cổ tay · mô men khớp · xúc giác thị giác · mảng taxel · không đo lúc chạy.

**SÁU DẠNG** token thô · bộ mã hóa lịch sử · có cấu trúc vật lý · latent đã căn · ngôn ngữ · dự đoán.

**RÚT RA** Dạng càng cao càng thêm ý nghĩa và độ bền, nhưng càng mất chi tiết và tốc độ.
</div>

## 1. Năm loại phép đo

| Phép đo | Cho ra gì | Mạnh ở | Yếu ở | Ví dụ |
|---|---|---|---|---|
| **F/T cổ tay** | một wrench 6D cho cả dụng cụ | lực đẩy tổng, lắp ghép | ngón nào đang trượt | ForceVLA, ForceVLA2, ForceRFT, CompliantVLA-adaptor |
| **Mô men khớp** (đo hoặc ước lượng) | mỗi khớp một số | không cần phần cứng thêm | phải trừ chuyển động của chính robot | MoDE-VLA, FWBC-VLA, TER-DAgger, TA-VLA |
| **Xúc giác thị giác** (kiểu GelSight) | ảnh biến dạng gel | hình dạng, trượt | ra lực cần hiệu chuẩn | VLA-Touch, TaF-VLA, Tabero, OmniVTLA |
| **Mảng taxel / áp điện** | lưới áp suất thô | phân bố áp suất | độ phân giải thấp | HapticVLA (10×10), TORL-VLA (6×8) |
| **Không đo lúc chạy** | lực được học hoặc suy ra | không có cảm biến để hỏng | chỉ tốt bằng dữ liệu huấn luyện | FD-VLA, HapticVLA, CompVLA |

Tần số báo cáo trong các bài đọc đầy đủ: F/T 300 Hz (ForceVLA2), bộ ước lượng mô men 200 Hz (FWBC-VLA), taxel 120 Hz (HapticVLA), ảnh gel 30 Hz (TaF-VLA).

## 2. Có lực mà không cần cảm biến lực

[[flow]]
= Chuỗi không cảm biến | Mô men khớp đo được > *Trừ mô hình chuyển động tự do* > Mô men tiếp xúc > *Nghịch đảo Jacobian* > Lực ở đầu ngón | FWBC-VLA và TER-DAgger dùng chuỗi này
[[/flow]] Mô men khớp lẫn cả tiếp xúc với trọng lực, ma sát và chuyển động. Bỏ phần do chuyển động của chính robot gây ra, rồi đổi phần còn lại thành lực ở đầu ngón.

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Tìm lại lực ở đầu ngón từ mô men khớp trên một cánh tay phẳng hai khâu. Đây là bước lõi của mọi phương pháp không cảm biến, và nó cho thấy vì sao mô hình chuyển động tự do quan trọng.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $q_1, q_2$ | góc khớp (mỗi khâu dài 1 m) | input | $0$, $90°$ |
| $J$ | Jacobian: tốc độ khớp → tốc độ đầu ngón | tính từ $q$ | $\begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$ |
| $\tau_{meas}$ | mô men khớp đo được | input | $(-12,\ -1.5)$ N·m |
| $\tau_{free}$ | mô men do chuyển động của chính robot (mô hình) | input | $(-2,\ -1.5)$ N·m |
| $\tau_{ext}$ | mô men do tiếp xúc | trung gian | – |
| $F$ | lực ở đầu ngón | output | – |

**Công thức** (tĩnh học: $\tau = J^\top F$)

$$\tau_{ext} = \tau_{meas} - \tau_{free}, \qquad F = (J^\top)^{-1}\,\tau_{ext}, \qquad (J^\top)^{-1} = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}$$

**Từng bước**

1. Vị trí đầu ngón: $(\cos 0 + \cos 90°,\ \sin 0 + \sin 90°) = (1, 1)$.
2. $\tau_{ext} = (-12, -1.5) - (-2, -1.5) = (-10,\ 0)$ N·m.
3. $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$ N.
4. Kiểm tra: khớp 2 nằm ở $(1, 0)$; một lực thẳng đứng tại $x = 1$ đi xuyên qua nó, nên mô men tiếp xúc ở khớp 2 bằng 0. ✓

**Kết quả.** Một lực 10 N hướng xuống tại đầu ngón.

**Ý nghĩa.** Bỏ bước 2 thì trọng lực và ma sát sẽ bị đọc thành tiếp xúc. Mô hình chuyển động tự do chính là thứ HSR-Force của FWBC-VLA học.
</div>

**Vì sao cần lịch sử.** Hai tiếp xúc cùng đọc 5 N lúc này: một cái đến từ $2, 3, 5$ (đang ấn thêm), cái kia từ $8, 6, 5$ (đang nhả). Thay đổi cuối ($+2$ so với $-1$) phân biệt được chúng; một mẫu đơn lẻ thì không. Vì thế có cửa sổ và bộ nhớ ở bậc 2 bên dưới.

## 3. Sáu dạng tín hiệu có thể mang

| # | Dạng | Giữ được | Mất | Ví dụ |
|---|---|---|---|---|
| 1 | **Token thô** (một lớp linear) | mọi con số | ngữ cảnh, xu hướng | ForceVLA, ForceVLA2 |
| 2 | **Bộ mã hóa lịch sử** | xu hướng theo thời gian | một phần chi tiết | TORL-VLA (MLP cửa sổ), FWBC-VLA (GRU, 13 bước), FM-VLA (bộ nhớ VAE), LIFT, ForceDelta-VLA |
| 3 | **Có cấu trúc vật lý** | ý nghĩa (wrench, siết và đẩy) | cần mô hình | TER-DAgger (wrench), Tabero (kẹp/tác dụng), VLA-Touch (trượt tổng) |
| 4 | **Latent đã căn** | khớp với modality khác | khả năng diễn giải | TaF-VLA (xúc giác ↔ lực), OmniVTLA (xúc giác ↔ ngôn ngữ) |
| 5 | **Ngôn ngữ** | VLM dùng dễ | tốc độ, độ chính xác | VLA-Touch (Octopi), ForceVLA2 (prompt), VTLA, Tactile-VLA |
| 6 | **Dự đoán** | chạy không cần cảm biến | phụ thuộc huấn luyện | FD-VLA, HapticVLA, TORL-VLA, TA-VLA, DexTacWAM |

## 4. Lưu ý

- FAVLA, LIFT, CompliantVLA-adaptor và CR-VLA-Force ghi "force/torque" hoặc "lực 6D" mà không nói đo ở đâu; có bài có thể ước lượng từ mô men khớp.
- Tần số là con số các bài báo cáo, không phải thuộc tính của loại cảm biến.

**Mang sang bài sau:** khi lực đã được đo và mã hóa, chính sách phải làm gì đó với nó: vẫn xuất pose, hay xuất lực, độ cứng, phần hiệu chỉnh? Xem [Survey 3](survey-force-output.html).

**Câu kiểm tra:** cùng cánh tay và tư thế, $\tau_{ext} = (-5,\ -5)$ N·m. Lực nào tác dụng ở đầu ngón?

<details markdown="1">
<summary>Đáp án</summary>

$F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N: đẩy 5 N theo $+x$. Kiểm tra: $J^\top F = (-5, -5)$.
</details>
:::
