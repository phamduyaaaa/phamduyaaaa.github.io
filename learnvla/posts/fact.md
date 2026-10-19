---
slug: fact
date: 2026-10-19
title_en: "FACT: Learning Dexterous Force from Human Gloves"
title_vi: "FACT: Học lực khéo léo từ găng tay của con người"
excerpt_en: "Robot data for dexterous hands is scarce and human video has no force. FACT pretrains on 2,000 hours of humans wearing tactile gloves, plans with video and tracks, then refines the action together with the fingertip force it predicts: 41% vs 9% for T-Rex on seven binary tasks."
excerpt_vi: "Dữ liệu robot cho bàn tay khéo léo rất khan và video của người không có lực. FACT huấn luyện trước trên 2.000 giờ người đeo găng xúc giác, lập kế hoạch bằng video và track, rồi tinh chỉnh hành động cùng với lực đầu ngón tay nó dự đoán: 41% so với 9% của T-Rex trên bảy tác vụ nhị phân."
tags: [VLA, Force, Tactile, Human Data, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2610.19155](https://arxiv.org/abs/2610.19155) · v1 13 Oct 2026 · University of Michigan, Stanford and Microsoft Research · [project page](https://fact-1-0.github.io/) (code and data "Coming Soon")

**PROBLEM** Dexterous hands need force to finish a motion, but robot data is expensive and the large human datasets record vision and hand motion without any contact force.

**WHAT FAILED BEFORE** T-Rex feeds vector-quantised force history into a refiner as an observation; force is never predicted, so how an action changes contact stays implicit. T-Rex scores 8.6% and π0.5 scores 1.4% on the seven binary tasks. Models trained without glove force scored 0% on some tasks.

**IDEA** Collect EgoForce, 2,000 hours of humans with calibrated tactile gloves, and train a two-stage model: a video planner draws the coarse motion, then a refiner denoises the rest of the action and the future fingertip force together.

**RESULT** 41.4% mean on seven binary tasks against 8.6% for T-Rex, from 10 robot and 90 human demonstrations per task.
</div>

## 1. The problem: force is an observation, not a consequence

[[flow]]
- Before~π0.5 | Images + text > !Actions only~no contact signal! > Hand | 1.4% on seven binary tasks
- Before~T-Rex | Tactile history > !Quantised force as input~never predicted! > Refiner > Hand | 8.6%
+ FACT | Video + tracks > *Coarse plan* > *Refiner: action + future force, jointly* > Hand | 41.4%
[[/flow]] In FACT the future force and the remaining action are denoised together, so each shapes the other at every step.

## 2. Architecture

[[fig:fact]] The planner stops denoising at a handoff point; the refiner finishes the action and predicts the force, and re-runs at every tactile refresh.

| Part | Input | Output | Role |
|---|---|---|---|
| Track-Guided Coarse Planner | instruction, anchor frame, robot state, past tracks | future video, visual tracks, a partly denoised action | coarse plan; 5.05B parameters, built from Wan2.2-TI2V-5B |
| Force–Action Joint Refiner | the partly denoised action, observed tactile history, cached planner states | the rest of the action and future fingertip force | 6-block transformer, 65M parameters |
| Output | – | a 16-step, 20 Hz action chunk of 62 values (delta base pose, absolute hand joints, per arm) | only the action is executed |

The force prediction has the shape $4 \times 10 \times 6$: four 5 Hz slots, ten fingertips, six components each. The paper records it for analysis and does not use it as a control reference.

## 3. Work it by hand: what the refiner re-decides at each refresh

<div class="calc" markdown="1">
Calculation card

**What and why.** The chunk is 16 steps at 20 Hz, and touch is read at 5 Hz. Computing the timeline shows how much of the chunk is still open when the refiner re-runs, and how its noise schedules step.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $N$, $f$ | chunk length (steps) and action rate (Hz) | constants | 16, 20 |
| $o$ | refresh offset: steps already executed | input | 0, 4, 8, 12 |
| $\tau_a$ | action noise level, linear from 0.4 to 0 in 4 Euler steps | schedule | step 0.1 |
| $\tau_f$ | force noise level, linear from 1 to 0 in 4 Euler steps | schedule | step 0.25 |
| $n_{suffix}$ | action steps still open | output | – |

**Formulas**

$$n_{suffix} = N - o,\qquad \text{time still open} = \frac{N - o}{f}\ \text{s},\qquad \Delta\tau = \frac{\tau_{start} - \tau_{end}}{4}$$

**Steps**

1. Refresh spacing: $4/20 = 0.2$ s, which is the 5 Hz tactile rate.
2. At $o = 8$: $n_{suffix} = 16 - 8 = 8$ steps, executed prefix $= 8/20 = 0.4$ s (fixed), time still open $= 8/20 = 0.4$ s.
3. $\tau_a$ grid: $0.4,\ 0.3,\ 0.2,\ 0.1,\ 0$ (step $0.4/4 = 0.1$).
4. $\tau_f$ grid: $1,\ 0.75,\ 0.5,\ 0.25,\ 0$ (step $1/4 = 0.25$).

**Result.** The refresh offsets 0, 4, 8, 12 leave 16, 12, 8 and 4 steps open, that is 0.8, 0.6, 0.4 and 0.2 s.

**Why it matters.** Force starts from pure noise ($\tau_f = 1$) while the action arrives at noise level 0.4, already mostly formed, so a force imagined from scratch shapes an action that is nearly finished.
</div>

## 4. Results

[[bars:%]] π0.5=1.4; T-Rex=8.6; FACT without force prediction=14.3; FACT without track prediction=35.7; *FACT full=41.4* || Mean success over seven binary tasks, 10 rollouts per task. Force prediction matters most on contact-sensitive tasks.

| Success (%), 10 rollouts | π0.5 | T-Rex | FACT w/o force pred | FACT |
|---|---|---|---|---|
| Lab pipetting | 0 | 0 | 30 | 40 |
| Open test-tube cap | 10 | 20 | 40 | 80 |
| Open microcentrifuge flip cap | 0 | 20 | 20 | 50 |
| Tie shoelaces | 0 | 0 | 0 | 20 |
| Shuffle cards | 0 | 10 | 0 | 30 |
| Multi-object grasp | 0 | 0 | 10 | 40 |
| Use screwdriver | 0 | 10 | 0 | 30 |

- Notes cleanly played out of 10: harp 6.7 against 2.1 for T-Rex and 0.5 for π0.5; xylophone 5.4 against 3.2 and 0.
- Pipette dial: FACT engages it in 5 of 10 trials with 6.4 µL mean error; T-Rex engages in 2 with 14 µL.
- Pretraining recipe on the same tasks: glove force removed from the human data drops the test-tube cap from 80% to 0% and pipetting from 40% to 20%; robot data only gives 20% and 0%. Multi-object grasping stays 40% without force.
- Human data in fine-tuning: ten robot trajectories alone vs the 10:90 mixture lifts shoelaces from 10% to 20% and card shuffling from 10% to 30%.

## 5. Data

| Item | Value |
|---|---|
| EgoForce | about 2,000 hours, 40k episodes, 1,000 tasks, 120 scenes, 1,000 demonstrators |
| Capture | bimanual tactile gloves and three egocentric RGB cameras (head and both wrists), synchronised |
| Calibration | a pneumatic bladder sweeps 0–50 psi against a reference sensor; force of each element $F_i = P_i A_i$ |
| Task mix | deformable 21.0%, assembly 17.3%, storage 14.8%; over two thirds is fine manipulation |
| Robot side | 100 hours of teleoperation from T-Rex for pretraining; 10 robot demonstrations per task for fine-tuning |

## 6. Can I use this on my robot?

**Short answer.** Not directly. FACT is built for a dexterous hand with force at every fingertip and for human glove data. A parallel gripper with a wrist F/T sensor would need a redesign, and the model is too large to be a light experiment. "Not stated" means I did not find it in the paper or project page.

| Need | What the authors used | If yours differs |
|---|---|---|
| Robot | A bimanual YAM station with two Sharpa Wave hands (22 joints, five-fingertip 6-axis force sensing) | A UR10e with a gripper has one wrist wrench, not ten fingertip forces. The force head expects fingertip force |
| Cameras | One RealSense D435 ego-view and two ZED Mini wrist cameras | – |
| Teleoperation | Manus glove and wrist tracker for the robot; Wuji tactile glove and wrist tracker for humans | You need a way to collect human demonstrations with force |
| Pretraining compute | 240 Alibaba T-Head PPU accelerators (96 GB each), end to end | Not a single-workstation job |
| Fine-tuning | 100 trajectories (10 robot, 90 human) per task, on 8 GPUs | Time per task: not stated |
| Model size | 5.05B parameters for the planner plus a 65M refiner | – |
| Code, weights, data | Project page: Code "Coming Soon", Data "Coming Soon" (checked on 2026-10-19) | Not usable yet |

## 7. Caveats

- Each task is 10 rollouts, so one rollout is 10 points. 80% on test-tube cap (8 of 10) is about 49% to 94% (Wilson, my arithmetic). The seven-task mean rests on 70 rollouts.
- The baselines were fine-tuned by the authors from public checkpoints on the same 100 trajectories. T-Rex is cited as a 2026 work with no arXiv entry in the reference list.
- Tasks are hard: FACT still fails most of the time on shoelaces (20%), pipetting (40%) and screwdriver use (30%).
- Individual ablations that differ by one or two rollouts are not conclusive; the clear signals are the large drops (cap opening 80% to 0% without glove force).

**Carry forward:** [Facet-0](facet-0.html) also predicts the future wrench and values it, with a wrist F/T sensor and a parallel gripper; FACT does the same with fingertip force and human glove data. [TA-VLA](ta-vla.html) also predicts torque as a training target.

**Check question:** At refresh offset $o = 12$ with $N = 16$ steps at 20 Hz, how many steps and how many seconds of the chunk are still open?

<details markdown="1">
<summary>Answer</summary>

$16 - 12 = 4$ steps, and $4/20 = 0.2$ s.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2610.19155](https://arxiv.org/abs/2610.19155) · v1 13/10/2026 · University of Michigan, Stanford và Microsoft Research · [trang dự án](https://fact-1-0.github.io/) (code và dữ liệu "Coming Soon")

**VẤN ĐỀ** Bàn tay khéo léo cần lực để hoàn tất một chuyển động, nhưng dữ liệu robot đắt đỏ, còn các bộ dữ liệu người lớn thì chỉ ghi thị giác và chuyển động tay, không có lực tiếp xúc.

**PAPER TRƯỚC HỎNG Ở ĐÂU** T-Rex đưa lịch sử lực đã lượng tử hóa vào một refiner như một quan sát; lực không bao giờ được dự đoán, nên việc hành động đổi tiếp xúc thế nào vẫn ngầm định. T-Rex đạt 8,6% và π0.5 đạt 1,4% trên bảy tác vụ nhị phân. Mô hình huấn luyện không có lực từ găng tay có tác vụ đạt 0%.

**Ý TƯỞNG** Thu EgoForce, 2.000 giờ người đeo găng xúc giác đã hiệu chuẩn, và huấn luyện một mô hình hai giai đoạn: bộ lập kế hoạch video vẽ chuyển động thô, rồi một refiner khử nhiễu phần hành động còn lại cùng với lực đầu ngón tay tương lai.

**KẾT QUẢ** Trung bình 41,4% trên bảy tác vụ nhị phân so với 8,6% của T-Rex, từ 10 demo robot và 90 demo người cho mỗi tác vụ.
</div>

## 1. Vấn đề: lực là một quan sát, không phải một hệ quả

[[flow]]
- Trước~π0.5 | Ảnh + câu lệnh > !Chỉ có hành động~không có tín hiệu tiếp xúc! > Bàn tay | 1,4% trên bảy tác vụ nhị phân
- Trước~T-Rex | Lịch sử xúc giác > !Lực đã lượng tử hóa làm input~không bao giờ được dự đoán! > Refiner > Bàn tay | 8,6%
+ FACT | Video + track > *Kế hoạch thô* > *Refiner: hành động + lực tương lai, cùng lúc* > Bàn tay | 41,4%
[[/flow]] Trong FACT, lực tương lai và phần hành động còn lại được khử nhiễu cùng nhau, nên mỗi thứ định hình thứ kia ở mọi bước.

## 2. Kiến trúc

[[fig:fact]] Bộ lập kế hoạch dừng khử nhiễu ở một điểm bàn giao; refiner hoàn tất hành động và dự đoán lực, rồi chạy lại ở mỗi lần làm mới xúc giác.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Track-Guided Coarse Planner | câu lệnh, khung neo, trạng thái robot, track quá khứ | video tương lai, track thị giác, một hành động mới khử nhiễu một phần | kế hoạch thô; 5,05 tỉ tham số, xây từ Wan2.2-TI2V-5B |
| Force–Action Joint Refiner | hành động đang khử nhiễu dở, lịch sử xúc giác quan sát được, trạng thái planner đã lưu đệm | phần hành động còn lại và lực đầu ngón tay tương lai | Transformer 6 khối, 65 triệu tham số |
| Đầu ra | – | chunk hành động 16 bước, 20 Hz, 62 giá trị (delta pose đế, khớp bàn tay tuyệt đối, mỗi tay) | chỉ hành động được thực thi |

Dự đoán lực có dạng $4 \times 10 \times 6$: bốn khe 5 Hz, mười đầu ngón tay, sáu thành phần mỗi ngón. Bài chỉ ghi lại nó để phân tích và không dùng làm tham chiếu điều khiển.

## 3. Tính tay: refiner quyết định lại phần nào ở mỗi lần làm mới

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Chunk dài 16 bước ở 20 Hz, còn xúc giác được đọc ở 5 Hz. Tính dòng thời gian để thấy khi refiner chạy lại thì còn bao nhiêu phần chunk đang mở, và lịch nhiễu của nó bước ra sao.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $N$, $f$ | độ dài chunk (bước) và tần số hành động (Hz) | hằng số | 16, 20 |
| $o$ | độ lệch làm mới: số bước đã thực thi | input | 0, 4, 8, 12 |
| $\tau_a$ | mức nhiễu của hành động, tuyến tính từ 0,4 về 0 trong 4 bước Euler | lịch | bước 0,1 |
| $\tau_f$ | mức nhiễu của lực, tuyến tính từ 1 về 0 trong 4 bước Euler | lịch | bước 0,25 |
| $n_{suffix}$ | số bước hành động còn mở | output | – |

**Công thức**

$$n_{suffix} = N - o,\qquad \text{thời gian còn mở} = \frac{N - o}{f}\ \text{s},\qquad \Delta\tau = \frac{\tau_{start} - \tau_{end}}{4}$$

**Từng bước**

1. Khoảng cách giữa hai lần làm mới: $4/20 = 0{,}2$ s, đúng bằng tần số xúc giác 5 Hz.
2. Tại $o = 8$: $n_{suffix} = 16 - 8 = 8$ bước, phần đã thực thi $= 8/20 = 0{,}4$ s (cố định), thời gian còn mở $= 8/20 = 0{,}4$ s.
3. Lưới $\tau_a$: $0{,}4,\ 0{,}3,\ 0{,}2,\ 0{,}1,\ 0$ (bước $0{,}4/4 = 0{,}1$).
4. Lưới $\tau_f$: $1,\ 0{,}75,\ 0{,}5,\ 0{,}25,\ 0$ (bước $1/4 = 0{,}25$).

**Kết quả.** Các độ lệch làm mới 0, 4, 8, 12 để lại 16, 12, 8 và 4 bước còn mở, tức là 0,8; 0,6; 0,4 và 0,2 giây.

**Ý nghĩa.** Lực bắt đầu từ nhiễu thuần ($\tau_f = 1$), còn hành động đến với mức nhiễu 0,4, tức là đã gần thành hình, nên một lực được tưởng tượng từ đầu sẽ định hình một hành động sắp hoàn thiện.
</div>

## 4. Kết quả

[[bars:%]] π0.5=1.4; T-Rex=8.6; FACT không dự đoán lực=14.3; FACT không dự đoán track=35.7; *FACT đầy đủ=41.4* || Thành công trung bình trên bảy tác vụ nhị phân, 10 lượt mỗi tác vụ. Dự đoán lực quan trọng nhất ở các tác vụ nhạy với tiếp xúc.

| Thành công (%), 10 lượt | π0.5 | T-Rex | FACT không dự đoán lực | FACT |
|---|---|---|---|---|
| Pipet phòng thí nghiệm | 0 | 0 | 30 | 40 |
| Mở nắp ống nghiệm | 10 | 20 | 40 | 80 |
| Mở nắp gập ống ly tâm nhỏ | 0 | 20 | 20 | 50 |
| Buộc dây giày | 0 | 0 | 0 | 20 |
| Xào bài | 0 | 10 | 0 | 30 |
| Nắm nhiều vật | 0 | 0 | 10 | 40 |
| Dùng tua vít | 0 | 10 | 0 | 30 |

- Số nốt vang rõ trên 10: đàn hạc 6,7 so với 2,1 của T-Rex và 0,5 của π0.5; xylophone 5,4 so với 3,2 và 0.
- Núm chỉnh pipet: FACT vào khớp được núm ở 5 trên 10 lượt với sai số trung bình 6,4 µL; T-Rex vào khớp 2 lượt với 14 µL.
- Công thức pretraining trên cùng các tác vụ: bỏ lực từ găng khỏi dữ liệu người làm mở nắp ống nghiệm giảm từ 80% xuống 0% và pipet từ 40% xuống 20%; chỉ dùng dữ liệu robot cho 20% và 0%. Nắm nhiều vật vẫn là 40% khi không có lực.
- Dữ liệu người khi fine-tune: chỉ mười quỹ đạo robot so với hỗn hợp 10:90 nâng buộc dây giày từ 10% lên 20% và xào bài từ 10% lên 30%.

## 5. Dữ liệu

| Mục | Giá trị |
|---|---|
| EgoForce | khoảng 2.000 giờ, 40 nghìn episode, 1.000 tác vụ, 120 cảnh, 1.000 người thực hiện |
| Thu thập | găng tay xúc giác hai tay và ba camera RGB góc nhìn thứ nhất (đầu và hai cổ tay), đồng bộ |
| Hiệu chuẩn | một túi khí nén quét 0–50 psi so với cảm biến tham chiếu; lực của từng phần tử $F_i = P_i A_i$ |
| Cơ cấu tác vụ | vật biến dạng 21,0%, lắp ráp 17,3%, sắp xếp 14,8%; hơn hai phần ba là thao tác tinh |
| Phía robot | 100 giờ teleoperation từ T-Rex để pretrain; 10 demo robot mỗi tác vụ để fine-tune |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Không dùng thẳng được. FACT được xây cho bàn tay khéo léo có lực ở từng đầu ngón và cho dữ liệu găng tay của người. Tay kẹp song song với cảm biến F/T cổ tay sẽ cần thiết kế lại, và mô hình quá lớn để làm một thí nghiệm nhẹ. "Không nêu" nghĩa là mình không tìm thấy trong paper hay trang dự án.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Robot | Trạm YAM hai tay với hai bàn tay Sharpa Wave (22 khớp, cảm biến lực 6 trục ở cả năm đầu ngón) | UR10e với tay kẹp chỉ có một wrench ở cổ tay, không có mười lực đầu ngón. Đầu ra lực của mô hình là lực đầu ngón |
| Camera | Một RealSense D435 góc nhìn thứ nhất và hai ZED Mini ở cổ tay | – |
| Teleoperation | Găng Manus và bộ theo dõi cổ tay cho robot; găng xúc giác Wuji và bộ theo dõi cổ tay cho người | Bạn cần một cách thu demo của người có kèm lực |
| Tính toán pretraining | 240 bộ tăng tốc Alibaba T-Head PPU (96 GB mỗi bộ), end to end | Không phải việc của một máy trạm |
| Fine-tune | 100 quỹ đạo (10 robot, 90 người) mỗi tác vụ, trên 8 GPU | Thời gian mỗi tác vụ: không nêu |
| Kích thước mô hình | 5,05 tỉ tham số cho planner cộng refiner 65 triệu | – |
| Code, trọng số, dữ liệu | Trang dự án: Code "Coming Soon", Data "Coming Soon" (kiểm tra ngày 19/10/2026) | Chưa dùng được |

## 7. Lưu ý

- Mỗi tác vụ chỉ 10 lượt, nên một lượt là 10 điểm. 80% ở mở nắp ống nghiệm (8 trên 10) là khoảng 49% đến 94% (Wilson, phép tính của mình). Trung bình bảy tác vụ dựa trên 70 lượt.
- Các baseline do tác giả fine-tune từ checkpoint công khai trên cùng 100 quỹ đạo. T-Rex được dẫn là công trình 2026 và không có mục arXiv trong danh sách tham khảo.
- Các tác vụ khó: FACT vẫn thất bại phần lớn ở buộc dây giày (20%), pipet (40%) và dùng tua vít (30%).
- Các ablation chênh nhau một hai lượt thì chưa kết luận được; tín hiệu rõ là các mức giảm lớn (mở nắp ống nghiệm từ 80% xuống 0% khi không có lực găng tay).

**Mang sang bài sau:** [Facet-0](facet-0.html) cũng dự đoán wrench tương lai và định giá nó, với cảm biến F/T cổ tay và tay kẹp song song; FACT làm tương tự với lực đầu ngón và dữ liệu găng tay của người. [TA-VLA](ta-vla.html) cũng dự đoán mô-men như một mục tiêu huấn luyện.

**Câu kiểm tra:** Ở độ lệch làm mới $o = 12$ với $N = 16$ bước ở 20 Hz, còn bao nhiêu bước và bao nhiêu giây của chunk đang mở?

<details markdown="1">
<summary>Đáp án</summary>

$16 - 12 = 4$ bước, và $4/20 = 0{,}2$ s.
</details>
:::
