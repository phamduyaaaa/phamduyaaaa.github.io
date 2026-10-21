---
slug: diffusion-policy
date: 2026-10-21
title_en: "Diffusion Policy: Generating Actions by Removing Noise"
title_vi: "Diffusion Policy: Sinh hành động bằng cách gỡ nhiễu"
excerpt_en: "Demonstrations often contain several right ways to act, and a regression head averages them. Diffusion Policy learns to remove noise from an action sequence, so sampling from noise lands on one valid way. The noising step and the noise target worked by hand."
excerpt_vi: "Demo thường chứa nhiều cách làm đúng, và một đầu hồi quy lấy trung bình chúng. Diffusion Policy học cách gỡ nhiễu khỏi một chuỗi hành động, nên lấy mẫu từ nhiễu sẽ rơi vào một cách làm hợp lệ. Tính tay bước thêm nhiễu và mục tiêu dự đoán nhiễu."
tags: [VLA, Foundations, Diffusion, Generative]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Chi et al., *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*, [arXiv 2303.04137](https://arxiv.org/abs/2303.04137) · 03/2023. Built on DDPM, [arXiv 2006.11239](https://arxiv.org/abs/2006.11239) · 06/2020

**PROBLEM** A policy must output a sequence of continuous actions that can have several valid modes (go around the left or the right of the obstacle), in many dimensions.

**WHAT FAILED BEFORE** Explicit policies regress one action or a few mixture components and average or miss modes. Implicit, energy-based policies (IBC) can represent modes but need negative samples, which makes training unstable. Action bins (BET) handle modes but coarsely.

**IDEA** Treat the action sequence like an image to be generated: train a network to predict the noise that was added to a demonstrated sequence, then sample by starting from pure noise and removing it step by step, conditioned on the observation. Predict a sequence, execute part of it, re-plan.

**RESULT** Across 12 tasks from 4 benchmarks, an average improvement of 46.9% over the previous state of the art (paper's abstract). In real robots, DDIM with 100 training and 10 inference steps gave 0.1 s inference on an RTX 3080. Flow matching, used by π0, follows the same idea with straighter paths.
</div>

## 1. The problem: averaging, or unstable training

[[flow]]
- Before~Explicit regression | Observation > !One action~squared error averages modes! > Action | left + right gives straight into the obstacle
- Before~Implicit (IBC) | Observation + candidate > !Energy model~needs negatives, unstable! > Best candidate | represents modes, hard to train
+ Diffusion Policy | Noise + observation > *Denoise step by step~learned noise predictor* > Action sequence | samples one mode, trains as regression
[[/flow]] The change: the network never outputs the action directly; it learns which direction makes a noisy action more like a real one.

## 2. Training and sampling

[[fig:diffusion-policy]] Top: training adds noise of a random level to a demonstration and asks the network to name the noise. Bottom: sampling starts from noise and repeatedly removes the predicted noise.

| Part | Input | Output | Role |
|---|---|---|---|
| Noise schedule $\bar\alpha_k$ | step $k$ | how much signal is left | $\bar\alpha$ near 1: almost clean; near 0: almost pure noise |
| Noise predictor $\varepsilon_\theta$ | noisy chunk $a_k$, level $k$, observation | predicted noise | a CNN or Transformer conditioned on images and state |
| Loss | $\varepsilon_\theta$, true $\varepsilon$ | $\lVert\varepsilon_\theta - \varepsilon\rVert^2$ | plain regression, stable to train |
| Sampler | noise $a_K$ | clean chunk $a_0$ | $K$ denoising steps (DDIM allows fewer at inference) |
| Receding horizon | observation horizon $T_o$, prediction $T_p$, execution $T_a$ | executed actions | plan $T_p$ steps, run $T_a$, observe, plan again |

<div class="calc" markdown="1">
Calculation card

**What and why.** One training example in one dimension: make the noisy input, then check that predicting the noise is the same as knowing the clean action.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $a_0$ | clean demonstrated action | input | 0.6 |
| $\varepsilon$ | Gaussian noise sample | input | −0.5 |
| $\bar\alpha_k$ | signal kept at level $k$ | constant | 0.64 |
| $a_k$ | noisy action fed to the network | output | – |
| $\hat\varepsilon$ | network's noise prediction | output | – |
| $\hat a_0$ | clean action implied by $\hat\varepsilon$ | output | – |

**Formulas**

$$a_k = \sqrt{\bar\alpha_k}\,a_0 + \sqrt{1-\bar\alpha_k}\,\varepsilon, \qquad \hat a_0 = \frac{a_k - \sqrt{1-\bar\alpha_k}\,\hat\varepsilon}{\sqrt{\bar\alpha_k}}$$

**Steps**

1. $\sqrt{0.64} = 0.8$, $\sqrt{0.36} = 0.6$.
2. $a_k = 0.8 \times 0.6 + 0.6 \times (-0.5) = 0.48 - 0.30 = 0.18$.
3. A perfect network outputs $\hat\varepsilon = -0.5$; then $\hat a_0 = (0.18 + 0.30) / 0.8 = 0.6$. Exact.
4. A network that outputs $\hat\varepsilon = -0.4$ has loss $(-0.4 + 0.5)^2 = 0.01$ and implies $\hat a_0 = (0.18 + 0.24)/0.8 = 0.525$.

**Result.** The noisy input is 0.18; naming the noise recovers 0.6, and a noise error of 0.1 becomes an action error of 0.075.

**Why it matters.** Predicting the noise is a regression with a single right answer per example, so it trains stably, unlike energy models. Yet the *sampler* can end in different modes: if half the demonstrations go to −1 and half to +1, a noisy point near −1 gets denoised toward −1 and one near +1 toward +1. Repeating this over many small steps turns random noise into one of the demonstrated behaviours instead of their average.
</div>

## 3. Design lessons that carried over

- **Position, not velocity.** The paper found Diffusion Policy "consistently" better with position commands than with velocity commands, the opposite of many earlier behavior-cloning methods ([action spaces](action-spaces.html)).
- **Chunks with re-planning.** Predicting $T_p$ steps and executing $T_a$ of them gives smooth motion and tolerates latency; it is the same idea as [action chunking](action-chunking.html).
- **Speed is the cost.** Each action chunk needs several network calls. DDIM cut it to 10 in the paper's real-robot runs; [flow matching](flowmatching.html) uses straighter paths so that about 10 Euler steps suffice, and is what π0 uses.
- **Force papers on this site** keep a diffusion or flow head and change its inputs or outputs: TA-VLA adds torque to the diffusion target; FACT co-denoises force with the action.

**Carry forward:** the curved noise-removal path needs many steps. Straightening it is the idea of [flow matching](flowmatching.html).

**Check question:** $a_0 = -0.2$, $\varepsilon = 1.0$, $\bar\alpha_k = 0.36$. What is $a_k$, and what $\hat a_0$ does a perfect prediction give back?

<details markdown="1">
<summary>Answer</summary>

$\sqrt{0.36} = 0.6$, $\sqrt{0.64} = 0.8$. $a_k = 0.6 \times (-0.2) + 0.8 \times 1.0 = -0.12 + 0.8 = 0.68$. With $\hat\varepsilon = 1.0$: $\hat a_0 = (0.68 - 0.8)/0.6 = -0.2$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Chi và cộng sự, *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*, [arXiv 2303.04137](https://arxiv.org/abs/2303.04137) · 03/2023. Dựa trên DDPM, [arXiv 2006.11239](https://arxiv.org/abs/2006.11239) · 06/2020

**VẤN ĐỀ** Chính sách phải xuất một chuỗi hành động liên tục có thể có nhiều mode hợp lệ (vòng qua bên trái hay bên phải vật cản), trong nhiều chiều.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Chính sách tường minh hồi quy một hành động hoặc vài thành phần hỗn hợp, nên lấy trung bình hoặc bỏ sót mode. Chính sách ngầm dựa trên năng lượng (IBC) biểu diễn được nhiều mode nhưng cần mẫu âm, khiến huấn luyện bất ổn. Chia hành động thành bin (BET) xử lý được mode nhưng thô.

**Ý TƯỞNG** Coi chuỗi hành động như một bức ảnh cần sinh: huấn luyện mạng đoán phần nhiễu đã được cộng vào một chuỗi demo, rồi lấy mẫu bằng cách bắt đầu từ nhiễu thuần và gỡ nó từng bước, có điều kiện theo quan sát. Dự đoán cả chuỗi, thực thi một phần, rồi lập kế hoạch lại.

**KẾT QUẢ** Trên 12 tác vụ thuộc 4 benchmark, cải thiện trung bình 46,9% so với kết quả tốt nhất trước đó (theo abstract). Trên robot thật, DDIM với 100 bước huấn luyện và 10 bước suy luận cho thời gian suy luận 0,1 s trên RTX 3080. Flow matching, mà π0 dùng, đi theo cùng ý tưởng với đường đi thẳng hơn.
</div>

## 1. Vấn đề: lấy trung bình, hoặc huấn luyện bất ổn

[[flow]]
- Trước~Hồi quy tường minh | Quan sát > !Một hành động~sai số bình phương lấy trung bình các mode! > Hành động | trái + phải thành lao thẳng vào vật cản
- Trước~Ngầm (IBC) | Quan sát + ứng viên > !Mô hình năng lượng~cần mẫu âm, bất ổn! > Ứng viên tốt nhất | biểu diễn được mode, khó huấn luyện
+ Diffusion Policy | Nhiễu + quan sát > *Gỡ nhiễu từng bước~bộ đoán nhiễu học được* > Chuỗi hành động | lấy mẫu một mode, huấn luyện như hồi quy
[[/flow]] Thay đổi: mạng không bao giờ xuất trực tiếp hành động; nó học hướng nào làm một hành động nhiễu giống hành động thật hơn.

## 2. Huấn luyện và lấy mẫu

[[fig:diffusion-policy]] Trên: huấn luyện cộng nhiễu ở một mức ngẫu nhiên vào một demo và bắt mạng gọi tên phần nhiễu. Dưới: lấy mẫu bắt đầu từ nhiễu và lặp đi lặp lại việc gỡ phần nhiễu được dự đoán.

| Bộ phận | Input | Output | Vai trò |
|---|---|---|---|
| Lịch nhiễu $\bar\alpha_k$ | bước $k$ | còn lại bao nhiêu tín hiệu | $\bar\alpha$ gần 1: gần sạch; gần 0: gần như nhiễu thuần |
| Bộ đoán nhiễu $\varepsilon_\theta$ | chunk nhiễu $a_k$, mức $k$, quan sát | nhiễu dự đoán | một CNN hoặc Transformer có điều kiện theo ảnh và trạng thái |
| Loss | $\varepsilon_\theta$, $\varepsilon$ thật | $\lVert\varepsilon_\theta - \varepsilon\rVert^2$ | hồi quy thuần, huấn luyện ổn định |
| Bộ lấy mẫu | nhiễu $a_K$ | chunk sạch $a_0$ | $K$ bước gỡ nhiễu (DDIM cho phép ít bước hơn khi suy luận) |
| Horizon lùi dần | horizon quan sát $T_o$, dự đoán $T_p$, thực thi $T_a$ | hành động được thực thi | lên kế hoạch $T_p$ bước, chạy $T_a$, quan sát, lên kế hoạch lại |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một mẫu huấn luyện một chiều: tạo đầu vào nhiễu, rồi kiểm tra rằng đoán đúng nhiễu cũng chính là biết được hành động sạch.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $a_0$ | hành động demo sạch | input | 0,6 |
| $\varepsilon$ | mẫu nhiễu Gauss | input | −0,5 |
| $\bar\alpha_k$ | phần tín hiệu giữ lại ở mức $k$ | hằng số | 0,64 |
| $a_k$ | hành động nhiễu đưa vào mạng | output | – |
| $\hat\varepsilon$ | nhiễu mà mạng dự đoán | output | – |
| $\hat a_0$ | hành động sạch suy ra từ $\hat\varepsilon$ | output | – |

**Công thức**

$$a_k = \sqrt{\bar\alpha_k}\,a_0 + \sqrt{1-\bar\alpha_k}\,\varepsilon, \qquad \hat a_0 = \frac{a_k - \sqrt{1-\bar\alpha_k}\,\hat\varepsilon}{\sqrt{\bar\alpha_k}}$$

**Từng bước**

1. $\sqrt{0{,}64} = 0{,}8$, $\sqrt{0{,}36} = 0{,}6$.
2. $a_k = 0{,}8 \times 0{,}6 + 0{,}6 \times (-0{,}5) = 0{,}48 - 0{,}30 = 0{,}18$.
3. Mạng hoàn hảo xuất $\hat\varepsilon = -0{,}5$; khi đó $\hat a_0 = (0{,}18 + 0{,}30) / 0{,}8 = 0{,}6$. Chính xác.
4. Mạng xuất $\hat\varepsilon = -0{,}4$ có loss $(-0{,}4 + 0{,}5)^2 = 0{,}01$ và suy ra $\hat a_0 = (0{,}18 + 0{,}24)/0{,}8 = 0{,}525$.

**Kết quả.** Đầu vào nhiễu là 0,18; gọi đúng tên nhiễu thì lấy lại được 0,6, và sai 0,1 ở nhiễu thành sai 0,075 ở hành động.

**Ý nghĩa.** Đoán nhiễu là một bài hồi quy với một đáp án đúng duy nhất cho mỗi mẫu, nên huấn luyện ổn định, khác với mô hình năng lượng. Thế nhưng *bộ lấy mẫu* có thể kết thúc ở các mode khác nhau: nếu một nửa số demo đi tới −1 và một nửa tới +1, một điểm nhiễu gần −1 được gỡ nhiễu về phía −1, còn điểm gần +1 về phía +1. Lặp lại qua nhiều bước nhỏ biến nhiễu ngẫu nhiên thành một trong các hành vi đã được làm mẫu, chứ không phải trung bình của chúng.
</div>

## 3. Những bài học thiết kế được mang theo

- **Vị trí, không phải vận tốc.** Paper thấy Diffusion Policy "luôn" tốt hơn với lệnh vị trí so với lệnh vận tốc, ngược với nhiều phương pháp behavior cloning trước đó ([không gian hành động](action-spaces.html)).
- **Chunk kèm lập kế hoạch lại.** Dự đoán $T_p$ bước và thực thi $T_a$ bước cho chuyển động mượt và chịu được độ trễ; đó cũng là ý tưởng của [action chunking](action-chunking.html).
- **Cái giá là tốc độ.** Mỗi chunk hành động cần nhiều lần gọi mạng. DDIM giảm xuống 10 trong các lượt chạy robot thật của paper; [flow matching](flowmatching.html) dùng đường đi thẳng hơn để khoảng 10 bước Euler là đủ, và là thứ π0 dùng.
- **Các bài lực trên trang này** giữ một đầu diffusion hoặc flow và đổi đầu vào hoặc đầu ra của nó: TA-VLA thêm mô-men vào mục tiêu diffusion; FACT khử nhiễu lực cùng với hành động.

**Mang theo:** đường gỡ nhiễu cong cần nhiều bước. Làm nó thẳng ra là ý tưởng của [flow matching](flowmatching.html).

**Câu kiểm tra:** $a_0 = -0{,}2$, $\varepsilon = 1{,}0$, $\bar\alpha_k = 0{,}36$. $a_k$ bằng bao nhiêu, và một dự đoán hoàn hảo cho lại $\hat a_0$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\sqrt{0{,}36} = 0{,}6$, $\sqrt{0{,}64} = 0{,}8$. $a_k = 0{,}6 \times (-0{,}2) + 0{,}8 \times 1{,}0 = -0{,}12 + 0{,}8 = 0{,}68$. Với $\hat\varepsilon = 1{,}0$: $\hat a_0 = (0{,}68 - 0{,}8)/0{,}6 = -0{,}2$.
</details>
:::
