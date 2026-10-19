---
slug: survey-force-sensing
date: 2026-10-18
title_en: "Survey 2: What Is Measured, and How It Becomes a Token"
title_vi: "Survey 2: Đo cái gì, và nó thành token ra sao"
excerpt_en: "'Force' in a force-aware VLA can mean five different measurements, and each reaches the network in one of six forms, from a raw number to a sentence. Includes the joint-torque-to-force calculation, a speed comparison and references."
excerpt_vi: "'Lực' trong một VLA có nhận biết lực có thể là năm phép đo khác nhau, và mỗi loại đến mạng dưới một trong sáu dạng, từ con số thô đến một câu văn. Có phép tính từ mô-men khớp ra lực, so sánh tốc độ và tài liệu tham khảo."
tags: [VLA, Force, Tactile, Survey]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 2 of 3 · [Survey 1: where force enters](survey-force-map.html) · [Survey 3: outputs and learning](survey-force-output.html)

**THE PROBLEM** Two papers that both say "force-aware" may have nothing in common at the input. One reads a wrist sensor, one reads a camera image of a squashed gel, one reads no sensor at all and infers force from motion.

**FIVE MEASUREMENTS** wrist force/torque · joint torque · vision-based touch · pressure arrays · none at run time.

**SIX FORMS** raw token · history encoder · physically structured · aligned latent · language · predicted.

**TAKEAWAY** The further right you go on the six forms, the more meaning and robustness you get, and the less detail and speed. Numbers in brackets are reference numbers from [Survey 1](survey-force-map.html).
</div>

## 1. Five kinds of measurement

Think of what a hand can feel. A wrist sensor is like holding a tool and sensing the total push. Joint torque is like feeling how hard your muscles work. A gel sensor is like pressing a finger into clay and looking at the dent. A pressure array is a patch of skin with a few dozen pressure points. The fifth option is a numb hand that has learned what contact feels like.

| Measurement | What it gives | Good at | Weak at | Examples |
|---|---|---|---|---|
| **Wrist F/T** | one 6D wrench for the whole tool | net push, insertion | cannot tell which finger slips | ForceVLA [2], ForceVLA2 [15], ForceRFT [30], CompliantVLA-adaptor [8] |
| **Joint torque** (measured or estimated) | one number per joint | no extra hardware | must remove the arm's own motion | MoDE-VLA [14], FWBC-VLA [25], TER-DAgger [13], TA-VLA [7] |
| **Vision-based touch** (GelSight-type) | an image of how the gel deforms | shape, shear, slip | force needs calibration | VLA-Touch [4], TaF-VLA [9], Tabero [17], OmniVTLA [6] |
| **Pressure arrays** (taxels, piezo) | a coarse grid of pressure | how pressure spreads | low resolution | HapticVLA [16] (10×10), TORL-VLA [18] (6×8) |
| **None at run time** | force learned or inferred | no sensor to break | only as good as training | FD-VLA [10], HapticVLA [16], CompVLA [31] |

[[bars:Hz]] Force/torque sensor (ForceVLA2)=300; Torque estimator (FWBC-VLA)=200; Pressure taxels (HapticVLA)=120; Gel images (TaF-VLA)=30; VLA planner (FWBC-VLA)=15; *Base policy (TER-DAgger)=1* || How often each part runs, in Hz, as reported by the papers read in full. Sensors are fast; the model that reads them is slow. That gap shapes the designs in [Survey 3](survey-force-output.html).

## 2. Getting force without a force sensor

The idea in one line: the motors know how hard they push. If you subtract the push needed just to move the arm, what is left is the world pushing back.

[[flow]]
= Sensorless chain | Measured joint torque > *Minus free-motion model* > Contact torque > *Jacobian inverse* > Fingertip force | used by FWBC-VLA and TER-DAgger
[[/flow]] Joint torque mixes contact with gravity, friction and motion. Remove what the arm's own motion explains, then convert what remains to a force at the fingertip.

<div class="calc" markdown="1">

Calculation card

**What and why.** Recover the fingertip force from joint torques on a planar two-link arm. This is the core step of every sensorless method, and it shows why the free-motion model matters.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $q_1, q_2$ | joint angles (links 1 m each) | input | $0$, $90°$ |
| $J$ | Jacobian: how joint speeds map to fingertip speed | from $q$ | $\begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$ |
| $\tau_{meas}$ | measured joint torques | input | $(-12,\ -1.5)$ N·m |
| $\tau_{free}$ | torques the arm's own motion explains (from a model) | input | $(-2,\ -1.5)$ N·m |
| $\tau_{ext}$ | contact torques | intermediate | – |
| $F$ | force at the fingertip | output | – |

