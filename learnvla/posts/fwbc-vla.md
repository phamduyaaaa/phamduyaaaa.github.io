---
slug: fwbc-vla
date: 2026-10-18
title_en: "FWBC-VLA: Force-aware Whole-Body Compensation for Loco-Manipulation"
title_vi: "FWBC-VLA: Bù trừ toàn thân có nhận biết lực cho loco-manipulation"
excerpt_en: "A wheeled-legged robot that pushes a door feels the reaction in its whole body. FWBC-VLA estimates contact force without a sensor, feeds it to the VLA, and also uses it to correct the base command."
excerpt_vi: "Robot bánh-chân đẩy cửa sẽ chịu phản lực lên cả thân. FWBC-VLA ước lượng lực tiếp xúc không cần cảm biến, đưa vào VLA, đồng thời dùng nó để hiệu chỉnh lệnh cho phần thân."
tags: [VLA, Force, Loco-manipulation, Paper Notes, π0.5]
---

:::en
Paper: [arXiv 2609.03889](https://arxiv.org/abs/2609.03889) (September 2026).

## The pain it cures

Arm-centric force VLAs ([ForceVLA](forcevla.html) and friends) correct the **arm** only. On a wheeled-legged robot with an arm, wiping a whiteboard or opening a spring-closed door also pushes the **base**; a VLA that ignores this loses balance or drifts. FWBC-VLA builds **dual feedback loops** from one sensorless force estimate: one into the VLA's task actions, one into a body-compensation command for the whole-body controller (WBC).

## Architecture

[[fig:fwbc-vla]] One 200 Hz sensorless estimator feeds two branches: force tokens for the 15 Hz VLA, and a Jacobian-derived body load for a small compensation network; the corrected base command goes to the WBC.

1. **HSR-Force (200 Hz).** Two compact experts, a *history* expert (causal torque and motion history) and a *state* expert (current arm, base, leg and IMU state), each predict the free-motion torque. A gate $\alpha_t = G(\lVert r_{state}\rVert)$ blends them: $\hat\tau_{free} = (1-\alpha_t)\hat\tau_{hist} + \alpha_t\hat\tau_{state}$. The external-torque estimate is $\hat\tau_{ext} = \tau_{meas} - \hat\tau_{free}$.
2. **Contact descriptor.** $d_t = [s_t, \Delta s_t]$ with $s_t = \lVert\hat\tau_{ext}\rVert_2$. The last $K=13$ descriptors (60 ms) pass a normalisation layer and a **GRU** to produce force tokens $Z^{force}$ (width 1024).
3. **Force-conditioned VLA (15 Hz).** The backbone is π0.5, fully fine-tuned. Force enters the Gemma action expert by cross-attention on its final hidden states: $\tilde Z^{act} = Z^{act} + \alpha_f\, g_t\, \text{CA}(Z^{act}, Z^{force})$, with a learned force-presence gate $g_t$. It is **not** propagated through the visual backbone.
4. **Body compensation.** A damped-least-squares Jacobian maps $\hat\tau_{ext}$ to wrenches at the end-effector and body frames. A small MLP $C_\psi$ takes the body-frame load $\hat F_{body}$, IMU orientation deviation and the nominal base command and predicts a residual $\bar r$ (for $\Delta v_x, \Delta v_y, \Delta\omega_z$). It is bounded, $r = r_{max}\tanh(\bar r)$, and added: $u_{base} = u_{nom} + r$, then deadband, low-pass, slew limits and clipping. A stale estimate or invalid IMU sets the residual to zero.
5. **WBC policy** keeps balance and tracks the combined command.

## Training and data

- The **WL&Arm dataset**: more than 5,000 teleoperation episodes with a Pico hybrid position-force teleoperation system, 200 Hz joint data and 15 Hz demonstrations (bottle pick-and-place 41%, whiteboard wiping 25%, door opening 21%).
- Estimator experts are fitted on free-motion windows where $\tau_{ext} \approx 0$. $C_\psi$ is trained with an $\ell_1$ loss on the demonstrated residual. No contact-classification or phase-prediction auxiliary losses.

## Results

25 trials per task; whiteboard wiping final-stage success: **FWBC-VLA 64%**, ForceVLA 24%, ACP 20%, OpenPI 0.5 12%. Door opening final stage: **52%** against ForceVLA 12% and OpenPI 0.5 0%. In the component ablation, no force gives 12.0% average contact-stage success, force input only 35.0%, the full method 65%. The estimator reaches 0.15 N force MAE with no load.

## Caveats

The action-chunk length, the WBC internals and rates of the WBC and compensation path are not stated. The paper describes base outputs as velocity and steering angle in one place and as $(\Delta v_x,\Delta v_y,\Delta\omega_z)$ residuals in another. The intro says "dual LSTM" while Sec. 4 only describes two "compact experts".
:::

:::vi
Bài báo: [arXiv 2609.03889](https://arxiv.org/abs/2609.03889) (tháng 9/2026).

## Vấn đề cần chữa

Các VLA lực lấy cánh tay làm trung tâm ([ForceVLA](forcevla.html) và các bài tương tự) chỉ hiệu chỉnh **cánh tay**. Trên robot bánh-chân có tay, lau bảng hay mở cửa có lò xo đóng cũng đẩy lên **thân**; VLA bỏ qua điều này sẽ mất thăng bằng hoặc trôi. FWBC-VLA xây **hai vòng phản hồi** từ một ước lượng lực không cần cảm biến: một vào hành động tác vụ của VLA, một vào lệnh bù cho bộ điều khiển toàn thân (WBC).

## Kiến trúc

[[fig:fwbc-vla]] Một bộ ước lượng 200 Hz không cảm biến cấp cho hai nhánh: token lực cho VLA 15 Hz, và tải thân suy ra từ Jacobian cho một mạng bù nhỏ; lệnh thân đã hiệu chỉnh đi vào WBC.

1. **HSR-Force (200 Hz).** Hai expert gọn, expert *lịch sử* (lịch sử mô men và chuyển động nhân quả) và expert *trạng thái* (trạng thái tay, thân, chân và IMU hiện tại), mỗi cái dự đoán mô men chuyển động tự do. Một gate $\alpha_t = G(\lVert r_{state}\rVert)$ trộn chúng: $\hat\tau_{free} = (1-\alpha_t)\hat\tau_{hist} + \alpha_t\hat\tau_{state}$. Ước lượng mô men ngoài là $\hat\tau_{ext} = \tau_{meas} - \hat\tau_{free}$.
2. **Mô tả tiếp xúc.** $d_t = [s_t, \Delta s_t]$ với $s_t = \lVert\hat\tau_{ext}\rVert_2$. $K=13$ mô tả gần nhất (60 ms) qua lớp chuẩn hóa và một **GRU** để tạo token lực $Z^{force}$ (độ rộng 1024).
3. **VLA điều kiện theo lực (15 Hz).** Backbone là π0.5, fine-tune toàn bộ. Lực vào action expert Gemma bằng cross-attention trên hidden state cuối: $\tilde Z^{act} = Z^{act} + \alpha_f\, g_t\, \text{CA}(Z^{act}, Z^{force})$, với gate "có lực" $g_t$ học được. Lực **không** được lan truyền qua backbone thị giác.
4. **Bù thân.** Jacobian bình phương tối thiểu có giảm chấn ánh xạ $\hat\tau_{ext}$ sang wrench ở khung end-effector và khung thân. Một MLP nhỏ $C_\psi$ nhận tải khung thân $\hat F_{body}$, độ lệch hướng IMU và lệnh thân danh định, dự đoán phần dư $\bar r$ (cho $\Delta v_x, \Delta v_y, \Delta\omega_z$). Phần dư bị chặn, $r = r_{max}\tanh(\bar r)$, rồi cộng vào: $u_{base} = u_{nom} + r$, sau đó qua vùng chết, lọc thông thấp, giới hạn tốc độ thay đổi và cắt biên. Ước lượng cũ hoặc IMU không hợp lệ sẽ đặt phần dư bằng 0.
5. **WBC policy** giữ thăng bằng và bám theo lệnh đã gộp.

## Huấn luyện và dữ liệu

- Bộ **WL&Arm**: hơn 5.000 episode teleoperation bằng hệ Pico lai vị trí-lực, dữ liệu khớp 200 Hz và demo 15 Hz (nhặt-thả chai 41%, lau bảng 25%, mở cửa 21%).
- Các expert ước lượng được fit trên cửa sổ chuyển động tự do nơi $\tau_{ext} \approx 0$. $C_\psi$ được huấn luyện bằng loss $\ell_1$ trên phần dư của demo. Không có loss phụ phân loại tiếp xúc hay dự đoán pha.

## Kết quả

25 lượt mỗi task; thành công ở bước cuối khi lau bảng: **FWBC-VLA 64%**, ForceVLA 24%, ACP 20%, OpenPI 0.5 12%. Mở cửa, bước cuối: **52%** so với ForceVLA 12% và OpenPI 0.5 0%. Trong ablation thành phần, không dùng lực cho 12,0% thành công trung bình ở các bước tiếp xúc, chỉ đưa lực vào VLA 35,0%, phương pháp đầy đủ 65%. Bộ ước lượng đạt sai số tuyệt đối trung bình 0,15 N khi không tải.

## Lưu ý

Độ dài action chunk, nội bộ WBC và tần số của WBC và đường bù không được nêu. Bài mô tả đầu ra thân là vận tốc và góc lái ở một chỗ, và là phần dư $(\Delta v_x,\Delta v_y,\Delta\omega_z)$ ở chỗ khác. Phần mở đầu nói "dual LSTM" trong khi Sec. 4 chỉ mô tả hai "expert gọn".
:::
