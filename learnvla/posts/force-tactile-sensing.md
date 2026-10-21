---
slug: force-tactile-sensing
date: 2026-10-21
title_en: "Force and Tactile Sensing: What Each Sensor Actually Measures"
title_vi: "Cảm biến lực và xúc giác: Mỗi cảm biến thực sự đo được gì"
excerpt_en: "A wrist F/T sensor, joint torques, a pressure array and a gel camera all say something about contact, but not the same thing. Where each one sits, what it reports, and two worked corrections a policy needs: removing the tool's weight, and estimating force from joint torques."
excerpt_vi: "Cảm biến F/T ở cổ tay, mô-men khớp, mảng áp suất và camera gel đều nói gì đó về tiếp xúc, nhưng không giống nhau. Mỗi loại nằm ở đâu, báo về gì, và tính tay hai hiệu chỉnh mà chính sách cần: trừ trọng lượng dụng cụ, và ước lượng lực từ mô-men khớp."
tags: [VLA, Foundations, Force, Tactile, Sensors]
---

:::en
<div class="tldr" markdown="1">
**CONCEPT** Force and tactile sensing for manipulation. Sensor-by-sensor comparison of the force-VLA papers in [Survey 2](survey-force-sensing.html); the gel sensor in detail in [GelSight](gelsight.html)

**PROBLEM** A force-aware policy is only as good as the force signal it reads. The same contact looks different to a wrist sensor, to the joint motors and to a fingertip.

**WHAT FAILED BEFORE** The usual errors are not in the network but in the signal: reading the tool's weight as contact force, mixing frames, zeroing the sensor once and then tilting the tool, or treating an estimate from motor current as if it were a calibrated sensor.

**IDEA** Know what each sensor reports and in which frame, and give the policy a cleaned signal: bias removed, tool weight compensated for the current orientation, in a stated frame, normalised, and often as a short history.