**Formula** (statics: $\tau = J^\top F$)

$$\tau_{ext} = \tau_{meas} - \tau_{free}, \qquad F = (J^\top)^{-1}\,\tau_{ext}, \qquad (J^\top)^{-1} = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}$$

**Steps**

1. Fingertip position: $(\cos 0 + \cos 90°,\ \sin 0 + \sin 90°) = (1, 1)$.
2. $\tau_{ext} = (-12, -1.5) - (-2, -1.5) = (-10,\ 0)$ N·m.
3. $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$ N.
4. Sanity check: joint 2 sits at $(1, 0)$; a vertical force at $x = 1$ passes through it, so it adds no torque there. ✓

**Result.** A 10 N downward force at the fingertip.

**Why it matters.** Skip step 2 and gravity and friction look like contact. Learning a good free-motion model is the job of FWBC-VLA's force estimator [25].
</div>

**Why history matters.** Two contacts both read 5 N right now: one came from $2, 3, 5$ (pressing harder), the other from $8, 6, 5$ (letting go). The last change ($+2$ against $-1$) tells them apart; a single sample cannot. That is why many methods keep a window or a memory (form 2 below).

## 3. Six forms a signal can take

[[fig:survey-force-forms]] Left forms stay close to the raw signal; right forms are closer to meaning.

| # | Form | Keeps | Loses | Examples |
|---|---|---|---|---|
| 1 | **Raw token** (one linear layer) | every number | context, trend | ForceVLA [2], ForceVLA2 [15] |
| 2 | **History encoder** | the trend over time | some detail | TORL-VLA [18] (MLP window), FWBC-VLA [25] (GRU, 13 steps), FM-VLA [23] (VAE memory), LIFT [22], ForceDelta-VLA [29] |
| 3 | **Physically structured** | meaning (wrench, grip against push) | needs a model | TER-DAgger [13] (wrench), Tabero [17] (grip/applied), VLA-Touch [4] (summed shear) |
| 4 | **Aligned latent** | agreement with another modality | easy interpretation | TaF-VLA [9] (touch with force), OmniVTLA [6] (touch with language) |
| 5 | **Language** | easy for a VLM to use | speed, precision | VLA-Touch [4] (Octopi), ForceVLA2 [15] (prompt), VTLA [1], Tactile-VLA [3] |
| 6 | **Predicted** | works without a sensor | depends on training | FD-VLA [10], HapticVLA [16], TORL-VLA [18], TA-VLA [7], DexTacWAM [33] |

## 4. Caveats

- FAVLA [12], LIFT [22] and CompliantVLA-adaptor [8] say "force/torque" or "6D force" without saying where it is measured; they may estimate it from joint torques.
- Rates are what the papers report, not properties of the sensor type.
- Methods marked "abstract" in Survey 1 were classified from abstracts only.

**Carry forward:** once force is measured and encoded, the policy must do something with it. Still output a pose, or a force, a stiffness, a correction? See [Survey 3](survey-force-output.html).

**Check question:** same arm and pose, $\tau_{ext} = (-5,\ -5)$ N·m. What force acts at the fingertip?

<details markdown="1">
<summary>Answer</summary>

$F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N: a 5 N push along $+x$. Check: $J^\top F = (-5, -5)$.
</details>

## References

Same numbering as [Survey 1](survey-force-map.html). Titles are as listed on arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 2 / 3 · [Survey 1: lực đi vào đâu](survey-force-map.html) · [Survey 3: đầu ra và cách học](survey-force-output.html)

**VẤN ĐỀ** Hai paper cùng tự nhận "có nhận biết lực" vẫn có thể chẳng giống nhau ở đầu vào. Một paper đọc cảm biến cổ tay, một đọc ảnh chụp lớp gel bị ép, một không dùng cảm biến nào mà suy lực từ chuyển động.

**NĂM LOẠI PHÉP ĐO** lực/mô-men ở cổ tay · mô-men khớp · xúc giác dựa ảnh · lưới áp suất · không có gì khi chạy thật.

**SÁU DẠNG BIỂU DIỄN** token thô · bộ mã hóa lịch sử · có cấu trúc vật lý · không gian ẩn đã căn · ngôn ngữ · được dự đoán.

**RÚT RA** Càng đi sang phải trong sáu dạng, bạn càng được nhiều ý nghĩa và độ bền, nhưng mất dần chi tiết và tốc độ. Số trong ngoặc vuông là số tài liệu tham khảo của [Survey 1](survey-force-map.html).
</div>

