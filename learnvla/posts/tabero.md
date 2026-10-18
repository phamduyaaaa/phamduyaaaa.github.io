---
slug: tabero
date: 2026-10-18
title_en: "Tabero: Gentle Manipulation with Closed-Loop Force Feedback"
title_vi: "Tabero: Thao tác nhẹ tay với phản hồi lực vòng kín"
excerpt_en: "Tabero replays LIBERO in a tactile simulator to get vision, touch and force data, and Tabero-VTLA predicts pose plus force setpoints that a fixed hybrid controller tracks, so 'gently' actually means less force."
excerpt_vi: "Tabero phát lại LIBERO trong mô phỏng xúc giác để có dữ liệu thị giác, xúc giác, lực; Tabero-VTLA dự đoán pose và lực mục tiêu cho bộ điều khiển lai cố định bám theo, nhờ đó 'nhẹ tay' thực sự là lực nhỏ hơn."
tags: [VLA, Force, Tactile, Benchmark, Paper Notes, π0]
---

:::en
Paper: [arXiv 2605.27886](https://arxiv.org/abs/2605.27886) (ICML 2026), code at [NathanWu7/Tabero](https://github.com/NathanWu7/Tabero). It is both a **benchmark/data pipeline** and a **model**.

## The pain it cures

A VLA told to "pick up the egg gently" has no way to make the gripper squeeze less: it never saw force, and an open-loop position command cannot hold a target force. Tabero attacks both ends: it creates force-aware data cheaply, and it gives the policy a force-position command interface that a low-level loop can actually track.

## Try the naive way first

Add "gently" to the instruction of a position-only policy. The gripper still closes to the commanded width, so the squeeze depends on the object, not on the word. Table 3 of the paper shows the result on Dataset B: a model with no tactile or force input scores 0.00 success on both firm and gentle runs, and models that get tactile tokens but no force supervision reach 0.37–0.40 when told to be firm and only 0.01 when told to be gentle.

## Work it by hand: two forces from two fingertips

Use one common gripper frame where $z$ is the closing axis and $y$ points up. The left fingertip measures $F_L = (0,\ 1.5,\ 5)$ N, the right $F_R = (0,\ 1.5,\ -5)$ N.

$$F_{grip} = 2\min(|5|,\ |{-5}|) = 10\ \text{N}$$

$$F_{applied} = -(F_L + F_R) = -(0,\ 3,\ 0) = (0,\ -3,\ 0)\ \text{N}$$

The two squeezing components cancel in $F_{applied}$, leaving a net 3 N downward push on the object; the squeeze appears only in $F_{grip}$. That is what "decoupled" means: the policy can ask for a gentle squeeze and a firm press at the same time. Taking the **minimum** finger makes $F_{grip}$ follow the weaker contact: if one finger read 5 N and the other 3 N, $F_{grip} = 6$ N.

The grip loop then boosts the policy's request by a feedforward gain. With the paper's $k_{ff} = 0.6$, a predicted grip of 5 N becomes a target of $(1 + 0.6) \times 5 = 8$ N.

## The benchmark pipeline

Take open-source trajectories made for another simulator (LIBERO tasks, originally MuJoCo) and **replay** them in Isaac Lab with a simulated GelSight gripper (320×240 image, 11×9 marker grid; Taxim for tactile images, FOTS for the marker field, physics-engine ground-truth contact force), sampled at 20 Hz. Force diversity comes from impedance gains for 100%, 25% and 10% force levels, and the paired instruction uses adverbs ("firmly", "gently"). Evaluation scores physical interaction quality as well as success: SR, mean grip force AG, peak grip force MG, and the matching applied-force metrics.

## Architecture (Tabero-VTLA)

[[fig:tabero]] Vision, language, marker-field and force tokens enter a LoRA-tuned π0; it predicts pose and force setpoints; a fixed hybrid controller tracks them and feeds measured force back.

- **Touch tokens.** The marker displacement field (a history of 8 frames plus the undeformed layout) goes through a small causal TCN, the Force-Field Tokenizer. Alternatively, left/right tactile frames are arranged into one image and sent through the vision encoder (the "Img" variant).
- **Force token.** The 6D force from both fingers goes through an MLP.
- **Backbone.** π0 (JAX) with LoRA, flow matching. Tactile tokens go to the prefix (or the suffix in one variant). An optional force-supervision loss (weight 0.1) predicts force.
- **Decoupled command interface.** The policy outputs a pose $P^{pred} \in SE(3)$, an applied-force target and a grip-force prediction with gripper width. The two forces are defined from fingertip forces: $F_{grip} = 2\min(|F_{L,z}|, |F_{R,z}|)$ and $F_{applied} = -(F_L + F_R)$.
- **Fixed hybrid controller.** Applied-force loop (admittance): $p_{cmd} = p_{pred} + K\,(F^{target} - F^{meas})$, followed by differential IK. Grip loop: a feedforward $F^{target}_{grip} = (1+k_{ff})F^{pred}_{grip}$, exponential smoothing, a deadzone and clipping on the gripper width.

## Results

- Training: 50,000 steps, batch 32, peak learning rate $2.5\times10^{-5}$ with cosine decay.
- On Dataset B (10% gentle force) the best model, Field+FS, keeps 0.86 success when told to be firm and 0.52 when told to be gentle, while the average grip force falls from 32.4 to 3.7 (an 88.6% cut). On Dataset A (25%) the cut is 72.8%.
- Models without force supervision collapse under the gentle instruction (success about 0.01).
- Both the feedforward term and the admittance loop are needed for accurate force tracking (ablation).

## Caveats

The visual encoder, the language encoder, the policy and controller rates and the action-chunk length are not stated. The text says the force input is 6D while Table 7 lists an MLP input of $8\times 6 = 48$. The authors note the framework does not jointly optimise task success and minimal force.
**Carry forward:** every method so far needs a tactile or force sensor at run time. [FD-VLA](fd-vla.html) asks whether the force can be inferred from vision and arm state instead.

**Check question:** in the same frame, $F_L = (0,\ 1,\ 4)$ N and $F_R = (0,\ 2,\ -6)$ N. Compute $F_{grip}$ and $F_{applied}$. What target does the grip loop use if the policy predicts 10 N?

*Answer:* $F_{grip} = 2\min(4, 6) = 8$ N. $F_{applied} = -(0,\ 3,\ -2) = (0,\ -3,\ 2)$ N: 3 N down, plus 2 N along the closing axis because the fingers do not squeeze evenly. Target $= 1.6 \times 10 = 16$ N.
:::

:::vi
Bài báo: [arXiv 2605.27886](https://arxiv.org/abs/2605.27886) (ICML 2026), code tại [NathanWu7/Tabero](https://github.com/NathanWu7/Tabero). Đây vừa là **benchmark/pipeline dữ liệu** vừa là **mô hình**.

## Vấn đề cần chữa

Một VLA được bảo "nhặt quả trứng nhẹ tay" không có cách nào làm kẹp siết nhẹ hơn: nó chưa từng thấy lực, và lệnh vị trí vòng hở không giữ được lực mục tiêu. Tabero xử lý cả hai đầu: tạo dữ liệu có lực với chi phí thấp, và cho chính sách một giao diện lệnh lực-vị trí mà vòng điều khiển thấp có thể bám theo thật.

## Thử cách ngây thơ trước

Thêm chữ "gently" vào câu lệnh của một chính sách chỉ điều khiển vị trí. Kẹp vẫn đóng tới độ mở được ra lệnh, nên lực siết phụ thuộc vào vật chứ không phụ thuộc vào chữ. Bảng 3 của bài cho thấy kết quả trên Dataset B: mô hình không có đầu vào xúc giác hay lực đạt 0,00 cả khi bảo "firm" lẫn "gentle", và các mô hình có token xúc giác nhưng không có giám sát lực đạt 0,37–0,40 khi bảo "firm" và chỉ 0,01 khi bảo "gentle".

## Tính tay: hai lực từ hai đầu ngón

Dùng một khung chung của kẹp, trong đó $z$ là trục đóng kẹp và $y$ hướng lên. Đầu ngón trái đo $F_L = (0,\ 1.5,\ 5)$ N, đầu ngón phải $F_R = (0,\ 1.5,\ -5)$ N.

$$F_{grip} = 2\min(|5|,\ |{-5}|) = 10\ \text{N}$$

$$F_{applied} = -(F_L + F_R) = -(0,\ 3,\ 0) = (0,\ -3,\ 0)\ \text{N}$$

Hai thành phần siết triệt tiêu nhau trong $F_{applied}$, còn lại một lực đẩy xuống 3 N lên vật; lực siết chỉ xuất hiện trong $F_{grip}$. Đó là nghĩa của "tách rời": chính sách có thể đòi siết nhẹ và ấn mạnh cùng lúc. Lấy ngón **nhỏ hơn** khiến $F_{grip}$ bám theo tiếp xúc yếu hơn: nếu một ngón đọc 5 N và ngón kia 3 N thì $F_{grip} = 6$ N.

Vòng kẹp sau đó tăng yêu cầu của chính sách bằng một hệ số feedforward. Với $k_{ff} = 0.6$ của bài, lực kẹp dự đoán 5 N thành mục tiêu $(1 + 0.6) \times 5 = 8$ N.

## Pipeline benchmark

Lấy các quỹ đạo mã nguồn mở làm cho mô phỏng khác (task LIBERO, gốc là MuJoCo) rồi **phát lại** chúng trong Isaac Lab với kẹp GelSight mô phỏng (ảnh 320×240, lưới marker 11×9; Taxim cho ảnh xúc giác, FOTS cho trường marker, lực tiếp xúc chuẩn từ engine vật lý), lấy mẫu 20 Hz. Độ đa dạng lực đến từ hệ số impedance cho mức lực 100%, 25% và 10%, và câu lệnh đi kèm dùng trạng từ ("firmly", "gently"). Đánh giá chấm cả chất lượng tương tác vật lý chứ không chỉ thành công: SR, lực kẹp trung bình AG, lực kẹp đỉnh MG, và các chỉ số lực tác dụng tương ứng.

## Kiến trúc (Tabero-VTLA)

[[fig:tabero]] Token thị giác, ngôn ngữ, trường marker và lực vào π0 tinh chỉnh LoRA; mô hình dự đoán pose và lực mục tiêu; bộ điều khiển lai cố định bám theo và đưa lực đo được ngược lại.

- **Token xúc giác.** Trường dịch chuyển marker (lịch sử 8 khung cộng khung chưa biến dạng) qua một TCN nhân quả nhỏ, gọi là Force-Field Tokenizer. Cách khác: ghép khung xúc giác trái/phải thành một ảnh rồi cho qua encoder thị giác (biến thể "Img").
- **Token lực.** Lực 6D từ hai ngón qua một MLP.
- **Backbone.** π0 (JAX) với LoRA, flow matching. Token xúc giác vào prefix (hoặc suffix ở một biến thể). Một loss giám sát lực tùy chọn (trọng số 0,1) dự đoán lực.
- **Giao diện lệnh tách rời.** Chính sách xuất pose $P^{pred} \in SE(3)$, lực tác dụng mục tiêu, và lực kẹp dự đoán cùng độ mở kẹp. Hai lực được định nghĩa từ lực đầu ngón: $F_{grip} = 2\min(|F_{L,z}|, |F_{R,z}|)$ và $F_{applied} = -(F_L + F_R)$.
- **Bộ điều khiển lai cố định.** Vòng lực tác dụng (admittance): $p_{cmd} = p_{pred} + K\,(F^{target} - F^{meas})$, sau đó IK vi phân. Vòng kẹp: feedforward $F^{target}_{grip} = (1+k_{ff})F^{pred}_{grip}$, làm mượt mũ, vùng chết và cắt biên độ mở kẹp.

## Kết quả

- Huấn luyện: 50.000 bước, batch 32, learning rate đỉnh $2.5\times10^{-5}$ giảm kiểu cosine.
- Ở Dataset B (lực nhẹ 10%), mô hình tốt nhất Field+FS giữ 0,86 thành công khi bảo "firm" và 0,52 khi bảo "gentle", trong khi lực kẹp trung bình giảm từ 32,4 xuống 3,7 (giảm 88,6%). Ở Dataset A (25%) mức giảm là 72,8%.
- Mô hình không có giám sát lực sụp khi nhận lệnh "gentle" (thành công khoảng 0,01).
- Cả thành phần feedforward lẫn vòng admittance đều cần cho việc bám lực chính xác (ablation).

## Lưu ý

Encoder thị giác, encoder ngôn ngữ, tần số chính sách và bộ điều khiển, và độ dài action chunk không được nêu. Văn bản nói lực đầu vào là 6D trong khi Bảng 7 ghi đầu vào MLP là $8\times 6 = 48$. Các tác giả thừa nhận khung chưa tối ưu đồng thời thành công nhiệm vụ và lực tối thiểu.

**Mang theo sang bài sau:** mọi phương pháp tới đây đều cần cảm biến xúc giác hoặc lực lúc chạy. [FD-VLA](fd-vla.html) hỏi: có suy ra được lực từ thị giác và state của cánh tay không?

**Câu kiểm tra:** cùng khung đó, $F_L = (0,\ 1,\ 4)$ N và $F_R = (0,\ 2,\ -6)$ N. Tính $F_{grip}$ và $F_{applied}$. Vòng kẹp dùng mục tiêu bao nhiêu nếu chính sách dự đoán 10 N?

*Đáp án:* $F_{grip} = 2\min(4, 6) = 8$ N. $F_{applied} = -(0,\ 3,\ -2) = (0,\ -3,\ 2)$ N: 3 N đẩy xuống, cộng 2 N dọc trục đóng kẹp vì hai ngón siết không đều. Mục tiêu $= 1.6 \times 10 = 16$ N.
:::
