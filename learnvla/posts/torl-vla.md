---
slug: torl-vla
date: 2026-10-18
title_en: "TORL-VLA: Tactile-guided Online RL on Top of a Wrench-aware VLA"
title_vi: "TORL-VLA: RL online dẫn hướng bằng xúc giác trên nền VLA nhận biết wrench"
excerpt_en: "A frozen wrench-aware π0.5 predicts actions and future wrench; a light actor-critic with an intervention-censored critic then refines the chunk online from human corrections."
excerpt_vi: "π0.5 nhận biết wrench (đóng băng) dự đoán hành động và wrench tương lai; một actor-critic nhẹ với critic bị kiểm duyệt theo can thiệp rồi tinh chỉnh chunk online từ chỉnh sửa của con người."
tags: [VLA, Tactile, RL, Paper Notes, π0.5]
---

:::en
Paper: [arXiv 2606.09337](https://arxiv.org/abs/2606.09337) (June 2026), project page [torl-vla.github.io](https://torl-vla.github.io/). The title says "tactile", not "torque": the tactile pads are converted to a 6D wrench.

## The pain it cures

A tactile VLA trained offline cannot adapt when contact conditions shift (a slightly different latch, a harder egg). It retries inefficiently or presses too hard. TORL-VLA keeps the offline policy as a **reference** and learns a **small online correction** on top, using human interventions near failure.

## Architecture

[[fig:torl-vla]] Stage I trains a wrench-aware reference VLA; Stage II freezes it and trains stage-specific actor heads and two critics online from policy and human data.

**Stage I: reference model (flow matching on π0.5).**

- Each fingertip pad (6×8 piezoelectric array) is mapped to a 6D wrench; both give $w_t \in \mathbb{R}^{12}$. A window of past wrenches goes through a light MLP into **one** token $z^{tac}$.
- **Late fusion:** the wrench token is not given to the VLM. After the VLM encodes images, language and state into prefix $P_t$, $[P_t; z^{tac}]$ passes self-attention, then a **soft-routed MoE** $F_t = \sum_m \rho_{t,m} E_m(H_t)$.
- A **zero-initialised bypass** $\alpha\,P(z^{tac})$ (learnable scalar $\alpha$ starting at 0) is added so contact information reaches the action expert directly.
- The expert predicts the action chunk **and the future wrench sequence**, with loss $L = \lVert u^a - \hat u^a\rVert^2 + \lambda_w\lVert u^w - \hat u^w\rVert^2$.

**Stage II: online refinement (reference frozen).**

- Context $c_t = [z^{vla}, q_t, w_t, W_{hist}, \hat W^{ref}, A^{ref}]$: visual tokens from the frozen VLA, proprioception, measured wrench and history, plus the VLA's predicted wrench and reference actions.
- A **stage estimator** picks one of several **stage-specific actor heads**, which output the refined chunk directly.
- Two critics: $Q_{task}$ (task return) and $Q_{ic}$, an **intervention-censored** critic. When a mostly policy-generated chunk is followed by an intervention-dominated one, the mask $m^{int}$ cuts the bootstrap, so human takeover is not credited to the policy. Intervention actions stay in the replay buffer for behaviour regularisation.
- Actor loss: $L_\pi = \lambda_{bc}L_{bc} - \lambda_{task}\,\mathbb{E}[\min_i Q^{(i)}_{task}] + \lambda_{ic}\,\mathbb{E}[\Delta Q_{ic}]$, anchoring to the VLA reference while following the critics.
- Reward: a human-judged binary success signal per subtask.

## Results

A latch-box long-horizon task (place a coffee cup in a tight holder, lock a latch, grasp and place an egg), 30 autonomous trials per row:

| Method | Cup | Latch | Egg | Full task | Full-task time |
|---|---|---|---|---|---|
| π0.5 | 18 | 15 | 20 | 12 | 199.7 s |
| ForceVLA | 21 | 20 | 22 | 15 | 195.3 s |
| TORL-VLA w/o RL | 25 | 23 | 25 | 21 | 191.9 s |
| RLT | 26 | 25 | 25 | 23 | 175.2 s |
| **TORL-VLA** | **30** | **29** | **30** | **28** | **165.5 s** |

Ablations on the reference model: removing the MoE drops to 18/17/19, the bypass to 23/20/21. Online ablations: no wrench context 27/27/26, no IC critic 27/26/28.

## Caveats

I read the HTML verbatim only up to the middle of the experiments; details such as H, K, control rate, update ratios and latencies come from a summary and are not quoted here. The number of experts, the sample rate of the tactile pads and the VLM size are not stated in the part I read.
:::

:::vi
Bài báo: [arXiv 2606.09337](https://arxiv.org/abs/2606.09337) (tháng 6/2026), trang dự án [torl-vla.github.io](https://torl-vla.github.io/). Tiêu đề nói "tactile" (xúc giác), không phải "torque": các miếng xúc giác được đổi thành wrench 6D.

## Vấn đề cần chữa

VLA xúc giác huấn luyện offline không thích nghi được khi điều kiện tiếp xúc đổi (chốt hơi khác, quả trứng cứng hơn). Nó thử lại kém hiệu quả hoặc ấn quá mạnh. TORL-VLA giữ chính sách offline làm **tham chiếu** và học thêm một **hiệu chỉnh online nhỏ**, dùng can thiệp của con người khi sắp thất bại.

## Kiến trúc

[[fig:torl-vla]] Giai đoạn I huấn luyện VLA tham chiếu nhận biết wrench; giai đoạn II đóng băng nó và huấn luyện các đầu actor theo từng pha cùng hai critic online từ dữ liệu của chính sách và con người.

**Giai đoạn I: mô hình tham chiếu (flow matching trên π0.5).**

- Mỗi miếng xúc giác ở đầu ngón (mảng áp điện 6×8) được ánh xạ thành wrench 6D; hai miếng cho $w_t \in \mathbb{R}^{12}$. Một cửa sổ wrench quá khứ qua MLP nhẹ thành **một** token $z^{tac}$.
- **Gộp muộn:** token wrench không được đưa vào VLM. Sau khi VLM mã hóa ảnh, ngôn ngữ và state thành prefix $P_t$, $[P_t; z^{tac}]$ qua self-attention rồi **MoE định tuyến mềm** $F_t = \sum_m \rho_{t,m} E_m(H_t)$.
- Một **bypass khởi tạo bằng 0** $\alpha\,P(z^{tac})$ (vô hướng học được $\alpha$ bắt đầu từ 0) được cộng vào để thông tin tiếp xúc đến thẳng action expert.
- Expert dự đoán chunk hành động **và chuỗi wrench tương lai**, với loss $L = \lVert u^a - \hat u^a\rVert^2 + \lambda_w\lVert u^w - \hat u^w\rVert^2$.

**Giai đoạn II: tinh chỉnh online (tham chiếu bị đóng băng).**

- Ngữ cảnh $c_t = [z^{vla}, q_t, w_t, W_{hist}, \hat W^{ref}, A^{ref}]$: token thị giác từ VLA đóng băng, proprioception, wrench đo được và lịch sử, cùng wrench dự đoán và hành động tham chiếu của VLA.
- Một **bộ ước lượng pha** chọn một trong nhiều **đầu actor theo pha**, xuất trực tiếp chunk đã tinh chỉnh.
- Hai critic: $Q_{task}$ (lợi ích nhiệm vụ) và $Q_{ic}$, critic **bị kiểm duyệt theo can thiệp**. Khi một chunk phần lớn do chính sách sinh ra được theo sau bởi chunk chủ yếu do con người, mask $m^{int}$ cắt bootstrap, nên việc con người tiếp quản không được ghi công cho chính sách. Hành động can thiệp vẫn nằm trong replay buffer để điều hòa hành vi.
- Loss actor: $L_\pi = \lambda_{bc}L_{bc} - \lambda_{task}\,\mathbb{E}[\min_i Q^{(i)}_{task}] + \lambda_{ic}\,\mathbb{E}[\Delta Q_{ic}]$, neo vào tham chiếu của VLA trong khi bám theo critic.
- Phần thưởng: tín hiệu thành công nhị phân do con người chấm cho từng subtask.

## Kết quả

Task chuỗi dài hộp chốt (đặt cốc cà phê vào khay chặt, khóa chốt, nắm và đặt quả trứng), 30 lượt tự động mỗi dòng:

| Phương pháp | Cốc | Chốt | Trứng | Cả chuỗi | Thời gian cả chuỗi |
|---|---|---|---|---|---|
| π0.5 | 18 | 15 | 20 | 12 | 199,7 s |
| ForceVLA | 21 | 20 | 22 | 15 | 195,3 s |
| TORL-VLA không RL | 25 | 23 | 25 | 21 | 191,9 s |
| RLT | 26 | 25 | 25 | 23 | 175,2 s |
| **TORL-VLA** | **30** | **29** | **30** | **28** | **165,5 s** |

Ablation mô hình tham chiếu: bỏ MoE tụt xuống 18/17/19, bỏ bypass 23/20/21. Ablation online: không có wrench context 27/27/26, không có IC critic 27/26/28.

## Lưu ý

Tôi chỉ đọc HTML nguyên văn đến khoảng giữa phần thực nghiệm; các chi tiết như H, K, tần số điều khiển, tỉ lệ cập nhật và độ trễ lấy từ bản tóm tắt nên không trích ở đây. Số expert, tần số lấy mẫu của miếng xúc giác và kích thước VLM không được nêu trong phần tôi đọc.
:::
