---
slug: fd-vla
date: 2026-10-18
title_en: "FD-VLA: Force Distilled from Vision and State"
title_vi: "FD-VLA: Chưng cất lực từ thị giác và state"
excerpt_en: "FD-VLA learns a force token from images and robot state, supervised by a real force encoder only at training time, so a force-aware VLA runs without any force sensor."
excerpt_vi: "FD-VLA học một token lực từ ảnh và state của robot, chỉ được giám sát bởi bộ mã hóa lực thật lúc huấn luyện, nhờ đó VLA nhận biết lực chạy được mà không cần cảm biến lực."
tags: [VLA, Force, Distillation, Paper Notes, SmolVLA]
---

:::en
Paper: [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) (February 2026), built on SmolVLA.

## The pain it cures

Force sensors are costly, fragile and often absent on deployed robots. Yet the earlier force VLAs in this series ([ForceVLA](forcevla.html), [ForceVLA2](forcevla2.html)) need them at run time. FD-VLA's idea: the force during contact is largely **predictable from what the robot sees and how its arm is posed**, so train a small module to predict a latent force token and throw the sensor away at inference.

## Try the naive way first

There are three obvious options, and the paper measures two of them on its three tasks:

1. Feed the raw sensor force in. It helps, but needs the sensor at run time, the very thing to remove.
2. Encode force with a plain MLP and no distillation module: **38.9%**.
3. Use the encoded ground-truth force itself as the attention query: **51.1%**.

A learnable query that has to *predict* the force latent does best, **61.1%**. Forcing the model to rebuild force from what it sees seems to teach it which visual cues matter.

## Work it by hand: one single-query attention step

The FDM's only query is $p$. Take three context tokens $[p,\ f^V,\ f^S]$ with values $v_p = (0,0)$, $v_V = (1,2)$, $v_S = (3,0)$, and let the scaled scores $q \cdot k / \sqrt{d_k}$ be $(0,\ 2,\ 1)$.

$$\text{softmax}(0, 2, 1) = \frac{(1,\ 7.389,\ 2.718)}{11.107} = (0.090,\ 0.665,\ 0.245)$$

$$Z = 0.090\,(0,0) + 0.665\,(1,2) + 0.245\,(3,0) = (1.400,\ 1.330)$$

Ignoring $W_O$, LayerNorm, the FFN and the $+p$ residual, $Z$ is the predicted force token. If the teacher's encoded force is $f^{aF} = (1.5,\ 1.0)$:

$$L_{dist} = (1.400 - 1.5)^2 + (1.330 - 1.0)^2 = 0.010 + 0.109 = 0.119$$

The gradient asks for more of the first coordinate and less of the second, so the scores shift weight from the vision token towards the state token. Over many samples, the module learns which mix of visual and arm cues predicts the force.

## Architecture

[[fig:fd-vla]] The Force Distillation Module predicts a force token from vision and state; during training it is pulled towards the encoding of real force; at inference only the prediction branch runs.

1. **Backbone and projection.** Following SmolVLA, the perception backbone is SmolVLM-2 with a SigLIP vision encoder. A single-layer MLP projects vision $f^V$, language $f^L$ and state $f^S$ to the VLM width $D$.
2. **Force Distillation Module (FDM).** A learnable query token $p \in \mathbb{R}^{1\times D}$ attends over the context $C = [p, f^V, f^S]$ with single-query multi-head attention; the output is $f^{pF} = \text{FFN}(\text{LN}([Z_1..Z_H] W_O + p))$, a single force token. Because $p$ is in the keys and values, the residual path gives self-conditioning.
3. **Teacher branch (training only).** The raw force from the F/T sensor goes through a light MLP to $f^{aF}$. The distillation loss is $L_{dist} = \lVert f^{pF} - f^{aF}\rVert_2^2$.
4. **Injection.** The VLM input is $[f^V, f^L, f^S, f^{pF}]$. The VLM is **frozen**. A directional attention mask (adapted from SmolVLA) makes information flow one way: percept tokens (vision, language) only see each other; control tokens (state, force) see percept tokens and earlier control tokens.
5. **Action expert.** A transformer head with a conditional flow-matching decoder produces the chunk $A_t$. Total loss $L = L^\tau(\theta) + \lambda L_{dist}$.

## Results

