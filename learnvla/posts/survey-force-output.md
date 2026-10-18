---
slug: survey-force-output
date: 2026-10-18
title_en: "Survey 3: What the Policy Outputs, and How It Learns"
title_vi: "Survey 3: Chính sách xuất ra gì, và học bằng cách nào"
excerpt_en: "Four output interfaces (pose only, pose plus force, pose plus stiffness, base plus residual), seven ways of learning from force, the speed gap between a VLA and a contact, and what is still missing: benchmarks and comparable numbers."
excerpt_vi: "Bốn giao diện đầu ra (chỉ pose, pose cộng lực, pose cộng độ cứng, nền cộng residual), bảy cách học từ lực, khoảng cách tốc độ giữa VLA và tiếp xúc, và những gì còn thiếu: benchmark và số liệu so sánh được."
tags: [VLA, Force, Survey, Control]
---

:::en
Last of three survey notes. [Survey 1](survey-force-map.html) maps where force enters; [Survey 2](survey-force-sensing.html) covers what is measured.

## The pain

A VLA that *reads* force perfectly can still fail if it can only *answer* with a pose. The force it applies is then decided by the low-level controller and by where the surface really is, not by the policy. So the output interface matters as much as the input.

## Four output interfaces

[[fig:survey-force-output]] Four ways a force-aware policy can talk to the robot: a pose with fixed stiffness, a pose plus a force target, a pose plus a stiffness, or a base action plus a force-driven residual.

- **(a) Pose only.** Most methods. Force improves *which* pose is chosen, but the applied force is only implied through the controller's stiffness.
- **(b) Pose + force target.** A hybrid force-position or admittance controller tracks the requested force using the measured one: ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CR-VLA-Force.
- **(c) Pose + stiffness.** The policy decides how soft to be, per axis and over time: CompVLA, CompliantVLA-adaptor.
- **(d) Base + residual.** A slow base policy proposes; a small, fast, force-aware model corrects: ForceDelta-VLA, ForceRFT, TER-DAgger, VLA-Touch, MoDE-VLA, TacPAC.

## Work it by hand: one spring, three interfaces

Model contact as a spring: an impedance controller with stiffness $K$ commanded $\Delta x$ into a surface applies $F = K\,\Delta x$. The task needs 10 N, and the policy's estimate of the surface is off by $\delta = 5$ mm.

**(a) Pose only, stiff controller,** $K = 1000$ N/m. Command $10/1000 = 10$ mm. The force error is $K\delta = 1000 \times 0.005 = 5$ N, or 50%.

**(c) Pose + low stiffness,** $K = 200$ N/m. Command $10/200 = 50$ mm. The force error drops to $200 \times 0.005 = 1$ N. The price: a 2 N disturbance in free space now moves the arm $2/200 = 10$ mm instead of $2/1000 = 2$ mm. That is why the stiffness should **change over time**: stiff while moving, soft at contact. Hence time-varying $K(t)$.

**(b) Pose + force target.** The controller measures $F$ and adjusts until it reads 10 N, so the 5 mm error no longer becomes a force error (up to sensor noise and controller tracking). The price: the robot needs a force measurement at run time, and the policy must predict a sensible $F^*$.

**(d) Residual.** The base still commands 10 mm at $K = 1000$; a residual that sees the measured 15 N (surface 5 mm closer) can back off by 5 mm between two base updates. It fixes the error only as fast as it runs, which is why these residuals run at tens of hertz.

## The speed gap

| System | Slow part | Fast part |
|---|---|---|
| [TER-DAgger](ter-dagger.html) | base policy 1 Hz | residual and error detector 50 Hz, impedance 1 kHz |
| [FWBC-VLA](fwbc-vla.html) | VLA 15 Hz | force estimator 200 Hz |
| [VLA-Touch](vla-touch.html) | VLA chunk of 64 steps | refined actions executed at up to 8 Hz |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | pretrained backbone | latent buffers read by a 100 Hz action head |

Sensors report forces at 30–300 Hz in these papers, while VLAs replan a few times per second. Every design in the "outside the VLA" column of [Survey 1](survey-force-map.html) is, at heart, a way to close this gap.

