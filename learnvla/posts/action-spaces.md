---
slug: action-spaces
date: 2026-10-21
title_en: "Action Spaces: Joints or Pose, Absolute or Delta, and How to Write a Rotation"
title_vi: "Không gian hành động: Khớp hay pose, tuyệt đối hay delta, và cách viết một phép quay"
excerpt_en: "The same motion can be written as joint angles or a gripper pose, as a target or a step, with rotation in Euler angles, quaternions or six numbers. These choices decide what a network can learn. Two worked examples: the Euler jump at 180°, and normalising an action."
excerpt_vi: "Cùng một chuyển động có thể viết bằng góc khớp hay pose tay kẹp, bằng đích đến hay bước dịch, với phép quay bằng góc Euler, quaternion hay sáu con số. Những lựa chọn này quyết định mạng học được gì. Hai ví dụ tính tay: cú nhảy của góc Euler ở 180°, và chuẩn hóa một hành động."
tags: [VLA, Foundations, Action, Rotation]
---

:::en
<div class="tldr" markdown="1">
**CONCEPT** Action spaces. Rotation result from Zhou et al., *On the Continuity of Rotation Representations in Neural Networks*, [arXiv 1812.07035](https://arxiv.org/abs/1812.07035) · 12/2018. Position-vs-velocity result from [Diffusion Policy](diffusion-policy.html) · 03/2023

**PROBLEM** A policy outputs numbers; the robot needs to know what they mean. The same motion can be written in several ways, and a network learns some of them much better than others.

**WHAT FAILED BEFORE** Rotations as Euler angles or quaternions: Zhou et al. prove that every representation of 3D rotations in four or fewer numbers is discontinuous, which makes them "difficult for neural networks to learn". Velocity or delta commands: most behavior-cloning work used them, but Diffusion Policy found position commands "consistently" better for its policies. Mixing datasets with different conventions silently corrupts training.

**IDEA** Make four choices explicitly and keep them identical across the data: what is commanded (joints or pose), absolute or delta, how rotation is encoded, and in which frame and scale.

**RESULT** No single best answer. VLAs on this site use joint or pose targets in chunks, and normalise each dimension with dataset statistics.
</div>

## 1. The problem: the same motion, many vectors

[[flow]]
- Before~Euler angles | Yaw 179° to −179° > !Number jumps by 358°~a 2° turn! > Network | learns a cliff that is not there
- Before~Deltas executed open-loop | Small step errors > !Add up over the chunk! > Drift | error grows with chunk length
+ Explicit convention | Joints or pose, absolute targets > *Continuous rotation + normalised scale* > Network | smooth targets, comparable dimensions
[[/flow]] A network fits smooth functions best, so the action format should make nearby motions have nearby numbers.

## 2. The four choices

[[fig:action-spaces]] Every action vector hides four decisions. They have to match across all the datasets one model is trained on.

| Choice | Options | What it costs |
|---|---|---|
| What is commanded | joint angles; gripper pose (position + rotation) | joints are exact for one robot but do not transfer to another arm; poses transfer better but need inverse kinematics |
| Absolute or delta | "go to this pose"; "move by this much" | deltas are small and centred near zero, but errors add up when a chunk is executed without feedback |
| Rotation | Euler angles (3); quaternion (4); axis-angle (3); 6D, the first two columns of the rotation matrix | Euler jumps at ±180° and has gimbal lock; $q$ and $-q$ are the same rotation; 6D is continuous but needs re-orthogonalising |
| Frame and scale | base frame or tool frame; metres, radians | dimensions with large ranges dominate the loss unless each is normalised |

<div class="calc" markdown="1">
Calculation card 1: why Euler angles hurt

**What and why.** A gripper turns from yaw 179° to yaw −179°, a 2° turn. Compare how the Euler number and the 6D representation change.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\psi$ | yaw angle about the vertical axis | input | 179°, then −179° |
| $r_1,\ r_2$ | first two columns of the rotation matrix (6D representation) | output | – |

**Formula** (rotation about $z$ only)

$$r_1 = (\cos\psi,\ \sin\psi,\ 0), \qquad r_2 = (-\sin\psi,\ \cos\psi,\ 0)$$

**Steps**

1. Euler: the target changes from 179 to −179, a difference of 358.
2. 6D at 179°: $r_1 = (-0.9998,\ 0.0175,\ 0)$, $r_2 = (-0.0175,\ -0.9998,\ 0)$.
3. 6D at −179°: $r_1 = (-0.9998,\ -0.0175,\ 0)$, $r_2 = (0.0175,\ -0.9998,\ 0)$.
4. Largest change in any of the six numbers: $0.0175 - (-0.0175) = 0.035$.

**Result.** For the same 2° turn the Euler target moves by 358 and the 6D target by at most 0.035.

**Why it matters.** A regression loss sees the Euler jump as a huge error, and the network has to learn a cliff that does not exist physically. Zhou et al. show the problem is unavoidable with four or fewer numbers and goes away with five or six. Axis-angle and quaternions also have a seam, but it sits at 180° of total rotation, which small per-step deltas rarely reach.
</div>

<div class="calc" markdown="1">
Calculation card 2: normalising one action dimension

**What and why.** Positions in metres, rotations in radians and gripper widths have very different ranges. Mapping each dimension's typical range to $[-1, 1]$ makes them comparable, using percentiles so one outlier does not stretch the scale (as OpenVLA and FAST do).

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $q_{01},\ q_{99}$ | 1st and 99th percentile of this dimension in the data | statistics | −0.08 m, 0.12 m |
| $a$ | raw action value | input | 0.03 m |
| $\tilde a$ | normalised value | output | – |

**Formula**

$$\tilde a = 2\,\frac{a - q_{01}}{q_{99} - q_{01}} - 1$$

**Steps**

1. $a - q_{01} = 0.03 + 0.08 = 0.11$.
2. $q_{99} - q_{01} = 0.20$, so $0.11 / 0.20 = 0.55$.
3. $\tilde a = 2 \times 0.55 - 1 = 0.10$.

**Result.** 0.03 m becomes 0.10. The policy predicts 0.10; the robot receives the inverse, 0.03 m.

**Why it matters.** The statistics are part of the model. Deploying with statistics from a different dataset shifts every command, which is why checkpoints ship with their normalisation files (the Facet-0 release includes `norm_stats.json`).
</div>

## 3. Absolute or delta, from first principles

A delta says "move 0.2 mm". If every step of a 50-step chunk carries a 0.2 mm bias and the chunk runs without looking back, the errors add: $50 \times 0.2 = 10$ mm by the end. An absolute target says "be at this pose"; a 0.2 mm error stays 0.2 mm. Diffusion Policy reports that its policies did better with position commands, against the trend in earlier behavior cloning, and connects this to action chunking: a chunk of positions is a plan, and errors in it do not compound. Deltas still have a place: they are small and centred, which makes them easy to normalise, and they transfer across workspaces where absolute coordinates differ.

## 4. In VLA

- π0: actions with the same size as the robot's configuration vector (7 numbers for a UR5e arm with gripper), predicted in chunks of 50.
- Facet-0: absolute gripper pose with rotation as a rotation vector (axis-angle), plus gripper.
- FACT: delta base pose plus absolute hand joints, per arm, 62 numbers per step.
- Force papers often add a force target to the action ([Survey 3](survey-force-output.html)).

**Carry forward:** whatever its format, the action becomes numbers that the model must read and write alongside text and images. The common currency is the [token](token.html).

**Check question:** With $q_{01} = -0.08$ and $q_{99} = 0.12$, what raw value does the normalised output $\tilde a = -0.5$ correspond to?

<details markdown="1">
<summary>Answer</summary>

Invert the formula: $a = q_{01} + (\tilde a + 1)(q_{99} - q_{01})/2 = -0.08 + 0.5 \times 0.20 / 2 = -0.08 + 0.05 = -0.03$ m.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**KHÁI NIỆM** Không gian hành động. Kết quả về phép quay từ Zhou và cộng sự, *On the Continuity of Rotation Representations in Neural Networks*, [arXiv 1812.07035](https://arxiv.org/abs/1812.07035) · 12/2018. Kết quả vị trí so với vận tốc từ [Diffusion Policy](diffusion-policy.html) · 03/2023

**VẤN ĐỀ** Chính sách xuất ra các con số; robot cần biết chúng nghĩa là gì. Cùng một chuyển động có thể viết theo nhiều cách, và mạng học một số cách tốt hơn hẳn các cách khác.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Phép quay viết bằng góc Euler hay quaternion: Zhou và cộng sự chứng minh mọi cách biểu diễn phép quay 3D bằng bốn số trở xuống đều không liên tục, khiến chúng "khó cho mạng nơ-ron học". Lệnh vận tốc hay delta: phần lớn công trình behavior cloning dùng chúng, nhưng Diffusion Policy thấy lệnh vị trí "luôn" tốt hơn cho các chính sách của nó. Trộn các bộ dữ liệu khác quy ước làm hỏng việc huấn luyện một cách âm thầm.

**Ý TƯỞNG** Đưa ra bốn lựa chọn một cách tường minh và giữ chúng giống nhau trên toàn bộ dữ liệu: điều khiển cái gì (khớp hay pose), tuyệt đối hay delta, mã hóa phép quay ra sao, và theo hệ tọa độ, thang đo nào.

**KẾT QUẢ** Không có một đáp án tốt nhất duy nhất. Các VLA trên trang này dùng đích đến theo khớp hoặc theo pose trong các chunk, và chuẩn hóa từng chiều bằng thống kê của tập dữ liệu.
</div>

## 1. Vấn đề: cùng một chuyển động, nhiều vector

[[flow]]
- Trước~Góc Euler | Yaw 179° sang −179° > !Con số nhảy 358°~cho một cú xoay 2°! > Mạng | học một vách đá không hề có
- Trước~Delta chạy mở vòng | Sai số nhỏ mỗi bước > !Cộng dồn qua cả chunk! > Trôi | sai số tăng theo độ dài chunk
+ Quy ước tường minh | Khớp hoặc pose, đích tuyệt đối > *Phép quay liên tục + thang đo chuẩn hóa* > Mạng | mục tiêu mượt, các chiều so sánh được
[[/flow]] Mạng khớp tốt nhất với hàm mượt, nên định dạng hành động phải làm cho các chuyển động gần nhau có các con số gần nhau.

## 2. Bốn lựa chọn

[[fig:action-spaces]] Mỗi vector hành động giấu bốn quyết định. Chúng phải khớp nhau trên mọi bộ dữ liệu mà một mô hình được huấn luyện.

| Lựa chọn | Phương án | Cái giá |
|---|---|---|
| Điều khiển cái gì | góc khớp; pose tay kẹp (vị trí + hướng) | khớp thì chính xác cho một robot nhưng không chuyển sang cánh tay khác; pose chuyển tốt hơn nhưng cần động học ngược |
| Tuyệt đối hay delta | "tới pose này"; "dời một chừng này" | delta nhỏ và quanh 0, nhưng sai số cộng dồn khi chạy cả chunk mà không có phản hồi |
| Phép quay | góc Euler (3); quaternion (4); trục-góc (3); 6D, hai cột đầu của ma trận quay | Euler nhảy ở ±180° và bị gimbal lock; $q$ và $-q$ là cùng một phép quay; 6D liên tục nhưng cần trực chuẩn hóa lại |
| Hệ tọa độ và thang đo | hệ tọa độ đế hay hệ tọa độ dụng cụ; mét, radian | các chiều có khoảng giá trị lớn sẽ lấn át loss nếu không chuẩn hóa từng chiều |

<div class="calc" markdown="1">
Thẻ tính tay 1: vì sao góc Euler gây hại

**Tính gì và vì sao.** Tay kẹp xoay từ yaw 179° sang yaw −179°, một cú xoay 2°. So sánh con số Euler và cách biểu diễn 6D thay đổi ra sao.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\psi$ | góc yaw quanh trục thẳng đứng | input | 179°, rồi −179° |
| $r_1,\ r_2$ | hai cột đầu của ma trận quay (biểu diễn 6D) | output | – |

**Công thức** (chỉ quay quanh $z$)

$$r_1 = (\cos\psi,\ \sin\psi,\ 0), \qquad r_2 = (-\sin\psi,\ \cos\psi,\ 0)$$

**Từng bước**

1. Euler: mục tiêu đổi từ 179 sang −179, chênh 358.
2. 6D ở 179°: $r_1 = (-0{,}9998;\ 0{,}0175;\ 0)$, $r_2 = (-0{,}0175;\ -0{,}9998;\ 0)$.
3. 6D ở −179°: $r_1 = (-0{,}9998;\ -0{,}0175;\ 0)$, $r_2 = (0{,}0175;\ -0{,}9998;\ 0)$.
4. Thay đổi lớn nhất trong sáu con số: $0{,}0175 - (-0{,}0175) = 0{,}035$.

**Kết quả.** Với cùng cú xoay 2°, mục tiêu Euler dời 358 còn mục tiêu 6D dời nhiều nhất 0,035.

**Ý nghĩa.** Loss hồi quy thấy cú nhảy Euler là một sai số khổng lồ, và mạng phải học một vách đá không có thật về mặt vật lý. Zhou và cộng sự chỉ ra vấn đề này không tránh được với bốn số trở xuống và biến mất với năm hoặc sáu số. Trục-góc và quaternion cũng có một đường nối, nhưng nó nằm ở tổng góc quay 180°, mà các delta nhỏ mỗi bước hiếm khi chạm tới.
</div>

<div class="calc" markdown="1">
Thẻ tính tay 2: chuẩn hóa một chiều hành động

**Tính gì và vì sao.** Vị trí tính bằng mét, phép quay bằng radian và độ mở tay kẹp có khoảng giá trị rất khác nhau. Ánh xạ khoảng điển hình của mỗi chiều về $[-1, 1]$ làm chúng so sánh được, dùng phân vị để một giá trị ngoại lai không kéo giãn thang đo (như OpenVLA và FAST làm).

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $q_{01},\ q_{99}$ | phân vị 1 và 99 của chiều này trong dữ liệu | thống kê | −0,08 m; 0,12 m |
| $a$ | giá trị hành động thô | input | 0,03 m |
| $\tilde a$ | giá trị đã chuẩn hóa | output | – |

**Công thức**

$$\tilde a = 2\,\frac{a - q_{01}}{q_{99} - q_{01}} - 1$$

**Từng bước**

1. $a - q_{01} = 0{,}03 + 0{,}08 = 0{,}11$.
2. $q_{99} - q_{01} = 0{,}20$, nên $0{,}11 / 0{,}20 = 0{,}55$.
3. $\tilde a = 2 \times 0{,}55 - 1 = 0{,}10$.

**Kết quả.** 0,03 m thành 0,10. Chính sách dự đoán 0,10; robot nhận phép nghịch đảo, 0,03 m.

**Ý nghĩa.** Bộ thống kê là một phần của mô hình. Triển khai với thống kê của một bộ dữ liệu khác sẽ làm lệch mọi lệnh, vì thế các checkpoint được phát hành kèm file chuẩn hóa (bản phát hành Facet-0 có `norm_stats.json`).
</div>

## 3. Tuyệt đối hay delta, nghĩ từ gốc

Một delta nói "dời 0,2 mm". Nếu mỗi bước trong một chunk 50 bước mang độ lệch 0,2 mm và chunk chạy mà không nhìn lại, các sai số cộng lại: $50 \times 0{,}2 = 10$ mm ở cuối. Một đích tuyệt đối nói "ở pose này"; sai số 0,2 mm vẫn là 0,2 mm. Diffusion Policy báo cáo các chính sách của nó tốt hơn với lệnh vị trí, ngược xu hướng behavior cloning trước đó, và gắn điều này với action chunking: một chunk vị trí là một kế hoạch, sai số trong đó không cộng dồn. Delta vẫn có chỗ đứng: chúng nhỏ và quanh 0, dễ chuẩn hóa, và chuyển được giữa các không gian làm việc có tọa độ tuyệt đối khác nhau.

## 4. Trong VLA

- π0: hành động có cùng kích thước với vector cấu hình của robot (7 số cho một cánh tay UR5e có tay kẹp), dự đoán theo chunk 50 bước.
- Facet-0: pose tay kẹp tuyệt đối với phép quay dạng vector quay (trục-góc), cộng tay kẹp.
- FACT: delta pose đế cộng góc khớp bàn tay tuyệt đối, mỗi tay, 62 số mỗi bước.
- Các bài lực thường thêm một mục tiêu lực vào hành động ([Survey 3](survey-force-output.html)).

**Mang theo:** dù định dạng thế nào, hành động cũng thành các con số mà mô hình phải đọc và viết cạnh chữ và ảnh. Đơn vị tiền tệ chung là [token](token.html).

**Câu kiểm tra:** Với $q_{01} = -0{,}08$ và $q_{99} = 0{,}12$, đầu ra đã chuẩn hóa $\tilde a = -0{,}5$ ứng với giá trị thô nào?

<details markdown="1">
<summary>Đáp án</summary>

Đảo công thức: $a = q_{01} + (\tilde a + 1)(q_{99} - q_{01})/2 = -0{,}08 + 0{,}5 \times 0{,}20 / 2 = -0{,}08 + 0{,}05 = -0{,}03$ m.
</details>
:::
