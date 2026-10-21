---
slug: flowmatching
date: 2026-10-18
title_en: "Flow Matching: Straight Paths From Noise to Action"
title_vi: "Flow Matching: Đường thẳng từ nhiễu đến hành động"
excerpt_en: "Diffusion policies denoise along a curved path in many steps. Flow matching trains a network to predict a constant velocity along a straight line, so about ten Euler steps are enough. Worked by hand in one dimension."
excerpt_vi: "Diffusion policy khử nhiễu theo đường cong qua nhiều bước. Flow matching huấn luyện mạng dự đoán vận tốc không đổi dọc một đường thẳng, nên khoảng mười bước Euler là đủ. Tính tay trong một chiều."
tags: [VLA, Foundations, Flow Matching, Diffusion]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Lipman et al., *Flow Matching for Generative Modeling*, [arXiv 2210.02747](https://arxiv.org/abs/2210.02747) · 10/2022

**PROBLEM** A policy must output a *continuous* action chunk, possibly with several valid modes, not a single average.

**WHAT FAILED BEFORE** Continuous normalizing flows could model this but were trained by simulating ODEs, which is expensive. Diffusion models train without simulation but are tied to Gaussian noise paths and sampling takes many denoising steps (tens to hundreds). Diffusion Policy inherits this cost.

**IDEA** Pick a simple path between noise $x_0$ and data $x_1$ (a straight line), and regress the network onto the path's velocity $x_1 - x_0$. Sample by integrating the learned velocity from noise.

**RESULT** Simple regression training and a few integration steps. π0 uses it in its action expert with $\delta = 0.1$ (ten steps).
</div>

## 1. The problem: many steps for a curved path

[[flow]]
- Before~Diffusion policy | Noise > !Denoise step 1~curved path! > !... step 50-100! > Action | many network calls per action chunk
+ Flow matching | Noise > *Velocity field~straight line* > Action | about 10 Euler steps
[[/flow]] The change is the path: a straight line has a constant velocity, so large steps stay accurate.

## 2. The mechanism

[[fig:flowmatching]] Left: diffusion path is curved and needs many steps. Right: the flow path from noise $x_0$ to action $x_1$ is a straight line with constant velocity $x_1 - x_0$.

| Block | Input | Output | Role |
|---|---|---|---|
| Interpolation | $x_0$ (noise), $x_1$ (true action), $t$ | $x_t$ | a point on the straight path |
| Network $v_\theta$ | $x_t$, $t$, observation | predicted velocity | learned during training |
| Loss | $v_\theta$, $x_1 - x_0$ | scalar | squared error to the true velocity |
| Sampler (Euler) | $x_0$, $v_\theta$ | $x_1$ (action) | follow the velocity in steps of $\delta$ |

<div class="calc" markdown="1">

Calculation card

**What and why.** One training example and one sampling pass in one dimension. It shows the network's target and why a straight path needs few steps.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $x_0$ | noise sample | input | $-1$ |
| $x_1$ | true action | input | $2$ |
| $t$ | time, $0$ = noise, $1$ = data | input | $0.25$ |
| $x_t$ | point on the path at time $t$ | output | – |
| $u$ | target velocity | output | – |
| $\delta$ | Euler step | constant | $0.1$ |

(Convention of Lipman et al.: $t = 0$ is noise. Some robot papers flip the direction; check each paper.)

**Formula**

$$x_t = (1-t)\,x_0 + t\,x_1, \qquad u = x_1 - x_0, \qquad L = \| v_\theta(x_t, t) - u \|^2$$

$$\text{sampling: } x \leftarrow x + \delta \, v_\theta(x, t)$$

**Steps**

1. $x_{0.25} = 0.75 \times (-1) + 0.25 \times 2 = -0.75 + 0.5 = -0.25$.
2. $u = 2 - (-1) = 3$. The network must output $3$ here. If it outputs $2.5$, the loss is $(2.5-3)^2 = 0.25$.
3. Sampling with a perfect $v = 3$ and $\delta = 0.1$: ten steps of $+0.3$ go from $-1$ to $-1 + 10 \times 0.3 = 2$. Exact.

**Result.** The target is the constant 3; ten steps reach the data point exactly.

**Why it matters.** On a straight path the velocity does not change, so even a big step lands on the right place. On a curved path, large steps overshoot and many small ones are needed. (In real data the true velocity at $x_t$ is an average over many possible data points, so the path is only approximately straight, and a few more steps still help.)
</div>

## 3. In VLA

- π0 and its relatives put a flow-matching action expert after the VLM: noise action chunk in, velocity out, ten Euler steps. TaF-VLA, ForceVLA and others reuse it.
- Force papers keep this action head and change what it is conditioned on or what it outputs: see the [force surveys](survey-force-output.html).
- Why this solves the "average of two good answers" problem from [imitation learning](imitation-learning.html): sampling starts from *random* noise, and different noise samples are carried to different modes. If the demonstrations go left half the time and right half the time, about half of the samples end on the left and half on the right; none is pushed to the useless middle, which is what a single squared-error regression would output.

**Carry forward:** flow matching turns noise into a whole *chunk* of actions at once. Why predict a chunk at all, and how is it executed? [Action chunking](action-chunking.html).

**Check question:** $x_0 = 1$, $x_1 = 5$, $t = 0.5$. What are $x_t$ and $u$?

<details markdown="1">
<summary>Answer</summary>

$x_{0.5} = 0.5 \times 1 + 0.5 \times 5 = 3$; $u = 5 - 1 = 4$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Lipman et al., *Flow Matching for Generative Modeling*, [arXiv 2210.02747](https://arxiv.org/abs/2210.02747) · 10/2022

**VẤN ĐỀ** Một chính sách phải xuất ra đoạn hành động *liên tục*, có thể có nhiều mode hợp lệ, chứ không phải một giá trị trung bình.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Continuous normalizing flow mô hình hóa được nhưng huấn luyện bằng cách mô phỏng ODE, rất tốn kém. Mô hình diffusion huấn luyện không cần mô phỏng nhưng gắn với đường nhiễu Gauss và việc lấy mẫu cần nhiều bước khử nhiễu (hàng chục đến hàng trăm). Diffusion Policy thừa hưởng chi phí này.

**Ý TƯỞNG** Chọn một đường đơn giản giữa nhiễu $x_0$ và dữ liệu $x_1$ (đường thẳng), và hồi quy mạng về vận tốc của đường đó $x_1 - x_0$. Lấy mẫu bằng cách tích phân vận tốc đã học từ nhiễu.

**KẾT QUẢ** Huấn luyện là hồi quy đơn giản và chỉ cần vài bước tích phân. π0 dùng nó trong action expert với $\delta = 0{,}1$ (mười bước).
</div>

## 1. Vấn đề: đường cong cần nhiều bước

[[flow]]
- Trước~Diffusion policy | Nhiễu > !Khử nhiễu bước 1~đường cong! > !... bước 50-100! > Hành động | nhiều lần gọi mạng cho mỗi đoạn hành động
+ Flow matching | Nhiễu > *Trường vận tốc~đường thẳng* > Hành động | khoảng 10 bước Euler
[[/flow]] Thay đổi nằm ở đường đi: đường thẳng có vận tốc không đổi nên bước lớn vẫn chính xác.

## 2. Cơ chế

[[fig:flowmatching]] Trái: đường của diffusion cong và cần nhiều bước. Phải: đường flow từ nhiễu $x_0$ đến hành động $x_1$ là đường thẳng với vận tốc không đổi $x_1 - x_0$.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Nội suy | $x_0$ (nhiễu), $x_1$ (hành động thật), $t$ | $x_t$ | một điểm trên đường thẳng |
| Mạng $v_\theta$ | $x_t$, $t$, quan sát | vận tốc dự đoán | được học khi huấn luyện |
| Loss | $v_\theta$, $x_1 - x_0$ | số vô hướng | sai số bình phương so với vận tốc thật |
| Bộ lấy mẫu (Euler) | $x_0$, $v_\theta$ | $x_1$ (hành động) | đi theo vận tốc từng bước $\delta$ |

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Một ví dụ huấn luyện và một lượt lấy mẫu trong một chiều. Cho thấy mục tiêu của mạng và vì sao đường thẳng cần ít bước.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $x_0$ | mẫu nhiễu | input | $-1$ |
| $x_1$ | hành động thật | input | $2$ |
| $t$ | thời gian, $0$ = nhiễu, $1$ = dữ liệu | input | $0{,}25$ |
| $x_t$ | điểm trên đường tại thời điểm $t$ | output | – |
| $u$ | vận tốc mục tiêu | output | – |
| $\delta$ | bước Euler | hằng số | $0{,}1$ |

(Quy ước của Lipman et al.: $t = 0$ là nhiễu. Một số paper robot đảo chiều; hãy kiểm tra từng paper.)

**Công thức**

$$x_t = (1-t)\,x_0 + t\,x_1, \qquad u = x_1 - x_0, \qquad L = \| v_\theta(x_t, t) - u \|^2$$

$$\text{lấy mẫu: } x \leftarrow x + \delta \, v_\theta(x, t)$$

**Các bước**

1. $x_{0{,}25} = 0{,}75 \times (-1) + 0{,}25 \times 2 = -0{,}75 + 0{,}5 = -0{,}25$.
2. $u = 2 - (-1) = 3$. Mạng phải xuất ra $3$ ở đây. Nếu xuất $2{,}5$, loss là $(2{,}5-3)^2 = 0{,}25$.
3. Lấy mẫu với $v = 3$ hoàn hảo và $\delta = 0{,}1$: mười bước $+0{,}3$ đi từ $-1$ đến $-1 + 10 \times 0{,}3 = 2$. Chính xác.

**Kết quả.** Mục tiêu là hằng số 3; mười bước đến đúng điểm dữ liệu.

**Ý nghĩa.** Trên đường thẳng vận tốc không đổi, nên bước lớn vẫn tới đúng chỗ. Trên đường cong, bước lớn bị vọt và cần nhiều bước nhỏ. (Với dữ liệu thật, vận tốc đúng tại $x_t$ là trung bình trên nhiều điểm dữ liệu có thể, nên đường chỉ gần thẳng, và thêm vài bước vẫn có ích.)
</div>

## 3. Trong VLA

- π0 và các biến thể đặt một action expert flow-matching sau VLM: vào là đoạn hành động nhiễu, ra là vận tốc, mười bước Euler. TaF-VLA, ForceVLA và các paper khác dùng lại.
- Các paper lực giữ phần đầu ra hành động này và đổi thứ nó nhận vào hoặc xuất ra: xem [survey lực](survey-force-output.html).
- Vì sao điều này giải được bài toán "trung bình của hai câu trả lời đúng" ở bài [imitation learning](imitation-learning.html): việc lấy mẫu bắt đầu từ nhiễu *ngẫu nhiên*, và các mẫu nhiễu khác nhau được đưa tới các mode khác nhau. Nếu demo rẽ trái một nửa số lần và rẽ phải một nửa, khoảng một nửa số mẫu kết thúc bên trái và một nửa bên phải; không mẫu nào bị đẩy vào khoảng giữa vô dụng, vốn là thứ mà một phép hồi quy sai số bình phương sẽ xuất ra.

**Mang theo:** flow matching biến nhiễu thành cả một *chunk* hành động cùng lúc. Vì sao lại dự đoán cả chunk, và chunk được thực thi ra sao? [Action chunking](action-chunking.html).

**Câu hỏi kiểm tra:** $x_0 = 1$, $x_1 = 5$, $t = 0{,}5$. $x_t$ và $u$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$x_{0{,}5} = 0{,}5 \times 1 + 0{,}5 \times 5 = 3$; $u = 5 - 1 = 4$.
</details>
:::