Hardware: UR5e with a wrist and a main camera; force from the arm's internal sensor during data collection. Tasks: Clean Whiteboard, Press Emergency Button, Insert Plug; 50 teleoperated demos per task, 30 evaluation trials each.

FD-VLA reaches a **61.1%** mean success, against 23.3% for SmolVLA without force, 46.7% for π0 without force and 11.1% for DP3. Ablation on the same three tasks:

| Variant | Mean success |
|---|---|
| No FDM (MLP force encoding) | 38.9% |
| FDM with the ground-truth force latent as the query | 51.1% |
| FDM with a learnable query (proposed) | 61.1% |

## Caveats

The text's gains for baselines given raw force ("+15.6%", "+20.0%") are ambiguous (points or relative), and the π0 numbers do not obviously add up against FD-VLA's 61.1%. Hidden sizes, $\lambda$, the chunk length, control rate and training schedule are not stated. The paper says the model has about one tenth of π0's parameters.
**Carry forward:** FD-VLA learns force by regressing onto a sensor latent, so it learns what the force *is*, not what force is *safe*. [HapticVLA](hapticvla.html) turns tactile data into a safety reward, then also removes the sensor by distillation.

**Check question:** same values, but the scores are $(0,\ 0,\ 2)$. What is $Z$, and what is $L_{dist}$ against $f^{aF} = (1.5,\ 1.0)$?

*Answer:* softmax $= (1, 1, 7.389)/9.389 = (0.107,\ 0.107,\ 0.787)$. $Z = 0.107\,(1,2) + 0.787\,(3,0) = (2.468,\ 0.213)$. $L_{dist} = 0.968^2 + 0.787^2 = 0.937 + 0.619 = 1.556$, much worse than before: too much weight on the state token now.
:::

