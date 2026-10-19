---
slug: facet-0
date: 2026-10-19
title_en: "Facet-0: Predict the Wrench, Then Value It"
title_vi: "Facet-0: Dự đoán wrench, rồi định giá nó"
excerpt_en: "Feeding the wrist force to a VLA as an input barely helps (9–14%), because the force only records contact that already happened. Facet-0 makes the policy predict the wrench its actions will cause, scores that pair with a critic and adapts on the robot: 82% vs 15% on five sub-millimetre assembly tasks."
excerpt_vi: "Đưa lực cổ tay vào VLA như một input gần như không giúp (9–14%), vì lực chỉ ghi lại tiếp xúc đã xảy ra. Facet-0 bắt chính sách dự đoán wrench mà hành động sẽ gây ra, chấm điểm cặp đó bằng một critic và thích nghi trên robot: 82% so với 15% trên năm tác vụ lắp ráp dưới milimét."
tags: [VLA, Force, Reinforcement Learning, Paper Notes, π0.5]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.01596](https://arxiv.org/abs/2609.01596) · 09/2026 · PaliGemma + flow matching, on openpi · [code](https://github.com/PINE-Lab-NTU/FACET) · [weights](https://huggingface.co/Pinelab/Facet-0) · [data](https://huggingface.co/datasets/Pinelab/ManuFacet-1K)

**PROBLEM** The last millimetre of an assembly decides success: a small pose error becomes lateral force, friction or a jam, and two visually similar motions can end in opposite outcomes.

**WHAT FAILED BEFORE** Force-aware VLAs such as TA-VLA, or π0.5 with the wrench as an extra input token, score 14% and 9%. They read contact as a record of what already happened. A RECAP-style value method without the wrench scores 15%. All were trained on the same data with matched budgets.

**IDEA** The policy generates the action chunk together with the future wrench it expects, a critic scores that pair from deployment rollouts, and a small bounded actor adapts a new part on the robot.

**RESULT** 82% mean success on five computer-assembly tasks (20 trials per cell) against 15% for the best baseline, with 0.5 mm placement accuracy and 50 ms command latency.
</div>

## 1. The problem: force as an input arrives too late

[[flow]]
- Before~π0.5 | Images + text > !Actions only~no contact signal! > Robot | 10% mean
- Before~force as input | Wrench token > !Reads contact after it happened! > Actions | π0.5+F 9%, TA-VLA 14%
- Before~RECAP-style | Images > !Value without the wrench~cannot tell a jam from a clean insert! > Actions | 15%
+ Facet-0 | Wrench history > *Predict actions + wrench* > *Critic values the pair* > *Bounded local actor* > Actions | 82%
[[/flow]] A single wrench sample is ambiguous. Contact onset is a step, a jam is force rising while motion stalls, a skew is an off-axis moment that persists, so the paper keeps a window of the last 10 samples.

## 2. Architecture

[[fig:facet-0]] Wrench history joins vision, language and pose in one representation. The action expert outputs actions and the wrench they should cause; only the actions are sent to a compliant controller.

| Part | Input | Output | Role |
|---|---|---|---|
| Vision-language encoder | 3 RGB views, instruction $\ell$ | $h^{VL}_t$ | scene and task meaning (PaliGemma) |
| State and wrench encoders | pose + gripper (7), wrench window $W_{t-K+1:t}$, $K = 10$ | embeddings | kinematics and contact history |
| Fusion | the three embeddings | $h^c_t$ | semantic–contact representation |
| Action expert | $h^c_t$ plus noise | $Y_t = [A, \hat W] \in \mathbb{R}^{50 \times 13}$ | 50 steps of action (7) and predicted wrench (6) |
| Controller | $A$ only | joint commands | 200 Hz, regulates force along the directions the sub-goal marks |

The coarse chunk comes at 5–10 Hz at about 5 mm resolution; a refinement expert updates it at 20 Hz at about 0.5 mm. Training loss: flow matching on the action columns plus $\lambda_{pre} = 0.1$ times flow matching on the wrench columns, so lowering the wrench error forces the policy to encode how its motion changes contact.

## 3. Work it by hand: the reward that charges for forcing

<div class="calc" markdown="1">
Calculation card

**What and why.** The critic learns from one per-step signal: credit for finishing a sub-goal, more if it is quick, less if the wrench exceeded its limit. Computing two cases shows why forcing through is worse than a gentle insert.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\Omega_t$ | 1 if the sub-goal is completed (VLM judge), else 0 | input | 1 |
| $\Delta t,\ T_{max}$ | time spent in the sub-goal, its budget | input | 225 s, 450 s |
| $\lVert w_t\rVert_\phi$ | wrench normalised by the limit of the current phase (above 1 = violation) | input | 1.4 (forced) or 0.8 (gentle) |
| $\alpha,\ \beta$ | exchange rates for force and speed | constants | 0.5, 0.2 (example values from the repo's reward script, not from the paper) |
| $r_t$ | per-step reward | output | – |

**Formula**

$$r_t = \Omega_t\Big(1 + \beta\big[1 - \tfrac{\Delta t}{T_{max}}\big]_+\Big) - \alpha\big[\lVert w_t\rVert_\phi - 1\big]_+,\qquad [x]_+ = \max(x, 0)$$

**Steps**

1. Speed bonus: $1 + 0.2\times(1 - 225/450) = 1 + 0.2\times 0.5 = 1.1$.
2. Forced case: force penalty $0.5\times(1.4 - 1) = 0.2$, so $r_t = 1.1 - 0.2 = 0.9$.
3. Gentle case: $0.8 < 1$, so the penalty is 0 and $r_t = 1.1$.

**Result.** The forced insert earns 0.9, the gentle one 1.1, with the same completion time.

**Why it matters.** Two inserts that reach the same depth look alike to vision and to geometric progress. Because the critic also sees the predicted wrench, it can rank them apart before they happen.
</div>

## 4. Results

[[bars:%]] GR00T N1.7=4; π0.5+F (wrench as input)=9; π0.5=10; TA-VLA=14; π0.5+RECAP-style=15; Facet-0 Align only=16; Facet-0 +RL=38; *Facet-0 Full=82* || Mean success over five tasks, 20 trials per cell. Each stage adds: representation 16, value-guided refinement 38, local adaptation 82.

| Success (%), 20 trials | RAM | CPU | Disk | GPU | LEVER | Mean |
|---|---|---|---|---|---|---|
| π0.5 | 10 | 5 | 25 | 10 | 0 | 10 |
| π0.5+RECAP-style (best baseline) | 35 | 15 | 20 | 5 | 0 | 15 |
| TA-VLA | 10 | 20 | 30 | 5 | 5 | 14 |
| Facet-0 +RL | 45 | 45 | 65 | 35 | 0 | 38 |
| **Facet-0 Full** | **95** | **85** | **95** | **85** | **50** | **82** |

- Post-training against matched advantage-weighted BC on the Disk task: success 20% → 65%, recovery 44% → 81%, human intervention 47% → 24%.
- Unseen RAM module with a different mass and latch, 10 demonstrations and 3 hours: Facet-0 45% (updating 6.6% of the parameters) against 5% for the best baseline.
- Contact-role ablation on RAM: removing the wrench from prediction, valuation and adaptation together drops success from 95% to 45% and raises peak off-axis force from 0.2× to 1.0×. Removing one role changes success by only one to two trials of 20, so their order is not resolved.
- Deployment: 50 ms per command against 150 ms for π0.5, 0.5 mm against about 5 mm placement accuracy, and 40% faster than an expert teleoperator.

## 5. Data and tasks

| Item | Value |
|---|---|
| ManuFacet-1K | about 1,000 hours of demonstrations and closed-loop rollouts, three robot embodiments, two chassis families, several sites |
| Per cell | torque-controlled arm, parallel gripper, wrist 6-axis F/T, three RGB cameras; kinesthetic teleoperation with force feedback |
| Action resolution | 0.5 mm |
| Phases | approach, align, insert, press, seat, fasten, retreat; the five from align to fasten are "critical" |
| Test suite | RAM, CPU, Disk, GPU installs and a CPU-socket lever: 23 sub-goals, 14 contact-critical, clearances 0.10–0.30 mm, force limits 8–70 N |

## 6. Can I use this on my robot?

**Short answer.** This is the closest match so far to a precision push-in task with a wrist F/T sensor: code, weights and data are public and the stack builds on openpi. But the released weights were trained on their computer-assembly cells, and the paper does not say how to port the controller. "Not stated" means I looked in the paper, project page and repo and did not find it.

| Need | What the authors used | If yours differs |
|---|---|---|
| Sensing | Wrist 6-axis F/T, three RGB cameras (two third-person, one wrist), joint state | A UR10e's built-in 6-axis wrist sensor gives the same kind of signal. The wrench is expected in physical units (N, N·m) |
| Arm and gripper | A torque-controlled arm with a parallel gripper in every cell; arm models not named in the text I read | Whether a position-controlled arm works is not stated |
| Low-level control | A 200 Hz compliant controller that regulates force along the directions each sub-goal marks, plus a safety layer that clips targets and limits motion per step | The repo says the compliant controller, judge models and hardware evaluation are "supplied independently", so you build this part |
| Software | Python 3.11, openpi at a pinned commit, LeRobot-format data, Apache-2.0 licence | The repo includes a CPU example that trains tiny networks on synthetic data |
| Weights and data | [Facet-0 post-training checkpoint](https://huggingface.co/Pinelab/Facet-0) (Apache-2.0); ManuFacet-1K, about 417 GB as listed on the hub (CC-BY-4.0) | Using the checkpoint on a new robot means fine-tuning. The repo documents pretraining from base weights; fine-tuning from the released checkpoint is not spelled out |
| Your own demonstrations | Each frame stores a 13-D state (pose, gripper, wrench), three views and a sub-task instruction; episodes are tagged base, precision or recovery | Number of demos needed for a new task: not stated (only 10 demonstrations for adapting to a new part on top of the full system) |
| Reward and judge | A VLM judge marks sub-goal completion and contact phase; per-phase wrench limits are configured | You need limits for your task; the repo's example limits are explicitly "not a calibrated hardware limit" |
| Training compute | Pretraining counted as 32K action-branch and 8K language-branch updates on one run; adaptation takes hours on one robot | GPU type and pretraining time: not stated |

**Which part to expect from.** In their ablation, the representation alone gave 16% and the value-guided stage 38%. Most of the 82% came from the last stage, the on-robot adaptation (+44 points on average). So for a new task such as pressing a cap, the full gain needs rollouts, interventions and a working compliant controller, not just the released weights.

## 7. Caveats

- All baselines, including TA-VLA and the RECAP-style method (the authors' own implementation), were trained by the authors on their corpus with matched budgets. They are not the original release of each method.
- Each cell is 20 trials. The overall 82 of 100 trials gives about 73% to 88% (Wilson, my arithmetic), and the best baseline's 15 of 100 gives about 9% to 23%.
- The evaluation covers wrist-sensed, parallel-gripper electronics assembly on one chassis fixture. The authors say broader end effectors and contact geometries are future work.
- The paper states no certified hard force bound: the reward and the controller discourage excessive force, nothing more.
- LEVER, two sequential presses with no free-space step, stays at 50%.

**Carry forward:** [ForceVLA](forcevla.html) and [TA-VLA](ta-vla.html) read force as an input; Facet-0 also predicts it and values it. [FIRe](fire.html) also uses RL on top of a force-aware policy, but trains it in simulation. The evaluation protocol here (20 trials per cell, success, violation, intervention, recovery, peak off-axis force, cycle time, latency) is a good template for [your own benchmark](danh-gia-vla.html).

**Check question:** $\alpha = 0.5$, $\beta = 0.2$, $\Omega_t = 1$, $\Delta t = T_{max}/3$ and $\lVert w_t\rVert_\phi = 1$. What is $r_t$?

<details markdown="1">
<summary>Answer</summary>

Speed bonus $= 1 + 0.2\times(1 - 1/3) = 1.133$. The wrench is exactly at its limit, so $[1 - 1]_+ = 0$ and the penalty is 0. $r_t \approx 1.13$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2609.01596](https://arxiv.org/abs/2609.01596) · 09/2026 · PaliGemma + flow matching, trên openpi · [code](https://github.com/PINE-Lab-NTU/FACET) · [trọng số](https://huggingface.co/Pinelab/Facet-0) · [dữ liệu](https://huggingface.co/datasets/Pinelab/ManuFacet-1K)

**VẤN ĐỀ** Milimét cuối cùng của một mối lắp quyết định thành bại: lệch pose nhỏ trở thành lực ngang, ma sát hoặc kẹt, và hai chuyển động trông giống nhau có thể cho kết quả trái ngược.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các VLA có lực như TA-VLA, hoặc π0.5 với wrench là một token đầu vào thêm, chỉ đạt 14% và 9%. Chúng đọc tiếp xúc như một bản ghi những gì đã xảy ra. Phương pháp giá trị kiểu RECAP không có wrench đạt 15%. Tất cả đều được huấn luyện trên cùng dữ liệu với ngân sách như nhau.

**Ý TƯỞNG** Chính sách sinh chunk hành động cùng với wrench tương lai mà nó dự kiến, một critic chấm điểm cặp đó từ các lượt triển khai, và một actor nhỏ có giới hạn thích nghi với chi tiết mới ngay trên robot.

**KẾT QUẢ** Thành công trung bình 82% trên năm tác vụ lắp máy tính (20 lượt mỗi ô), so với 15% của baseline tốt nhất, với độ chính xác đặt 0,5 mm và độ trễ lệnh 50 ms.
</div>

## 1. Vấn đề: lực như một input đến quá muộn

[[flow]]
- Trước~π0.5 | Ảnh + câu lệnh > !Chỉ có hành động~không có tín hiệu tiếp xúc! > Robot | trung bình 10%
- Trước~lực làm input | Token wrench > !Đọc tiếp xúc sau khi nó xảy ra! > Hành động | π0.5+F 9%, TA-VLA 14%
- Trước~kiểu RECAP | Ảnh > !Giá trị không có wrench~không phân biệt kẹt với vào sạch! > Hành động | 15%
+ Facet-0 | Lịch sử wrench > *Dự đoán hành động + wrench* > *Critic chấm cặp đó* > *Actor cục bộ có giới hạn* > Hành động | 82%
[[/flow]] Một mẫu wrench đơn lẻ là mơ hồ. Lúc bắt đầu chạm là một bước nhảy, kẹt là lực tăng trong khi chuyển động dừng, lệch là một mô-men ngoài trục kéo dài, nên bài giữ một cửa sổ 10 mẫu gần nhất.

## 2. Kiến trúc

[[fig:facet-0]] Lịch sử wrench nhập với thị giác, ngôn ngữ và pose vào một biểu diễn. Action expert xuất hành động và wrench mà chúng sẽ gây ra; chỉ hành động được gửi tới bộ điều khiển mềm.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Bộ mã hóa thị giác-ngôn ngữ | 3 ảnh RGB, câu lệnh $\ell$ | $h^{VL}_t$ | nghĩa của cảnh và nhiệm vụ (PaliGemma) |
| Bộ mã hóa trạng thái và wrench | pose + tay kẹp (7), cửa sổ wrench $W_{t-K+1:t}$, $K = 10$ | embedding | động học và lịch sử tiếp xúc |
| Fusion | ba embedding trên | $h^c_t$ | biểu diễn ngữ nghĩa–tiếp xúc |
| Action expert | $h^c_t$ cộng nhiễu | $Y_t = [A, \hat W] \in \mathbb{R}^{50 \times 13}$ | 50 bước hành động (7) và wrench dự đoán (6) |
| Bộ điều khiển | chỉ $A$ | lệnh khớp | 200 Hz, điều chỉnh lực theo các hướng mà sub-goal chỉ định |

Chunk thô ra ở 5–10 Hz với độ phân giải khoảng 5 mm; một refinement expert cập nhật nó ở 20 Hz với khoảng 0,5 mm. Hàm loss huấn luyện: flow matching trên các cột hành động cộng $\lambda_{pre} = 0{,}1$ lần flow matching trên các cột wrench, nên muốn giảm sai số wrench thì chính sách buộc phải mã hóa cách chuyển động của nó làm đổi tiếp xúc.

## 3. Tính tay: reward tính phí việc ép mạnh

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Critic học từ một tín hiệu mỗi bước: thưởng khi xong một sub-goal, thưởng nhiều hơn nếu nhanh, bị giảm nếu wrench vượt giới hạn. Tính hai trường hợp để thấy vì sao ép qua tệ hơn một lần cắm nhẹ.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\Omega_t$ | 1 nếu sub-goal hoàn thành (VLM làm giám khảo), ngược lại 0 | input | 1 |
| $\Delta t,\ T_{max}$ | thời gian đã ở trong sub-goal, ngân sách của nó | input | 225 s, 450 s |
| $\lVert w_t\rVert_\phi$ | wrench chuẩn hóa theo giới hạn của pha hiện tại (trên 1 là vi phạm) | input | 1,4 (ép) hoặc 0,8 (nhẹ) |
| $\alpha,\ \beta$ | tỉ lệ đổi giữa lực và tốc độ | hằng số | 0,5; 0,2 (ví dụ từ script reward của repo, không phải của bài báo) |
| $r_t$ | reward mỗi bước | output | – |

**Công thức**

$$r_t = \Omega_t\Big(1 + \beta\big[1 - \tfrac{\Delta t}{T_{max}}\big]_+\Big) - \alpha\big[\lVert w_t\rVert_\phi - 1\big]_+,\qquad [x]_+ = \max(x, 0)$$

**Từng bước**

1. Thưởng tốc độ: $1 + 0{,}2\times(1 - 225/450) = 1 + 0{,}2\times 0{,}5 = 1{,}1$.
2. Trường hợp ép: phạt lực $0{,}5\times(1{,}4 - 1) = 0{,}2$, nên $r_t = 1{,}1 - 0{,}2 = 0{,}9$.
3. Trường hợp nhẹ: $0{,}8 < 1$ nên phạt bằng 0 và $r_t = 1{,}1$.

**Kết quả.** Cắm ép nhận 0,9, cắm nhẹ nhận 1,1, với cùng thời gian hoàn thành.

**Ý nghĩa.** Hai lần cắm cùng đạt một độ sâu thì nhìn giống nhau với thị giác và với tiến độ hình học. Vì critic còn thấy wrench dự đoán, nó xếp hạng được chúng trước khi chúng xảy ra.
</div>

## 4. Kết quả

[[bars:%]] GR00T N1.7=4; π0.5+F (wrench làm input)=9; π0.5=10; TA-VLA=14; π0.5+kiểu RECAP=15; Facet-0 chỉ Align=16; Facet-0 +RL=38; *Facet-0 đầy đủ=82* || Thành công trung bình trên năm tác vụ, 20 lượt mỗi ô. Mỗi giai đoạn cộng thêm: biểu diễn 16, tinh chỉnh theo giá trị 38, thích nghi cục bộ 82.

| Thành công (%), 20 lượt | RAM | CPU | Disk | GPU | LEVER | Trung bình |
|---|---|---|---|---|---|---|
| π0.5 | 10 | 5 | 25 | 10 | 0 | 10 |
| π0.5+kiểu RECAP (baseline tốt nhất) | 35 | 15 | 20 | 5 | 0 | 15 |
| TA-VLA | 10 | 20 | 30 | 5 | 5 | 14 |
| Facet-0 +RL | 45 | 45 | 65 | 35 | 0 | 38 |
| **Facet-0 đầy đủ** | **95** | **85** | **95** | **85** | **50** | **82** |

- Hậu huấn luyện so với BC có trọng số lợi thế (AWR) cùng ngân sách, trên tác vụ Disk: thành công 20% → 65%, phục hồi 44% → 81%, can thiệp của người 47% → 24%.
- Mô-đun RAM chưa từng thấy với khối lượng và chốt khác, 10 demo và 3 giờ: Facet-0 45% (chỉ cập nhật 6,6% tham số) so với 5% của baseline tốt nhất.
- Ablation vai trò của wrench trên RAM: bỏ wrench khỏi cả dự đoán, định giá và thích nghi làm thành công giảm từ 95% xuống 45% và đẩy lực ngoài trục đỉnh từ 0,2× lên 1,0×. Bỏ riêng từng vai trò chỉ đổi thành công một đến hai lượt trong 20, nên thứ tự của chúng chưa phân định được.
- Triển khai: 50 ms mỗi lệnh so với 150 ms của π0.5, độ chính xác đặt 0,5 mm so với khoảng 5 mm, và nhanh hơn 40% so với một chuyên gia teleoperation.

## 5. Dữ liệu và tác vụ

| Mục | Giá trị |
|---|---|
| ManuFacet-1K | khoảng 1.000 giờ demo và các lượt chạy vòng kín, ba loại robot, hai họ khung máy, nhiều địa điểm |
| Mỗi trạm | cánh tay điều khiển mô-men, tay kẹp song song, F/T 6 trục ở cổ tay, ba camera RGB; teleoperation kinesthetic có phản hồi lực |
| Độ phân giải hành động | 0,5 mm |
| Các pha | tiếp cận, căn chỉnh, cắm, ấn, vào khít, siết, rút lui; năm pha từ căn chỉnh đến siết là "quan trọng" |
| Bộ kiểm tra | lắp RAM, CPU, Disk, GPU và một cần gạt ổ CPU: 23 sub-goal, 14 sub-goal tiếp xúc quan trọng, khe hở 0,10–0,30 mm, giới hạn lực 8–70 N |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Đây là bài gần nhất cho tới giờ với việc ấn chính xác có cảm biến F/T ở cổ tay: code, trọng số và dữ liệu đều công khai và toàn bộ xây trên openpi. Nhưng trọng số công bố được huấn luyện trên các trạm lắp máy tính của họ, và bài không nói cách chuyển bộ điều khiển sang robot khác. "Không nêu" nghĩa là mình đã tìm trong paper, trang dự án và repo mà không thấy.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cảm biến | F/T 6 trục ở cổ tay, ba camera RGB (hai ngoài, một cổ tay), trạng thái khớp | Cảm biến 6 trục tích hợp ở cổ tay của UR10e cho cùng loại tín hiệu. Wrench được mong đợi theo đơn vị vật lý (N, N·m) |
| Cánh tay và tay kẹp | Cánh tay điều khiển mô-men với tay kẹp song song ở mọi trạm; văn bản mình đọc không nêu tên mẫu cánh tay | Cánh tay điều khiển vị trí có chạy được không: không nêu |
| Điều khiển mức thấp | Bộ điều khiển mềm 200 Hz điều chỉnh lực theo các hướng mà mỗi sub-goal chỉ định, cùng lớp an toàn cắt mục tiêu và giới hạn chuyển động mỗi bước | Repo ghi bộ điều khiển mềm, các mô hình giám khảo và đánh giá phần cứng là "do bạn tự cung cấp", nên phần này bạn tự xây |
| Phần mềm | Python 3.11, openpi ở một commit cố định, dữ liệu định dạng LeRobot, giấy phép Apache-2.0 | Repo có ví dụ chạy trên CPU, huấn luyện mạng nhỏ trên dữ liệu tổng hợp |
| Trọng số và dữ liệu | [Checkpoint hậu huấn luyện Facet-0](https://huggingface.co/Pinelab/Facet-0) (Apache-2.0); ManuFacet-1K, khoảng 417 GB theo số liệu trên hub (CC-BY-4.0) | Dùng checkpoint cho robot mới nghĩa là phải fine-tune. Repo mô tả huấn luyện từ trọng số nền; fine-tune từ checkpoint đã công bố không được nói rõ |
| Demo của riêng bạn | Mỗi khung lưu trạng thái 13 chiều (pose, tay kẹp, wrench), ba góc nhìn và một câu lệnh sub-task; episode được gắn nhãn base, precision hoặc recovery | Số demo cần cho tác vụ mới: không nêu (chỉ có 10 demo để thích nghi với chi tiết mới trên nền hệ thống đầy đủ) |
| Reward và giám khảo | Một VLM làm giám khảo đánh dấu hoàn thành sub-goal và pha tiếp xúc; giới hạn wrench theo từng pha được cấu hình | Bạn cần giới hạn cho tác vụ của mình; giới hạn ví dụ trong repo được ghi rõ là "không phải giới hạn phần cứng đã hiệu chuẩn" |
| Tính toán huấn luyện | Pretraining là 32K lần cập nhật nhánh hành động và 8K lần nhánh ngôn ngữ trong một lần chạy; thích nghi mất vài giờ trên một robot | Loại GPU và thời gian pretraining: không nêu |

**Nên kỳ vọng phần nào.** Theo ablation của họ, riêng biểu diễn cho 16% và giai đoạn tinh chỉnh theo giá trị cho 38%. Phần lớn trong 82% đến từ giai đoạn cuối, thích nghi trên robot (thêm 44 điểm trung bình). Vì vậy với tác vụ mới như ấn nắp, lợi ích đầy đủ cần các lượt chạy thật, can thiệp của người và một bộ điều khiển mềm hoạt động, chứ không chỉ trọng số công bố.

## 7. Lưu ý

- Mọi baseline, kể cả TA-VLA và phương pháp kiểu RECAP (do chính tác giả cài đặt), đều do các tác giả huấn luyện trên kho dữ liệu của họ với ngân sách như nhau. Chúng không phải bản gốc của từng phương pháp.
- Mỗi ô là 20 lượt. Tổng cộng 82 trên 100 lượt cho khoảng 73% đến 88% (Wilson, phép tính của mình), còn 15 trên 100 của baseline tốt nhất cho khoảng 9% đến 23%.
- Đánh giá giới hạn ở lắp ráp điện tử có cảm biến cổ tay, tay kẹp song song, trên một khung máy cố định. Các tác giả nói mở rộng sang end effector và hình học tiếp xúc khác là việc sau này.
- Bài không khẳng định giới hạn lực cứng được chứng nhận: reward và bộ điều khiển chỉ làm nản lòng việc dùng lực quá mức, không hơn.
- LEVER, hai lần ấn liên tiếp không có bước chuyển động tự do, vẫn dừng ở 50%.

**Mang sang bài sau:** [ForceVLA](forcevla.html) và [TA-VLA](ta-vla.html) đọc lực như một input; Facet-0 còn dự đoán và định giá nó. [FIRe](fire.html) cũng dùng RL trên một chính sách có lực, nhưng huấn luyện trong mô phỏng. Giao thức đánh giá ở đây (20 lượt mỗi ô, thành công, vi phạm, can thiệp, phục hồi, lực ngoài trục đỉnh, thời gian chu kỳ, độ trễ) là một khuôn mẫu tốt cho [benchmark riêng của bạn](danh-gia-vla.html).

**Câu kiểm tra:** $\alpha = 0{,}5$, $\beta = 0{,}2$, $\Omega_t = 1$, $\Delta t = T_{max}/3$ và $\lVert w_t\rVert_\phi = 1$. $r_t$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Thưởng tốc độ $= 1 + 0{,}2\times(1 - 1/3) = 1{,}133$. Wrench đúng bằng giới hạn nên $[1 - 1]_+ = 0$ và phạt bằng 0. $r_t \approx 1{,}13$.
</details>
:::
