---
slug: residual-policy
date: 2026-10-21
title_en: "Residual Policy: Learning Only the Correction"
title_vi: "Residual policy: Chỉ học phần hiệu chỉnh"
excerpt_en: "A hand-tuned controller or a VLA is good but not good enough at contact. Instead of replacing it, add a small learned correction on top, bounded so the base stays in charge. Worked: a bounded residual step, and where TER-DAgger, FIRe and MoDE-VLA use the idea."
excerpt_vi: "Một bộ điều khiển chỉnh tay hay một VLA thì tốt nhưng chưa đủ tốt khi tiếp xúc. Thay vì thay thế nó, hãy cộng một phần hiệu chỉnh nhỏ học được lên trên, có giới hạn để phần nền vẫn nắm quyền. Tính tay một bước residual có giới hạn, và TER-DAgger, FIRe, MoDE-VLA dùng ý tưởng này ở đâu."
tags: [VLA, Foundations, Residual, Reinforcement Learning]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Residual Policy Learning, [arXiv 1812.06298](https://arxiv.org/abs/1812.06298) · 12/2018. Residual Reinforcement Learning for Robot Control, [arXiv 1812.03201](https://arxiv.org/abs/1812.03201) · 12/2018

**PROBLEM** Contact and friction are hard to model, so a hand-designed controller is "brittle and inaccurate" at them (Residual RL's words), and a VLA trained by imitation drifts exactly at contact. Yet both get most of the motion right.

**WHAT FAILED BEFORE** Reinforcement learning from scratch is data-hungry and, for long tasks with sparse rewards, often fails outright. Retuning the controller by hand for every task does not scale.

**IDEA** Keep the base policy and add a learned residual: $a = a_{base}(s) + a_{res}(s)$. The residual starts at zero and is bounded, so learning starts from the base's behaviour and can only nudge it.

**RESULT** Residual Policy Learning solves long-horizon, sparse-reward MuJoCo tasks where RL alone fails and "consistently and substantially improves on the initial controllers". On this site: FIRe's residual on a frozen VLA reaches 96.7% on peg insertion against 23.3% for the VLA alone; TER-DAgger and MoDE-VLA use residual corrections too.
</div>

## 1. The problem: good enough in free space, not at contact

[[flow]]
- Before~Base alone | Observation > !Controller or VLA~misses contact details! > Robot | drifts, jams, pushes too hard
- Before~RL from scratch | Observation > !Learn everything~sparse reward! > Robot | too slow, unsafe to explore
+ Residual | Observation > *Base + bounded correction~learn only the difference* > Robot | starts good, gets better
[[/flow]] The change is what is learned: not the whole behaviour, only the gap between the base and good behaviour.

## 2. How it is built

[[fig:residual-policy]] The base policy is kept (often frozen). A small residual policy outputs a correction that is squashed into a fixed range and added to the base action.

| Part | Role | Typical choice |
|---|---|---|
| Base policy | does most of the work | hand-designed controller, model-predictive controller, BC policy, or a frozen VLA |
| Residual policy | learns the correction | small network, often given force or touch the base does not see |
| Bound | limits how far the residual can move the action | $a_{res} = b \tanh(u)$, so $\lvert a_{res}\rvert \le b$ |
| Zero start | initial residual output is 0 | training begins exactly at the base's behaviour |
| Training signal | RL reward, or human corrections (BC) | FIRe: PPO in simulation; TER-DAgger: human-corrected demonstrations |

<div class="calc" markdown="1">
Calculation card

**What and why.** One control step: the base proposes a move, the residual network outputs a raw value, the bound squashes it. It shows why a wild residual output cannot take over.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $a_{base}$ | base action along one axis | input | 0.010 m |
| $u$ | raw residual network output | input | 2.0, then −5.0 |
| $b$ | bound on the residual | constant | 0.003 m (illustrative) |
| $a$ | executed action | output | – |

**Formula**

$$a_{res} = b\,\tanh(u), \qquad a = a_{base} + a_{res}$$

**Steps**

1. $\tanh(2.0) = 0.964$, so $a_{res} = 0.003 \times 0.964 = 0.0029$ m.
2. $a = 0.010 + 0.0029 = 0.0129$ m.
3. A much larger raw output, $u = -5.0$: $\tanh(-5.0) = -0.9999$, $a_{res} = -0.0030$ m, $a = 0.0070$ m.

**Result.** Whatever the network outputs, the action stays within ±3 mm of the base: here 12.9 mm or 7.0 mm against the base's 10 mm.

**Why it matters.** The bound is what makes residual learning safe to train on hardware and keeps the base, which knows where to go, in charge of the motion; FIRe's authors put it as the VLA deciding "where the motion goes" while the residual decides "how the contact is negotiated". The cost is that the residual cannot fix a base that is badly wrong; it can only refine one that is roughly right.
</div>

## 3. Residuals on this site

- **[FIRe](fire.html):** frozen VLA proposes 16-step chunks; a residual trained with PPO in simulation sees force at 15 Hz and adds a bounded 6-D correction to every step.
- **[TER-DAgger](ter-dagger.html):** a fast residual corrects the base policy where a force-error alarm called a human in.
- **[MoDE-VLA](mode-vla.html):** force and touch enter through a separate path whose output is added to π0's as a residual, so the pretrained path is not overwritten.
- **Not a residual:** Facet-0's local actor receives the frozen policy's action as an input ("a conditioning prior, not a residual base", in its paper's words) and outputs the full action itself.

**Carry forward:** most residuals are trained with reinforcement learning, which needs a way to judge actions by their long-term result: [actor-critic RL](actor-critic.html).

**Check question:** $a_{base} = -0.004$ m, $b = 0.002$ m, $u = 0.5$. What is the executed action?

<details markdown="1">
<summary>Answer</summary>

$\tanh(0.5) = 0.462$, $a_{res} = 0.002 \times 0.462 = 0.00092$ m, so $a = -0.004 + 0.00092 = -0.00308$ m.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Residual Policy Learning, [arXiv 1812.06298](https://arxiv.org/abs/1812.06298) · 12/2018. Residual Reinforcement Learning for Robot Control, [arXiv 1812.03201](https://arxiv.org/abs/1812.03201) · 12/2018

**VẤN ĐỀ** Tiếp xúc và ma sát khó mô hình hóa, nên một bộ điều khiển thiết kế tay "giòn và thiếu chính xác" ở những chỗ đó (lời của Residual RL), và một VLA học bằng bắt chước trôi đúng lúc tiếp xúc. Vậy mà cả hai làm đúng phần lớn chuyển động.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Học tăng cường từ đầu tốn rất nhiều dữ liệu và, với tác vụ dài có phần thưởng thưa, thường thất bại hẳn. Chỉnh tay lại bộ điều khiển cho từng tác vụ thì không mở rộng được.

**Ý TƯỞNG** Giữ chính sách nền và cộng một phần residual học được: $a = a_{base}(s) + a_{res}(s)$. Residual khởi đầu bằng 0 và có giới hạn, nên việc học bắt đầu từ hành vi của phần nền và chỉ có thể đẩy nhẹ nó.

**KẾT QUẢ** Residual Policy Learning giải được các tác vụ MuJoCo dài, phần thưởng thưa mà RL đơn thuần thất bại, và "cải thiện nhất quán và đáng kể so với bộ điều khiển ban đầu". Trên trang này: residual của FIRe trên một VLA đóng băng đạt 96,7% ở cắm chốt so với 23,3% khi chỉ có VLA; TER-DAgger và MoDE-VLA cũng dùng hiệu chỉnh residual.
</div>

## 1. Vấn đề: đủ tốt khi chuyển động tự do, chưa đủ khi tiếp xúc

[[flow]]
- Trước~Chỉ có phần nền | Quan sát > !Bộ điều khiển hoặc VLA~bỏ sót chi tiết tiếp xúc! > Robot | trôi, kẹt, ấn quá mạnh
- Trước~RL từ đầu | Quan sát > !Học mọi thứ~phần thưởng thưa! > Robot | quá chậm, khám phá không an toàn
+ Residual | Quan sát > *Nền + hiệu chỉnh có giới hạn~chỉ học phần chênh lệch* > Robot | khởi đầu tốt, rồi tốt hơn
[[/flow]] Thay đổi nằm ở thứ được học: không phải toàn bộ hành vi, chỉ là khoảng cách giữa phần nền và hành vi tốt.

## 2. Cách dựng

[[fig:residual-policy]] Chính sách nền được giữ lại (thường đóng băng). Một chính sách residual nhỏ xuất ra phần hiệu chỉnh, được nén vào một khoảng cố định rồi cộng vào hành động nền.

| Bộ phận | Vai trò | Lựa chọn điển hình |
|---|---|---|
| Chính sách nền | làm phần lớn công việc | bộ điều khiển thiết kế tay, bộ điều khiển dự báo mô hình, chính sách BC, hoặc một VLA đóng băng |
| Chính sách residual | học phần hiệu chỉnh | mạng nhỏ, thường được cho lực hoặc xúc giác mà phần nền không thấy |
| Giới hạn | chặn mức residual được phép dời hành động | $a_{res} = b \tanh(u)$, nên $\lvert a_{res}\rvert \le b$ |
| Khởi đầu bằng 0 | đầu ra residual ban đầu bằng 0 | huấn luyện bắt đầu đúng tại hành vi của phần nền |
| Tín hiệu huấn luyện | phần thưởng RL, hoặc hiệu chỉnh của người (BC) | FIRe: PPO trong mô phỏng; TER-DAgger: demo được người hiệu chỉnh |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một bước điều khiển: phần nền đề xuất một bước dịch, mạng residual xuất một giá trị thô, giới hạn nén nó lại. Phép tính cho thấy vì sao một đầu ra residual hoang dã không thể chiếm quyền.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $a_{base}$ | hành động nền theo một trục | input | 0,010 m |
| $u$ | đầu ra thô của mạng residual | input | 2,0, rồi −5,0 |
| $b$ | giới hạn của residual | hằng số | 0,003 m (minh họa) |
| $a$ | hành động được thực thi | output | – |

**Công thức**

$$a_{res} = b\,\tanh(u), \qquad a = a_{base} + a_{res}$$

**Từng bước**

1. $\tanh(2{,}0) = 0{,}964$, nên $a_{res} = 0{,}003 \times 0{,}964 = 0{,}0029$ m.
2. $a = 0{,}010 + 0{,}0029 = 0{,}0129$ m.
3. Đầu ra thô lớn hơn nhiều, $u = -5{,}0$: $\tanh(-5{,}0) = -0{,}9999$, $a_{res} = -0{,}0030$ m, $a = 0{,}0070$ m.

**Kết quả.** Dù mạng xuất ra gì, hành động vẫn nằm trong ±3 mm quanh phần nền: ở đây 12,9 mm hoặc 7,0 mm so với 10 mm của phần nền.

**Ý nghĩa.** Giới hạn là thứ làm việc học residual an toàn khi huấn luyện trên phần cứng và giữ cho phần nền, vốn biết phải đi đâu, nắm quyền chuyển động; các tác giả FIRe diễn đạt là VLA quyết định "chuyển động đi về đâu" còn residual quyết định "tiếp xúc được xử lý thế nào". Cái giá là residual không sửa được một phần nền sai nghiêm trọng; nó chỉ tinh chỉnh được một phần nền đại khái đúng.
</div>

## 3. Residual trên trang này

- **[FIRe](fire.html):** VLA đóng băng đề xuất chunk 16 bước; một residual huấn luyện bằng PPO trong mô phỏng thấy lực ở 15 Hz và cộng một hiệu chỉnh 6 chiều có giới hạn vào mọi bước.
- **[TER-DAgger](ter-dagger.html):** một residual nhanh hiệu chỉnh chính sách nền ở những chỗ chuông báo sai số lực đã gọi người can thiệp.
- **[MoDE-VLA](mode-vla.html):** lực và xúc giác đi vào qua một đường riêng, đầu ra của nó được cộng vào đầu ra của π0 như một residual, nên đường đã pretrain không bị ghi đè.
- **Không phải residual:** actor cục bộ của Facet-0 nhận hành động của chính sách đóng băng làm đầu vào ("một tiên nghiệm điều kiện, không phải nền residual", theo lời paper) và tự xuất toàn bộ hành động.

**Mang theo:** phần lớn residual được huấn luyện bằng học tăng cường, cần một cách đánh giá hành động theo kết quả lâu dài: [actor-critic RL](actor-critic.html).

**Câu kiểm tra:** $a_{base} = -0{,}004$ m, $b = 0{,}002$ m, $u = 0{,}5$. Hành động được thực thi là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\tanh(0{,}5) = 0{,}462$, $a_{res} = 0{,}002 \times 0{,}462 = 0{,}00092$ m, nên $a = -0{,}004 + 0{,}00092 = -0{,}00308$ m.
</details>
:::