**RESULT** Every force paper on this site makes one of these choices: wrist F/T (ForceVLA, Facet-0, CR-VLA-Force), joint torque from motor current (TA-VLA), estimated external force (FWBC-VLA), gel tactile images (TaF-VLA, VLA-Touch), pressure arrays (HapticVLA, TaF-VLA's training rig).
</div>

## 1. The problem: one contact, four different readings

[[flow]]
- Before~Raw wrist reading | F/T sensor > !Tool weight + bias + contact~mixed together! > Policy | "force" changes when the tool tilts
- Before~Motor current as force | Currents > !Friction and model error~read as contact! > Policy | noisy, biased estimate
+ Cleaned signal | Sensor > *Bias, gravity, frame, normalisation* > Policy | force that means contact
[[/flow]] The change is treating the force signal as a measurement with a model, not as a number to paste into the state.

## 2. The sensors

[[fig:force-tactile-sensing]] From base to fingertip: cheaper and already present near the base, richer and more fragile near the fingertip.

| Sensor | What it reports | Typical rate | Strength | Weakness |
|---|---|---|---|---|
| Joint torque / motor current | one torque per joint | the robot's control rate | no extra hardware | friction, gear losses; contact force must be estimated |
| Wrist 6-axis F/T | 3 forces + 3 torques at the wrist | hundreds of Hz or more (ForceVLA2's: 300 Hz) | direct, calibrated; some arms, such as Universal Robots' e-Series, have one in the tool flange | total wrench only: cannot say where on the tool the contact is |
| Pressure / taxel array | a coarse map of normal pressure (TaF-VLA's rig: 12×12) | moderate | shows where contact is | coarse, mostly normal force only |
| Vision-based tactile (gel) | an image of the deformed gel | about 30 Hz (GelSight, TaF-VLA) | fine shape, texture, slip | force must be inferred; gels wear |

<div class="calc" markdown="1">
Calculation card

**What and why.** Two corrections a force-aware policy depends on. First, removing the tool's weight from a wrist reading, and what happens if the tool tilts after zeroing. Second, estimating contact force from joint torques with the Jacobian, on the same two-link arm as in [proprioception](proprioception.html).

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $m$ | mass of tool + gripper below the sensor | constant | 0.5 kg |
| $F_z^{meas}$ | wrist reading along the sensor's $z$ axis, pointing down | input | 13.0 N |
| $\phi$ | tilt of the tool from vertical | input | 30° |
| $J$ | Jacobian of the arm at $\theta = (30°, 45°)$ | derived | – |
| $F$ | force the tool applies, $(F_x, F_y)$ | input | $(0, -10)$ N |
| $\tau$ | joint torques that balance $F$ | output | – |

**Formulas**

$$F_z^{contact} = F_z^{meas} - m g \cos\phi, \qquad \tau = J^\top F$$

**Steps**

1. Tool weight: $0.5 \times 9.81 = 4.905$ N. With the tool vertical, $F_z^{contact} = 13.0 - 4.905 = 8.1$ N.
2. If the sensor was zeroed with the tool vertical and the tool then tilts 30°, the weight along $z$ becomes $4.905 \times \cos 30° = 4.25$ N, so a "zeroed" sensor shows $4.25 - 4.905 = -0.66$ N with no contact at all.
3. Jacobian at $(30°, 45°)$ with links 0.4 m and 0.3 m: $J = \begin{pmatrix} -0.490 & -0.290 \\ 0.424 & 0.078 \end{pmatrix}$.
4. Pressing down with 10 N: $\tau_1 = 0.424 \times (-10) = -4.24$ N·m, $\tau_2 = 0.078 \times (-10) = -0.78$ N·m.

**Result.** The contact force is 8.1 N, not 13 N; a 30° tilt after zeroing fakes 0.66 N; and a 10 N push shows up as 4.24 and 0.78 N·m at the two joints.

**Why it matters.** Step 2 is why policies see force "drift" while moving in free air, which a learned model can mistake for contact. Steps 3–4 run backwards in torque-based methods: measure $\tau$, subtract what gravity and motion explain, and solve for $F$. At joint 2 a 10 N contact is only 0.78 N·m, so a little friction in that joint is a large force error, which is why torque-based estimates are noisier than a wrist sensor.
</div>

## 3. What the force papers choose

- **Wrist F/T:** ForceVLA, ForceVLA2, Facet-0 (10-sample wrench window), CR-VLA-Force (UR5e with a 6-DoF F/T sensor). The most direct option for a single arm with a parallel gripper.
- **Joint torque, no extra sensor:** TA-VLA estimates torque from motor current; FWBC-VLA estimates the external wrench for a whole wheel-legged body.
- **Touch at the fingertips:** TaF-VLA and VLA-Touch use gel images; HapticVLA uses 10×10 tactile maps during training only; FACT uses fingertip force on dexterous hands.
- **No sensor at run time:** FD-VLA and HapticVLA keep the sensor for training and remove it with [distillation](distillation.html).

**Carry forward:** measuring force is half the story. The other half is what the low-level controller does with a force, and why a stiff position controller against a rigid part ends in a protective stop: [contact-rich control](contact-rich-control.html).

**Check question:** The tool is tilted 60° from vertical. With $m = 0.5$ kg, what does its weight contribute along the sensor's $z$ axis?

<details markdown="1">
<summary>Answer</summary>

$4.905 \times \cos 60° = 4.905 \times 0.5 = 2.45$ N. If the sensor was zeroed vertical, it would show $2.45 - 4.905 = -2.45$ N with no contact.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**KHÁI NIỆM** Cảm biến lực và xúc giác cho thao tác. So sánh từng loại cảm biến trong các paper VLA lực ở [Survey 2](survey-force-sensing.html); cảm biến gel chi tiết ở [GelSight](gelsight.html)

**VẤN ĐỀ** Một chính sách nhận biết lực chỉ tốt bằng tín hiệu lực mà nó đọc. Cùng một tiếp xúc trông khác nhau với cảm biến cổ tay, với động cơ khớp và với đầu ngón tay.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Lỗi thường gặp không nằm ở mạng mà ở tín hiệu: đọc trọng lượng dụng cụ thành lực tiếp xúc, trộn các hệ tọa độ, đặt 0 cho cảm biến một lần rồi nghiêng dụng cụ, hoặc coi một ước lượng từ dòng điện động cơ như thể đó là cảm biến đã hiệu chuẩn.

**Ý TƯỞNG** Biết mỗi cảm biến báo về gì và trong hệ tọa độ nào, và đưa cho chính sách một tín hiệu đã làm sạch: bỏ độ lệch, bù trọng lượng dụng cụ theo hướng hiện tại, trong một hệ tọa độ đã nêu, đã chuẩn hóa, và thường là một lịch sử ngắn.

**KẾT QUẢ** Mọi bài lực trên trang này đều chọn một trong các phương án sau: F/T cổ tay (ForceVLA, Facet-0, CR-VLA-Force), mô-men khớp từ dòng điện động cơ (TA-VLA), lực ngoài ước lượng (FWBC-VLA), ảnh xúc giác gel (TaF-VLA, VLA-Touch), mảng áp suất (HapticVLA, thiết bị huấn luyện của TaF-VLA).
</div>

## 1. Vấn đề: một tiếp xúc, bốn cách đọc

[[flow]]
- Trước~Số đọc cổ tay thô | Cảm biến F/T > !Trọng lượng dụng cụ + độ lệch + tiếp xúc~trộn lẫn! > Chính sách | "lực" đổi khi dụng cụ nghiêng
- Trước~Dòng điện động cơ làm lực | Dòng điện > !Ma sát và sai số mô hình~bị đọc thành tiếp xúc! > Chính sách | ước lượng nhiễu, lệch
+ Tín hiệu đã làm sạch | Cảm biến > *Độ lệch, trọng lực, hệ tọa độ, chuẩn hóa* > Chính sách | lực mang nghĩa tiếp xúc
[[/flow]] Thay đổi nằm ở việc coi tín hiệu lực là một phép đo có mô hình, chứ không phải một con số dán vào trạng thái.

## 2. Các cảm biến

[[fig:force-tactile-sensing]] Từ đế tới đầu ngón: gần đế thì rẻ hơn và có sẵn, gần đầu ngón thì giàu thông tin hơn và dễ hỏng hơn.

| Cảm biến | Báo về gì | Tần số điển hình | Điểm mạnh | Điểm yếu |
|---|---|---|---|---|
| Mô-men khớp / dòng điện động cơ | một mô-men cho mỗi khớp | tần số điều khiển của robot | không cần phần cứng thêm | ma sát, tổn hao hộp số; lực tiếp xúc phải ước lượng |
| F/T 6 trục ở cổ tay | 3 lực + 3 mô-men tại cổ tay | vài trăm Hz trở lên (của ForceVLA2: 300 Hz) | trực tiếp, đã hiệu chuẩn; một số cánh tay, như dòng e-Series của Universal Robots, có sẵn một cái ở mặt bích dụng cụ | chỉ có wrench tổng: không biết tiếp xúc nằm ở đâu trên dụng cụ |
| Mảng áp suất / taxel | bản đồ thô của áp suất pháp tuyến (thiết bị của TaF-VLA: 12×12) | trung bình | cho biết tiếp xúc ở đâu | thô, chủ yếu chỉ có lực pháp tuyến |
| Xúc giác dùng camera (gel) | ảnh của lớp gel bị biến dạng | khoảng 30 Hz (GelSight, TaF-VLA) | hình dạng tinh, kết cấu, trượt | lực phải suy ra; gel bị mòn |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Hai hiệu chỉnh mà một chính sách nhận biết lực phụ thuộc vào. Thứ nhất, trừ trọng lượng dụng cụ khỏi số đọc cổ tay, và chuyện gì xảy ra nếu dụng cụ nghiêng sau khi đặt 0. Thứ hai, ước lượng lực tiếp xúc từ mô-men khớp bằng Jacobian, trên cùng cánh tay hai khâu như ở bài [proprioception](proprioception.html).

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $m$ | khối lượng dụng cụ + tay kẹp bên dưới cảm biến | hằng số | 0,5 kg |
| $F_z^{meas}$ | số đọc cổ tay theo trục $z$ của cảm biến, chĩa xuống | input | 13,0 N |
| $\phi$ | góc nghiêng của dụng cụ so với phương thẳng đứng | input | 30° |
| $J$ | Jacobian của cánh tay tại $\theta = (30°, 45°)$ | suy ra | – |
| $F$ | lực dụng cụ tác dụng, $(F_x, F_y)$ | input | $(0, -10)$ N |
| $\tau$ | mô-men khớp cân bằng với $F$ | output | – |

**Công thức**

$$F_z^{contact} = F_z^{meas} - m g \cos\phi, \qquad \tau = J^\top F$$

**Từng bước**

1. Trọng lượng dụng cụ: $0{,}5 \times 9{,}81 = 4{,}905$ N. Khi dụng cụ thẳng đứng, $F_z^{contact} = 13{,}0 - 4{,}905 = 8{,}1$ N.
2. Nếu cảm biến được đặt 0 khi dụng cụ thẳng đứng rồi dụng cụ nghiêng 30°, trọng lượng theo $z$ còn $4{,}905 \times \cos 30° = 4{,}25$ N, nên một cảm biến "đã đặt 0" hiện $4{,}25 - 4{,}905 = -0{,}66$ N dù không có tiếp xúc nào.
3. Jacobian tại $(30°, 45°)$ với các khâu 0,4 m và 0,3 m: $J = \begin{pmatrix} -0{,}490 & -0{,}290 \\ 0{,}424 & 0{,}078 \end{pmatrix}$.
4. Ấn xuống với 10 N: $\tau_1 = 0{,}424 \times (-10) = -4{,}24$ N·m, $\tau_2 = 0{,}078 \times (-10) = -0{,}78$ N·m.

**Kết quả.** Lực tiếp xúc là 8,1 N chứ không phải 13 N; nghiêng 30° sau khi đặt 0 tạo ra 0,66 N giả; và một lực ấn 10 N hiện ra là 4,24 và 0,78 N·m ở hai khớp.

**Ý nghĩa.** Bước 2 là lý do chính sách thấy lực "trôi" khi di chuyển trong không khí, điều mà một mô hình học có thể nhầm là tiếp xúc. Bước 3–4 được chạy ngược trong các phương pháp dựa trên mô-men: đo $\tau$, trừ đi phần mà trọng lực và chuyển động giải thích được, rồi giải ra $F$. Ở khớp 2, một tiếp xúc 10 N chỉ là 0,78 N·m, nên một chút ma sát ở khớp đó đã là sai số lực lớn, đó là lý do ước lượng từ mô-men nhiễu hơn cảm biến cổ tay.
</div>

## 3. Các paper lực chọn gì

- **F/T cổ tay:** ForceVLA, ForceVLA2, Facet-0 (cửa sổ wrench 10 mẫu), CR-VLA-Force (UR5e với cảm biến F/T 6 bậc). Lựa chọn trực tiếp nhất cho một cánh tay đơn với tay kẹp song song.
- **Mô-men khớp, không cần cảm biến thêm:** TA-VLA ước lượng mô-men từ dòng điện động cơ; FWBC-VLA ước lượng wrench ngoài cho cả thân robot chân-bánh.
- **Xúc giác ở đầu ngón:** TaF-VLA và VLA-Touch dùng ảnh gel; HapticVLA chỉ dùng bản đồ xúc giác 10×10 khi huấn luyện; FACT dùng lực đầu ngón trên bàn tay khéo léo.
- **Không có cảm biến khi chạy:** FD-VLA và HapticVLA giữ cảm biến cho huấn luyện rồi bỏ nó bằng [distillation](distillation.html).

**Mang theo:** đo được lực mới là một nửa câu chuyện. Nửa còn lại là bộ điều khiển mức thấp làm gì với một lực, và vì sao một bộ điều khiển vị trí cứng ép vào chi tiết cứng sẽ kết thúc bằng một lần dừng bảo vệ: [điều khiển giàu tiếp xúc](contact-rich-control.html).

**Câu kiểm tra:** Dụng cụ nghiêng 60° so với phương thẳng đứng. Với $m = 0{,}5$ kg, trọng lượng của nó đóng góp bao nhiêu theo trục $z$ của cảm biến?

<details markdown="1">
<summary>Đáp án</summary>

$4{,}905 \times \cos 60° = 4{,}905 \times 0{,}5 = 2{,}45$ N. Nếu cảm biến đã được đặt 0 ở tư thế thẳng đứng, nó sẽ hiện $2{,}45 - 4{,}905 = -2{,}45$ N dù không có tiếp xúc.
</details>
:::
