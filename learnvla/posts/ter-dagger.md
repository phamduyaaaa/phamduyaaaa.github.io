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
:::

:::vi
Bài báo: [arXiv 2603.04038](https://arxiv.org/abs/2603.04038), *Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control*; abstract đặt tên phương pháp là **Trajectory Editing Residual Dataset Aggregation (TER-DAgger)**. Bản thân nó không phải VLA: chính sách nền là transformer kiểu ACT. Nó nằm trong series này vì cho thấy **sai số dự đoán lực** có thể kích hoạt và định hình các chỉnh sửa của con người ra sao.

## Vấn đề cần chữa

Phích USB có dung sai khoảng 0,1 mm. Chính sách nền chậm (1 Hz) thường rơi lệch vài milimét. DAgger thông thường nhờ con người chỉnh, nhưng bản chỉnh ghi lúc đang thất bại chứa cả sự do dự và trôi của lượt chạy lỗi, và khó chỉ cho học viên chỗ thất bại bắt đầu. TER-DAgger sửa ba thứ: **khi nào** hỏi (bộ phát hiện sai số lực), **ghi gì** (quỹ đạo đã chỉnh sửa, sạch) và **áp dụng thế nào** (chính sách residual nhanh dưới điều khiển impedance).

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
:::
