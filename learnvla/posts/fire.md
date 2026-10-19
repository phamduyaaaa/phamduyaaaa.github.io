---
slug: fire
date: 2026-10-19
title_en: "FIRe: A Force-Informed Residual on Top of a Frozen VLA"
title_vi: "FIRe: Một residual nhận biết lực đặt trên VLA đóng băng"
excerpt_en: "A chunked VLA runs open-loop and cannot react to contact; RL can, but needs a new dense reward per task. FIRe keeps the VLA frozen and trains a small force-aware residual in simulation with a reward that is the same for every task. Peg insertion on a real robot: 96.7% vs 23.3%."
excerpt_vi: "VLA xuất chunk chạy mở vòng nên không phản ứng kịp với tiếp xúc; RL thì phản ứng được nhưng cần reward dày mới cho từng tác vụ. FIRe giữ VLA đóng băng và huấn luyện một residual nhỏ nhận biết lực trong mô phỏng, với reward giống nhau cho mọi tác vụ. Cắm chốt trên robot thật: 96,7% so với 23,3%."
tags: [VLA, Force, Residual, Paper Notes, GR00T, π0.5]
---

:::en
<div class="tldr" markdown="1">
**SOURCE** [Project page](https://rcilab.github.io/FIRe/) · [code](https://github.com/RCILab/FIRe) · 2026 · submitted to IEEE RA-L. The page says "Paper (Coming Soon)": no arXiv paper yet, so every number below is from the project page and has not been checked against a full text.

**PROBLEM** Assembly (peg, gear, nut) needs the robot to react to contact many times per second. A VLA gives one action chunk and then executes it open-loop.

**WHAT FAILED BEFORE** The VLA alone: 23.3%, 10.0% and 3.3% on the three tasks. RL from scratch can use force, but the dense reward (FORGE style) is written anew for each task, three different rewards for three tasks.

**IDEA** Freeze the VLA. Train a small residual policy in simulation that sees force at every step and adds a bounded correction to each VLA action. The reward is a sparse success term plus one force term that is identical for all tasks.

**RESULT** Real robot, 30 trials each: +73.4, +90.0 and +30.0 points over the VLA (average +64.5). Peg Insert 96.7% against 86.7% for RL with a task-specific reward.
</div>

## 1. The problem: a chunk is blind between two inferences

[[flow]]
- Before~VLA alone | Images + text > !Action chunk~16 steps, open-loop! > Robot | no force, no reaction inside the chunk: 23.3% on Peg Insert
- Before~RL from scratch | Force + pose > !Dense reward~new for every task! > Robot | reacts to force, but reward engineering per task: 86.7%
+ FIRe | Images + text > *Frozen VLA~chunk* > *Residual~force, every step* > Robot | VLA decides where to go, residual decides how contact goes: 96.7%
[[/flow]] The VLA also warms up RL: the reward no longer has to say where the goal is, because the VLA action already points there.

## 2. Architecture

[[fig:fire]] The final command is the VLA action plus a bounded residual, run through a 1 kHz impedance controller. The VLA never waits: the next chunk is fetched at the midpoint of the current one.

| Part | Input | Output | Role |
|---|---|---|---|
| Frozen VLA | 2 external + 1 wrist image, absolute pose $p_{ee}^{abs}$ (7), text $\ell$ | action chunk of length $T$ | where to move, once per chunk |
| Residual policy $\pi_{res}$ | relative pose (7), velocity (6), force $F_t$ (3), previous command | $a_t^{res}$ (6, bounded) | how to negotiate contact, every step at 15 Hz |
| Sum | $a_t^{VLA}$ and $a_t^{res}$ | $a_t$ | both in the same relative-pose representation |
| Impedance controller | $a_t$ | joint torques | 1 kHz, interpolates between 15 Hz commands |

The only requirement on the VLA: it must output 6-D end-effector relative-pose action chunks, so the residual can be added in the same form. The same residual worked on GR00T, π0.5 and OpenVLA.

## 3. Work it by hand: the FIRe reward

<div class="calc" markdown="1">
Calculation card

**What and why.** The reward tells the residual to avoid pushing harder than a reference force $F_{ref}$, without saying anything about the task. Computing it once shows what each term does.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\lVert F_t\rVert,\ \lVert F_{t+1}\rVert$ | force magnitude before and after a step | input | 30 N, 20 N |
| $F_{ref}$ | reference force | constant | 10 N (evaluation; randomised in training) |
| $\alpha,\ \lambda_f,\ c_f,\ \gamma$ | penalty scale, shaping scale, potential coefficient, discount | constant | $10^{-5}$, $10^{-5}$, 1.0, 0.995 |
| $r_p,\ r_{sh}$ | direct penalty and shaping term | output | – |

**Formulas**

$$r_p = -\alpha\max(0,\ \lVert F_{t+1}\rVert - F_{ref}),\qquad r_{sh} = \lambda_f\big(\gamma\,\phi_f(s_{t+1}) - \phi_f(s_t)\big)$$

$$\phi_f(s) = -\log\!\big(c_f\max(0,\ \lVert F(s)\rVert - F_{ref}) + 1\big)$$

**Steps**

1. Excess over $F_{ref}$: before $30 - 10 = 20$ N, after $20 - 10 = 10$ N.
2. $\phi_f(s_t) = -\log 21 = -3.0445$ and $\phi_f(s_{t+1}) = -\log 11 = -2.3979$.
3. $r_p = -10^{-5}\times 10 = -1.0\times 10^{-4}$.
4. $r_{sh} = 10^{-5}\,(0.995\times(-2.3979) + 3.0445) = 10^{-5}\times 0.6586 = 6.6\times 10^{-6}$.

**Result.** $r_f = r_p + r_{sh} \approx -9.3\times 10^{-5}$. Easing from 30 N to 20 N is rewarded by the shaping term, but the step is still penalised because 20 N is above 10 N.

**Why it matters.** Both terms are exactly zero at or below $F_{ref}$, so the reward never pays the robot for touching or avoiding contact; contact comes from the success reward and the VLA action. The numbers are tiny next to the success reward of 1. The page does not say how forces are scaled, so I show the arithmetic and do not claim how the terms balance.
</div>

## 4. Results

[[bars:%]] VLA alone=23.3; FIRe without force=43.3; FIRe force observation only=70.0; RL with task-specific reward=86.7; *FIRe=96.7* || Peg Insert on the real robot, 30 trials each. Each use of force adds about 27 points.

| Real robot, 30 trials | Peg Insert | Gear Mesh | Nut Thread |
|---|---|---|---|
| VLA | 23.3% | 10.0% | 3.3% |
| RL, task-specific reward | 86.7% | 100.0% | 33.3% |
| FIRe without force | 43.3% | 93.3% | 6.7% |
| FIRe, force in observation only | 70.0% | 100.0% | 16.7% |
| **FIRe** | **96.7%** | **100.0%** | **33.3%** |

- Same residual, three backbones (Peg / Gear / Nut): GR00T 23.3→96.7, 10.0→100, 3.3→33.3; π0.5 20.0→96.7, 66.7→100, 0.0→13.3; OpenVLA 56.7→90.0, 93.3→100, 3.3→16.7.
- Simulation, peak success: FIRe 100%, 100%, 97%; RL with task-specific reward 94%, 100%, 100%. From scratch with the same FIRe reward and no VLA: about 40% on Peg Insert and 0% on Nut Thread, so the VLA warm start matters.
- Nut Thread stays low: about 60% of the failures end with the nut aligned on the bolt but not threaded. The page says thread engagement is not observable from the end-effector pose.

## 5. Can I use this on my robot?

**Short answer.** The idea transfers to any arm with a force reading and a compliant controller, but the recipe is built around a simulator model of your task and a VLA that outputs relative-pose chunks. "Not stated" means the project page does not say it.

| Need | What the authors used | If yours differs |
|---|---|---|
| Robot and sensor | Franka FR3, wrist-mounted 3-axis force sensor, three cameras (two external, one wrist) | Only the 3 force components are used, so a 6-axis wrist sensor (such as the one built into a UR10e) gives more than needed. Other arms: not tested |
| Low-level control | Task-space impedance controller at 1 kHz, torque control through a ROS 2 controller | You need an equivalent compliant controller; the page does not say how to port it |
| VLA | GR00T (chunk 16), π0.5 and OpenVLA (chunk 8 in the repo) with the action head fine-tuned, then frozen | The VLA must output 6-D relative end-effector pose chunks |
| Simulation | Isaac Sim 5.1 and Isaac Lab on Linux, Python 3.11, CUDA 12.8, 64 parallel environments, 200 epochs of PPO | Your task must exist as a simulated contact task. The tasks here are rigid 3D-printed parts from FORGE. A press-fit cap needs its own model; FORGE approximated snap-fit clips with a spring |
| Sim-to-real | Domain randomisation and noise on pose and force, zero-shot, no real-world fine-tuning | Contact that the simulator models poorly can break zero-shot transfer |
| Demonstrations for the VLA | The repo has a script that rolls out a trained baseline in simulation to save GR00T demos; a pick-and-place check used 128 teleoperated episodes | How many demos the contact tasks used, and whether they were real or simulated, is not stated |
| Training time and GPU | Not stated | – |
| Code | [github.com/RCILab/FIRe](https://github.com/RCILab/FIRe): `fire_lab` (training) and `fire_deploy` (real robot). No licence file. The page still says "Code (Coming Soon)" | Check the repo before relying on it |

## 6. Caveats

- No arXiv paper or full text is available, so the numbers are the authors' project-page claims, not peer-reviewed results.
- Every real-robot result is on three rigid peg, gear and nut tasks with 30 trials per method. At 30 trials, 96.7% (29/30) still means roughly 83% to 99% (Wilson, my arithmetic).
- Success on Nut Thread (33.3%) only matches RL with a task-specific reward; the gain there is over the VLA, not over RL.

**Carry forward:** [ForceVLA](forcevla.html) and [TA-VLA](ta-vla.html) put force *inside* the VLA and retrain it. FIRe leaves the VLA alone and corrects it from outside, which is the same idea as the residual in [TER-DAgger](ter-dagger.html), here trained with RL in simulation.

**Check question:** $F_{ref} = 10$ N, $\alpha = 10^{-5}$, $\lVert F_{t+1}\rVert = 15$ N. What is $r_p$?

<details markdown="1">
<summary>Answer</summary>

Excess $= 15 - 10 = 5$ N, so $r_p = -10^{-5}\times 5 = -5\times 10^{-5}$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**NGUỒN** [Trang dự án](https://rcilab.github.io/FIRe/) · [code](https://github.com/RCILab/FIRe) · 2026 · nộp IEEE RA-L. Trang ghi "Paper (Coming Soon)": chưa có paper trên arXiv, nên mọi con số dưới đây lấy từ trang dự án và chưa được đối chiếu với toàn văn.

**VẤN ĐỀ** Lắp ráp (chốt, bánh răng, đai ốc) cần robot phản ứng với tiếp xúc nhiều lần mỗi giây. VLA chỉ cho một chunk hành động rồi chạy mở vòng.

**PAPER TRƯỚC HỎNG Ở ĐÂU** VLA đứng một mình chỉ đạt 23,3%, 10,0% và 3,3% trên ba tác vụ. RL từ đầu dùng được lực, nhưng reward dày (kiểu FORGE) phải viết lại cho từng tác vụ, ba reward khác nhau cho ba tác vụ.

**Ý TƯỞNG** Đóng băng VLA. Huấn luyện trong mô phỏng một chính sách residual nhỏ, nhìn thấy lực ở mỗi bước và cộng một hiệu chỉnh có giới hạn vào mỗi hành động của VLA. Reward gồm một số hạng thành công thưa cộng một số hạng lực giống hệt nhau cho mọi tác vụ.

**KẾT QUẢ** Robot thật, 30 lượt mỗi cấu hình: +73,4, +90,0 và +30,0 điểm so với VLA (trung bình +64,5). Cắm chốt đạt 96,7%, so với 86,7% của RL có reward riêng cho tác vụ.
</div>

## 1. Vấn đề: giữa hai lần suy luận, một chunk là "mù"

[[flow]]
- Trước~VLA đứng một mình | Ảnh + câu lệnh > !Chunk hành động~16 bước, mở vòng! > Robot | không có lực, không phản ứng trong chunk: 23,3% ở cắm chốt
- Trước~RL từ đầu | Lực + pose > !Reward dày~mới cho mỗi tác vụ! > Robot | phản ứng với lực, nhưng phải thiết kế reward riêng: 86,7%
+ FIRe | Ảnh + câu lệnh > *VLA đóng băng~chunk* > *Residual~lực, mỗi bước* > Robot | VLA quyết định đi đâu, residual quyết định tiếp xúc diễn ra thế nào: 96,7%
[[/flow]] VLA còn "khởi động nóng" cho RL: reward không cần nói đích ở đâu nữa, vì hành động của VLA đã chỉ về đó.

## 2. Kiến trúc

[[fig:fire]] Lệnh cuối cùng là hành động VLA cộng một residual có giới hạn, rồi qua bộ điều khiển trở kháng 1 kHz. VLA không bao giờ bắt vòng điều khiển chờ: chunk kế tiếp được lấy trước tại điểm giữa chunk hiện tại.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| VLA đóng băng | 2 ảnh ngoài + 1 ảnh cổ tay, pose tuyệt đối $p_{ee}^{abs}$ (7), câu lệnh $\ell$ | chunk hành động độ dài $T$ | đi đâu, một lần mỗi chunk |
| Residual $\pi_{res}$ | pose tương đối (7), vận tốc (6), lực $F_t$ (3), lệnh trước đó | $a_t^{res}$ (6, có giới hạn) | tiếp xúc diễn ra thế nào, mỗi bước ở 15 Hz |
| Phép cộng | $a_t^{VLA}$ và $a_t^{res}$ | $a_t$ | cả hai cùng biểu diễn pose tương đối |
| Bộ điều khiển trở kháng | $a_t$ | mô-men khớp | 1 kHz, nội suy giữa các lệnh 15 Hz |

Điều kiện duy nhất với VLA: phải xuất chunk pose tương đối 6 chiều của end-effector để residual cộng vào cùng dạng. Cùng một residual chạy được trên GR00T, π0.5 và OpenVLA.

## 3. Tính tay: reward của FIRe

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Reward bảo residual đừng ấn mạnh hơn một lực tham chiếu $F_{ref}$, mà không nói gì về tác vụ. Tính một lần để thấy mỗi số hạng làm gì.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\lVert F_t\rVert,\ \lVert F_{t+1}\rVert$ | độ lớn lực trước và sau một bước | input | 30 N, 20 N |
| $F_{ref}$ | lực tham chiếu | hằng số | 10 N (lúc đánh giá; ngẫu nhiên hóa khi huấn luyện) |
| $\alpha,\ \lambda_f,\ c_f,\ \gamma$ | hệ số phạt, hệ số shaping, hệ số thế năng, chiết khấu | hằng số | $10^{-5}$, $10^{-5}$, 1,0, 0,995 |
| $r_p,\ r_{sh}$ | phạt trực tiếp và số hạng shaping | output | – |

**Công thức**

$$r_p = -\alpha\max(0,\ \lVert F_{t+1}\rVert - F_{ref}),\qquad r_{sh} = \lambda_f\big(\gamma\,\phi_f(s_{t+1}) - \phi_f(s_t)\big)$$

$$\phi_f(s) = -\log\!\big(c_f\max(0,\ \lVert F(s)\rVert - F_{ref}) + 1\big)$$

**Từng bước**

1. Phần vượt $F_{ref}$: trước $30 - 10 = 20$ N, sau $20 - 10 = 10$ N.
2. $\phi_f(s_t) = -\log 21 = -3,0445$ và $\phi_f(s_{t+1}) = -\log 11 = -2,3979$.
3. $r_p = -10^{-5}\times 10 = -1,0\times 10^{-4}$.
4. $r_{sh} = 10^{-5}\,(0,995\times(-2,3979) + 3,0445) = 10^{-5}\times 0,6586 = 6,6\times 10^{-6}$.

**Kết quả.** $r_f = r_p + r_{sh} \approx -9,3\times 10^{-5}$. Giảm lực từ 30 N xuống 20 N được số hạng shaping thưởng, nhưng bước đó vẫn bị phạt vì 20 N còn cao hơn 10 N.

**Ý nghĩa.** Cả hai số hạng đều bằng đúng 0 khi lực không vượt $F_{ref}$, nên reward không thưởng cho việc chạm hay tránh chạm; việc đi tới tiếp xúc đến từ reward thành công và hành động của VLA. Các con số rất nhỏ so với reward thành công là 1. Trang không nói lực được chia thang thế nào, nên mình chỉ trình bày phép tính và không khẳng định các số hạng cân bằng ra sao.
</div>

## 4. Kết quả

[[bars:%]] VLA đứng một mình=23.3; FIRe không có lực=43.3; FIRe chỉ có lực trong observation=70.0; RL có reward riêng=86.7; *FIRe=96.7* || Cắm chốt trên robot thật, 30 lượt mỗi cấu hình. Mỗi cách dùng lực thêm khoảng 27 điểm.

| Robot thật, 30 lượt | Cắm chốt | Ăn khớp bánh răng | Vặn đai ốc |
|---|---|---|---|
| VLA | 23,3% | 10,0% | 3,3% |
| RL, reward riêng cho tác vụ | 86,7% | 100,0% | 33,3% |
| FIRe không có lực | 43,3% | 93,3% | 6,7% |
| FIRe, lực chỉ trong observation | 70,0% | 100,0% | 16,7% |
| **FIRe** | **96,7%** | **100,0%** | **33,3%** |

- Cùng một residual, ba backbone (chốt / bánh răng / đai ốc): GR00T 23,3→96,7, 10,0→100, 3,3→33,3; π0.5 20,0→96,7, 66,7→100, 0,0→13,3; OpenVLA 56,7→90,0, 93,3→100, 3,3→16,7.
- Mô phỏng, thành công đỉnh: FIRe 100%, 100%, 97%; RL có reward riêng 94%, 100%, 100%. RL từ đầu với cùng reward FIRe và không có VLA: khoảng 40% ở cắm chốt và 0% ở vặn đai ốc, nên khởi động từ VLA quan trọng.
- Vặn đai ốc vẫn thấp: khoảng 60% lỗi kết thúc khi đai ốc đã thẳng hàng trên bu-lông nhưng chưa vào ren. Trang cho rằng việc ăn ren không quan sát được từ pose của end-effector.

## 5. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Ý tưởng chuyển được sang bất kỳ cánh tay nào có đọc lực và bộ điều khiển mềm, nhưng công thức được xây quanh một mô hình mô phỏng của tác vụ và một VLA xuất chunk pose tương đối. "Không nêu" nghĩa là trang dự án không nói.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Robot và cảm biến | Franka FR3, cảm biến lực 3 trục gắn cổ tay, ba camera (hai ngoài, một cổ tay) | Chỉ dùng 3 thành phần lực, nên cảm biến 6 trục ở cổ tay (như cái tích hợp trong UR10e) là dư. Cánh tay khác: chưa thử |
| Điều khiển mức thấp | Bộ điều khiển trở kháng không gian tác vụ 1 kHz, điều khiển mô-men qua bộ điều khiển ROS 2 | Bạn cần một bộ điều khiển mềm tương đương; trang không nói cách chuyển |
| VLA | GR00T (chunk 16), π0.5 và OpenVLA (chunk 8 trong repo), action head đã fine-tune rồi đóng băng | VLA phải xuất chunk pose tương đối 6 chiều của end-effector |
| Mô phỏng | Isaac Sim 5.1 và Isaac Lab trên Linux, Python 3.11, CUDA 12.8, 64 môi trường song song, 200 epoch PPO | Tác vụ của bạn phải tồn tại dưới dạng tác vụ tiếp xúc mô phỏng. Ở đây là chi tiết in 3D cứng lấy từ FORGE. Nắp ấn khít cần mô hình riêng; FORGE xấp xỉ kẹp snap-fit bằng một lò xo |
| Từ mô phỏng sang thật | Ngẫu nhiên hóa miền và nhiễu trên pose và lực, zero-shot, không fine-tune ngoài thực tế | Tiếp xúc mà mô phỏng mô hình hóa kém có thể làm hỏng việc chuyển zero-shot |
| Demo cho VLA | Repo có script chạy một baseline đã huấn luyện trong mô phỏng để lưu demo GR00T; phép thử pick-and-place dùng 128 episode teleoperation | Các tác vụ tiếp xúc dùng bao nhiêu demo, và là demo thật hay mô phỏng, không được nêu |
| Thời gian huấn luyện và GPU | Không nêu | – |
| Code | [github.com/RCILab/FIRe](https://github.com/RCILab/FIRe): `fire_lab` (huấn luyện) và `fire_deploy` (robot thật). Không có file giấy phép. Trang vẫn ghi "Code (Coming Soon)" | Hãy kiểm tra repo trước khi dựa vào nó |

## 6. Lưu ý

- Chưa có paper trên arXiv hay toàn văn, nên các số liệu là lời của tác giả trên trang dự án, chưa qua bình duyệt.
- Mọi kết quả robot thật đều trên ba tác vụ cứng (chốt, bánh răng, đai ốc) với 30 lượt mỗi cấu hình. Với 30 lượt, 96,7% (29/30) vẫn chỉ cho khoảng 83% đến 99% (Wilson, phép tính của mình).
- Thành công ở vặn đai ốc (33,3%) chỉ bằng RL có reward riêng; mức tăng ở đó là so với VLA, không phải so với RL.

**Mang sang bài sau:** [ForceVLA](forcevla.html) và [TA-VLA](ta-vla.html) đưa lực *vào bên trong* VLA và huấn luyện lại nó. FIRe để nguyên VLA và hiệu chỉnh từ bên ngoài, cùng ý với residual trong [TER-DAgger](ter-dagger.html), nhưng ở đây được huấn luyện bằng RL trong mô phỏng.

**Câu kiểm tra:** $F_{ref} = 10$ N, $\alpha = 10^{-5}$, $\lVert F_{t+1}\rVert = 15$ N. $r_p$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Phần vượt $= 15 - 10 = 5$ N, nên $r_p = -10^{-5}\times 5 = -5\times 10^{-5}$.
</details>
:::
