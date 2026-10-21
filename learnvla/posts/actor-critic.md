---
slug: actor-critic
date: 2026-10-21
title_en: "Actor-Critic RL: Improving a Policy by Trial and a Learned Judge"
title_vi: "Actor-critic RL: Cải thiện chính sách bằng thử nghiệm và một giám khảo học được"
excerpt_en: "Imitation can only copy the demonstrator. Reinforcement learning improves on it from reward, but raw trial and error is noisy. A critic learns how good states are, the actor follows what beat the critic's expectation, and PPO keeps each update small. Discount, TD error and the PPO clip worked by hand."
excerpt_vi: "Bắt chước chỉ chép lại được người làm mẫu. Học tăng cường cải thiện từ phần thưởng, nhưng thử và sai thuần túy thì nhiễu. Một critic học xem trạng thái tốt tới đâu, actor đi theo những gì vượt kỳ vọng của critic, và PPO giữ mỗi lần cập nhật nhỏ. Tính tay chiết khấu, sai số TD và phép kẹp của PPO."
tags: [VLA, Foundations, Reinforcement Learning, Actor-Critic]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** PPO, [arXiv 1707.06347](https://arxiv.org/abs/1707.06347) · 07/2017. Soft Actor-Critic, [arXiv 1801.01290](https://arxiv.org/abs/1801.01290) · 01/2018

**PROBLEM** A policy trained by imitation can at best match its demonstrations and keeps repeating the same failures at contact. To do better it must learn from the *results* of its own actions, measured by a reward.

**WHAT FAILED BEFORE** Plain policy gradient uses the whole noisy return of an episode as its learning signal, and "standard policy gradient methods perform one gradient update per data sample" (PPO paper). Deep RL in general suffered from "very high sample complexity and brittle convergence properties" (SAC paper).

**IDEA** Learn two networks. The *critic* estimates how much future reward to expect from a state (or a state and action). The *actor*, the policy, is pushed toward actions that did better than the critic expected. PPO limits how far one update can move the policy; SAC learns off-policy from a replay buffer and rewards keeping some randomness.

**RESULT** PPO became the default on-policy method, especially in simulation; SAC and TD3-style off-policy methods are common on real robots because they reuse old data. On this site: FIRe trains its residual with PPO in simulation; TORL-VLA and Facet-0 train critics on real rollouts.
</div>

## 1. The problem: copying cannot beat the teacher

[[flow]]
- Before~Imitation only | Demonstrations > !Copy the expert~no notion of better! > Policy | capped at the demonstrator, repeats failures
- Before~Plain policy gradient | Whole-episode return > !Noisy signal~one update per sample! > Policy | slow, unstable
+ Actor-critic | Reward + critic's estimate > *Advantage: better than expected?* > Actor update, kept small | learns from outcomes, stably
[[/flow]] The change is a learned baseline: an action is judged against what the critic expected from that state, not against zero.

## 2. The loop

[[fig:actor-critic]] The actor acts; the environment returns a reward and a new state; the critic's estimate turns that into a "better or worse than expected" signal that updates the actor.

| Term | Meaning |
|---|---|
| Return $G_t$ | discounted sum of future rewards, $\sum_k \gamma^k r_{t+k}$ |
| Discount $\gamma$ | how much a reward one step later counts, e.g. 0.99 |
| Value $V(s)$ | expected return from state $s$ under the current policy |
| $Q(s, a)$ | expected return after taking action $a$ in $s$ |
| TD error $\delta$ | $r + \gamma V(s') - V(s)$: what happened minus what was expected |
| Advantage | how much better an action was than average; $\delta$ is a one-step estimate of it |
| On-policy (PPO) | learns from data of the current policy only |
| Off-policy (SAC, TD3) | learns from a replay buffer of older data, more sample-efficient |

<div class="calc" markdown="1">
Calculation card

**What and why.** Three small calculations that make up one actor-critic update: what a delayed reward is worth, how surprising one step was, and how much PPO lets the policy change.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\gamma$ | discount | constant | 0.99 |
| $r$ | reward this step | input | 0 |
| $V(s),\ V(s')$ | critic's value now and at the next state | input | 0.70, 0.80 |
| $\rho$ | new policy probability ÷ old policy probability for the action taken | input | 1.5 |
| $\epsilon$ | PPO clip range | constant | 0.2 (the paper's best setting) |

**Formulas**

$$G = \gamma^{k} r_{t+k}, \qquad \delta = r + \gamma V(s') - V(s), \qquad L^{CLIP} = \min\big(\rho A,\ \mathrm{clip}(\rho, 1-\epsilon, 1+\epsilon)\,A\big)$$

**Steps**

1. A success reward of 1 arriving 9 steps from now is worth $0.99^9 = 0.914$ today; 99 steps away, $0.99^{99} = 0.370$.
2. TD error: $\delta = 0 + 0.99 \times 0.80 - 0.70 = 0.092$. The step went better than expected; use $A = 0.092$.
3. PPO: $\rho A = 1.5 \times 0.092 = 0.138$; clipped $\rho = 1.2$ gives $1.2 \times 0.092 = 0.110$; $L^{CLIP} = \min(0.138, 0.110) = 0.110$.

**Result.** The delayed reward is worth 0.914; the step beat expectations by 0.092; PPO counts the gain as if the probability had risen only 20%, not 50%.

**Why it matters.** The discount is why RL prefers fast success, and why a reward 100 steps away is weak: long contact tasks need denser rewards or a good starting policy. The critic replaces a noisy whole-episode return with a one-step surprise. The clip means that once the action's probability has risen 20%, pushing it further earns nothing in this update, so a lucky batch cannot wreck the policy.
</div>

## 3. On this site

- **[FIRe](fire.html):** PPO in Isaac Lab; the critic sees privileged simulator state the actor does not (an asymmetric actor-critic); the reward is success plus a force term.
- **[TORL-VLA](torl-vla.html):** online RL on a real robot on top of a frozen force-aware VLA, with two critics, one of which stops bootstrapping across human takeovers.
- **[Facet-0](facet-0.html):** a distributional critic scores predicted action–wrench pairs from deployment rollouts; a small local actor is trained TD3-style with a behaviour-cloning anchor.
- **Why most robot RL starts from a policy:** with a reward only at success, random exploration on a real arm rarely reaches it. Starting from a BC policy or a VLA ([residual policy](residual-policy.html)) makes the first successes happen.

**Carry forward:** this completes the learning tools. Applying them to contact needs to know what force sensors measure: [force and tactile sensing](force-tactile-sensing.html).

**Check question:** $r = 1$ (the task just succeeded), episode ends so $V(s') = 0$, and $V(s) = 0.6$. What is $\delta$? If $\rho = 0.7$ and $\epsilon = 0.2$, what is $L^{CLIP}$?

<details markdown="1">
<summary>Answer</summary>

$\delta = 1 + 0 - 0.6 = 0.4$. $\rho A = 0.7 \times 0.4 = 0.28$; clipped $\rho = 0.8$ gives $0.32$; $\min(0.28, 0.32) = 0.28$. The clip only limits *increases* of the objective, so this update is not clipped.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** PPO, [arXiv 1707.06347](https://arxiv.org/abs/1707.06347) · 07/2017. Soft Actor-Critic, [arXiv 1801.01290](https://arxiv.org/abs/1801.01290) · 01/2018

**VẤN ĐỀ** Chính sách học bằng bắt chước cùng lắm chỉ bằng các demo của nó và cứ lặp lại những thất bại khi tiếp xúc. Muốn tốt hơn, nó phải học từ *kết quả* hành động của chính mình, đo bằng một phần thưởng.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Policy gradient thuần dùng cả tổng phần thưởng nhiễu của một episode làm tín hiệu học, và "các phương pháp policy gradient chuẩn chỉ cập nhật gradient một lần cho mỗi mẫu dữ liệu" (paper PPO). Deep RL nói chung chịu "độ phức tạp mẫu rất cao và hội tụ dễ gãy" (paper SAC).

**Ý TƯỞNG** Học hai mạng. *Critic* ước lượng nên kỳ vọng bao nhiêu phần thưởng tương lai từ một trạng thái (hoặc một trạng thái và hành động). *Actor*, tức chính sách, bị đẩy về phía những hành động làm tốt hơn kỳ vọng của critic. PPO giới hạn mức một lần cập nhật được phép dời chính sách; SAC học off-policy từ một bộ đệm replay và thưởng cho việc giữ một chút ngẫu nhiên.

**KẾT QUẢ** PPO trở thành phương pháp on-policy mặc định, nhất là trong mô phỏng; SAC và các phương pháp off-policy kiểu TD3 phổ biến trên robot thật vì chúng tái dùng dữ liệu cũ. Trên trang này: FIRe huấn luyện residual của nó bằng PPO trong mô phỏng; TORL-VLA và Facet-0 huấn luyện critic trên các lượt chạy thật.
</div>

## 1. Vấn đề: chép lại thì không vượt được thầy

[[flow]]
- Trước~Chỉ bắt chước | Demo > !Chép chuyên gia~không có khái niệm tốt hơn! > Chính sách | dừng ở mức người làm mẫu, lặp lại thất bại
- Trước~Policy gradient thuần | Tổng phần thưởng cả episode > !Tín hiệu nhiễu~mỗi mẫu một lần cập nhật! > Chính sách | chậm, bất ổn
+ Actor-critic | Phần thưởng + ước lượng của critic > *Advantage: tốt hơn kỳ vọng không?* > Cập nhật actor, giữ nhỏ | học từ kết quả, ổn định
[[/flow]] Thay đổi là một mốc so sánh học được: một hành động được đánh giá so với điều critic kỳ vọng từ trạng thái đó, chứ không so với số 0.

## 2. Vòng lặp

[[fig:actor-critic]] Actor hành động; môi trường trả về phần thưởng và trạng thái mới; ước lượng của critic biến điều đó thành tín hiệu "tốt hơn hay tệ hơn kỳ vọng" để cập nhật actor.

| Thuật ngữ | Nghĩa |
|---|---|
| Return $G_t$ | tổng phần thưởng tương lai có chiết khấu, $\sum_k \gamma^k r_{t+k}$ |
| Chiết khấu $\gamma$ | phần thưởng đến muộn một bước được tính bao nhiêu, ví dụ 0,99 |
| Giá trị $V(s)$ | return kỳ vọng từ trạng thái $s$ dưới chính sách hiện tại |
| $Q(s, a)$ | return kỳ vọng sau khi làm hành động $a$ ở $s$ |
| Sai số TD $\delta$ | $r + \gamma V(s') - V(s)$: điều đã xảy ra trừ điều được kỳ vọng |
| Advantage | một hành động tốt hơn mức trung bình bao nhiêu; $\delta$ là ước lượng một bước của nó |
| On-policy (PPO) | chỉ học từ dữ liệu của chính sách hiện tại |
| Off-policy (SAC, TD3) | học từ bộ đệm replay chứa dữ liệu cũ hơn, tiết kiệm mẫu hơn |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Ba phép tính nhỏ tạo nên một lần cập nhật actor-critic: một phần thưởng đến muộn đáng giá bao nhiêu, một bước gây bất ngờ tới đâu, và PPO cho chính sách thay đổi bao nhiêu.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\gamma$ | chiết khấu | hằng số | 0,99 |
| $r$ | phần thưởng bước này | input | 0 |
| $V(s),\ V(s')$ | giá trị critic hiện tại và ở trạng thái kế | input | 0,70; 0,80 |
| $\rho$ | xác suất của chính sách mới ÷ xác suất của chính sách cũ cho hành động đã làm | input | 1,5 |
| $\epsilon$ | khoảng kẹp của PPO | hằng số | 0,2 (thiết lập tốt nhất của paper) |

**Công thức**

$$G = \gamma^{k} r_{t+k}, \qquad \delta = r + \gamma V(s') - V(s), \qquad L^{CLIP} = \min\big(\rho A,\ \mathrm{clip}(\rho, 1-\epsilon, 1+\epsilon)\,A\big)$$

**Từng bước**

1. Phần thưởng thành công 1 đến sau 9 bước đáng giá $0{,}99^9 = 0{,}914$ ở hiện tại; cách 99 bước thì $0{,}99^{99} = 0{,}370$.
2. Sai số TD: $\delta = 0 + 0{,}99 \times 0{,}80 - 0{,}70 = 0{,}092$. Bước này diễn ra tốt hơn kỳ vọng; dùng $A = 0{,}092$.
3. PPO: $\rho A = 1{,}5 \times 0{,}092 = 0{,}138$; kẹp $\rho = 1{,}2$ cho $1{,}2 \times 0{,}092 = 0{,}110$; $L^{CLIP} = \min(0{,}138;\ 0{,}110) = 0{,}110$.

**Kết quả.** Phần thưởng đến muộn đáng giá 0,914; bước này vượt kỳ vọng 0,092; PPO tính phần lợi như thể xác suất chỉ tăng 20% chứ không phải 50%.

**Ý nghĩa.** Chiết khấu là lý do RL thích thành công nhanh, và vì sao một phần thưởng cách 100 bước thì yếu: tác vụ tiếp xúc dài cần phần thưởng dày hơn hoặc một chính sách khởi đầu tốt. Critic thay một tổng phần thưởng nhiễu của cả episode bằng một độ bất ngờ một bước. Phép kẹp có nghĩa là khi xác suất của hành động đã tăng 20%, đẩy thêm nữa không được lợi gì trong lần cập nhật này, nên một batch may mắn không thể phá hỏng chính sách.
</div>

## 3. Trên trang này

- **[FIRe](fire.html):** PPO trong Isaac Lab; critic thấy trạng thái đặc quyền của mô phỏng mà actor không thấy (actor-critic bất đối xứng); phần thưởng là thành công cộng một số hạng lực.
- **[TORL-VLA](torl-vla.html):** RL online trên robot thật, chồng lên một VLA nhận biết lực đã đóng băng, với hai critic, một trong số đó dừng bootstrap qua các lần người tiếp quản.
- **[Facet-0](facet-0.html):** một critic phân phối chấm điểm các cặp hành động–wrench dự đoán từ các lượt triển khai; một actor cục bộ nhỏ được huấn luyện kiểu TD3 với một mỏ neo behaviour cloning.
- **Vì sao phần lớn RL cho robot bắt đầu từ một chính sách:** khi chỉ có phần thưởng lúc thành công, khám phá ngẫu nhiên trên cánh tay thật hiếm khi chạm tới nó. Bắt đầu từ một chính sách BC hay một VLA ([residual policy](residual-policy.html)) giúp những lần thành công đầu tiên xảy ra.

**Mang theo:** đến đây là đủ bộ công cụ học. Áp chúng vào tiếp xúc thì cần biết cảm biến lực đo được gì: [cảm biến lực và xúc giác](force-tactile-sensing.html).

**Câu kiểm tra:** $r = 1$ (tác vụ vừa thành công), episode kết thúc nên $V(s') = 0$, và $V(s) = 0{,}6$. $\delta$ bằng bao nhiêu? Nếu $\rho = 0{,}7$ và $\epsilon = 0{,}2$ thì $L^{CLIP}$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\delta = 1 + 0 - 0{,}6 = 0{,}4$. $\rho A = 0{,}7 \times 0{,}4 = 0{,}28$; kẹp $\rho = 0{,}8$ cho $0{,}32$; $\min(0{,}28;\ 0{,}32) = 0{,}28$. Phép kẹp chỉ chặn việc *tăng* mục tiêu, nên lần cập nhật này không bị kẹp.
</details>
:::
