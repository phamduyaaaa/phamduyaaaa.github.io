---
slug: cr-vla-force
date: 2026-10-19
title_en: "CR-VLA-Force (CC-VLA): A Compliance Controller Guided by the VLA"
title_vi: "CR-VLA-Force (CC-VLA): Bộ điều khiển mềm dẻo do VLA dẫn đường"
excerpt_en: "A force-aware VLA still emits one action chunk per second as poses, so it cannot track a force or react fast. CC-VLA makes the VLA predict a desired force too, and a 500 Hz adaptive-stiffness controller tracks pose and force on a UR5e: 89.2% against 73.2% for ForceVLA."
excerpt_vi: "Một VLA có lực vẫn xuất mỗi giây một chunk dưới dạng pose, nên không bám được một lực cho trước và không phản ứng nhanh. CC-VLA bắt VLA dự đoán thêm lực mong muốn, rồi một bộ điều khiển độ cứng thích nghi 500 Hz bám cả pose lẫn lực trên UR5e: 89,2% so với 73,2% của ForceVLA."
tags: [VLA, Force, Compliance, Paper Notes, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.05832](https://arxiv.org/abs/2609.05832) · 09/2026 · Huawei, South China University of Technology, Ola Dimensions, Hong Kong Polytechnic University · built on π0. The title says CR-VLA-Force; the framework is called CC-VLA (Control-aware Compliance VLA) inside the paper. No code or project link in the text.

**PROBLEM** Contact tasks need a force held steady (wiping at 40 N) and fast reactions, but a VLA runs about once a second.

**WHAT FAILED BEFORE** ForceVLA and TA-VLA put force into the VLA but still output position commands, so they work "without explicit or implicit force control" (the paper's words) and cannot track a force. In wiping, π0 and π0.5 hit the 75 N protective stop; ForceVLA's force error is 35.6% of the demonstrated force.

**IDEA** The VLA predicts a desired pose and a desired force each chunk; a 500 Hz controller follows them and adapts its stiffness to the force error. A force-history token and two-stage training feed the VLA.

**RESULT** 89.2% average success over six conditions against 73.2% for ForceVLA, and wiping-force error of 5.5% against 35.6%, on a UR5e.
</div>

## 1. The problem: a pose-only chunk cannot hold a force

[[flow]]
- Before~π0 / π0.5 | Images + text > !Pose chunk~no force awareness! > Robot | wiping hits the 75 N protective stop
- Before~ForceVLA | F/T + images > !Pose chunk~force not tracked! > Robot | 73.2% success, 35.6% force error
+ CC-VLA | F/T history + images > *Pose + force chunk* > *Adaptive compliance control~500 Hz* > Robot | 89.2%, 5.5% force error
[[/flow]] The VLA stays slow (one inference per second); the controller is what makes the reaction fast and the contact safe.

## 2. Architecture

[[fig:cr-vla-force]] The VLA outputs desired pose and force once a second; an asynchronous layer interpolates them to 500 Hz and the controller adapts stiffness to the force error.

| Part | Input | Output | Role |
|---|---|---|---|
| π0 backbone | 2 images, instruction | context embeddings | PaliGemma + flow-matching action expert |
| Force-history encoder | $F_t \in \mathbb{R}^{h \times 6}$ | one force token | split into segments, MLP per segment, cross-attention by a learnable token |
| Cross-modal fusion expert | force token, vision-language features | residual to the action expert | sparse MoE of 4 experts, as in ForceVLA |
| Action chunk | – | $a_t = \{p_t, g_t, f_t\}$, $H = 40$ | desired pose, gripper and force |
| Adaptive compliance controller | desired pose and force, measured force | robot command at 500 Hz | $F_{ext} = K_d(x - x_d) + D_d\dot x + F_d$ |

State is 13-D: TCP pose, gripper width and the current wrench. The history length $h$ and segment length are not given in the text.

## 3. Work it by hand: one stiffness update

<div class="calc" markdown="1">
Calculation card

**What and why.** The controller raises stiffness when the force error is shrinking and lowers it when the error is growing, in steps proportional to the error. Computing one update shows how stiffness stays inside bounds and moves smoothly.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $K^{t-1}$ | stiffness before the update (N/m) | input | 800 |
| $\lvert F_{err}^{k}\rvert,\ \lvert F_{err}^{k-1}\rvert$ | force error now and one step earlier (N) | input | 10 and 14 |
| $\lambda$ | step-size parameter | constant | 2 (illustrative; not given in the paper) |
| $\beta$ | low-pass weight | constant | 0.5 (illustrative) |
| $K_{min}, K_{max}$ | stiffness limits (N/m) | constant | 400 and 2500 (from the paper) |
| $K_d$ | stiffness sent to the controller | output | – |

**Formulas**

$$K^{t} = K^{t-1} - \alpha\,\mathrm{sign}\big(\lvert F_{err}^{k}\rvert - \lvert F_{err}^{k-1}\rvert\big),\quad \alpha = \lambda\lvert F_{err}^{k}\rvert$$

$$K_{filt} = \beta K^{t} + (1-\beta)K^{t-1},\qquad K_d = \min\big(\max(K_{filt}, K_{min}), K_{max}\big)$$

**Steps**

1. The error fell from 14 N to 10 N, so $\mathrm{sign}(10 - 14) = -1$.
2. $\alpha = 2\times 10 = 20$.
3. $K^{t} = 800 - 20\times(-1) = 820$.
4. Filter: $0.5\times 820 + 0.5\times 800 = 810$; inside $[400, 2500]$, so $K_d = 810$ N/m.

Opposite case, error rising from 10 N to 14 N: $\alpha = 2\times 14 = 28$, $\mathrm{sign}(+4) = +1$, $K^t = 772$, filtered $= 786$ N/m.

**Result.** Stiffness goes to 810 N/m when the error is shrinking and to 786 N/m when it is growing.

**Why it matters.** A stiff controller tracks well but jumps in force when the pose is a little wrong; a soft one is safe but loses force. Letting the error steer the stiffness gives both, within fixed bounds.
</div>

## 4. Results

[[bars:%]] Diffusion Policy=31.3; π0.5=44.7; π0=47.3; π0 with force in state=60.2; ForceVLA=73.2; *CC-VLA=89.2* || Average success over six conditions (the text names button, plug-insertion and window-opening variants, including out-of-distribution height and proximal start); wiping is reported by force error below. 24–25 trials per condition.

| Wiping force error (lower is better) | DP | π0 | π0.5 | π0 with force | ForceVLA | CC-VLA |
|---|---|---|---|---|---|---|
| Base | 83.8% | n/a | 76.1% | 28.1% | 35.6% | 5.5% |
| Board 6 cm lower (OOD) | 79.3% | 81.2% | 82.2% | 38.2% | 52.3% | 8.8% |

- Wiping force error is the mean of $\lvert F_{ext} - F_{demo}\rvert / F_{demo}$ against the demonstrated 40 N. π0 and π0.5 triggered the protective stop above 75 N, so π0 has no base value.
- Controller ablation (wiping, base): without the VLA-guided controller 17.7%; fixed low stiffness 7.9%; fixed high stiffness 13.3%; adaptive stiffness 5.5%.
- Training ablations: two-stage training raises button pressing by 12% (as the paper states it) and cuts false presses from 28% to 8%; plug insertion reaches 76% (+8%); the force-history encoder lifts the proximal-start plug task from 72% to 92%.

## 5. Data and setup

| Item | Value |
|---|---|
| Robot | UR5e (position-controlled), UMI-like gripper, wrist RealSense D435, a second side camera, 6-DoF F/T sensor, controlled through UR RTDE |
| Host | one computer with an Intel i7-13700KF; inference once per second, action horizon 40, force sampled every 0.1 s, control at 500 Hz |
| Demonstrations | 50 per task for button, window and wiping; 100 for plug insertion |
| Trials | 24–25 per test condition |
| Tasks | press an emergency-stop button, insert a charging plug (multiple peg-in-hole), open a rotary window, wipe a whiteboard at constant force |
| Teleoperation | shared teleoperation: a compensated virtual impedance makes the environment feel softer to a gamepad or 3D mouse, so a small error does not trigger a protective stop |

## 6. Can I use this on my robot?

**Short answer.** This is the closest published match to a UR arm with a 6-DoF F/T sensor: the experiments use a UR5e, UR RTDE and π0, and a UR10e is the same family. Hardware is the easy part; the paper gives no code and no training details. "Not stated" means I looked in the full text and did not find it.

| Need | What the authors used | If yours differs |
|---|---|---|
| Arm | UR5e, position-controlled, controlled through UR RTDE | A UR10e is another model of the same family; the paper does not test it |
| Force sensing | A 6-DoF F/T sensor; where it is mounted is not stated | Whether it was the arm's built-in sensor is not stated |
| Gripper | A UMI-like gripper | Not stated for other grippers |
| Cameras | One wrist and one side camera | – |
| Compute at run time | One host computer with an Intel i7-13700KF running RTDE and the controller; where the VLA runs is not stated | Inference once per second is slow, so the model need not be fast |
| Demonstrations | 50 to 100 per task, collected with shared teleoperation | The paper warns that data collection "relies heavily on precise force control and temporal consistency" |
| Controller settings | Stiffness 400–2500 N/m, 500 Hz, critical damping with a fixed ratio | $\lambda$, $\beta$ and the damping ratio are not stated; you tune them |
| Training | Two stages on π0 with a sparse MoE of 4 experts | GPU, steps and time: not stated |
| Code and weights | None mentioned in the text I read | You would implement it on openpi plus ForceVLA's MoE |

**Which parts carry over.** The press-an-e-stop and plug-insertion tasks are close to pressing a cap. The shared teleoperation trick matters if you collect demonstrations with a 3D mouse on a position-controlled UR: it avoids protective stops when the tool meets a rigid surface.

## 7. Caveats

- The paper reports a single average over six conditions (89.2%). Per-task numbers are in a figure that the text does not list, so I cannot give them.
- With 24–25 trials per condition, one trial is about 4 points. The average over six conditions is about 150 trials.
- The wiping comparison is a force-tracking result on one task; it supports the controller more than it supports the VLA.
- The authors say the method needs precise force control during demonstration collection and covers only object-level variable impedance, not finger-level gripper control.

**Carry forward:** [ForceVLA](forcevla.html) supplies the MoE fusion block this paper reuses, and [TA-VLA](ta-vla.html) also predicts a force target. [TER-DAgger](ter-dagger.html) and [FIRe](fire.html) correct a policy with a fast residual; CC-VLA instead replaces the low-level executor with an adaptive-stiffness controller.

**Check question:** Stiffness before the update is 1000 N/m, $\lambda = 2$, the force error went from 5 N to 6 N, and there is no filter. What is the new stiffness?

<details markdown="1">
<summary>Answer</summary>

$\mathrm{sign}(6 - 5) = +1$, $\alpha = 2\times 6 = 12$, so $K = 1000 - 12\times(+1) = 988$ N/m.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.05832](https://arxiv.org/abs/2609.05832) · 09/2026 · Huawei, South China University of Technology, Ola Dimensions, Hong Kong Polytechnic University · nền π0. Tiêu đề ghi CR-VLA-Force; trong bài, khung được gọi là CC-VLA (Control-aware Compliance VLA). Văn bản không có link code hay trang dự án.

**VẤN ĐỀ** Tác vụ tiếp xúc cần giữ một lực ổn định (lau với 40 N) và phản ứng nhanh, nhưng VLA chỉ chạy khoảng mỗi giây một lần.

**PAPER TRƯỚC HỎNG Ở ĐÂU** ForceVLA và TA-VLA đưa lực vào VLA nhưng vẫn xuất lệnh vị trí, nên chúng hoạt động "không có điều khiển lực tường minh hay ngầm" (lời bài báo) và không bám được một lực. Khi lau, π0 và π0.5 chạm ngưỡng dừng bảo vệ 75 N; sai số lực của ForceVLA là 35,6% so với lực được trình diễn.

**Ý TƯỞNG** VLA dự đoán một pose mong muốn và một lực mong muốn ở mỗi chunk; một bộ điều khiển 500 Hz bám theo chúng và điều chỉnh độ cứng theo sai số lực. Một token lịch sử lực và huấn luyện hai giai đoạn nuôi VLA.

**KẾT QUẢ** Thành công trung bình 89,2% trên sáu điều kiện so với 73,2% của ForceVLA, và sai số lực khi lau 5,5% so với 35,6%, trên UR5e.
</div>

## 1. Vấn đề: một chunk chỉ có pose thì không giữ được lực

[[flow]]
- Trước~π0 / π0.5 | Ảnh + câu lệnh > !Chunk pose~không có nhận biết lực! > Robot | khi lau chạm dừng bảo vệ 75 N
- Trước~ForceVLA | F/T + ảnh > !Chunk pose~lực không được bám! > Robot | 73,2% thành công, sai số lực 35,6%
+ CC-VLA | Lịch sử F/T + ảnh > *Chunk pose + lực* > *Điều khiển mềm dẻo thích nghi~500 Hz* > Robot | 89,2%, sai số lực 5,5%
[[/flow]] VLA vẫn chậm (một lần suy luận mỗi giây); chính bộ điều khiển làm phản ứng nhanh và tiếp xúc an toàn.

## 2. Kiến trúc

[[fig:cr-vla-force]] VLA xuất pose và lực mong muốn mỗi giây một lần; một lớp bất đồng bộ nội suy chúng lên 500 Hz và bộ điều khiển chỉnh độ cứng theo sai số lực.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Backbone π0 | 2 ảnh, câu lệnh | embedding ngữ cảnh | PaliGemma + action expert flow matching |
| Bộ mã hóa lịch sử lực | $F_t \in \mathbb{R}^{h \times 6}$ | một token lực | chia thành các đoạn, mỗi đoạn qua MLP, một token học được cross-attend lên chúng |
| Chuyên gia hợp nhất đa phương thức | token lực, đặc trưng thị giác-ngôn ngữ | residual cộng vào action expert | MoE thưa 4 chuyên gia, như ForceVLA |
| Chunk hành động | – | $a_t = \{p_t, g_t, f_t\}$, $H = 40$ | pose, tay kẹp và lực mong muốn |
| Bộ điều khiển mềm dẻo thích nghi | pose và lực mong muốn, lực đo được | lệnh robot ở 500 Hz | $F_{ext} = K_d(x - x_d) + D_d\dot x + F_d$ |

Trạng thái là 13 chiều: TCP pose, độ mở tay kẹp và wrench hiện tại. Độ dài lịch sử $h$ và độ dài đoạn không được nêu trong văn bản.

## 3. Tính tay: một lần cập nhật độ cứng

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Bộ điều khiển tăng độ cứng khi sai số lực đang giảm và hạ độ cứng khi sai số đang tăng, với bước tỉ lệ với sai số. Tính một lần cập nhật để thấy độ cứng nằm trong giới hạn và đổi mượt ra sao.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $K^{t-1}$ | độ cứng trước cập nhật (N/m) | input | 800 |
| $\lvert F_{err}^{k}\rvert,\ \lvert F_{err}^{k-1}\rvert$ | sai số lực hiện tại và một bước trước (N) | input | 10 và 14 |
| $\lambda$ | tham số kích thước bước | hằng số | 2 (minh họa; bài không nêu) |
| $\beta$ | trọng số lọc thông thấp | hằng số | 0,5 (minh họa) |
| $K_{min}, K_{max}$ | giới hạn độ cứng (N/m) | hằng số | 400 và 2500 (từ bài) |
| $K_d$ | độ cứng gửi cho bộ điều khiển | output | – |

**Công thức**

$$K^{t} = K^{t-1} - \alpha\,\mathrm{sign}\big(\lvert F_{err}^{k}\rvert - \lvert F_{err}^{k-1}\rvert\big),\quad \alpha = \lambda\lvert F_{err}^{k}\rvert$$

$$K_{filt} = \beta K^{t} + (1-\beta)K^{t-1},\qquad K_d = \min\big(\max(K_{filt}, K_{min}), K_{max}\big)$$

**Từng bước**

1. Sai số giảm từ 14 N xuống 10 N, nên $\mathrm{sign}(10 - 14) = -1$.
2. $\alpha = 2\times 10 = 20$.
3. $K^{t} = 800 - 20\times(-1) = 820$.
4. Lọc: $0{,}5\times 820 + 0{,}5\times 800 = 810$; nằm trong $[400, 2500]$ nên $K_d = 810$ N/m.

Trường hợp ngược lại, sai số tăng từ 10 N lên 14 N: $\alpha = 2\times 14 = 28$, $\mathrm{sign}(+4) = +1$, $K^t = 772$, sau lọc $= 786$ N/m.

**Kết quả.** Độ cứng lên 810 N/m khi sai số đang giảm và xuống 786 N/m khi sai số đang tăng.

**Ý nghĩa.** Bộ điều khiển cứng thì bám tốt nhưng lực nhảy vọt khi pose hơi sai; bộ mềm thì an toàn nhưng mất lực. Để sai số điều khiển độ cứng thì có cả hai, trong giới hạn cố định.
</div>

## 4. Kết quả

[[bars:%]] Diffusion Policy=31.3; π0.5=44.7; π0=47.3; π0 có lực trong state=60.2; ForceVLA=73.2; *CC-VLA=89.2* || Thành công trung bình trên sáu điều kiện (văn bản nêu các biến thể ấn nút, cắm phích và mở cửa sổ, gồm lệch chiều cao ngoài phân phối và xuất phát gần); lau bảng được báo cáo bằng sai số lực ở dưới. 24–25 lượt mỗi điều kiện.

| Sai số lực khi lau (thấp hơn là tốt hơn) | DP | π0 | π0.5 | π0 có lực | ForceVLA | CC-VLA |
|---|---|---|---|---|---|---|
| Cơ sở | 83,8% | không có | 76,1% | 28,1% | 35,6% | 5,5% |
| Bảng thấp hơn 6 cm (OOD) | 79,3% | 81,2% | 82,2% | 38,2% | 52,3% | 8,8% |

- Sai số lực khi lau là trung bình của $\lvert F_{ext} - F_{demo}\rvert / F_{demo}$ so với lực trình diễn 40 N. π0 và π0.5 chạm dừng bảo vệ khi trên 75 N, nên π0 không có giá trị cơ sở.
- Ablation bộ điều khiển (lau, cơ sở): không có bộ điều khiển do VLA dẫn 17,7%; độ cứng thấp cố định 7,9%; độ cứng cao cố định 13,3%; độ cứng thích nghi 5,5%.
- Ablation huấn luyện: huấn luyện hai giai đoạn tăng ấn nút thêm 12% (theo cách bài viết) và giảm ấn nhầm từ 28% xuống 8%; cắm phích đạt 76% (+8%); bộ mã hóa lịch sử lực nâng tác vụ phích cắm xuất phát gần từ 72% lên 92%.

## 5. Dữ liệu và thiết lập

| Mục | Giá trị |
|---|---|
| Robot | UR5e (điều khiển vị trí), tay kẹp kiểu UMI, camera cổ tay RealSense D435, một camera bên hông, cảm biến F/T 6 bậc tự do, điều khiển qua UR RTDE |
| Máy chủ | một máy có Intel i7-13700KF; suy luận mỗi giây một lần, horizon hành động 40, lực lấy mẫu mỗi 0,1 s, điều khiển 500 Hz |
| Demo | 50 mỗi tác vụ cho nút, cửa sổ và lau; 100 cho cắm phích |
| Số lượt thử | 24–25 mỗi điều kiện kiểm tra |
| Tác vụ | ấn nút dừng khẩn cấp, cắm phích sạc (nhiều lỗ), mở cửa sổ xoay, lau bảng trắng với lực không đổi |
| Teleoperation | teleoperation chia sẻ: một trở kháng ảo bù làm môi trường "mềm" hơn với tay game hoặc chuột 3D, nên sai số nhỏ không gây dừng bảo vệ |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Đây là bài công bố gần nhất với cánh tay UR có cảm biến F/T 6 bậc tự do: thí nghiệm dùng UR5e, UR RTDE và π0, còn UR10e cùng họ. Phần cứng là phần dễ; bài không cho code và không nêu chi tiết huấn luyện. "Không nêu" nghĩa là mình đã tìm trong toàn văn mà không thấy.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cánh tay | UR5e, điều khiển vị trí, điều khiển qua UR RTDE | UR10e là mẫu khác cùng họ; bài không thử |
| Cảm biến lực | Cảm biến F/T 6 bậc tự do; vị trí gắn không nêu | Đó có phải cảm biến tích hợp của cánh tay không: không nêu |
| Tay kẹp | Tay kẹp kiểu UMI | Tay kẹp khác: không nêu |
| Camera | Một camera cổ tay và một camera bên hông | – |
| Tính toán khi chạy | Một máy có Intel i7-13700KF chạy RTDE và bộ điều khiển; VLA chạy ở đâu không nêu | Suy luận một lần mỗi giây là chậm, nên mô hình không cần nhanh |
| Demo | 50 đến 100 mỗi tác vụ, thu bằng teleoperation chia sẻ | Bài cảnh báo việc thu dữ liệu "phụ thuộc nhiều vào điều khiển lực chính xác và nhất quán về thời gian" |
| Thiết lập bộ điều khiển | Độ cứng 400–2500 N/m, 500 Hz, giảm chấn tới hạn với tỉ số cố định | $\lambda$, $\beta$ và tỉ số giảm chấn không nêu; bạn tự chỉnh |
| Huấn luyện | Hai giai đoạn trên π0 với MoE thưa 4 chuyên gia | GPU, số bước, thời gian: không nêu |
| Code và trọng số | Văn bản mình đọc không nhắc | Bạn sẽ tự cài trên openpi cộng khối MoE của ForceVLA |

**Phần nào mang sang được.** Các tác vụ ấn nút dừng khẩn cấp và cắm phích gần với việc ấn nắp. Mẹo teleoperation chia sẻ có ý nghĩa nếu bạn thu demo bằng chuột 3D trên UR điều khiển vị trí: nó tránh dừng bảo vệ khi dụng cụ chạm bề mặt cứng.

## 7. Lưu ý

- Bài báo cáo một trung bình duy nhất trên sáu điều kiện (89,2%). Số theo từng tác vụ nằm trong một hình mà văn bản không liệt kê, nên mình không đưa được.
- Với 24–25 lượt mỗi điều kiện, một lượt là khoảng 4 điểm. Trung bình sáu điều kiện dựa trên khoảng 150 lượt.
- So sánh khi lau là kết quả bám lực trên một tác vụ; nó ủng hộ bộ điều khiển hơn là ủng hộ VLA.
- Các tác giả nói phương pháp cần điều khiển lực chính xác khi thu demo và chỉ bao quát trở kháng biến thiên ở mức vật thể, chưa phải điều khiển tay kẹp ở mức ngón.

**Mang sang bài sau:** [ForceVLA](forcevla.html) cung cấp khối MoE hợp nhất mà bài này dùng lại, và [TA-VLA](ta-vla.html) cũng dự đoán một mục tiêu lực. [TER-DAgger](ter-dagger.html) và [FIRe](fire.html) hiệu chỉnh chính sách bằng một residual nhanh; CC-VLA thay vào đó thay thế bộ thực thi mức thấp bằng một bộ điều khiển độ cứng thích nghi.

**Câu kiểm tra:** Độ cứng trước cập nhật là 1000 N/m, $\lambda = 2$, sai số lực tăng từ 5 N lên 6 N, và không có lọc. Độ cứng mới là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\mathrm{sign}(6 - 5) = +1$, $\alpha = 2\times 6 = 12$, nên $K = 1000 - 12\times(+1) = 988$ N/m.
</details>
:::