## Seven ways to learn from force

| Regime | Idea | Examples |
|---|---|---|
| Imitation fine-tuning | add force inputs, fine-tune on demonstrations | ForceVLA, ForceVLA2, MoDE-VLA, TaF-VLA, Tabero, FWBC-VLA |
| Post-training, curriculum | adapt a pretrained VLA in stages | LIFT (reactive expert + DAgger), CRAFT (force first, then full input) |
| Distillation | a teacher with force trains a student | FD-VLA, HapticVLA, ForceDelta-VLA, TaF-VLA (alignment) |
| Reward weighting, RL | force defines what is good | HapticVLA (tactile reward), TORL-VLA (online RL), ForceRFT (residual RL), MoDE-VLA (PPO hand skill) |
| Human in the loop | humans correct contact failures | TER-DAgger, LIFT, TORL-VLA, ForceRFT |
| Preference learning | rank better and worse actions | VTLA (DPO) |
| World-model pretraining | learn to predict touch first | DexTacWAM, H-Tac / TTP |

Two trends stand out: **human corrections** are becoming the main source of contact data, because contact failures are hard to script; and **credit assignment** around those corrections needs care. TORL-VLA and ForceRFT both stop value bootstrapping across human takeovers.

## What is still missing

- **Shared benchmarks.** Almost every paper builds its own tasks. Tabero is the only simulated force benchmark in this survey.
- **Comparable numbers.** ForceVLA is the most common baseline, yet it scores 54.4% in ForceDelta-VLA, 15/30 full tasks in TORL-VLA and 24% / 12% final-stage in FWBC-VLA, on different tasks and robots. These numbers cannot be compared across papers.
- **Metrics beyond success.** A task can succeed while crushing the object. Only some papers report force quality: Tabero's average and peak grip force, ForceDelta-VLA's 26% lower peak contact force.
- **Sensor diversity.** A method tuned to one wrist sensor or one gel may not transfer; TaF-VLA's cross-sensor test is a start.

## How to choose (a rough guide)

- You have a wrist F/T sensor and want a quick gain: fuse **after the VLM** with a protected path (ForceVLA-style MoE, zero-initialised bypass).
- The task is about *how hard* (press, polish, gentle grasp): output a **force target** or a **stiffness**, not only a pose.
- Contacts change fast: add a **fast residual or controller** next to the VLA.
- No sensor on the deployed robot: **distil** from a sensorised teacher, or estimate from joint torques.
- The robot keeps failing the same contact: collect **human corrections** and refine online.

## Caveats

The guide follows from the papers surveyed, not from a controlled comparison. The spring model ignores damping, friction and sensor noise; it shows the direction of each trade-off, not exact values.

**Carry forward:** the series closes here. The next notes to write are the foundations these surveys lean on: Mixture of Experts, Cross-attention, Distillation and Impedance control.

**Check question:** with a stiffness of $K = 300$ N/m, the surface estimate is off by 4 mm. What is the force error for a pose-only command, and how far into the surface must the policy command to get 6 N?

*Answer:* error $= 300 \times 0.004 = 1.2$ N. Command $= 6 / 300 = 0.02$ m = 20 mm.
:::

:::vi
Bài cuối trong ba ghi chú survey. [Survey 1](survey-force-map.html) vẽ bản đồ lực vào ở đâu; [Survey 2](survey-force-sensing.html) nói về đo cái gì.

## Vấn đề

Một VLA *đọc* lực hoàn hảo vẫn có thể thất bại nếu nó chỉ *trả lời* được bằng một pose. Khi đó lực thực sự tác dụng do bộ điều khiển mức thấp và vị trí thật của bề mặt quyết định, không phải do chính sách. Vì vậy giao diện đầu ra quan trọng ngang đầu vào.

## Bốn giao diện đầu ra

[[fig:survey-force-output]] Bốn cách một chính sách nhận biết lực nói chuyện với robot: một pose với độ cứng cố định, pose cộng lực mục tiêu, pose cộng độ cứng, hoặc hành động nền cộng một residual do lực điều khiển.