## 1. Năm loại phép đo

Hãy nghĩ xem một bàn tay cảm nhận được gì. Cảm biến cổ tay giống như cầm một dụng cụ và cảm nhận tổng lực đẩy. Mô-men khớp giống như cảm nhận cơ bắp đang gắng sức đến đâu. Cảm biến gel giống như ấn ngón tay vào đất sét rồi nhìn vết lõm. Lưới áp suất là một mảng da có vài chục điểm cảm nhận. Lựa chọn thứ năm là một bàn tay tê dại nhưng đã học được tiếp xúc "thường cảm thấy thế nào".

| Phép đo | Cho bạn gì | Giỏi ở | Yếu ở | Ví dụ |
|---|---|---|---|---|
| **F/T cổ tay** | một wrench 6D cho cả dụng cụ | lực đẩy tổng, lắp ghép | không biết ngón nào đang trượt | ForceVLA [2], ForceVLA2 [15], ForceRFT [30], CompliantVLA-adaptor [8] |
| **Mô-men khớp** (đo hoặc ước lượng) | một số cho mỗi khớp | không cần phần cứng thêm | phải trừ chuyển động của chính cánh tay | MoDE-VLA [14], FWBC-VLA [25], TER-DAgger [13], TA-VLA [7] |
| **Xúc giác dựa ảnh** (kiểu GelSight) | ảnh cho thấy gel biến dạng ra sao | hình dạng, lực cắt, trượt | muốn ra lực phải hiệu chuẩn | VLA-Touch [4], TaF-VLA [9], Tabero [17], OmniVTLA [6] |
| **Lưới áp suất** (taxel, piezo) | lưới áp suất thô | áp suất phân bố thế nào | độ phân giải thấp | HapticVLA [16] (10×10), TORL-VLA [18] (6×8) |
| **Không có khi chạy** | lực được học hoặc suy ra | không có cảm biến để hỏng | chỉ tốt bằng dữ liệu huấn luyện | FD-VLA [10], HapticVLA [16], CompVLA [31] |

[[bars:Hz]] Cảm biến F/T (ForceVLA2)=300; Bộ ước lượng mô-men (FWBC-VLA)=200; Taxel áp suất (HapticVLA)=120; Ảnh gel (TaF-VLA)=30; Planner VLA (FWBC-VLA)=15; *Chính sách nền (TER-DAgger)=1* || Mỗi bộ phận chạy bao nhiêu lần mỗi giây (Hz), theo các paper đã đọc đầy đủ. Cảm biến thì nhanh; mô hình đọc chúng lại chậm. Khoảng cách này định hình các thiết kế ở [Survey 3](survey-force-output.html).

## 2. Lấy lực mà không cần cảm biến lực

Ý chính trong một câu: động cơ biết nó đang đẩy mạnh bao nhiêu. Trừ đi phần lực cần để chỉ riêng việc di chuyển cánh tay, phần còn lại chính là thế giới đẩy ngược lại.

[[flow]]
= Chuỗi không cảm biến | Mô-men khớp đo được > *Trừ mô hình chuyển động tự do* > Mô-men do tiếp xúc > *Nghịch đảo Jacobian* > Lực tại đầu ngón | FWBC-VLA và TER-DAgger dùng
[[/flow]] Mô-men khớp là hỗn hợp của tiếp xúc, trọng lực, ma sát và chuyển động. Hãy bỏ phần mà chuyển động của chính cánh tay giải thích được, rồi đổi phần còn lại thành lực tại đầu ngón.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Tìm lại lực tại đầu ngón từ mô-men khớp trên một cánh tay phẳng hai khâu. Đây là bước lõi của mọi phương pháp không cảm biến, và nó cho thấy vì sao mô hình chuyển động tự do quan trọng.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $q_1, q_2$ | góc khớp (mỗi khâu dài 1 m) | input | $0$, $90°$ |
| $J$ | Jacobian: ánh xạ tốc độ khớp sang tốc độ đầu ngón | tính từ $q$ | $\begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$ |
| $\tau_{meas}$ | mô-men khớp đo được | input | $(-12,\ -1{,}5)$ N·m |
| $\tau_{free}$ | mô-men mà chuyển động của chính cánh tay giải thích (từ mô hình) | input | $(-2,\ -1{,}5)$ N·m |
| $\tau_{ext}$ | mô-men do tiếp xúc | trung gian | – |
| $F$ | lực tại đầu ngón | output | – |

