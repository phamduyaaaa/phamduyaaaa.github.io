---
slug: survey-force-sensing
date: 2026-10-18
title_en: "Survey 2: What Is Measured, and How It Becomes a Token"
title_vi: "Survey 2: Đo cái gì, và nó thành token ra sao"
excerpt_en: "'Force' in force-aware VLAs means five different measurements: a wrist wrench, joint torques, a gel image, a pressure grid, or nothing at all. And each reaches the network in one of six forms, from a raw number to a sentence."
excerpt_vi: "'Lực' trong các VLA nhận biết lực là năm phép đo khác nhau: wrench ở cổ tay, mô men khớp, ảnh gel, lưới áp suất, hoặc không đo gì. Mỗi loại tới mạng dưới một trong sáu dạng, từ con số thô đến một câu văn."
tags: [VLA, Force, Tactile, Survey]
---

:::en
Second of three survey notes. [Survey 1](survey-force-map.html) maps where force enters; [Survey 3](survey-force-output.html) covers outputs and learning.

## The pain

Two papers that both say "force-aware" may not share a single input. One reads six numbers from a sensor behind the wrist. Another reads a camera image of a gel pad. A third reads nothing at run time and infers force from vision. Before comparing their architectures, it helps to know what each one actually measures.

## Five kinds of measurement

| Measurement | What it gives | Examples in the survey | Rates reported |
|---|---|---|---|
| **Wrist F/T sensor** | one 6D wrench (3 forces, 3 torques) for everything the tool touches | ForceVLA, ForceVLA2, FD-VLA (training), ForceRFT, CompliantVLA-adaptor, CR-VLA-Force, FAVLA, LIFT | 300 Hz (ForceVLA2) |
| **Joint torque**, measured or estimated | one number per joint; contact must be separated from gravity, friction and motion | MoDE-VLA (14 torques), FWBC-VLA, TER-DAgger, TA-VLA | 200 Hz estimator (FWBC-VLA) |
| **Vision-based tactile** (GelSight-type) | an image of gel deformation at a fingertip: shape, shear, slip | VLA-Touch, TaF-VLA, Tabero (simulated), MoDE-VLA fingertips, OmniVTLA | 30 Hz (TaF-VLA) |
| **Taxel or piezo arrays** | a coarse grid of pressures | HapticVLA (10×10), TORL-VLA (6×8 → wrench), TaF-VLA (12×12 as teacher) | 120 Hz (HapticVLA) |
| **None at run time** | force is learned or inferred | FD-VLA, HapticVLA (sensor only in training), CompVLA (RGB + language inputs) | – |

The trade-off is roughly locality versus cost. A wrist sensor sums every contact into one wrench; it cannot tell which finger is slipping. Fingertip tactile can, but needs a sensor per finger and gives a high-dimensional signal. Joint torques need no extra hardware, but only make sense after a model of the arm's own motion is subtracted.

## Work it by hand: from joint torques to a fingertip force

Take a planar two-link arm with link lengths 1 m, joint angles $q_1 = 0$ and $q_2 = 90°$. The fingertip is at $(1, 1)$ and the Jacobian is

$$J = \begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$$

With the convention $\tau = J^\top F$, a downward contact force $F = (0, -10)$ N gives

$$\tau = \begin{pmatrix} -1 & 1 \\ -1 & 0 \end{pmatrix}\begin{pmatrix} 0 \\ -10 \end{pmatrix} = \begin{pmatrix} -10 \\ 0 \end{pmatrix}\ \text{N·m}$$

Joint 2 feels nothing: it sits at $(1, 0)$, and a vertical force at $x = 1$ passes straight through it. Going backwards is what a sensorless method has to do:

$$F = (J^\top)^{-1}\tau = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$$

In practice the joints measure, say, $\tau_{meas} = (-12,\ -1.5)$, because gravity and friction also load them. A model predicts the contact-free torque, $(-2,\ -1.5)$. Only the difference, $(-10,\ 0)$, is contact. That subtraction is exactly what FWBC-VLA's HSR-Force estimator learns, and why its quality decides everything downstream.

**Why history matters.** Two contacts both read 5 N now. One came from $2, 3, 5$ (pressing harder), the other from $8, 6, 5$ (releasing). A single reading cannot tell them apart; the last differences ($+2$ versus $-1$) can. This is why most recent methods feed a short window rather than one sample.

## Six forms a signal can take

Ordered from least to most processed:

1. **Raw token.** One linear layer maps the 6 numbers to one token: ForceVLA, ForceVLA2.
2. **History encoder.** A window becomes a token or a memory: an MLP over a window (TORL-VLA), a GRU over 13 steps (FWBC-VLA), a pretrained VAE memory (FM-VLA), causal force memory (LIFT), force history (ForceDelta-VLA).
3. **Physically structured.** The signal is turned into quantities with meaning: a wrench from joint torques (TER-DAgger), grip force versus applied force (Tabero), summed shear $(X, Y, M)$ from markers (VLA-Touch).
4. **Aligned latent.** An encoder is trained so that its output agrees with another modality: tactile images aligned to real force by contrastive learning (TaF-VLA), tactile aligned to language semantics (OmniVTLA).
5. **Language.** Touch becomes words for the VLM: Octopi's "soft, rough" (VLA-Touch), subtask force prompts (ForceVLA2), tactile grounding in language (VTLA), tactile reasoning (Tactile-VLA).
6. **Predicted.** The network produces the signal itself: a distilled force token (FD-VLA), a teacher's tactile-aware actions (HapticVLA), future wrench or torque (TORL-VLA, TA-VLA), future touch in a world model (DexTacWAM, TacPAC, UniTacVLA).