- **(a) Chỉ pose.** Đa số phương pháp. Lực giúp chọn *pose nào*, nhưng lực tác dụng chỉ được ngầm định qua độ cứng của bộ điều khiển.
- **(b) Pose + lực mục tiêu.** Bộ điều khiển lai lực-vị trí hoặc admittance bám theo lực được yêu cầu bằng lực đo được: ForceVLA2, Tabero, Tactile-VLA, Opt2VLA, CR-VLA-Force.
- **(c) Pose + độ cứng.** Chính sách quyết định mềm đến đâu, theo từng trục và theo thời gian: CompVLA, CompliantVLA-adaptor.
- **(d) Nền + residual.** Một chính sách nền chậm đề xuất; một mô hình nhỏ, nhanh, nhận biết lực hiệu chỉnh: ForceDelta-VLA, ForceRFT, TER-DAgger, VLA-Touch, MoDE-VLA, TacPAC.

## Tính tay: một lò xo, ba giao diện

Mô hình tiếp xúc như một lò xo: bộ điều khiển impedance độ cứng $K$ được ra lệnh ấn $\Delta x$ vào bề mặt sẽ tác dụng $F = K\,\Delta x$. Task cần 10 N, và ước lượng bề mặt của chính sách lệch $\delta = 5$ mm.

**(a) Chỉ pose, bộ điều khiển cứng,** $K = 1000$ N/m. Ra lệnh $10/1000 = 10$ mm. Sai số lực là $K\delta = 1000 \times 0.005 = 5$ N, tức 50%.

**(c) Pose + độ cứng thấp,** $K = 200$ N/m. Ra lệnh $10/200 = 50$ mm. Sai số lực giảm còn $200 \times 0.005 = 1$ N. Cái giá: một nhiễu 2 N khi di chuyển tự do giờ làm cánh tay lệch $2/200 = 10$ mm thay vì $2/1000 = 2$ mm. Vì vậy độ cứng nên **thay đổi theo thời gian**: cứng khi di chuyển, mềm khi tiếp xúc. Đó là lý do có $K(t)$.

**(b) Pose + lực mục tiêu.** Bộ điều khiển đo $F$ và chỉnh tới khi đọc được 10 N, nên sai số 5 mm không còn thành sai số lực (trong giới hạn nhiễu cảm biến và độ bám của bộ điều khiển). Cái giá: robot cần đo lực lúc chạy, và chính sách phải dự đoán được một $F^*$ hợp lý.

**(d) Residual.** Nền vẫn ra lệnh 10 mm ở $K = 1000$; một residual thấy lực đo được 15 N (bề mặt gần hơn 5 mm) có thể lùi lại 5 mm giữa hai lần cập nhật của nền. Nó chỉ sửa lỗi nhanh bằng tốc độ nó chạy, nên các residual này chạy ở vài chục hertz.

## Khoảng cách tốc độ

