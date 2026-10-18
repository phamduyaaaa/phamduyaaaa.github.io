---
slug: fd-vla
date: 2026-10-18
title_en: "FD-VLA: Force Distilled from Vision and State"
title_vi: "FD-VLA: Chưng cất lực từ thị giác và state"
excerpt_en: "ForceVLA and Tactile-VLA need a force sensor on the deployed robot. FD-VLA learns to predict a force token from images and arm state, using the sensor only during training: 61.1% vs 23.3% for SmolVLA."
excerpt_vi: "ForceVLA và Tactile-VLA cần cảm biến lực trên robot triển khai. FD-VLA học dự đoán token lực từ ảnh và state cánh tay, chỉ dùng cảm biến lúc huấn luyện: 61,1% so với 23,3% của SmolVLA."
tags: [VLA, Force, Distillation, Paper Notes, SmolVLA]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) · 02/2026 · built on SmolVLA

**PROBLEM** Force sensors are costly, fragile and often missing on deployed robots.

**WHAT FAILED BEFORE** The force VLAs the paper compares against in its Fig. 1, Tactile-VLA and [ForceVLA](forcevla.html), need the sensor at run time.

**IDEA** A Force Distillation Module: a learnable query looks at image and state tokens and predicts a force token. During training it is pulled towards the encoding of the real sensor force; at run time the sensor is gone.

**RESULT** 61.1% mean success vs 23.3% (SmolVLA) and 46.7% (π0), both without force.
</div>

## 1. The problem: force-aware, but only with a sensor

[[flow]]
- Before~ForceVLA, Tactile-VLA | F/T sensor at run time > !Force-aware VLA~needs the sensor! > Actions | no sensor on the robot, no force
+ FD-VLA | RGB + arm state > *Force Distillation~predicts a force token* > SmolVLM (frozen) > Action expert | sensor used only during training
[[/flow]] The question becomes: can the force be read off what the robot sees and how its arm is posed?

[[bars:%]] No FDM, MLP force encoding=38.9; FDM with real-force latent as query=51.1; *FDM with learnable query=61.1* || Ablation, mean of three tasks: a query that has to *predict* force works best.

## 2. Architecture

[[fig:fd-vla]] The Force Distillation Module predicts a force token from vision and state; in training it is pulled towards the encoding of real force; at inference only the prediction branch runs.

| Block | Input | Output | Role |
|---|---|---|---|
| Projection (1-layer MLP) | image $V_t$, language $L$, state $S_t$ | $f^V, f^L, f^S$ | tokens in the VLM width $D$ |
| FDM | query $p$, $f^V$, $f^S$ | force token $f^{pF}$ | predicted force |
| Teacher MLP (training only) | sensor force $F_t$ | $f^{aF}$ | target for $f^{pF}$ |
| SmolVLM-2 (frozen) + mask | $[f^V, f^L, f^S, f^{pF}]$ | features | control tokens see percept tokens, not the reverse |
| Action expert | features | action chunk $A_t$ | flow-matching decoder |

## 3. Work it by hand: one single-query attention step

<div class="calc" markdown="1">
Calculation card

**What and why.** The FDM is one attention step with a single query. Computing it shows how the predicted force token is a weighted mix of what the image and the arm state say, and how the distillation loss corrects that mix.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $s_p, s_V, s_S$ | scaled scores of query $p$ against $p$, $f^V$, $f^S$ | input | $(0,\ 2,\ 1)$ |
| $v_p, v_V, v_S$ | values of the three tokens | input | $(0,0)$, $(1,2)$, $(3,0)$ |
| $\alpha$ | attention weights | intermediate | – |
| $Z$ | predicted force token (before $W_O$, LayerNorm, FFN) | output | – |
| $f^{aF}$ | encoded real force (teacher) | input | $(1.5,\ 1.0)$ |
| $L_{dist}$ | distillation loss | output | – |

**Formula**

$$\alpha = \text{softmax}(s), \qquad Z = \sum_i \alpha_i v_i, \qquad L_{dist} = \lVert Z - f^{aF} \rVert_2^2$$

**Steps**

