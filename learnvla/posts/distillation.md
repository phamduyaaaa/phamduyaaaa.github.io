---
slug: distillation
date: 2026-10-21
title_en: "Distillation: Teaching a Student What the Teacher Knows"
title_vi: "Distillation: Dạy học trò những gì người thầy biết"
excerpt_en: "A big model, or a model with a sensor the robot will not carry, can teach a smaller or sensor-free one. The trick is to copy the teacher's soft outputs, not only the right answer. Temperature worked by hand, and how FD-VLA and HapticVLA distil force and touch away."
excerpt_vi: "Một mô hình lớn, hoặc một mô hình có cảm biến mà robot sẽ không mang theo, có thể dạy một mô hình nhỏ hơn hoặc không cần cảm biến. Mẹo là chép đầu ra mềm của người thầy, không chỉ đáp án đúng. Tính tay nhiệt độ, và cách FD-VLA, HapticVLA chưng cất lực và xúc giác để bỏ cảm biến."
tags: [VLA, Foundations, Distillation, Force]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Hinton, Vinyals, Dean, *Distilling the Knowledge in a Neural Network*, [arXiv 1503.02531](https://arxiv.org/abs/1503.02531) · 03/2015

**PROBLEM** The best model is often too big to run fast, or depends on information that will not exist at deployment: a force sensor removed for cost, a touch sensor that wears out, a simulator's exact object pose.

**WHAT FAILED BEFORE** Training the small model only on the correct labels throws away what the big model knows about the *wrong* answers, which ones are almost right. Deploying an ensemble or the big model is "cumbersome and may be too computationally expensive" (the paper).

**IDEA** Train the student to match the teacher's output distribution, softened with a temperature $T$ so that small probabilities become visible. In robotics the same pattern appears with features: a student without a sensor learns to predict what the teacher's sensor-based encoder would have produced.

**RESULT** The paper distils an ensemble into one model and improves a commercial speech system. On this site, [FD-VLA](fd-vla.html) trains with a force sensor and deploys without one (61.1% against 46.7% for π0 on its three tasks), and [HapticVLA](hapticvla.html) removes touch at run time (86.7% mean).
</div>

## 1. The problem: knowledge locked in the wrong model

[[flow]]
- Before~Hard labels only | Data > !Small model learns the label~"cup", nothing else! > Student | loses the teacher's "almost a mug"
- Before~Deploy the teacher | Big model or extra sensor > !Too slow, or sensor absent! > Robot | cannot run as trained
+ Distillation | Teacher outputs > *Soft targets or features~at temperature T* > Student | small, fast, sensor-free
[[/flow]] The change is the target: the student copies a distribution or a feature, which carries more information per example than one label.

## 2. Teacher and student

[[fig:distillation]] The teacher sees more (a bigger network, or privileged signals). The student is trained to reproduce the teacher's soft outputs or internal features and is the only one deployed.

| Term | Meaning |
|---|---|
| Teacher | trained first; large, an ensemble, or given privileged inputs |
| Student | trained to match the teacher; what runs on the robot |
| Temperature $T$ | divide logits by $T$ before softmax; $T > 1$ spreads probability onto the "almost right" answers |
| Soft-target loss | cross-entropy between teacher and student distributions, both at temperature $T$, scaled by $T^2$ |
| Feature distillation | match an internal vector instead of output probabilities (FD-VLA's force token) |

<div class="calc" markdown="1">
Calculation card

**What and why.** See what temperature does to a teacher's output, and compute the student's soft-target loss.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $z$ | teacher logits for (cup, mug, plate) | input | $(4,\ 1,\ 0)$ |
| $T$ | temperature | constant | 1, then 2 |
| $p^T$ | teacher soft targets | output | – |
| $q^T$ | student probabilities at the same $T$ | input | $(0.6,\ 0.3,\ 0.1)$ |
| $L$ | soft-target loss | output | – |

**Formulas**

$$p^T_i = \frac{e^{z_i/T}}{\sum_j e^{z_j/T}}, \qquad L = -T^2 \sum_i p^T_i \log q^T_i$$

**Steps**

1. $T = 1$: $e^4 = 54.6$, $e^1 = 2.72$, $e^0 = 1$; sum $= 58.3$; $p = (0.936,\ 0.047,\ 0.017)$.
2. $T = 2$: logits $(2,\ 0.5,\ 0)$; $e^2 = 7.39$, $e^{0.5} = 1.65$, $e^0 = 1$; sum $= 10.04$; $p = (0.736,\ 0.164,\ 0.100)$.
3. Cross-entropy: $0.736 \times 0.511 + 0.164 \times 1.204 + 0.100 \times 2.303 = 0.376 + 0.197 + 0.230 = 0.804$.
4. Scale by $T^2 = 4$: $L = 3.22$.

**Result.** At $T = 1$ the teacher says "cup" with 94% and almost nothing else; at $T = 2$ it says 74% cup, 16% mug, 10% plate. The student's loss against that is 0.80 before scaling.

**Why it matters.** "Mug is more likely than plate" is knowledge the hard label "cup" does not contain; the temperature makes it large enough to learn from. Softening also shrinks gradients by about $1/T^2$, which is why the paper multiplies the loss by $T^2$ to keep its weight comparable when mixed with the normal hard-label loss.
</div>

## 3. Distillation in robot learning

- **Sensor at training, not at deployment.** FD-VLA's force distillation module predicts a force token from images and state; during training it is pulled toward the encoding of the real sensor force, and at run time the sensor is gone.
- **Touch removed after training.** HapticVLA uses touch offline to judge which demonstrations were safe, then trains a policy that does not need touch at run time.
- **Privileged simulation teachers.** A teacher trained in simulation with exact object poses supervises a student that only sees cameras; FIRe's critic, which sees privileged simulator state while the actor does not, uses a related asymmetry ([residual policy](residual-policy.html)).
- **Fewer generation steps.** A many-step diffusion policy can teach a one- or few-step student; this is how some fast policies avoid the cost of [diffusion](diffusion-policy.html).

**Carry forward:** a student replaces a teacher. Sometimes the better move is to *keep* a good policy and learn only a small correction on top: [residual policy](residual-policy.html).

**Check question:** Teacher logits $(2,\ 2,\ 0)$ at $T = 1$. What are the soft targets?

<details markdown="1">
<summary>Answer</summary>

$e^2 = 7.39$ twice, $e^0 = 1$; sum $= 15.78$; $p = (0.468,\ 0.468,\ 0.063)$. The teacher is undecided between the first two, which is exactly the information a hard label would hide.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Hinton, Vinyals, Dean, *Distilling the Knowledge in a Neural Network*, [arXiv 1503.02531](https://arxiv.org/abs/1503.02531) · 03/2015

**VẤN ĐỀ** Mô hình tốt nhất thường quá lớn để chạy nhanh, hoặc phụ thuộc vào thông tin sẽ không có khi triển khai: cảm biến lực bị bỏ đi vì giá, cảm biến xúc giác bị mòn, tư thế vật chính xác chỉ có trong mô phỏng.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Huấn luyện mô hình nhỏ chỉ trên nhãn đúng sẽ vứt bỏ những gì mô hình lớn biết về các đáp án *sai*, đáp án nào gần đúng. Triển khai cả một tổ hợp mô hình hay mô hình lớn thì "cồng kềnh và có thể quá tốn tính toán" (lời paper).

**Ý TƯỞNG** Huấn luyện học trò khớp phân phối đầu ra của người thầy, được làm mềm bằng nhiệt độ $T$ để các xác suất nhỏ hiện ra. Trong robot, cùng mẫu hình này xuất hiện với đặc trưng: học trò không có cảm biến học cách dự đoán thứ mà bộ mã hóa dựa trên cảm biến của người thầy lẽ ra sẽ sinh ra.

**KẾT QUẢ** Paper chưng cất một tổ hợp mô hình vào một mô hình và cải thiện một hệ thống nhận dạng giọng nói thương mại. Trên trang này, [FD-VLA](fd-vla.html) huấn luyện có cảm biến lực và triển khai không cần nó (61,1% so với 46,7% của π0 trên ba tác vụ của nó), và [HapticVLA](hapticvla.html) bỏ xúc giác khi chạy (trung bình 86,7%).
</div>

## 1. Vấn đề: kiến thức bị khóa trong mô hình không phù hợp

[[flow]]
- Trước~Chỉ nhãn cứng | Dữ liệu > !Mô hình nhỏ học nhãn~"cốc", ngoài ra không gì! > Học trò | mất cái "gần như là ca" của người thầy
- Trước~Triển khai người thầy | Mô hình lớn hoặc cảm biến thêm > !Quá chậm, hoặc không có cảm biến! > Robot | không chạy được như lúc huấn luyện
+ Distillation | Đầu ra của thầy > *Mục tiêu mềm hoặc đặc trưng~ở nhiệt độ T* > Học trò | nhỏ, nhanh, không cần cảm biến
[[/flow]] Thay đổi nằm ở mục tiêu: học trò chép một phân phối hay một đặc trưng, thứ chứa nhiều thông tin mỗi mẫu hơn một nhãn.

## 2. Thầy và trò

[[fig:distillation]] Người thầy thấy nhiều hơn (mạng lớn hơn, hoặc tín hiệu đặc quyền). Học trò được huấn luyện để tái tạo đầu ra mềm hoặc đặc trưng bên trong của thầy, và chỉ học trò được triển khai.

| Thuật ngữ | Nghĩa |
|---|---|
| Thầy | huấn luyện trước; lớn, một tổ hợp, hoặc được cho đầu vào đặc quyền |
| Trò | huấn luyện để khớp với thầy; là thứ chạy trên robot |
| Nhiệt độ $T$ | chia logit cho $T$ trước softmax; $T > 1$ dàn xác suất sang các đáp án "gần đúng" |
| Loss mục tiêu mềm | cross-entropy giữa phân phối của thầy và trò, cả hai ở nhiệt độ $T$, nhân với $T^2$ |
| Chưng cất đặc trưng | khớp một vector bên trong thay vì xác suất đầu ra (token lực của FD-VLA) |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Xem nhiệt độ làm gì với đầu ra của người thầy, và tính loss mục tiêu mềm của học trò.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $z$ | logit của thầy cho (cốc, ca, đĩa) | input | $(4,\ 1,\ 0)$ |
| $T$ | nhiệt độ | hằng số | 1, rồi 2 |
| $p^T$ | mục tiêu mềm của thầy | output | – |
| $q^T$ | xác suất của trò ở cùng $T$ | input | $(0{,}6;\ 0{,}3;\ 0{,}1)$ |
| $L$ | loss mục tiêu mềm | output | – |

**Công thức**

$$p^T_i = \frac{e^{z_i/T}}{\sum_j e^{z_j/T}}, \qquad L = -T^2 \sum_i p^T_i \log q^T_i$$

**Từng bước**

1. $T = 1$: $e^4 = 54{,}6$, $e^1 = 2{,}72$, $e^0 = 1$; tổng $= 58{,}3$; $p = (0{,}936;\ 0{,}047;\ 0{,}017)$.
2. $T = 2$: logit $(2;\ 0{,}5;\ 0)$; $e^2 = 7{,}39$, $e^{0{,}5} = 1{,}65$, $e^0 = 1$; tổng $= 10{,}04$; $p = (0{,}736;\ 0{,}164;\ 0{,}100)$.
3. Cross-entropy: $0{,}736 \times 0{,}511 + 0{,}164 \times 1{,}204 + 0{,}100 \times 2{,}303 = 0{,}376 + 0{,}197 + 0{,}230 = 0{,}804$.
4. Nhân $T^2 = 4$: $L = 3{,}22$.

**Kết quả.** Ở $T = 1$ người thầy nói "cốc" với 94% và gần như không nói gì khác; ở $T = 2$ thầy nói 74% cốc, 16% ca, 10% đĩa. Loss của học trò so với đó là 0,80 trước khi nhân.

**Ý nghĩa.** "Ca dễ đúng hơn đĩa" là kiến thức mà nhãn cứng "cốc" không chứa; nhiệt độ làm nó đủ lớn để học được. Làm mềm cũng thu nhỏ gradient khoảng $1/T^2$, vì thế paper nhân loss với $T^2$ để giữ trọng số tương đương khi trộn với loss nhãn cứng thông thường.
</div>

## 3. Distillation trong học robot

- **Có cảm biến khi huấn luyện, không có khi triển khai.** Mô-đun chưng cất lực của FD-VLA dự đoán một token lực từ ảnh và trạng thái; khi huấn luyện, nó bị kéo về phía mã hóa của lực đo thật, và khi chạy thì cảm biến không còn.
- **Bỏ xúc giác sau khi huấn luyện.** HapticVLA dùng xúc giác offline để đánh giá demo nào an toàn, rồi huấn luyện một chính sách không cần xúc giác khi chạy.
- **Người thầy đặc quyền trong mô phỏng.** Một người thầy huấn luyện trong mô phỏng với tư thế vật chính xác giám sát một học trò chỉ thấy camera; critic của FIRe, thấy trạng thái đặc quyền của mô phỏng trong khi actor thì không, dùng một kiểu bất đối xứng tương tự ([residual policy](residual-policy.html)).
- **Ít bước sinh hơn.** Một chính sách diffusion nhiều bước có thể dạy một học trò một hoặc vài bước; đó là cách một số chính sách nhanh tránh được chi phí của [diffusion](diffusion-policy.html).

**Mang theo:** học trò thay thế người thầy. Đôi khi cách tốt hơn là *giữ* một chính sách tốt và chỉ học một phần hiệu chỉnh nhỏ bên trên: [residual policy](residual-policy.html).

**Câu kiểm tra:** Logit của thầy $(2,\ 2,\ 0)$ ở $T = 1$. Mục tiêu mềm là gì?

<details markdown="1">
<summary>Đáp án</summary>

$e^2 = 7{,}39$ hai lần, $e^0 = 1$; tổng $= 15{,}78$; $p = (0{,}468;\ 0{,}468;\ 0{,}063)$. Người thầy phân vân giữa hai lựa chọn đầu, đúng là thông tin mà một nhãn cứng sẽ che mất.
</details>
:::