| Hệ thống | Phần chậm | Phần nhanh |
|---|---|---|
| [TER-DAgger](ter-dagger.html) | chính sách nền 1 Hz | residual và bộ phát hiện lỗi 50 Hz, impedance 1 kHz |
| [FWBC-VLA](fwbc-vla.html) | VLA 15 Hz | bộ ước lượng lực 200 Hz |
| [VLA-Touch](vla-touch.html) | chunk VLA 64 bước | hành động tinh chỉnh thực thi tối đa 8 Hz |
| [DAM-VLA](https://arxiv.org/abs/2606.12105) | backbone đã pretrain | bộ đệm latent được đầu hành động 100 Hz đọc |

Trong các bài này cảm biến báo lực ở 30–300 Hz, còn VLA chỉ lập kế hoạch lại vài lần mỗi giây. Mọi thiết kế ở cột "bên ngoài VLA" trong [Survey 1](survey-force-map.html), về bản chất, là một cách lấp khoảng cách này.

## Bảy cách học từ lực

| Cách học | Ý tưởng | Ví dụ |
|---|---|---|
| Fine-tune bắt chước | thêm đầu vào lực, fine-tune trên demo | ForceVLA, ForceVLA2, MoDE-VLA, TaF-VLA, Tabero, FWBC-VLA |
| Post-training, giáo trình | thích nghi VLA đã pretrain theo từng giai đoạn | LIFT (expert phản xạ + DAgger), CRAFT (lực trước, rồi đủ đầu vào) |
| Chưng cất | teacher có lực dạy student | FD-VLA, HapticVLA, ForceDelta-VLA, TaF-VLA (căn chỉnh) |
| Trọng số phần thưởng, RL | lực định nghĩa thế nào là tốt | HapticVLA (phần thưởng xúc giác), TORL-VLA (RL online), ForceRFT (RL residual), MoDE-VLA (kỹ năng tay PPO) |
| Có người trong vòng lặp | con người sửa lỗi tiếp xúc | TER-DAgger, LIFT, TORL-VLA, ForceRFT |
| Học theo sở thích | xếp hạng hành động tốt và kém | VTLA (DPO) |
| Pretrain world model | học dự đoán xúc giác trước | DexTacWAM, H-Tac / TTP |

Hai xu hướng nổi bật: **chỉnh sửa của con người** đang thành nguồn dữ liệu tiếp xúc chính, vì lỗi tiếp xúc khó viết kịch bản trước; và việc **ghi công** quanh những chỉnh sửa đó cần cẩn thận. TORL-VLA và ForceRFT đều ngừng bootstrap giá trị qua các lần con người tiếp quản.

## Những gì còn thiếu

- **Benchmark chung.** Gần như bài nào cũng tự dựng task. Tabero là benchmark lực mô phỏng duy nhất trong survey này.
- **Số liệu so sánh được.** ForceVLA là baseline phổ biến nhất, nhưng đạt 54,4% trong ForceDelta-VLA, 15/30 cả chuỗi trong TORL-VLA và 24% / 12% ở bước cuối trong FWBC-VLA, trên task và robot khác nhau. Các con số này không so sánh được giữa các bài.
- **Chỉ số ngoài thành công.** Một task có thể thành công trong khi làm bẹp vật. Chỉ một số bài báo cáo chất lượng lực: lực kẹp trung bình và đỉnh của Tabero, lực tiếp xúc đỉnh thấp hơn 26% của ForceDelta-VLA.
- **Đa dạng cảm biến.** Phương pháp chỉnh cho một cảm biến cổ tay hay một loại gel có thể không chuyển được sang cảm biến khác; thử nghiệm chéo cảm biến của TaF-VLA mới là bước đầu.

## Chọn thế nào (hướng dẫn sơ bộ)

- Có cảm biến F/T cổ tay và muốn cải thiện nhanh: gộp **sau VLM** với một đường được bảo vệ (MoE kiểu ForceVLA, bypass khởi tạo bằng 0).
- Task xoay quanh *mạnh hay nhẹ* (ấn, đánh bóng, nắm nhẹ): xuất **lực mục tiêu** hoặc **độ cứng**, không chỉ pose.
- Tiếp xúc thay đổi nhanh: thêm một **residual hoặc bộ điều khiển nhanh** cạnh VLA.
- Robot triển khai không có cảm biến: **chưng cất** từ teacher có cảm biến, hoặc ước lượng từ mô men khớp.
- Robot cứ hỏng ở cùng một tiếp xúc: thu **chỉnh sửa của con người** và tinh chỉnh online.

## Lưu ý

Hướng dẫn rút ra từ các bài trong survey, không phải từ một so sánh có kiểm soát. Mô hình lò xo bỏ qua giảm chấn, ma sát và nhiễu cảm biến; nó cho thấy hướng của từng đánh đổi, không cho giá trị chính xác.

**Mang theo sang bài sau:** series khép lại ở đây. Các ghi chú nên viết tiếp là những nền tảng mà các survey này dựa vào: Mixture of Experts, Cross-attention, Distillation và điều khiển Impedance.

**Câu kiểm tra:** với độ cứng $K = 300$ N/m, ước lượng bề mặt lệch 4 mm. Sai số lực của lệnh chỉ-pose là bao nhiêu, và chính sách phải ra lệnh ấn sâu bao nhiêu để được 6 N?

*Đáp án:* sai số $= 300 \times 0.004 = 1.2$ N. Lệnh $= 6 / 300 = 0.02$ m = 20 mm.
:::
