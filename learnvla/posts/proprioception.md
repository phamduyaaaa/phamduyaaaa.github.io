---
slug: proprioception
date: 2026-10-21
title_en: "Proprioception: What the Robot Knows About Its Own Body"
title_vi: "Proprioception: Robot biết gì về chính cơ thể nó"
excerpt_en: "Cameras miss the exact joint angles, the gripper opening and the force at the wrist; the robot's own sensors give them directly. Which signals go into the state vector, how forward kinematics turns angles into a gripper pose, and why a long state history can make a policy lazy."
excerpt_vi: "Camera không thấy chính xác góc khớp, độ mở tay kẹp hay lực ở cổ tay; cảm biến của chính robot cho những thứ đó trực tiếp. Tín hiệu nào vào vector trạng thái, động học thuận biến góc khớp thành pose tay kẹp ra sao, và vì sao lịch sử trạng thái dài có thể làm chính sách lười."
tags: [VLA, Foundations, Proprioception, State]
---

:::en
<div class="tldr" markdown="1">
**CONCEPT** Proprioception, the robot's sense of its own body. The pitfall below is from *Fighting Copycat Agents in Behavioral Cloning from Observation Histories*, [arXiv 2010.14876](https://arxiv.org/abs/2010.14876) · 10/2020

**PROBLEM** A policy must know where its own arm and gripper are, and how hard they push, to the millimetre and the newton.

**WHAT FAILED BEFORE** Image-only policies must infer the arm's configuration from pixels, which is imprecise and fails when the arm hides itself. Adding a long history of states fails differently: the policy learns to repeat the expert's previous action, which the copycat paper calls "cheating", and stops reacting.

**IDEA** Give the policy a compact, normalised state vector read directly from the robot: joint angles (or the gripper pose computed from them), gripper width, and for force tasks the wrench or joint torques. Usually only the current step.

**RESULT** Every VLA on this site takes such a vector: 7 numbers for a single UR5e arm with a gripper in π0, 13 in Facet-0 and CR-VLA-Force (pose, gripper, wrench), and a 10-step wrench window in some force papers.
</div>

## 1. The problem: pixels are a poor ruler

[[flow]]
- Before~Images only | Camera > !Infer arm pose from pixels~imprecise, occluded! > Policy | millimetres lost, gripper state guessed
- Before~Long state history | Last k states > !Copy the last action~looks good in training! > Policy | ignores the scene, does not react
+ Proprioception | Encoders, gripper, F/T > *Current state vector~normalised* > Policy + images | exact body state, scene still from the camera
[[/flow]] The camera answers "where is the cup"; proprioception answers "where am I".

## 2. What goes into the state vector

[[fig:proprioception]] The robot's own sensors give the state directly; forward kinematics turns joint angles into a gripper pose. The policy reads it next to the camera tokens.

| Signal | Source | Size (typical arm) | Tells the policy |
|---|---|---|---|
| Joint angles $q$ | encoders in each joint | 6 or 7 | the full configuration of the arm |
| Joint velocities $\dot q$ | differentiated encoders | 6 or 7 | how fast it is moving |
| Gripper pose | forward kinematics of $q$ | 6 or 7 (position + rotation) | where the tool is in space |
| Gripper width | gripper encoder | 1 | open, closed, holding something |
| Joint torques / motor currents | torque sensors or current | 6 or 7 | load on each joint ([TA-VLA](ta-vla.html)) |
| Wrench | wrist F/T sensor | 6 | contact force and torque at the tool ([force sensing](force-tactile-sensing.html)) |

<div class="calc" markdown="1">
Calculation card

**What and why.** The camera sees the gripper; the encoders give the angles. Forward kinematics computes the gripper position from the angles, and the same formula shows how a tiny angle error turns into millimetres at the tool.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $l_1,\ l_2$ | lengths of the two links of a planar arm | constants | 0.4 m, 0.3 m |
| $\theta_1,\ \theta_2$ | joint angles ($\theta_2$ relative to link 1) | input | 30°, 45° |
| $(x, y)$ | tool position | output | – |
| $\Delta\theta_1$ | an error on joint 1 | input | 0.1° |