Higher rungs add meaning and robustness but lose detail and speed. Language is easy for a VLM to use and almost useless at 200 Hz; a raw token keeps every millinewton but has to win attention against hundreds of image tokens ([Survey 1](survey-force-map.html)).

## Caveats

Sensor types for the abstract-only papers are often unstated, so the table lists only what the papers say. FAVLA, LIFT, CompliantVLA-adaptor and CR-VLA-Force say "force/torque" or "6D end-effector force" without saying where it is measured; I placed them in the F/T row, but some may estimate it from joint torques. Rates are the ones reported in the papers I read in full; they are not a property of the sensor type.

**Carry forward:** once force is measured and encoded, the policy must do something with it: still output a pose, or output a force, a stiffness, or a correction? See [Survey 3](survey-force-output.html).

**Check question:** same arm and pose. The contact-only joint torques are $\tau_{ext} = (-5,\ -5)$ N·m. What force acts at the fingertip?

*Answer:* $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N, a 5 N push along $+x$. Check: $J^\top F = (-5,\ -5)$.
:::

:::vi
Bài thứ hai trong ba ghi chú survey. [Survey 1](survey-force-map.html) vẽ bản đồ lực đi vào ở đâu; [Survey 3](survey-force-output.html) nói về đầu ra và cách học.

## Vấn đề

Hai bài cùng gọi mình là "nhận biết lực" có thể không chung một đầu vào nào. Bài này đọc sáu con số từ cảm biến sau cổ tay. Bài kia đọc ảnh camera chụp một miếng gel. Bài thứ ba không đọc gì lúc chạy và suy ra lực từ thị giác. Trước khi so kiến trúc, cần biết mỗi bài thực sự đo cái gì.

## Năm loại phép đo

| Phép đo | Cho ra gì | Ví dụ trong survey | Tần số đã báo cáo |
|---|---|---|---|
| **Cảm biến F/T cổ tay** | một wrench 6D (3 lực, 3 mô men) cho mọi thứ dụng cụ chạm vào | ForceVLA, ForceVLA2, FD-VLA (huấn luyện), ForceRFT, CompliantVLA-adaptor, CR-VLA-Force, FAVLA, LIFT | 300 Hz (ForceVLA2) |
| **Mô men khớp**, đo hoặc ước lượng | mỗi khớp một số; phải tách tiếp xúc khỏi trọng lực, ma sát và chuyển động | MoDE-VLA (14 mô men), FWBC-VLA, TER-DAgger, TA-VLA | bộ ước lượng 200 Hz (FWBC-VLA) |
| **Xúc giác thị giác** (kiểu GelSight) | ảnh biến dạng gel ở đầu ngón: hình dạng, lực trượt, trượt | VLA-Touch, TaF-VLA, Tabero (mô phỏng), đầu ngón MoDE-VLA, OmniVTLA | 30 Hz (TaF-VLA) |
| **Mảng taxel hoặc áp điện** | một lưới áp suất thô | HapticVLA (10×10), TORL-VLA (6×8 → wrench), TaF-VLA (12×12 làm teacher) | 120 Hz (HapticVLA) |
| **Không đo lúc chạy** | lực được học hoặc suy ra | FD-VLA, HapticVLA (cảm biến chỉ khi huấn luyện), CompVLA (đầu vào RGB + ngôn ngữ) | – |

Đánh đổi đại khái là giữa tính cục bộ và chi phí. Cảm biến cổ tay cộng mọi tiếp xúc thành một wrench; nó không biết ngón nào đang trượt. Xúc giác đầu ngón biết được, nhưng cần mỗi ngón một cảm biến và tín hiệu nhiều chiều. Mô men khớp không cần phần cứng thêm, nhưng chỉ có nghĩa sau khi trừ đi mô hình chuyển động của chính cánh tay.

## Tính tay: từ mô men khớp ra lực ở đầu ngón

Lấy một cánh tay phẳng hai khâu dài 1 m, góc khớp $q_1 = 0$ và $q_2 = 90°$. Đầu ngón ở $(1, 1)$ và Jacobian là

$$J = \begin{pmatrix} -1 & -1 \\ 1 & 0 \end{pmatrix}$$

Với quy ước $\tau = J^\top F$, một lực tiếp xúc hướng xuống $F = (0, -10)$ N cho

$$\tau = \begin{pmatrix} -1 & 1 \\ -1 & 0 \end{pmatrix}\begin{pmatrix} 0 \\ -10 \end{pmatrix} = \begin{pmatrix} -10 \\ 0 \end{pmatrix}\ \text{N·m}$$