**Công thức** (tĩnh học: $\tau = J^\top F$)

$$\tau_{ext} = \tau_{meas} - \tau_{free}, \qquad F = (J^\top)^{-1}\,\tau_{ext}, \qquad (J^\top)^{-1} = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}$$

**Từng bước**

1. Vị trí đầu ngón: $(\cos 0 + \cos 90°,\ \sin 0 + \sin 90°) = (1, 1)$.
2. $\tau_{ext} = (-12, -1{,}5) - (-2, -1{,}5) = (-10,\ 0)$ N·m.
3. $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$ N.
4. Kiểm tra lại: khớp 2 nằm ở $(1, 0)$; một lực thẳng đứng tại $x = 1$ đi qua đúng khớp đó nên không gây mô-men ở đó. ✓

**Kết quả.** Lực 10 N hướng xuống tại đầu ngón.

**Ý nghĩa.** Bỏ bước 2 thì trọng lực và ma sát sẽ bị tưởng là tiếp xúc. Học một mô hình chuyển động tự do tốt chính là việc của bộ ước lượng lực trong FWBC-VLA [25].
</div>

**Vì sao lịch sử quan trọng.** Hai tiếp xúc cùng đọc 5 N ngay lúc này: một cái đến từ $2, 3, 5$ (đang ấn mạnh dần), cái kia từ $8, 6, 5$ (đang thả ra). Chính độ thay đổi cuối ($+2$ so với $-1$) phân biệt chúng, một mẫu đơn lẻ thì không. Vì vậy nhiều phương pháp giữ một cửa sổ hoặc bộ nhớ (dạng 2 bên dưới).

## 3. Sáu dạng mà tín hiệu có thể mang

[[fig:survey-force-forms]] Các dạng bên trái còn sát tín hiệu thô; các dạng bên phải gần với ý nghĩa hơn.

| # | Dạng | Giữ lại | Mất đi | Ví dụ |
|---|---|---|---|---|
| 1 | **Token thô** (một lớp tuyến tính) | mọi con số | ngữ cảnh, xu hướng | ForceVLA [2], ForceVLA2 [15] |
| 2 | **Bộ mã hóa lịch sử** | xu hướng theo thời gian | một phần chi tiết | TORL-VLA [18] (cửa sổ MLP), FWBC-VLA [25] (GRU, 13 bước), FM-VLA [23] (bộ nhớ VAE), LIFT [22], ForceDelta-VLA [29] |
| 3 | **Có cấu trúc vật lý** | ý nghĩa (wrench, kẹp so với đẩy) | cần có mô hình | TER-DAgger [13] (wrench), Tabero [17] (kẹp/tác dụng), VLA-Touch [4] (tổng lực cắt) |
| 4 | **Không gian ẩn đã căn** | sự thống nhất với một phương thức khác | dễ diễn giải | TaF-VLA [9] (xúc giác với lực), OmniVTLA [6] (xúc giác với ngôn ngữ) |
| 5 | **Ngôn ngữ** | VLM dễ dùng | tốc độ, độ chính xác | VLA-Touch [4] (Octopi), ForceVLA2 [15] (prompt), VTLA [1], Tactile-VLA [3] |
| 6 | **Được dự đoán** | chạy được khi không có cảm biến | phụ thuộc huấn luyện | FD-VLA [10], HapticVLA [16], TORL-VLA [18], TA-VLA [7], DexTacWAM [33] |

## 4. Lưu ý

- FAVLA [12], LIFT [22] và CompliantVLA-adaptor [8] ghi "lực/mô-men" hay "lực 6D" mà không nói đo ở đâu; có thể chúng ước lượng từ mô-men khớp.
- Tốc độ là con số các paper báo cáo, không phải đặc tính cố hữu của loại cảm biến.
- Các phương pháp ghi "abstract" ở Survey 1 chỉ được phân loại từ abstract.

**Mang theo:** khi lực đã được đo và mã hóa, chính sách phải làm gì đó với nó. Vẫn chỉ xuất một pose, hay xuất lực, độ cứng, hay một bản hiệu chỉnh? Xem [Survey 3](survey-force-output.html).

**Câu hỏi kiểm tra:** cùng cánh tay và tư thế, $\tau_{ext} = (-5,\ -5)$ N·m. Lực tại đầu ngón là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N: lực đẩy 5 N theo chiều $+x$. Kiểm tra: $J^\top F = (-5, -5)$.
</details>

## Tài liệu tham khảo

Số thứ tự giống [Survey 1](survey-force-map.html). Tiêu đề giữ nguyên như trên arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.
:::