:::vi
Bài báo: [arXiv 2602.02142](https://arxiv.org/abs/2602.02142) (tháng 2/2026), xây trên SmolVLA.

## Vấn đề cần chữa

Cảm biến lực đắt, dễ hỏng và thường không có trên robot triển khai. Vậy mà các VLA lực trước trong series này ([ForceVLA](forcevla.html), [ForceVLA2](forcevla2.html)) cần chúng lúc chạy. Ý tưởng FD-VLA: lực khi tiếp xúc phần lớn **đoán được từ những gì robot thấy và tư thế cánh tay**, nên huấn luyện một module nhỏ dự đoán token lực ẩn rồi bỏ cảm biến lúc suy luận.

## Thử cách ngây thơ trước

Có ba lựa chọn hiển nhiên, và bài báo đo hai trong số đó trên ba task của mình:

1. Đưa thẳng lực từ cảm biến vào. Có giúp, nhưng cần cảm biến lúc chạy, đúng thứ ta muốn bỏ.
2. Mã hóa lực bằng một MLP thường, không có module chưng cất: **38,9%**.
3. Dùng chính lực thật đã mã hóa làm query cho attention: **51,1%**.

Một query học được, buộc phải *dự đoán* latent lực, cho kết quả tốt nhất, **61,1%**. Bắt mô hình dựng lại lực từ những gì nó thấy dường như dạy nó tín hiệu thị giác nào mới quan trọng.

## Tính tay: một bước attention một query

Query duy nhất của FDM là $p$. Lấy ba token ngữ cảnh $[p,\ f^V,\ f^S]$ với value $v_p = (0,0)$, $v_V = (1,2)$, $v_S = (3,0)$, và cho điểm đã chia tỉ lệ $q \cdot k / \sqrt{d_k}$ là $(0,\ 2,\ 1)$.

$$\text{softmax}(0, 2, 1) = \frac{(1,\ 7.389,\ 2.718)}{11.107} = (0.090,\ 0.665,\ 0.245)$$

$$Z = 0.090\,(0,0) + 0.665\,(1,2) + 0.245\,(3,0) = (1.400,\ 1.330)$$

Bỏ qua $W_O$, LayerNorm, FFN và residual $+p$, $Z$ chính là token lực dự đoán. Nếu lực thật đã mã hóa của teacher là $f^{aF} = (1.5,\ 1.0)$:

$$L_{dist} = (1.400 - 1.5)^2 + (1.330 - 1.0)^2 = 0.010 + 0.109 = 0.119$$

Gradient đòi tăng tọa độ thứ nhất và giảm tọa độ thứ hai, nên điểm số dịch trọng số từ token thị giác sang token state. Qua nhiều mẫu, module học được cách pha trộn tín hiệu thị giác và cánh tay để đoán lực.

## Kiến trúc

[[fig:fd-vla]] Force Distillation Module dự đoán token lực từ thị giác và state; lúc huấn luyện nó được kéo về phía mã hóa của lực thật; lúc suy luận chỉ chạy nhánh dự đoán.

1. **Backbone và phép chiếu.** Theo SmolVLA, backbone cảm nhận là SmolVLM-2 với encoder ảnh SigLIP. Một MLP một lớp chiếu thị giác $f^V$, ngôn ngữ $f^L$ và state $f^S$ về chiều $D$ của VLM.
2. **Force Distillation Module (FDM).** Một token truy vấn học được $p \in \mathbb{R}^{1\times D}$ chú ý trên ngữ cảnh $C = [p, f^V, f^S]$ bằng multi-head attention một query; đầu ra $f^{pF} = \text{FFN}(\text{LN}([Z_1..Z_H] W_O + p))$, một token lực duy nhất. Vì $p$ nằm trong cả key và value, đường residual cho phép tự điều kiện hóa.
3. **Nhánh teacher (chỉ lúc huấn luyện).** Lực thô từ cảm biến F/T qua một MLP nhẹ thành $f^{aF}$. Loss chưng cất là $L_{dist} = \lVert f^{pF} - f^{aF}\rVert_2^2$.
4. **Tiêm vào VLM.** Đầu vào VLM là $[f^V, f^L, f^S, f^{pF}]$. VLM bị **đóng băng**. Một mask attention có hướng (lấy từ SmolVLA) làm thông tin chảy một chiều: token cảm nhận (thị giác, ngôn ngữ) chỉ nhìn nhau; token điều khiển (state, lực) nhìn được token cảm nhận và token điều khiển trước đó.
5. **Action expert.** Đầu transformer với bộ giải mã conditional flow-matching tạo chunk $A_t$. Loss tổng $L = L^\tau(\theta) + \lambda L_{dist}$.

## Kết quả

Phần cứng: UR5e có camera cổ tay và camera chính; lực lấy từ cảm biến trong của cánh tay khi thu dữ liệu. Task: Clean Whiteboard, Press Emergency Button, Insert Plug; 50 demo teleoperation mỗi task, 30 lượt đánh giá mỗi task.

FD-VLA đạt **61,1%** thành công trung bình, so với 23,3% của SmolVLA không lực, 46,7% của π0 không lực và 11,1% của DP3. Ablation trên cùng ba task:

| Biến thể | Thành công TB |
|---|---|
| Không FDM (mã hóa lực bằng MLP) | 38,9% |
| FDM dùng latent lực thật làm query | 51,1% |
| FDM với query học được (đề xuất) | 61,1% |

## Lưu ý

Mức cải thiện bài nêu cho baseline có dùng lực thô ("+15,6%", "+20,0%") không rõ là điểm hay tương đối, và số của π0 không khớp rõ ràng với 61,1% của FD-VLA. Kích thước ẩn, $\lambda$, độ dài chunk, tần số điều khiển và lịch huấn luyện không được nêu. Bài cho biết mô hình có khoảng một phần mười số tham số của π0.

**Mang theo sang bài sau:** FD-VLA học lực bằng cách hồi quy về latent của cảm biến, nên nó học lực *là bao nhiêu*, không học lực nào là *an toàn*. [HapticVLA](hapticvla.html) biến dữ liệu xúc giác thành phần thưởng an toàn, rồi cũng bỏ cảm biến bằng chưng cất.

**Câu kiểm tra:** cùng value, nhưng điểm số là $(0,\ 0,\ 2)$. $Z$ bằng bao nhiêu, và $L_{dist}$ so với $f^{aF} = (1.5,\ 1.0)$ là bao nhiêu?

*Đáp án:* softmax $= (1, 1, 7.389)/9.389 = (0.107,\ 0.107,\ 0.787)$. $Z = 0.107\,(1,2) + 0.787\,(3,0) = (2.468,\ 0.213)$. $L_{dist} = 0.968^2 + 0.787^2 = 0.937 + 0.619 = 1.556$, tệ hơn nhiều so với trước: giờ dồn quá nhiều trọng số vào token state.
:::