**Formula**

$$x = l_1\cos\theta_1 + l_2\cos(\theta_1+\theta_2), \qquad y = l_1\sin\theta_1 + l_2\sin(\theta_1+\theta_2)$$

**Steps**

1. $\cos 30° = 0.866$, $\sin 30° = 0.5$, $\cos 75° = 0.259$, $\sin 75° = 0.966$.
2. $x = 0.4 \times 0.866 + 0.3 \times 0.259 = 0.346 + 0.078 = 0.424$ m.
3. $y = 0.4 \times 0.5 + 0.3 \times 0.966 = 0.200 + 0.290 = 0.490$ m.
4. The tool is $\sqrt{0.424^2 + 0.490^2} = 0.648$ m from joint 1. An error of $0.1° = 0.00175$ rad there moves it by $0.648 \times 0.00175 = 0.0011$ m.

**Result.** The tool is at $(0.424, 0.490)$ m, and a 0.1° error at the shoulder already costs about 1.1 mm at the tool.

**Why it matters.** Encoders measure angles far better than a camera can, so the state vector, not the image, is what fixes the arm's own position. The same lever effect is why a millimetre-precise insertion is hard: errors at the base are amplified at the tip.
</div>

## 3. The copycat trap

At 50 Hz, the expert's action at step $t$ is almost the same as at step $t-1$, and a history of states reveals the previous action (the change from one state to the next *is* the previous action). A network given that history can reach a low training loss by predicting "do what you just did". At test time it keeps doing what it just did, also when the scene says to stop or turn. The copycat paper names this and proposes a fix that removes the previous-action information from the features. The common practical answers in VLAs are simpler: feed only the current state, add noise or dropout to the state, and let the images and the instruction carry the task.

Force is the exception that proves the rule. A wrench window of a few steps (10 samples in Facet-0) is kept on purpose, because contact onset, a jam and a slip are patterns over time that one sample cannot show.

## 4. In VLA

- π0 puts the state in its own block of tokens, read by the action expert. Robots with fewer joints are zero-padded to a fixed size ([cross-embodiment data](cross-embodiment-data.html)).
- Each dimension is normalised, usually with dataset statistics, so that a joint angle in radians and a gripper width in metres arrive on similar scales.
- Force papers differ mainly in which body signals they add: wrist wrench (ForceVLA), joint torque from motor current (TA-VLA), or a torque-estimated external force (FWBC-VLA).

**Carry forward:** the state says where the arm *is*; the action says where it should *go*, and there are several ways to write that down: [action spaces](action-spaces.html).

**Check question:** Same arm, $\theta_1 = 0°$, $\theta_2 = 90°$. Where is the tool?

<details markdown="1">
<summary>Answer</summary>

