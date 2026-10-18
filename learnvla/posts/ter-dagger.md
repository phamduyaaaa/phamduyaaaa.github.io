---
slug: ter-dagger
date: 2026-10-18
title_en: "TER-DAgger: Trajectory-Editing Residual DAgger for Precision Insertion"
title_vi: "TER-DAgger: Residual DAgger với chỉnh sửa quỹ đạo cho lắp ghép chính xác"
excerpt_en: "In HG-DAgger a human decides when to step in, and the raw takeover is used as data. TER-DAgger lets a force-error detector call the human, edits the correction into a clean trajectory, and trains a 50 Hz residual on it."
excerpt_vi: "Trong HG-DAgger, con người tự quyết khi nào can thiệp, và lần tiếp quản thô được dùng làm dữ liệu. TER-DAgger để bộ phát hiện sai số lực gọi con người, chỉnh bản sửa thành quỹ đạo sạch, rồi huấn luyện residual 50 Hz trên đó."
tags: [VLA, Force, DAgger, Imitation Learning, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.04038](https://arxiv.org/abs/2603.04038) · 03/2026 · base policy ACT-style (not a VLA)

**PROBLEM** Plug insertion with about 0.1 mm tolerance; a slow base policy often lands a few millimetres off.

**WHAT FAILED BEFORE** In HG-DAgger a person decides *when* to intervene (late, inconsistent), and the raw takeover, drift included, becomes training data. Retraining or fine-tuning on such data are the baselines.

**IDEA** (1) Call the human when predicted and measured force disagree. (2) Edit the base trajectory so it joins the human's correction smoothly. (3) Train a fast residual policy on the edited data, executed under impedance control.

**RESULT** The abstract reports an average improvement of over 37% across tasks.
</div>

## 1. The problem: when to ask, and what to record

[[flow]]
- Before~HG-DAgger | Base policy > !Human watches~decides when! > !Raw takeover data! > Retrain | late, inconsistent; data contain the failing drift
+ TER-DAgger | Base policy 1 Hz > *Force-error detector* > Human demo > *Trajectory editing* > *Residual 50 Hz* | the robot asks; corrections become clean residual labels
[[/flow]] The force the base policy predicts is used as an alarm: when reality disagrees, something has gone wrong.

## 2. Architecture

[[fig:ter-dagger]] A 1 Hz base policy proposes actions, a 50 Hz residual adds a correction, a 1 kHz impedance controller executes. A force-error detector triggers human correction; trajectory editing turns it into residual data.

| Block | Rate | Input | Output |
|---|---|---|---|
| Base policy (ACT-style CVAE) | 1 Hz | pose, force, two RGB images | 100 future actions **and forces**; runs 50 |
| Error detector | 50 Hz | predicted vs measured force | pause + call the human |
| Trajectory editing | offline | failed base path, human demo | smooth corrected path |
| Residual policy (2-layer Transformer) | 50 Hz | pose, base action, two images | correction $\Delta A$ |
| Impedance controller | 1 kHz | $\hat A + \Delta A$ | joint torques |

## 3. Work it by hand: the force-error alarm

<div class="calc" markdown="1">
Calculation card

**What and why.** The base policy predicts the force it expects to feel. If the measured force differs too much, the plug is probably hitting the rim. Computing $e_t$ shows how a 4 N surprise triggers the pause.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\hat F_t$ | predicted wrench $(f_x, f_y, f_z, \tau_x, \tau_y, \tau_z)$ | input | $(0, 0, -5, 0, 0, 0)$ |
| $F_t$ | measured wrench | input | $(0.5, 0, -9, 0, 0, 0.1)$ |
| $c$ | threshold | constant | 3 (illustrative) |
| $e_t$ | force error | output | – |

**Formula** (L1 norm: sum of absolute differences)

$$e_t = \lVert \hat F_t - F_t \rVert_1 = \sum_{j=1}^{6} \left| \hat F_{t,j} - F_{t,j} \right|, \qquad \text{pause if } e_t > c$$

**Steps**

1. Differences: $(-0.5,\ 0,\ 4,\ 0,\ 0,\ -0.1)$.
2. Absolute values summed: $0.5 + 0 + 4 + 0 + 0 + 0.1 = 4.6$.
3. Compare: $4.6 > 3$.

**Result.** The detector fires: pause and ask the human.

**Why it matters.** The camera may not show a plug pressing 4 N too hard into the rim; force does. The robot asks for help at the moment it starts failing, not when a person happens to notice.
</div>

## 4. Training and setup

| Item | Value |
|---|---|
| Base policy | 100 demonstrations, 2,000 epochs |
| Residual | 50 corrective demonstrations, 200 epochs |
| Editing weights | $\omega_p = 1.0$ (position), $\omega_q = 0.5$ (orientation), $\lambda_s = 1$, $\lambda_e = 1000$ |
| Tasks | USB, two-pin, three-pin plugs; MuJoCo + real Franka; 50 trials each |
| Baselines | ACT, FILIC, HG-DAgger, Retrain, Finetune |

## 5. Results

[[bars:%]] ACT=27.6; FILIC=25.6; HG-DAgger=31.6; Retrain=32.4; Finetune=40; *TER-DAgger=77.2* || Average success over five tasks, 50 trials per task (Table I of the paper).

| Method | Sim USB | Sim two-pin | Real USB | Real two-pin | Real three-pin | Average |
|---|---|---|---|---|---|---|
| ACT | 26% | 22% | 2% | 64% | 24% | 27.6% |
| HG-DAgger | 50% | 44% | 16% | 36% | 12% | 31.6% |
| Finetune | 68% | 54% | 10% | 28% | 40% | 40.0% |
| TER-DAgger | 90% | 96% | 22% | 96% | 82% | 77.2% |

- The error detector keeps 100% recall (its threshold is chosen for that) and reaches 98.8% average precision with force prediction error; KL loss, reconstruction loss and position error give lower precision.
- Note the weak cell: real USB insertion is only 22%.

## 6. Caveats

- Checked against the full text: the numbers in the results above match Table I and Table II of the paper (50 trials per task).
- Corrections are given by hand with the impedance stiffness set to zero; the physical interface and the other stiffness values are not stated.

**Carry forward:** this closes the force-paper series. [Survey 1](survey-force-map.html) puts all eleven side by side with 22 more methods.

**Check question:** $\hat F = (0, 0, -4, 0, 0, 0)$, $F = (0.2, -0.3, -5, 0.1, 0, 0)$, $c = 3$. Does the detector fire?

<details markdown="1">
<summary>Answer</summary>

$e_t = 0.2 + 0.3 + 1 + 0.1 = 1.6 < 3$: no pause.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.04038](https://arxiv.org/abs/2603.04038) · 03/2026 · chính sách nền kiểu ACT (không phải VLA)

**VẤN ĐỀ** Cắm phích với dung sai khoảng 0,1 mm; chính sách nền chậm thường rơi lệch vài milimét.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Trong HG-DAgger, một người tự quyết *khi nào* can thiệp (muộn, không đều), và lần tiếp quản thô, kể cả phần trôi, thành dữ liệu huấn luyện. Huấn luyện lại hoặc fine-tune trên dữ liệu đó là các baseline.

**Ý TƯỞNG** (1) Gọi con người khi lực dự đoán và lực đo lệch nhau. (2) Chỉnh quỹ đạo nền để nó nối mượt vào bản sửa của con người. (3) Huấn luyện một chính sách residual nhanh trên dữ liệu đã chỉnh, thực thi dưới điều khiển impedance.

**KẾT QUẢ** Abstract nêu mức cải thiện trung bình hơn 37% trên các task.
</div>

## 1. Vấn đề: khi nào hỏi, và ghi lại cái gì

[[flow]]
- Trước~HG-DAgger | Chính sách nền > !Người quan sát~tự quyết khi nào! > !Dữ liệu tiếp quản thô! > Huấn luyện lại | muộn, không đều; dữ liệu chứa cả phần trôi lỗi
+ TER-DAgger | Chính sách nền 1 Hz > *Bộ phát hiện sai số lực* > Demo của người > *Chỉnh sửa quỹ đạo* > *Residual 50 Hz* | robot tự hỏi; bản sửa thành nhãn residual sạch
[[/flow]] Lực mà chính sách nền dự đoán được dùng như một chuông báo: khi thực tế không khớp, có gì đó đã sai.

## 2. Kiến trúc

[[fig:ter-dagger]] Chính sách nền 1 Hz đề xuất hành động, residual 50 Hz cộng hiệu chỉnh, bộ điều khiển impedance 1 kHz thực thi. Bộ phát hiện sai số lực kích hoạt con người sửa; chỉnh sửa quỹ đạo biến bản sửa thành dữ liệu residual.

| Khối | Tần số | Input | Output |
|---|---|---|---|
| Chính sách nền (CVAE kiểu ACT) | 1 Hz | pose, lực, hai ảnh RGB | 100 hành động **và lực** tương lai; chạy 50 |
| Bộ phát hiện lỗi | 50 Hz | lực dự đoán và lực đo | tạm dừng + gọi người |
| Chỉnh sửa quỹ đạo | offline | đường nền bị lỗi, demo của người | đường đã sửa, mượt |
| Chính sách residual (Transformer 2 lớp) | 50 Hz | pose, hành động nền, hai ảnh | hiệu chỉnh $\Delta A$ |
| Bộ điều khiển impedance | 1 kHz | $\hat A + \Delta A$ | mô men khớp |

## 3. Tính tay: chuông báo sai số lực

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Chính sách nền dự đoán lực nó sẽ cảm thấy. Nếu lực đo được khác quá nhiều, nhiều khả năng phích đang tì vào mép ổ. Tính $e_t$ để thấy một bất ngờ 4 N kích hoạt việc tạm dừng ra sao.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\hat F_t$ | wrench dự đoán $(f_x, f_y, f_z, \tau_x, \tau_y, \tau_z)$ | input | $(0, 0, -5, 0, 0, 0)$ |
| $F_t$ | wrench đo được | input | $(0.5, 0, -9, 0, 0, 0.1)$ |
| $c$ | ngưỡng | hằng số | 3 (minh họa) |
| $e_t$ | sai số lực | output | – |

**Công thức** (chuẩn L1: tổng trị tuyệt đối của hiệu)

$$e_t = \lVert \hat F_t - F_t \rVert_1 = \sum_{j=1}^{6} \left| \hat F_{t,j} - F_{t,j} \right|, \qquad \text{dừng nếu } e_t > c$$

**Từng bước**

1. Hiệu: $(-0.5,\ 0,\ 4,\ 0,\ 0,\ -0.1)$.
2. Cộng trị tuyệt đối: $0.5 + 0 + 4 + 0 + 0 + 0.1 = 4.6$.
3. So sánh: $4.6 > 3$.

**Kết quả.** Bộ phát hiện kích hoạt: tạm dừng và gọi người.

**Ý nghĩa.** Camera có thể không thấy phích đang ấn mạnh hơn dự kiến 4 N vào mép ổ; lực thì thấy. Robot xin giúp đỡ đúng lúc nó bắt đầu hỏng, không phải lúc một người tình cờ để ý.
</div>

## 4. Huấn luyện và thiết lập

| Mục | Giá trị |
|---|---|
| Chính sách nền | 100 demo, 2.000 epoch |
| Residual | 50 demo hiệu chỉnh, 200 epoch |
| Trọng số chỉnh sửa | $\omega_p = 1.0$ (vị trí), $\omega_q = 0.5$ (hướng), $\lambda_s = 1$, $\lambda_e = 1000$ |
| Task | phích USB, hai chấu, ba chấu; MuJoCo + Franka thật; 50 lượt mỗi task |
| Baseline | ACT, FILIC, HG-DAgger, Retrain, Finetune |

## 5. Kết quả

[[bars:%]] ACT=27.6; FILIC=25.6; HG-DAgger=31.6; Retrain=32.4; Finetune=40; *TER-DAgger=77.2* || Tỉ lệ thành công trung bình trên năm tác vụ, 50 lượt mỗi tác vụ (Bảng I của paper).

| Phương pháp | USB mô phỏng | Phích hai chân mô phỏng | USB thật | Phích hai chân thật | Phích ba chân thật | Trung bình |
|---|---|---|---|---|---|---|
| ACT | 26% | 22% | 2% | 64% | 24% | 27,6% |
| HG-DAgger | 50% | 44% | 16% | 36% | 12% | 31,6% |
| Finetune | 68% | 54% | 10% | 28% | 40% | 40,0% |
| TER-DAgger | 90% | 96% | 22% | 96% | 82% | 77,2% |

- Bộ phát hiện sai số giữ recall 100% (ngưỡng được chọn cho điều đó) và đạt độ chính xác trung bình 98,8% với sai số dự đoán lực; KL loss, loss tái tạo và sai số vị trí cho độ chính xác thấp hơn.
- Lưu ý ô yếu: lắp USB thật chỉ đạt 22%.

## 6. Lưu ý

- Đã đối chiếu với toàn văn: các số ở phần kết quả khớp Bảng I và Bảng II của paper (50 lượt mỗi tác vụ).
- Bản hiệu chỉnh do người làm bằng tay khi độ cứng trở kháng đặt bằng 0; giao diện vật lý và các giá trị độ cứng còn lại không được nêu.

**Mang sang bài sau:** bài này khép lại series paper lực. [Survey 1](survey-force-map.html) đặt cả mười một bài cạnh nhau cùng 22 phương pháp khác.

**Câu kiểm tra:** $\hat F = (0, 0, -4, 0, 0, 0)$, $F = (0.2, -0.3, -5, 0.1, 0, 0)$, $c = 3$. Bộ phát hiện có kích hoạt không?

<details markdown="1">
<summary>Đáp án</summary>

$e_t = 0.2 + 0.3 + 1 + 0.1 = 1.6 < 3$: không dừng.
</details>
:::