1. $e^0 = 1$, $e^2 = 7.389$, $e^1 = 2.718$; sum $11.107$; $\alpha = (0.090,\ 0.665,\ 0.245)$.
2. $Z = 0.665\,(1,2) + 0.245\,(3,0) = (1.400,\ 1.330)$.
3. $L_{dist} = (1.400 - 1.5)^2 + (1.330 - 1.0)^2 = 0.010 + 0.109 = 0.119$.

**Result.** Predicted $(1.40, 1.33)$ against the real $(1.5, 1.0)$; loss 0.119.

**Why it matters.** To lower the loss, the first coordinate must rise and the second fall, so the scores move weight from the image token to the state token. Over many samples the module learns which visual and arm cues predict force.
</div>

## 4. Results

[[bars:%]] DP3=11.1; SmolVLA (no force)=23.3; π0 (no force)=46.7; *FD-VLA=61.1* || Mean success: Clean Whiteboard, Press Emergency Button, Insert Plug; 30 trials each, UR5e.

## 5. Training

| Item | Value |
|---|---|
| Loss | $L = L_{flow} + \lambda L_{dist}$ |
| Frozen | the VLM (SmolVLM-2) |
| Data | 50 SpaceMouse demos per task |
| Size | about one tenth of π0's parameters |

## 6. Caveats

- Gains reported for baselines given raw force ("+15.6%", "+20.0%") are ambiguous (points or relative).
- $\lambda$, hidden sizes, chunk length and control rate are not stated.

**Carry forward:** FD-VLA learns what the force *is*, not what force is *safe*. [HapticVLA](hapticvla.html) turns tactile data into a safety reward, then also removes the sensor.

**Check question:** same values, scores $(0,\ 0,\ 2)$. What are $Z$ and $L_{dist}$?

<details markdown="1">
<summary>Answer</summary>

$\alpha = (1, 1, 7.389)/9.389 = (0.107, 0.107, 0.787)$. $Z = 0.107\,(1,2) + 0.787\,(3,0) = (2.468, 0.213)$. $L_{dist} = 0.968^2 + 0.787^2 = 1.556$: now too much weight on the state token.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) · 02/2026 · nền SmolVLA

**VẤN ĐỀ** Cảm biến lực đắt, dễ hỏng và thường không có trên robot triển khai.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các VLA lực mà bài so sánh trong Fig. 1, Tactile-VLA và [ForceVLA](forcevla.html), cần cảm biến lúc chạy.

**Ý TƯỞNG** Một Force Distillation Module: một query học được nhìn token ảnh và state rồi dự đoán một token lực. Lúc huấn luyện nó bị kéo về phía mã hóa của lực thật từ cảm biến; lúc chạy thì không còn cảm biến.

**KẾT QUẢ** Thành công trung bình 61,1%, so với 23,3% (SmolVLA) và 46,7% (π0), cả hai không dùng lực.
</div>

## 1. Vấn đề: nhận biết lực, nhưng chỉ khi có cảm biến

[[flow]]
- Trước~ForceVLA, Tactile-VLA | Cảm biến F/T lúc chạy > !VLA nhận biết lực~cần cảm biến! > Hành động | robot không có cảm biến thì không có lực
+ FD-VLA | RGB + state cánh tay > *Force Distillation~dự đoán token lực* > SmolVLM (đóng băng) > Action expert | cảm biến chỉ dùng lúc huấn luyện
[[/flow]] Câu hỏi trở thành: có đọc được lực từ những gì robot thấy và tư thế cánh tay không?

[[bars:%]] Không FDM, mã hóa lực bằng MLP=38.9; FDM dùng latent lực thật làm query=51.1; *FDM với query học được=61.1* || Ablation, trung bình ba task: query phải *dự đoán* lực cho kết quả tốt nhất.

## 2. Kiến trúc

[[fig:fd-vla]] Force Distillation Module dự đoán token lực từ thị giác và state; lúc huấn luyện nó bị kéo về phía mã hóa của lực thật; lúc suy luận chỉ chạy nhánh dự đoán.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Phép chiếu (MLP 1 lớp) | ảnh $V_t$, ngôn ngữ $L$, state $S_t$ | $f^V, f^L, f^S$ | token theo chiều $D$ của VLM |
| FDM | query $p$, $f^V$, $f^S$ | token lực $f^{pF}$ | lực dự đoán |
| MLP teacher (chỉ khi huấn luyện) | lực cảm biến $F_t$ | $f^{aF}$ | mục tiêu cho $f^{pF}$ |
| SmolVLM-2 (đóng băng) + mask | $[f^V, f^L, f^S, f^{pF}]$ | đặc trưng | token điều khiển nhìn token cảm nhận, không ngược lại |
| Action expert | đặc trưng | chunk hành động $A_t$ | bộ giải mã flow-matching |