$x = 0.4 \times 1 + 0.3 \times \cos 90° = 0.4$ m; $y = 0.4 \times 0 + 0.3 \times \sin 90° = 0.3$ m. The tool is at $(0.4, 0.3)$ m: link 1 along $x$, link 2 pointing straight up.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**KHÁI NIỆM** Proprioception, giác quan của robot về chính cơ thể nó. Cái bẫy ở dưới lấy từ *Fighting Copycat Agents in Behavioral Cloning from Observation Histories*, [arXiv 2010.14876](https://arxiv.org/abs/2010.14876) · 10/2020

**VẤN ĐỀ** Chính sách phải biết cánh tay và tay kẹp của nó đang ở đâu, và đang ấn mạnh bao nhiêu, tới từng milimét và từng newton.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Chính sách chỉ dùng ảnh phải đoán cấu hình cánh tay từ pixel, vừa thiếu chính xác vừa hỏng khi cánh tay tự che khuất. Thêm một lịch sử trạng thái dài thì hỏng theo kiểu khác: chính sách học cách lặp lại hành động trước đó của chuyên gia, điều mà paper copycat gọi là "ăn gian", và thôi không phản ứng.

**Ý TƯỞNG** Đưa cho chính sách một vector trạng thái gọn, đã chuẩn hóa, đọc trực tiếp từ robot: góc khớp (hoặc pose tay kẹp tính từ góc khớp), độ mở tay kẹp, và với tác vụ lực thì thêm wrench hoặc mô-men khớp. Thường chỉ lấy bước hiện tại.

**KẾT QUẢ** Mọi VLA trên trang này đều nhận một vector như vậy: 7 số cho một cánh tay UR5e có tay kẹp trong π0, 13 số trong Facet-0 và CR-VLA-Force (pose, tay kẹp, wrench), và một cửa sổ wrench 10 bước trong vài bài lực.
</div>

## 1. Vấn đề: pixel là một cây thước tồi

[[flow]]
- Trước~Chỉ có ảnh | Camera > !Đoán pose cánh tay từ pixel~thiếu chính xác, bị che! > Chính sách | mất vài milimét, trạng thái tay kẹp phải đoán
- Trước~Lịch sử trạng thái dài | k trạng thái gần nhất > !Chép hành động vừa làm~trông tốt khi huấn luyện! > Chính sách | bỏ qua cảnh, không phản ứng
+ Proprioception | Encoder, tay kẹp, F/T > *Vector trạng thái hiện tại~đã chuẩn hóa* > Chính sách + ảnh | trạng thái cơ thể chính xác, cảnh vẫn lấy từ camera
[[/flow]] Camera trả lời "cái cốc ở đâu"; proprioception trả lời "mình đang ở đâu".

## 2. Vector trạng thái gồm những gì

[[fig:proprioception]] Cảm biến của chính robot cho trạng thái trực tiếp; động học thuận biến góc khớp thành pose tay kẹp. Chính sách đọc nó bên cạnh các token camera.

| Tín hiệu | Nguồn | Kích thước (cánh tay thường gặp) | Cho chính sách biết |
|---|---|---|---|
| Góc khớp $q$ | encoder ở mỗi khớp | 6 hoặc 7 | toàn bộ cấu hình cánh tay |
| Vận tốc khớp $\dot q$ | đạo hàm encoder | 6 hoặc 7 | đang chuyển động nhanh cỡ nào |
| Pose tay kẹp | động học thuận từ $q$ | 6 hoặc 7 (vị trí + hướng) | dụng cụ đang ở đâu trong không gian |
| Độ mở tay kẹp | encoder tay kẹp | 1 | mở, đóng, đang giữ vật |
| Mô-men khớp / dòng điện động cơ | cảm biến mô-men hoặc dòng điện | 6 hoặc 7 | tải trên từng khớp ([TA-VLA](ta-vla.html)) |
| Wrench | cảm biến F/T cổ tay | 6 | lực và mô-men tiếp xúc ở dụng cụ ([cảm biến lực](force-tactile-sensing.html)) |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Camera thấy tay kẹp; encoder cho góc khớp. Động học thuận tính vị trí tay kẹp từ góc khớp, và cùng công thức đó cho thấy một sai số góc rất nhỏ biến thành vài milimét ở đầu dụng cụ.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $l_1,\ l_2$ | chiều dài hai khâu của một cánh tay phẳng | hằng số | 0,4 m; 0,3 m |
| $\theta_1,\ \theta_2$ | góc khớp ($\theta_2$ tính so với khâu 1) | input | 30°, 45° |
| $(x, y)$ | vị trí dụng cụ | output | – |
| $\Delta\theta_1$ | một sai số ở khớp 1 | input | 0,1° |

**Công thức**

$$x = l_1\cos\theta_1 + l_2\cos(\theta_1+\theta_2), \qquad y = l_1\sin\theta_1 + l_2\sin(\theta_1+\theta_2)$$

**Từng bước**

1. $\cos 30° = 0{,}866$, $\sin 30° = 0{,}5$, $\cos 75° = 0{,}259$, $\sin 75° = 0{,}966$.
2. $x = 0{,}4 \times 0{,}866 + 0{,}3 \times 0{,}259 = 0{,}346 + 0{,}078 = 0{,}424$ m.
3. $y = 0{,}4 \times 0{,}5 + 0{,}3 \times 0{,}966 = 0{,}200 + 0{,}290 = 0{,}490$ m.
4. Dụng cụ cách khớp 1 là $\sqrt{0{,}424^2 + 0{,}490^2} = 0{,}648$ m. Sai số $0{,}1° = 0{,}00175$ rad ở đó làm nó dời $0{,}648 \times 0{,}00175 = 0{,}0011$ m.

**Kết quả.** Dụng cụ ở $(0{,}424;\ 0{,}490)$ m, và sai số 0,1° ở vai đã tốn khoảng 1,1 mm ở đầu dụng cụ.

**Ý nghĩa.** Encoder đo góc tốt hơn camera rất nhiều, nên chính vector trạng thái, chứ không phải ảnh, xác định vị trí của bản thân cánh tay. Cùng hiệu ứng đòn bẩy đó là lý do lắp ghép chính xác tới milimét rất khó: sai số ở gốc bị khuếch đại ở đầu.
</div>

## 3. Cái bẫy copycat

Ở 50 Hz, hành động của chuyên gia ở bước $t$ gần như giống hệt ở bước $t-1$, và một lịch sử trạng thái làm lộ hành động trước đó (độ thay đổi giữa hai trạng thái liên tiếp *chính là* hành động trước đó). Mạng được cho lịch sử ấy có thể đạt loss huấn luyện thấp bằng cách đoán "làm lại điều vừa làm". Khi chạy thật, nó cứ làm lại điều vừa làm, kể cả khi cảnh bảo dừng hoặc rẽ. Paper copycat đặt tên cho hiện tượng này và đề xuất cách loại thông tin hành động trước khỏi đặc trưng. Các câu trả lời thực tế phổ biến trong VLA đơn giản hơn: chỉ đưa trạng thái hiện tại, thêm nhiễu hoặc dropout vào trạng thái, và để ảnh cùng câu lệnh gánh phần tác vụ.

Lực là ngoại lệ chứng minh quy tắc. Một cửa sổ wrench vài bước (10 mẫu trong Facet-0) được giữ có chủ ý, vì lúc bắt đầu chạm, lúc kẹt và lúc trượt là những mẫu hình theo thời gian mà một mẫu đơn lẻ không thể hiện được.

## 4. Trong VLA

- π0 đặt trạng thái vào một khối token riêng, do action expert đọc. Robot ít khớp hơn được đệm số 0 tới một kích thước cố định ([dữ liệu cross-embodiment](cross-embodiment-data.html)).
- Mỗi chiều được chuẩn hóa, thường bằng thống kê của tập dữ liệu, để góc khớp tính bằng radian và độ mở tay kẹp tính bằng mét có thang đo tương tự nhau.
- Các bài lực khác nhau chủ yếu ở chỗ thêm tín hiệu cơ thể nào: wrench ở cổ tay (ForceVLA), mô-men khớp từ dòng điện động cơ (TA-VLA), hay lực ngoài ước lượng từ mô-men (FWBC-VLA).

**Mang theo:** trạng thái cho biết cánh tay *đang ở* đâu; hành động cho biết nó nên *đi* tới đâu, và có nhiều cách để viết điều đó: [không gian hành động](action-spaces.html).

**Câu kiểm tra:** Cùng cánh tay, $\theta_1 = 0°$, $\theta_2 = 90°$. Dụng cụ ở đâu?

<details markdown="1">
<summary>Đáp án</summary>

$x = 0{,}4 \times 1 + 0{,}3 \times \cos 90° = 0{,}4$ m; $y = 0{,}4 \times 0 + 0{,}3 \times \sin 90° = 0{,}3$ m. Dụng cụ ở $(0{,}4;\ 0{,}3)$ m: khâu 1 nằm dọc trục $x$, khâu 2 chĩa thẳng lên.
</details>
:::
