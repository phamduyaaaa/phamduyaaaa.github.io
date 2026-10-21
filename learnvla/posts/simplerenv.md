---
slug: simplerenv
date: 2026-10-21
title_en: "SimplerEnv: Does the Simulator Rank Policies Like the Real Robot?"
title_vi: "SimplerEnv: Mô phỏng có xếp hạng policy giống robot thật không?"
excerpt_en: "SimplerEnv evaluates policies trained on real data in simulators tuned to two real setups (Google Robot, WidowX Bridge). It is judged by whether the simulated ranking matches the real ranking, measured with a new metric, MMRV."
excerpt_vi: "SimplerEnv đánh giá các policy học từ dữ liệu thật trong trình mô phỏng được chỉnh theo hai bộ robot thật (Google Robot, WidowX Bridge). Nó được chấm bằng việc thứ hạng mô phỏng có khớp thứ hạng thật không, đo bằng một thước đo mới là MMRV."
tags: [VLA, Benchmark, SimplerEnv, Real-to-sim]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Li et al., *Evaluating Real-World Robot Manipulation Policies in Simulation* (SIMPLER), [arXiv 2405.05941](https://arxiv.org/abs/2405.05941) · 05/2024

**PROBLEM** Generalist policies such as RT-1, RT-2-X and Octo are trained on real data, and evaluating them on a real robot is slow, costly and hard to reproduce.

**WHAT FAILED BEFORE** Two cheap proxies both fail. Validation loss (action MSE on held-out demos) is a poor predictor of real success: across the paper's Google Robot tasks it reaches only Pearson $r = 0.308$. A naive simulator differs from the real setup in control (wrong PD gains, missed grasps) and in appearance, and some policies are very sensitive to textures.

**IDEA** Build simulators *for evaluation only*, matched to two real setups: tune the controller by system identification on logged trajectories, and close the visual gap by green-screening real backgrounds and baking textures from real photos. Score the simulator by whether it ranks policies in the real order, using a new metric, Mean Maximum Rank Violation (MMRV).

**RESULT** On Google Robot tasks, average MMRV 0.056 and Pearson $r$ 0.924 with "Visual Matching", against 0.375 and 0.308 for validation MSE. On Bridge, MMRV 0.014 and $r$ 0.890. About 1,500 real episodes were run to check this.
</div>

## 1. The problem: cheap evaluation that ranks policies wrongly

[[flow]]
- Before~Validation loss | Held-out demos > !Action MSE~low loss, low success possible! > Pick a checkpoint | avg Pearson r 0.308 with real success
+ SIMPLER | Real-matched sim > *Roll out the policy~controller and visuals matched* > Rank policies | avg Pearson r 0.924, MMRV 0.056
[[/flow]] The change is to measure behaviour in a closed loop, in a simulator built to agree with the real ranking.

## 2. How the simulator is matched to reality

[[fig:simplerenv]] The two gaps are closed separately, then the same real-trained policies are run both in reality and in simulation, and the rankings are compared.

| Gap | Symptom | Fix in SIMPLER |
|---|---|---|
| Control | default PD gains track the end-effector badly, so a grasp misses the can | system identification: replay logged actions open loop, fit stiffness and damping by simulated annealing to minimise translation + rotation error |
| Visual | policies react to object and arm textures | "Visual Matching": green-screen the real background behind simulated objects, bake textures from real images; for Google Robot, average over four arm colours |
| Alternative | – | "Variant Aggregation": randomise backgrounds, lighting, textures and average. It worked worse than Visual Matching |

Tasks: Google Robot (pick coke can, move near, open/close drawer, put object in drawer) and WidowX + BridgeData V2 (spoon on towel, carrot on plate, stack cubes, eggplant in basket).

| Google Robot (Table I) | MMRV ↓ val. MSE | MMRV ↓ VisMatch | Pearson r ↑ val. MSE | Pearson r ↑ VisMatch |
|---|---|---|---|---|
| Pick coke can | 0.412 | 0.031 | 0.464 | 0.976 |
| Move near | 0.408 | 0.111 | 0.230 | 0.855 |
| Drawer | 0.306 | 0.027 | 0.231 | 0.942 |
| Average | 0.375 | 0.056 | 0.308 | 0.924 |

## 3. The metric: MMRV

Pearson $r$ asks whether sim and real success lie on a line. The paper points out two problems with that: a simulator that gets the order right but not the line is penalised, and when several policies have nearly the same real success, noise dominates $r$. MMRV looks only at mistakes in order, weighted by how much they matter in reality.

<div class="calc" markdown="1">

Calculation card

**What and why.** Compute MMRV by hand for three policies, to see that a swap between two similar policies costs little and a swap between very different ones costs a lot.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $R_i$ | real success of policy $i$ | input | 0.70, 0.60, 0.20 |
| $R_{S,i}$ | simulated success of policy $i$ | input | 0.50, 0.55, 0.10 |
| $\text{RV}(i,j)$ | rank violation between $i$ and $j$ | intermediate | – |
| MMRV | mean over $i$ of the worst violation involving $i$ | output | – |

**Formula**

$$\text{RV}(i,j) = |R_i - R_j| \cdot \mathbb{1}\big[(R_{S,i} < R_{S,j}) \ne (R_i < R_j)\big], \qquad \text{MMRV} = \frac{1}{N}\sum_{i=1}^{N} \max_j \text{RV}(i,j)$$

**Steps**

1. Pair (1, 2): real says $0.70 > 0.60$, sim says $0.50 < 0.55$. Disagree, so $\text{RV} = |0.70 - 0.60| = 0.10$.
2. Pairs (1, 3) and (2, 3): sim and real agree, so $\text{RV} = 0$.
3. Worst violation per policy: policy 1: 0.10, policy 2: 0.10, policy 3: 0.
4. $\text{MMRV} = (0.10 + 0.10 + 0) / 3 = 0.067$.
5. If the simulator had instead swapped policies 1 and 3 (real gap 0.50), policies 1 and 3 would each get 0.50, and MMRV would be at least $(0.50 + 0.50)/3 = 0.333$.

**Result.** 0.067 for a swap between near-equal policies; at least 0.333 for a swap between very different ones.

**Why it matters.** Notice that the simulated success rates (0.50, 0.55, 0.10) are far from the real ones, yet MMRV is low. For choosing between checkpoints, the order is what you need.
</div>

## 4. How VLA papers use it, and its limits

- **Use.** Report sim success on the Google Robot and Bridge tasks for policies trained on the corresponding real data (OXE / Bridge). It is mostly reported by policies trained on those datasets, often next to LIBERO.
- **Limit 1: only two real setups.** A policy trained for a UR10e or a different gripper has no matched simulator here.
- **Limit 2: contact.** System identification targets end-effector tracking, not contact forces. A simulator matched for grasp success says little about force regulation.
- **Limit 3: rank, not absolute numbers.** A 60% SimplerEnv score does not mean 60% on the real robot.

## 5. Caveats

- Checked against the full paper: the system-identification loss, Visual Matching vs Variant Aggregation, Table I and the Bridge numbers.
- The MMRV example uses made-up success rates.

**Carry forward:** [RoboTwin](robotwin.html) goes the other way, using simulation to *generate* training data and benchmark bimanual tasks; [GM-100](gm-100.html) evaluates on real robots instead.

**Check question:** real success (0.9, 0.5, 0.4), sim success (0.8, 0.3, 0.35). Which pairs are violated, and what is the MMRV?

<details markdown="1">
<summary>Answer</summary>

Pair (2, 3): real $0.5 > 0.4$, sim $0.3 < 0.35$, violated with $\text{RV} = 0.1$. The other pairs agree. Worst per policy: 0, 0.1, 0.1. MMRV $= 0.2/3 = 0.067$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Li và cộng sự, *Evaluating Real-World Robot Manipulation Policies in Simulation* (SIMPLER), [arXiv 2405.05941](https://arxiv.org/abs/2405.05941) · 05/2024

**VẤN ĐỀ** Các policy tổng quát như RT-1, RT-2-X và Octo học từ dữ liệu thật, và đánh giá chúng trên robot thật thì chậm, tốn kém, khó lặp lại.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Hai cách thay thế rẻ đều hỏng. Loss kiểm định (MSE hành động trên demo giữ lại) đoán kém tỉ lệ thành công thật: trên các tác vụ Google Robot của paper nó chỉ đạt Pearson $r = 0{,}308$. Một trình mô phỏng ngây thơ khác bộ thật cả về điều khiển (sai hệ số PD, gắp trượt) lẫn hình ảnh, và vài policy rất nhạy với vân bề mặt.

**Ý TƯỞNG** Dựng trình mô phỏng *chỉ để đánh giá*, khớp với hai bộ robot thật: chỉnh bộ điều khiển bằng nhận dạng hệ thống trên quỹ đạo đã ghi, và thu hẹp khác biệt hình ảnh bằng cách ghép nền thật (green screen) và nướng vân bề mặt từ ảnh thật. Chấm trình mô phỏng bằng việc nó có xếp policy đúng thứ tự thật không, dùng thước đo mới là Mean Maximum Rank Violation (MMRV).

**KẾT QUẢ** Trên các tác vụ Google Robot, MMRV trung bình 0,056 và Pearson $r$ 0,924 với "Visual Matching", so với 0,375 và 0,308 của MSE kiểm định. Trên Bridge, MMRV 0,014 và $r$ 0,890. Khoảng 1.500 lượt chạy robot thật được dùng để kiểm tra.
</div>

## 1. Vấn đề: đánh giá rẻ nhưng xếp hạng sai

[[flow]]
- Trước~Loss kiểm định | Demo giữ lại > !MSE hành động~loss thấp vẫn có thể thành công thấp! > Chọn checkpoint | Pearson r trung bình 0,308 với thành công thật
+ SIMPLER | Mô phỏng khớp thật > *Chạy policy~khớp điều khiển và hình ảnh* > Xếp hạng policy | Pearson r trung bình 0,924, MMRV 0,056
[[/flow]] Thay đổi là đo hành vi trong vòng kín, trong một trình mô phỏng được dựng để đồng ý với thứ hạng thật.

## 2. Khớp trình mô phỏng với thực tế thế nào

[[fig:simplerenv]] Hai khoảng cách được xử lý riêng, rồi cùng các policy học từ dữ liệu thật được chạy cả ngoài đời lẫn trong mô phỏng, và so thứ hạng.

| Khoảng cách | Triệu chứng | Cách SIMPLER sửa |
|---|---|---|
| Điều khiển | hệ số PD mặc định bám đầu cuối kém, nên gắp trượt lon | nhận dạng hệ thống: phát lại hành động đã ghi theo vòng hở, chỉnh độ cứng và giảm chấn bằng simulated annealing để sai số tịnh tiến + quay nhỏ nhất |
| Hình ảnh | policy phản ứng với vân của vật và cánh tay | "Visual Matching": ghép nền thật sau vật mô phỏng, nướng vân từ ảnh thật; với Google Robot, lấy trung bình bốn màu tay |
| Phương án khác | – | "Variant Aggregation": ngẫu nhiên hóa nền, ánh sáng, vân rồi lấy trung bình. Kém hơn Visual Matching |

Tác vụ: Google Robot (gắp lon coca, đưa lại gần, mở/đóng ngăn kéo, bỏ vật vào ngăn kéo) và WidowX + BridgeData V2 (thìa lên khăn, cà rốt lên đĩa, xếp khối, cà tím vào rổ).

| Google Robot (Bảng I) | MMRV ↓ MSE kđ | MMRV ↓ VisMatch | Pearson r ↑ MSE kđ | Pearson r ↑ VisMatch |
|---|---|---|---|---|
| Gắp lon coca | 0,412 | 0,031 | 0,464 | 0,976 |
| Đưa lại gần | 0,408 | 0,111 | 0,230 | 0,855 |
| Ngăn kéo | 0,306 | 0,027 | 0,231 | 0,942 |
| Trung bình | 0,375 | 0,056 | 0,308 | 0,924 |

## 3. Thước đo: MMRV

Pearson $r$ hỏi xem thành công mô phỏng và thật có nằm trên một đường thẳng không. Paper chỉ ra hai vấn đề: trình mô phỏng đúng thứ tự nhưng không thẳng hàng vẫn bị phạt, và khi nhiều policy có thành công thật gần bằng nhau thì nhiễu lấn át $r$. MMRV chỉ nhìn vào lỗi thứ tự, có trọng số theo mức độ quan trọng ngoài đời.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Tính tay MMRV cho ba policy, để thấy đảo thứ tự hai policy gần bằng nhau thì tốn ít, còn đảo hai policy rất khác nhau thì tốn nhiều.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $R_i$ | thành công thật của policy $i$ | đầu vào | 0,70; 0,60; 0,20 |
| $R_{S,i}$ | thành công mô phỏng của policy $i$ | đầu vào | 0,50; 0,55; 0,10 |
| $\text{RV}(i,j)$ | vi phạm thứ hạng giữa $i$ và $j$ | trung gian | – |
| MMRV | trung bình theo $i$ của vi phạm tệ nhất liên quan $i$ | đầu ra | – |

**Công thức**

$$\text{RV}(i,j) = |R_i - R_j| \cdot \mathbb{1}\big[(R_{S,i} < R_{S,j}) \ne (R_i < R_j)\big], \qquad \text{MMRV} = \frac{1}{N}\sum_{i=1}^{N} \max_j \text{RV}(i,j)$$

**Các bước**

1. Cặp (1, 2): thật nói $0{,}70 > 0{,}60$, mô phỏng nói $0{,}50 < 0{,}55$. Lệch nhau, nên $\text{RV} = |0{,}70 - 0{,}60| = 0{,}10$.
2. Cặp (1, 3) và (2, 3): mô phỏng và thật đồng ý, nên $\text{RV} = 0$.
3. Vi phạm tệ nhất mỗi policy: policy 1: 0,10, policy 2: 0,10, policy 3: 0.
4. $\text{MMRV} = (0{,}10 + 0{,}10 + 0) / 3 = 0{,}067$.
5. Nếu trình mô phỏng đảo policy 1 và 3 (chênh thật 0,50), policy 1 và 3 mỗi cái nhận 0,50, và MMRV ít nhất là $(0{,}50 + 0{,}50)/3 = 0{,}333$.

**Kết quả.** 0,067 khi đảo hai policy gần bằng nhau; ít nhất 0,333 khi đảo hai policy rất khác nhau.

**Vì sao quan trọng.** Để ý rằng thành công mô phỏng (0,50; 0,55; 0,10) khác xa số thật, nhưng MMRV vẫn thấp. Để chọn giữa các checkpoint, thứ bạn cần là thứ tự.
</div>

## 4. Paper VLA dùng nó thế nào, và giới hạn

- **Cách dùng.** Báo thành công mô phỏng trên các tác vụ Google Robot và Bridge cho policy học từ dữ liệu thật tương ứng (OXE / Bridge). Nó chủ yếu được báo cáo bởi policy học trên các bộ dữ liệu đó, thường cạnh LIBERO.
- **Giới hạn 1: chỉ hai bộ robot thật.** Policy học cho UR10e hay tay kẹp khác không có trình mô phỏng khớp ở đây.
- **Giới hạn 2: tiếp xúc.** Nhận dạng hệ thống nhắm vào việc bám đầu cuối, không phải lực tiếp xúc. Trình mô phỏng khớp về tỉ lệ gắp được nói rất ít về điều chỉnh lực.
- **Giới hạn 3: thứ hạng, không phải số tuyệt đối.** 60% trên SimplerEnv không có nghĩa là 60% trên robot thật.

## 5. Lưu ý

- Đã đối chiếu với toàn văn paper: loss nhận dạng hệ thống, Visual Matching và Variant Aggregation, Bảng I và số của Bridge.
- Ví dụ MMRV dùng tỉ lệ thành công tự đặt.

**Mang theo:** [RoboTwin](robotwin.html) đi theo hướng ngược lại, dùng mô phỏng để *sinh* dữ liệu huấn luyện và làm benchmark tác vụ hai tay; [GM-100](gm-100.html) thì đánh giá trên robot thật.

**Câu hỏi kiểm tra:** thành công thật (0,9; 0,5; 0,4), mô phỏng (0,8; 0,3; 0,35). Cặp nào bị vi phạm, và MMRV bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Cặp (2, 3): thật $0{,}5 > 0{,}4$, mô phỏng $0{,}3 < 0{,}35$, vi phạm với $\text{RV} = 0{,}1$. Các cặp khác đồng ý. Tệ nhất mỗi policy: 0; 0,1; 0,1. MMRV $= 0{,}2/3 = 0{,}067$.
</details>
:::
