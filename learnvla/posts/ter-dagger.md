---
slug: ter-dagger
date: 2026-10-18
title_en: "TER-DAgger: Trajectory-Editing Residual DAgger for Precision Insertion"
title_vi: "TER-DAgger: Residual DAgger với chỉnh sửa quỹ đạo cho lắp ghép chính xác"
excerpt_en: "When force prediction disagrees with measurement, the robot pauses and a human corrects it. TER-DAgger edits the failed trajectory into a clean correction and trains a 50 Hz residual policy on it."
excerpt_vi: "Khi lực dự đoán lệch lực đo, robot dừng và con người chỉnh. TER-DAgger chỉnh sửa quỹ đạo thất bại thành một bản hiệu chỉnh sạch rồi huấn luyện chính sách residual 50 Hz trên đó."
tags: [VLA, Force, DAgger, Imitation Learning, Paper Notes]
---

:::en
Paper: [arXiv 2603.04038](https://arxiv.org/abs/2603.04038), *Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control*; the abstract names the method **Trajectory Editing Residual Dataset Aggregation (TER-DAgger)**. It is not a VLA itself: the base policy is an ACT-style transformer. It belongs in this series because it shows how **force prediction error** can trigger and shape human corrections.

## The pain it cures

A USB plug has about 0.1 mm of tolerance. A slow base policy (1 Hz) will often land a few millimetres off. Ordinary DAgger asks a human for corrections, but a correction recorded during a failure contains the hesitation and drift of the failing rollout, and it is hard to tell the learner where the failure begins. TER-DAgger fixes three things: **when** to ask (a force-error detector), **what** to record (an edited, clean trajectory) and **how** to apply it (a fast residual policy under impedance control).

## Try the naive way first

Classic human-in-the-loop DAgger (HG-DAgger): a person watches and takes over whenever things look wrong, and the corrections are added to the data. Two weak points:

1. **When to intervene** is left to human attention, which is late and inconsistent for sub-millimetre insertion.
2. **What gets recorded** is a raw takeover, including the hesitation and drift of the failing rollout, and nothing says where the base policy actually went wrong.

The paper compares against HG-DAgger, retraining on a combined dataset, and fine-tuning; the abstract reports an average improvement of over 37% over these baselines.

## Work it by hand

**The error detector.** The base policy predicted $\hat F = (0,\ 0,\ -5,\ 0,\ 0,\ 0)$ and the sensor reads $F = (0.5,\ 0,\ -9,\ 0,\ 0,\ 0.1)$:

$$e_t = \lVert \hat F - F \rVert_1 = 0.5 + 0 + 4 + 0 + 0 + 0.1 = 4.6$$

With an illustrative threshold $c = 3$, $e_t > c$: pause and call the human. The plug is hitting the socket 4 N harder than the policy expected, a contact the camera may not show.

**Where to splice the correction.** Two candidate points on the base trajectory, $D = \omega_p d_p + \omega_q d_q$ with $\omega_p = 1.0$, $\omega_q = 0.5$:

- $k_1$: $d_p = 0.010$ m, $d_q = 0.02$ rad, so $D = 0.010 + 0.010 = 0.020$
- $k_2$: $d_p = 0.004$ m, $d_q = 0.05$ rad, so $D = 0.004 + 0.025 = 0.029$

$k^* = k_1$, although $k_2$ is closer in position: its orientation is too far off. The weights decide how metres trade against radians.

**A residual label.** During the human segment the base policy wanted $x = 0.300$ m and the human went to $0.296$ m, so $\Delta A = 0.296 - 0.300 = -0.004$ m. Before the edit the label is $0$: the residual learns to stay silent where the base was fine.

## Architecture

[[fig:ter-dagger]] A 1 Hz base policy proposes actions, a 50 Hz residual policy adds a correction, a 1 kHz impedance controller executes. A force-error detector triggers human correction, and trajectory editing turns it into residual training data.

- **Base policy (1 Hz).** ACT-style CVAE transformer. Inputs: pose $x_t = [p_t, q_t]$, force $F_t = [f_x,f_y,f_z,\tau_x,\tau_y,\tau_z]$ (estimated from joint torques) and two 480×640 RGB images through ResNet-18. It predicts **future actions and future forces** jointly, with horizon $n=100$ steps (2 s), executing the first 50 before replanning.
- **Error detector (50 Hz).** $e_t = \lVert\hat F_t - F_t\rVert_1$, comparing the base policy's predicted force with the measured force. If $e_t > c$ (a threshold), execution pauses.
- **Human correction.** The Cartesian impedance stiffness is set to zero and a short corrective insertion demonstration is recorded (in real experiments the end-effector starts about 8 cm above the target).
- **Trajectory editing.** Find the base-trajectory point nearest to the start of the human demonstration, $k^* = \arg\min_k D(k)$ with $D = \omega_p d_p + \omega_q d_q$ ($\omega_p=1.0$, $\omega_q=0.5$). Replace a local segment by an optimised one that minimises fidelity + smoothness + endpoint cost ($\lambda_s = 1$, $\lambda_e = 1000$) while being pinned to the human start pose. The output $X_{correct}$ is a smooth path joining the base trajectory to the human insertion.
- **Residual labels in four regions.** Before the edit the residual is 0; in the transition it is the edited pose minus the base action; in the human demo it is the human pose minus the base action; after the edit it is the nearest human pose minus the base action.
- **Residual policy (50 Hz).** A two-layer transformer encoder (hidden size 256, 8 heads); inputs: current pose, the base action $\hat A_{t+1}$ and two images through a shared ResNet-18; output $\Delta A_{t+1}$. Executed action: $A^{exec} = \hat A + \Delta A$.
- **Impedance controller (1 kHz).** $F_{imp} = K(x_d - x) + D(\dot x_d - \dot x)$ with gravity compensation.

## Training and setup

Base: 100 demonstrations, 2000 epochs. Residual: 50 corrective demonstrations, 200 epochs. Simulation: MuJoCo, Franka Research 3, USB and two-pin plugs, socket offset in $[-5, 5]$ cm. Real: Franka with a wrist RealSense D415 and a fixed front camera; USB, two-pin and three-pin plugs. Baselines: ACT, FILIC, HG-DAgger, Retrain (one combined dataset) and Finetune. 50 trials per task.

## Results

The abstract reports an average improvement of **over 37%** over the baselines. The paper's tables (which I read only through a summary, so verify them) report TER-DAgger around 77% average, a force-error detector with about 98.8% precision and 100% recall, and an optimisation window of 20 points working best.

## Caveats

The aggregation loop itself (when the dataset is merged and models retrained) is not described step by step, and the physical interface used by the human is not stated. The figure caption says the edited segment has $N-1$ preceding points while the equation uses $N+1$ indices. Stiffness values $K$, $D$ and the optimiser used for editing are not given.
**Carry forward:** this closes the force series. Across the eleven papers, force enters at five places:

- **into the VLM input:** ForceVLA2 (force prompt), FD-VLA (predicted force token)
- **between the VLM and the action expert:** ForceVLA, MoDE-VLA, TORL-VLA
- **inside the action expert:** TaF-VLA, FWBC-VLA
- **outside the VLA, in a refiner or a controller:** VLA-Touch, Tabero, TER-DAgger, FWBC-VLA's body compensation
- **only at training time:** FD-VLA, HapticVLA

A planned comparison post will put them side by side.

**Check question:** $\hat F = (0,\ 0,\ -4,\ 0,\ 0,\ 0)$, $F = (0.2,\ -0.3,\ -5,\ 0.1,\ 0,\ 0)$, $c = 3$. Does the detector fire? And what is $D$ for $d_p = 0.006$ m, $d_q = 0.01$ rad?

*Answer:* $e_t = 0.2 + 0.3 + 1 + 0.1 = 1.6 < 3$: no pause. $D = 0.006 + 0.5 \times 0.01 = 0.011$.
:::

:::vi
Bài báo: [arXiv 2603.04038](https://arxiv.org/abs/2603.04038), *Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control*; abstract đặt tên phương pháp là **Trajectory Editing Residual Dataset Aggregation (TER-DAgger)**. Bản thân nó không phải VLA: chính sách nền là transformer kiểu ACT. Nó nằm trong series này vì cho thấy **sai số dự đoán lực** có thể kích hoạt và định hình các chỉnh sửa của con người ra sao.

## Vấn đề cần chữa

Phích USB có dung sai khoảng 0,1 mm. Chính sách nền chậm (1 Hz) thường rơi lệch vài milimét. DAgger thông thường nhờ con người chỉnh, nhưng bản chỉnh ghi lúc đang thất bại chứa cả sự do dự và trôi của lượt chạy lỗi, và khó chỉ cho học viên chỗ thất bại bắt đầu. TER-DAgger sửa ba thứ: **khi nào** hỏi (bộ phát hiện sai số lực), **ghi gì** (quỹ đạo đã chỉnh sửa, sạch) và **áp dụng thế nào** (chính sách residual nhanh dưới điều khiển impedance).

## Thử cách ngây thơ trước

DAgger cổ điển có người trong vòng lặp (HG-DAgger): một người quan sát và tiếp quản bất cứ khi nào thấy không ổn, rồi các bản sửa được thêm vào dữ liệu. Hai điểm yếu:

1. **Khi nào can thiệp** phụ thuộc vào sự chú ý của con người, vốn chậm và không đều với thao tác lắp dưới một milimét.
2. **Thứ được ghi lại** là một lần tiếp quản thô, gồm cả sự do dự và trôi của lượt chạy lỗi, và không có gì chỉ ra chính sách nền thực sự sai ở đâu.

Bài so sánh với HG-DAgger, huấn luyện lại trên bộ dữ liệu gộp, và fine-tune; abstract nêu mức cải thiện trung bình hơn 37% so với các baseline này.

## Tính tay

**Bộ phát hiện lỗi.** Chính sách nền dự đoán $\hat F = (0,\ 0,\ -5,\ 0,\ 0,\ 0)$ còn cảm biến đọc $F = (0.5,\ 0,\ -9,\ 0,\ 0,\ 0.1)$:

$$e_t = \lVert \hat F - F \rVert_1 = 0.5 + 0 + 4 + 0 + 0 + 0.1 = 4.6$$

Với ngưỡng minh họa $c = 3$, $e_t > c$: tạm dừng và gọi con người. Phích đang tì vào ổ mạnh hơn 4 N so với chính sách dự kiến, một tiếp xúc mà camera có thể không thấy.

**Nối bản sửa vào đâu.** Hai điểm ứng viên trên quỹ đạo nền, $D = \omega_p d_p + \omega_q d_q$ với $\omega_p = 1.0$, $\omega_q = 0.5$:

- $k_1$: $d_p = 0.010$ m, $d_q = 0.02$ rad, nên $D = 0.010 + 0.010 = 0.020$
- $k_2$: $d_p = 0.004$ m, $d_q = 0.05$ rad, nên $D = 0.004 + 0.025 = 0.029$

$k^* = k_1$, dù $k_2$ gần hơn về vị trí: hướng của nó lệch quá nhiều. Các trọng số quyết định mét được đổi lấy radian theo tỉ lệ nào.

**Một nhãn residual.** Trong đoạn con người điều khiển, chính sách nền muốn $x = 0.300$ m còn con người đi tới $0.296$ m, nên $\Delta A = 0.296 - 0.300 = -0.004$ m. Trước chỗ chỉnh, nhãn là $0$: residual học cách im lặng ở nơi chính sách nền đã ổn.

## Kiến trúc

[[fig:ter-dagger]] Chính sách nền 1 Hz đề xuất hành động, chính sách residual 50 Hz cộng hiệu chỉnh, bộ điều khiển impedance 1 kHz thực thi. Bộ phát hiện sai số lực kích hoạt chỉnh sửa của con người, và chỉnh sửa quỹ đạo biến nó thành dữ liệu huấn luyện residual.

- **Chính sách nền (1 Hz).** Transformer CVAE kiểu ACT. Đầu vào: pose $x_t = [p_t, q_t]$, lực $F_t = [f_x,f_y,f_z,\tau_x,\tau_y,\tau_z]$ (ước lượng từ mô men khớp) và hai ảnh RGB 480×640 qua ResNet-18. Nó dự đoán đồng thời **hành động và lực tương lai**, horizon $n=100$ bước (2 s), chạy 50 bước đầu rồi lập kế hoạch lại.
- **Bộ phát hiện lỗi (50 Hz).** $e_t = \lVert\hat F_t - F_t\rVert_1$, so lực dự đoán của chính sách nền với lực đo. Nếu $e_t > c$ (ngưỡng), việc thực thi tạm dừng.
- **Con người chỉnh sửa.** Độ cứng impedance Descartes đặt về 0 và ghi một demo chèn hiệu chỉnh ngắn (thí nghiệm thật bắt đầu với end-effector cách mục tiêu khoảng 8 cm).
- **Chỉnh sửa quỹ đạo.** Tìm điểm trên quỹ đạo nền gần nhất với điểm bắt đầu demo của con người, $k^* = \arg\min_k D(k)$ với $D = \omega_p d_p + \omega_q d_q$ ($\omega_p=1{,}0$, $\omega_q=0{,}5$). Thay một đoạn cục bộ bằng đoạn được tối ưu giảm thiểu chi phí trung thực + mượt + điểm cuối ($\lambda_s = 1$, $\lambda_e = 1000$) trong khi bị ghim vào pose bắt đầu của con người. Đầu ra $X_{correct}$ là đường mượt nối quỹ đạo nền với đoạn chèn của con người.
- **Nhãn residual ở bốn vùng.** Trước chỗ chỉnh, residual bằng 0; ở đoạn chuyển tiếp là pose đã chỉnh trừ hành động nền; ở demo con người là pose con người trừ hành động nền; sau chỗ chỉnh là pose con người gần nhất trừ hành động nền.
- **Chính sách residual (50 Hz).** Transformer encoder hai lớp (ẩn 256, 8 head); đầu vào: pose hiện tại, hành động nền $\hat A_{t+1}$ và hai ảnh qua ResNet-18 dùng chung; đầu ra $\Delta A_{t+1}$. Hành động thực thi: $A^{exec} = \hat A + \Delta A$.
- **Bộ điều khiển impedance (1 kHz).** $F_{imp} = K(x_d - x) + D(\dot x_d - \dot x)$ có bù trọng lực.

## Huấn luyện và thiết lập

Nền: 100 demo, 2000 epoch. Residual: 50 demo hiệu chỉnh, 200 epoch. Mô phỏng: MuJoCo, Franka Research 3, phích USB và phích hai chấu, độ lệch ổ cắm trong $[-5, 5]$ cm. Thật: Franka với RealSense D415 cổ tay và camera cố định phía trước; phích USB, hai chấu và ba chấu. Baseline: ACT, FILIC, HG-DAgger, Retrain (một bộ dữ liệu gộp) và Finetune. 50 lượt mỗi task.

## Kết quả

Abstract nêu mức cải thiện trung bình **hơn 37%** so với các baseline. Các bảng trong bài (tôi chỉ đọc qua bản tóm tắt nên cần kiểm tra lại) cho TER-DAgger khoảng 77% trung bình, bộ phát hiện sai số lực có độ chính xác khoảng 98,8% và recall 100%, và cửa sổ tối ưu 20 điểm là tốt nhất.

## Lưu ý

Bản thân vòng tổng hợp dữ liệu (khi nào gộp dataset và huấn luyện lại) không được mô tả từng bước, và giao diện vật lý con người dùng để chỉnh không được nêu. Chú thích hình nói đoạn được chỉnh có $N-1$ điểm đứng trước còn công thức dùng $N+1$ chỉ số. Giá trị độ cứng $K$, $D$ và bộ tối ưu dùng khi chỉnh sửa không được nêu.

**Mang theo sang bài sau:** bài này khép lại series lực. Qua mười một bài, lực được đưa vào ở năm chỗ:

- **vào đầu vào VLM:** ForceVLA2 (force prompt), FD-VLA (token lực dự đoán)
- **giữa VLM và action expert:** ForceVLA, MoDE-VLA, TORL-VLA
- **bên trong action expert:** TaF-VLA, FWBC-VLA
- **bên ngoài VLA, trong bộ tinh chỉnh hoặc bộ điều khiển:** VLA-Touch, Tabero, TER-DAgger, phần bù thân của FWBC-VLA
- **chỉ lúc huấn luyện:** FD-VLA, HapticVLA

Một bài so sánh sắp tới sẽ đặt chúng cạnh nhau.

**Câu kiểm tra:** $\hat F = (0,\ 0,\ -4,\ 0,\ 0,\ 0)$, $F = (0.2,\ -0.3,\ -5,\ 0.1,\ 0,\ 0)$, $c = 3$. Bộ phát hiện có kích hoạt không? Và $D$ bằng bao nhiêu với $d_p = 0.006$ m, $d_q = 0.01$ rad?

*Đáp án:* $e_t = 0.2 + 0.3 + 1 + 0.1 = 1.6 < 3$: không dừng. $D = 0.006 + 0.5 \times 0.01 = 0.011$.
:::