## 3. Tính tay: một bước attention một query

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** FDM là một bước attention với một query duy nhất. Tính nó để thấy token lực dự đoán là một hỗn hợp có trọng số giữa thông tin ảnh và state cánh tay, và loss chưng cất sửa hỗn hợp đó ra sao.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $s_p, s_V, s_S$ | điểm (đã chia tỉ lệ) của query $p$ với $p$, $f^V$, $f^S$ | input | $(0,\ 2,\ 1)$ |
| $v_p, v_V, v_S$ | value của ba token | input | $(0,0)$, $(1,2)$, $(3,0)$ |
| $\alpha$ | trọng số attention | trung gian | – |
| $Z$ | token lực dự đoán (trước $W_O$, LayerNorm, FFN) | output | – |
| $f^{aF}$ | lực thật đã mã hóa (teacher) | input | $(1.5,\ 1.0)$ |
| $L_{dist}$ | loss chưng cất | output | – |

**Công thức**

$$\alpha = \text{softmax}(s), \qquad Z = \sum_i \alpha_i v_i, \qquad L_{dist} = \lVert Z - f^{aF} \rVert_2^2$$

**Từng bước**

1. $e^0 = 1$, $e^2 = 7.389$, $e^1 = 2.718$; tổng $11.107$; $\alpha = (0.090,\ 0.665,\ 0.245)$.
2. $Z = 0.665\,(1,2) + 0.245\,(3,0) = (1.400,\ 1.330)$.
3. $L_{dist} = (1.400 - 1.5)^2 + (1.330 - 1.0)^2 = 0.010 + 0.109 = 0.119$.

**Kết quả.** Dự đoán $(1.40, 1.33)$ so với lực thật $(1.5, 1.0)$; loss 0,119.

**Ý nghĩa.** Để giảm loss, tọa độ thứ nhất phải tăng và tọa độ thứ hai phải giảm, nên điểm số dịch trọng số từ token ảnh sang token state. Qua nhiều mẫu, module học được tín hiệu thị giác và cánh tay nào đoán được lực.
</div>

## 4. Kết quả

[[bars:%]] DP3=11.1; SmolVLA (không lực)=23.3; π0 (không lực)=46.7; *FD-VLA=61.1* || Thành công trung bình: Clean Whiteboard, Press Emergency Button, Insert Plug; 30 lượt mỗi task, UR5e.

## 5. Huấn luyện

| Mục | Giá trị |
|---|---|
| Loss | $L = L_{flow} + \lambda L_{dist}$ |
| Đóng băng | VLM (SmolVLM-2) |
| Dữ liệu | 50 demo SpaceMouse mỗi task |
| Kích thước | khoảng một phần mười số tham số của π0 |

## 6. Lưu ý

- Mức tăng bài nêu cho baseline có lực thô ("+15,6%", "+20,0%") không rõ là điểm hay tương đối.
- $\lambda$, kích thước ẩn, độ dài chunk và tần số điều khiển không được nêu.

**Mang sang bài sau:** FD-VLA học lực *là bao nhiêu*, không học lực nào là *an toàn*. [HapticVLA](hapticvla.html) biến dữ liệu xúc giác thành phần thưởng an toàn, rồi cũng bỏ cảm biến.

**Câu kiểm tra:** cùng value, điểm số $(0,\ 0,\ 2)$. $Z$ và $L_{dist}$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\alpha = (1, 1, 7.389)/9.389 = (0.107, 0.107, 0.787)$. $Z = 0.107\,(1,2) + 0.787\,(3,0) = (2.468, 0.213)$. $L_{dist} = 0.968^2 + 0.787^2 = 1.556$: giờ dồn quá nhiều trọng số vào token state.
</details>
:::