Khớp 2 không cảm thấy gì: nó nằm ở $(1, 0)$, và một lực thẳng đứng tại $x = 1$ đi xuyên qua nó. Đi ngược lại là việc một phương pháp không cảm biến phải làm:

$$F = (J^\top)^{-1}\tau = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -10 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ -10 \end{pmatrix}$$

Thực tế các khớp đo được, chẳng hạn, $\tau_{meas} = (-12,\ -1.5)$, vì trọng lực và ma sát cũng tác dụng lên chúng. Một mô hình dự đoán mô men khi không tiếp xúc là $(-2,\ -1.5)$. Chỉ phần chênh, $(-10,\ 0)$, mới là tiếp xúc. Phép trừ đó chính là thứ bộ ước lượng HSR-Force của FWBC-VLA học, và vì sao chất lượng của nó quyết định mọi thứ phía sau.

**Vì sao cần lịch sử.** Hai tiếp xúc cùng đọc 5 N lúc này. Một cái đến từ chuỗi $2, 3, 5$ (đang ấn mạnh thêm), cái kia từ $8, 6, 5$ (đang nhả ra). Một lần đọc không phân biệt được; hiệu số cuối ($+2$ so với $-1$) thì được. Đó là lý do hầu hết phương pháp gần đây đưa vào một cửa sổ ngắn thay vì một mẫu.

## Sáu dạng tín hiệu có thể mang

Xếp từ ít xử lý đến nhiều xử lý nhất:

1. **Token thô.** Một lớp linear ánh xạ 6 con số thành một token: ForceVLA, ForceVLA2.
2. **Bộ mã hóa lịch sử.** Một cửa sổ thành token hoặc bộ nhớ: MLP trên cửa sổ (TORL-VLA), GRU trên 13 bước (FWBC-VLA), bộ nhớ VAE đã pretrain (FM-VLA), bộ nhớ lực nhân quả (LIFT), lịch sử lực (ForceDelta-VLA).
3. **Có cấu trúc vật lý.** Tín hiệu được đổi thành các đại lượng có nghĩa: wrench từ mô men khớp (TER-DAgger), lực kẹp tách khỏi lực tác dụng (Tabero), lực trượt tổng $(X, Y, M)$ từ marker (VLA-Touch).
4. **Latent đã căn chỉnh.** Một encoder được huấn luyện để đầu ra khớp với modality khác: ảnh xúc giác căn với lực thật bằng học tương phản (TaF-VLA), xúc giác căn với ngữ nghĩa ngôn ngữ (OmniVTLA).
5. **Ngôn ngữ.** Xúc giác thành chữ cho VLM: "mềm, nhám" của Octopi (VLA-Touch), force prompt theo subtask (ForceVLA2), neo xúc giác vào ngôn ngữ (VTLA), suy luận xúc giác (Tactile-VLA).
6. **Dự đoán.** Mạng tự sinh ra tín hiệu: token lực chưng cất (FD-VLA), hành động có nhận biết xúc giác của teacher (HapticVLA), wrench hoặc mô men tương lai (TORL-VLA, TA-VLA), xúc giác tương lai trong world model (DexTacWAM, TacPAC, UniTacVLA).

Bậc càng cao càng thêm ý nghĩa và độ bền, nhưng mất chi tiết và tốc độ. Ngôn ngữ thì VLM dùng dễ nhưng gần như vô dụng ở 200 Hz; token thô giữ từng milinewton nhưng phải tranh attention với hàng trăm token ảnh ([Survey 1](survey-force-map.html)).

## Lưu ý

Loại cảm biến của các bài chỉ đọc abstract thường không được nêu, nên bảng chỉ ghi những gì bài viết nói. FAVLA, LIFT, CompliantVLA-adaptor và CR-VLA-Force ghi "force/torque" hoặc "lực end-effector 6D" mà không nói đo ở đâu; tôi xếp chúng vào dòng F/T, nhưng có bài có thể ước lượng từ mô men khớp. Tần số là con số báo cáo trong các bài tôi đọc đầy đủ; chúng không phải thuộc tính của loại cảm biến.

**Mang theo sang bài sau:** khi lực đã được đo và mã hóa, chính sách phải làm gì đó với nó: vẫn xuất pose, hay xuất lực, độ cứng, hoặc một phần hiệu chỉnh? Xem [Survey 3](survey-force-output.html).

**Câu kiểm tra:** cùng cánh tay và tư thế đó. Mô men khớp chỉ do tiếp xúc là $\tau_{ext} = (-5,\ -5)$ N·m. Lực nào tác dụng ở đầu ngón?

*Đáp án:* $F = \begin{pmatrix} 0 & -1 \\ 1 & -1 \end{pmatrix}\begin{pmatrix} -5 \\ -5 \end{pmatrix} = \begin{pmatrix} 5 \\ 0 \end{pmatrix}$ N, một lực đẩy 5 N theo $+x$. Kiểm tra: $J^\top F = (-5,\ -5)$.
:::
