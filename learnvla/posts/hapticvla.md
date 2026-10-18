---
slug: hapticvla
date: 2026-10-18
title_en: "HapticVLA: Tactile-aware Manipulation Without Tactile Sensing at Inference"
title_vi: "HapticVLA: Thao tác nhận biết xúc giác mà không cần cảm biến lúc suy luận"
excerpt_en: "Plain imitation copies the demonstrations that crushed the egg, and a tactile sensor at run time is expensive. HapticVLA weights demonstrations by a tactile safety reward, then distils into a student that needs no sensor: 86.7%."
excerpt_vi: "Bắt chước thuần chép cả những demo làm vỡ trứng, còn cảm biến xúc giác lúc chạy thì đắt. HapticVLA gán trọng số demo bằng phần thưởng an toàn từ xúc giác, rồi chưng cất sang student không cần cảm biến: 86,7%."
tags: [VLA, Tactile, Distillation, Paper Notes, SmolVLA]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.15257](https://arxiv.org/abs/2603.15257) · 03/2026 · built on SmolVLA (0.45B) · Skoltech

**PROBLEM** For a jar, waffles and an egg, success means the object stays intact, not just that it moved.

**WHAT FAILED BEFORE** Baseline VLAs (SmolVLA, X-VLA, VLA-0) imitate every demonstration equally, including ones where the object was damaged; X-VLA and VLA-0 score 0%. The abstract adds that HapticVLA beats even versions "provided with direct tactile feedback at inference".

**IDEA** Stage 1: compute a safety reward from tactile maps and train a teacher with reward-weighted flow matching. Stage 2: distil the teacher into a student that sees only vision and state.

**RESULT** 86.7% mean success with no tactile sensor at run time.
</div>

## 1. The problem: imitation copies the bad grasps too

[[flow]]
- Before~plain imitation | demos incl. 20–30 damaged ones > !Behaviour cloning~all demos weigh the same! > Policy | copies the crushing grasps too
- Before~touch at run time | RGB + tactile sensor > !VLA~needs the hardware! > Actions | costly, and still not safer
+ HapticVLA | tactile maps > *Safety reward* > *Reward-weighted teacher* > *Distilled student~vision + state only* | safe grasps without a sensor: 86.7%
[[/flow]] Touch is used to decide *which* demonstrations to trust, then removed.

## 2. Architecture

[[fig:hapticvla]] Stage 1 trains a teacher with a tactile reward as an extra condition; stage 2 distils the teacher's action targets into a student that never sees tactile data.

| Block | Input | Output | Role |
|---|---|---|---|
| Offline tactile reward | 10×10 tactile maps, arm state | $r_t$, $R_{episode}$, risk | score each demonstration |
| SA-RWFM action expert | VLM features, reward | teacher policy $\pi_T$ | safe actions, reward-weighted |
| Teacher targets | training set | $\hat a^T$ for 51,251 samples | computed once, offline |
| Blend | $a^{GT}$, $\hat a^T$ | $\tilde a = (1-\alpha)a^{GT} + \alpha\hat a^T$ | training target |
| Student SmolVLA | vision + state only | actions | deployed model |

## 3. Work it by hand: reward weights in one batch

<div class="calc" markdown="1">
Calculation card

**What and why.** Each demonstration's loss is multiplied by a weight that grows with its advantage (how safe its contact was). Computing one batch shows how much more a safe sample counts than a risky one, and why weights are clipped.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $A_i$ | advantage of sample $i$ (already clipped to $[-6, 6]$) | input | $(-4,\ 0,\ 2,\ 6)$ |
| $\alpha$ | temperature of the weighting | constant | 0.25 (paper) |
| $w_{min}, w_{max}$ | clip range | constant | 0.25, 4.0 (paper) |
| $w_i$ | final weight in the loss | output | – |

**Formula**

$$w^{raw}_i = e^{\alpha A_i}, \qquad \bar w_i = \text{clip}(w^{raw}_i,\ w_{min},\ w_{max}), \qquad w_i = \frac{\bar w_i}{\text{mean}_j\,\bar w_j}$$

**Steps**

1. $w^{raw} = (e^{-1},\ e^{0},\ e^{0.5},\ e^{1.5}) = (0.368,\ 1.000,\ 1.649,\ 4.482)$.
2. Clip to $[0.25, 4]$: $(0.368,\ 1.000,\ 1.649,\ 4.000)$.
3. Mean $= 7.017 / 4 = 1.754$.
4. Divide: $w = (0.210,\ 0.570,\ 0.940,\ 2.281)$.

**Result.** The safest sample counts $2.281 / 0.210 \approx 11$ times as much as the riskiest.

**Why it matters.** Without the clip, $4.482$ would let one sample dominate; dividing by the mean keeps the average weight at 1 so the learning rate keeps its meaning.
</div>

## 4. Results

[[bars:%]] X-VLA=0; VLA-0=0; SmolVLA + SA-RWFM (no distillation)=75; *HapticVLA=86.7* || Mean success over Jar, Waffles, Egg; 20 trials each. HapticVLA per task: 75%, 90%, 95%.

## 5. Training and hardware

| Item | Value |
|---|---|
| Data | 310 real episodes (70 good + 20 faulty per single-arm task, 100 + 30 bimanual) + 1,000 Isaac Sim episodes |
| Robot | two LeRobot SO-101 arms, tactile gripper (100 taxels per pad, 120 Hz), Jetson Orin NX |
| Distillation | blend $\alpha = 0.5$, flow-matching loss on $\tilde a$ |

## 6. Caveats

- The abstract says the student predicts a "compact tactile token", but the only distillation loss given is on actions; token size and loss are not specified.
- Checked against the full text: action horizon $K = 50$ and a 6-dimensional joint action per arm. Optimiser, learning rate, steps and control rate are not stated.

**Carry forward:** all arms so far stand on a fixed base. On a wheeled-legged robot, pushing a door also pushes the body. See [FWBC-VLA](fwbc-vla.html).

**Check question:** a batch of two samples, $A = (-6,\ 6)$, $\alpha = 0.25$. What are the final weights?

<details markdown="1">
<summary>Answer</summary>

$w^{raw} = (e^{-1.5}, e^{1.5}) = (0.223, 4.482)$ → clip $(0.25, 4.0)$ → mean $2.125$ → $w = (0.118, 1.882)$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2603.15257](https://arxiv.org/abs/2603.15257) · 03/2026 · nền SmolVLA (0,45B) · Skoltech

**VẤN ĐỀ** Với hũ mứt, bánh waffle và quả trứng, thành công nghĩa là vật còn nguyên vẹn, không chỉ là vật đã được di chuyển.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các VLA baseline (SmolVLA, X-VLA, VLA-0) bắt chước mọi demo như nhau, kể cả demo làm hỏng vật; X-VLA và VLA-0 đạt 0%. Abstract còn nêu HapticVLA thắng cả những bản "được cho phản hồi xúc giác trực tiếp lúc suy luận".

**Ý TƯỞNG** Giai đoạn 1: tính phần thưởng an toàn từ bản đồ xúc giác và huấn luyện teacher bằng flow matching có trọng số theo phần thưởng. Giai đoạn 2: chưng cất teacher sang student chỉ thấy thị giác và state.

**KẾT QUẢ** Thành công trung bình 86,7% mà không cần cảm biến xúc giác lúc chạy.
</div>

## 1. Vấn đề: bắt chước chép cả những lần nắm hỏng

[[flow]]
- Trước~bắt chước thuần | demo gồm 20–30 lần làm hỏng > !Behavior cloning~mọi demo nặng như nhau! > Chính sách | chép luôn những lần bóp vỡ
- Trước~xúc giác lúc chạy | RGB + cảm biến xúc giác > !VLA~cần phần cứng! > Hành động | tốn kém, mà vẫn không an toàn hơn
+ HapticVLA | bản đồ xúc giác > *Phần thưởng an toàn* > *Teacher có trọng số* > *Student chưng cất~chỉ thị giác + state* | nắm an toàn mà không cần cảm biến: 86,7%
[[/flow]] Xúc giác được dùng để quyết định *nên tin* demo nào, rồi được bỏ đi.

## 2. Kiến trúc

[[fig:hapticvla]] Giai đoạn 1 huấn luyện teacher với phần thưởng xúc giác làm điều kiện phụ; giai đoạn 2 chưng cất mục tiêu hành động của teacher sang student không bao giờ thấy dữ liệu xúc giác.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Phần thưởng xúc giác offline | bản đồ xúc giác 10×10, state cánh tay | $r_t$, $R_{episode}$, rủi ro | chấm điểm từng demo |
| Action expert SA-RWFM | đặc trưng VLM, phần thưởng | chính sách teacher $\pi_T$ | hành động an toàn, có trọng số |
| Mục tiêu teacher | tập huấn luyện | $\hat a^T$ cho 51.251 mẫu | tính một lần, offline |
| Trộn | $a^{GT}$, $\hat a^T$ | $\tilde a = (1-\alpha)a^{GT} + \alpha\hat a^T$ | mục tiêu huấn luyện |
| Student SmolVLA | chỉ thị giác + state | hành động | mô hình triển khai |

## 3. Tính tay: trọng số phần thưởng trong một batch

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Loss của mỗi demo được nhân với một trọng số tăng theo advantage (tiếp xúc của nó an toàn đến đâu). Tính một batch để thấy mẫu an toàn được tính nặng hơn mẫu rủi ro bao nhiêu, và vì sao phải cắt trọng số.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $A_i$ | advantage của mẫu $i$ (đã cắt trong $[-6, 6]$) | input | $(-4,\ 0,\ 2,\ 6)$ |
| $\alpha$ | nhiệt độ của việc gán trọng số | hằng số | 0.25 (của bài) |
| $w_{min}, w_{max}$ | khoảng cắt | hằng số | 0.25, 4.0 (của bài) |
| $w_i$ | trọng số cuối trong loss | output | – |

**Công thức**

$$w^{raw}_i = e^{\alpha A_i}, \qquad \bar w_i = \text{clip}(w^{raw}_i,\ w_{min},\ w_{max}), \qquad w_i = \frac{\bar w_i}{\text{mean}_j\,\bar w_j}$$

**Từng bước**

1. $w^{raw} = (e^{-1},\ e^{0},\ e^{0.5},\ e^{1.5}) = (0.368,\ 1.000,\ 1.649,\ 4.482)$.
2. Cắt trong $[0.25, 4]$: $(0.368,\ 1.000,\ 1.649,\ 4.000)$.
3. Trung bình $= 7.017 / 4 = 1.754$.
4. Chia: $w = (0.210,\ 0.570,\ 0.940,\ 2.281)$.

**Kết quả.** Mẫu an toàn nhất được tính nặng gấp $2.281 / 0.210 \approx 11$ lần mẫu rủi ro nhất.

**Ý nghĩa.** Không cắt thì $4.482$ để một mẫu lấn át cả batch; chia cho trung bình giữ trọng số trung bình bằng 1 để learning rate vẫn giữ nghĩa.
</div>

## 4. Kết quả

[[bars:%]] X-VLA=0; VLA-0=0; SmolVLA + SA-RWFM (chưa chưng cất)=75; *HapticVLA=86.7* || Thành công trung bình trên Jar, Waffles, Egg; 20 lượt mỗi task. HapticVLA từng task: 75%, 90%, 95%.

## 5. Huấn luyện và phần cứng

| Mục | Giá trị |
|---|---|
| Dữ liệu | 310 episode thật (70 tốt + 20 lỗi mỗi task một tay, 100 + 30 task hai tay) + 1.000 episode Isaac Sim |
| Robot | hai tay LeRobot SO-101, kẹp xúc giác (100 taxel mỗi miếng, 120 Hz), Jetson Orin NX |
| Chưng cất | trộn $\alpha = 0{,}5$, loss flow-matching trên $\tilde a$ |

## 6. Lưu ý

- Abstract nói student dự đoán một "token xúc giác gọn", nhưng loss chưng cất duy nhất được nêu là trên hành động; kích thước và loss của token không được đặc tả.
- Đã đối chiếu với toàn văn: horizon hành động $K = 50$ và hành động khớp 6 chiều cho mỗi tay. Optimizer, learning rate, số bước và tần số điều khiển không được nêu.

**Mang sang bài sau:** mọi cánh tay tới đây đều đứng trên đế cố định. Trên robot bánh-chân, đẩy cửa cũng là đẩy cả thân. Xem [FWBC-VLA](fwbc-vla.html).

**Câu kiểm tra:** batch có hai mẫu, $A = (-6,\ 6)$, $\alpha = 0.25$. Trọng số cuối là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$w^{raw} = (e^{-1.5}, e^{1.5}) = (0.223, 4.482)$ → cắt $(0.25, 4.0)$ → trung bình $2.125$ → $w = (0.118, 1.882)$.
</details>
:::
