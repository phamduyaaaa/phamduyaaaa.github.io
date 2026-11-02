---
slug: reactive-diffusion-policy
date: 2026-11-02
title_en: "Reactive Diffusion Policy: A Slow Planner and a Fast Tactile Reflex"
title_vi: "Reactive Diffusion Policy: Một bộ lập kế hoạch chậm và một phản xạ xúc giác nhanh"
excerpt_en: "An action chunk runs open loop, so the policy cannot react to touch until the next chunk. RDP plans latent chunks at 1–2 Hz and lets a tiny decoder turn them into actions at 24 Hz using the latest tactile or wrench reading: peeling 0.95 vs 0.44 for Diffusion Policy, bimanual lifting 0.70 vs 0."
excerpt_vi: "Một action chunk chạy vòng hở, nên chính sách không phản ứng được với xúc giác cho tới chunk sau. RDP lập kế hoạch chunk tiềm ẩn ở 1–2 Hz và để một bộ giải mã nhỏ biến chúng thành hành động ở 24 Hz bằng giá trị xúc giác hoặc wrench mới nhất: gọt vỏ 0,95 so với 0,44 của Diffusion Policy, nâng bằng hai tay 0,70 so với 0."
tags: [VLA, Force, Tactile, Diffusion, Action Chunking, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Xue, Ren, Chen et al., [arXiv 2503.02881](https://arxiv.org/abs/2503.02881) · v1 4 Mar 2025, v3 23 Apr 2025 · **RSS 2025, Best Student Paper Finalist** · Shanghai Jiao Tong, Tsinghua IIIS, Shanghai Qi Zhi, Shanghai AI Lab · [project page](https://reactive-diffusion-policy.github.io/) · [code](https://github.com/xiaoxiaoxh/reactive_diffusion_policy), [data](https://huggingface.co/datasets/WendiChen/reactive_diffusion_policy_dataset) and [models](https://huggingface.co/WendiChen/reactive_diffusion_policy_model) released

**PROBLEM** [Action chunking](action-chunking.html) makes imitation policies smooth and good at multi-modal behaviour, but while a chunk executes the robot is open loop: a contact change in the middle of the chunk is ignored until the next one.

**WHAT FAILED BEFORE** Adding touch to the observation of [Diffusion Policy](diffusion-policy.html) does not help (peeling 0.39–0.41 vs 0.44 without touch), because touch only matters at chunk boundaries. Shorter chunks (8 → 2) drop grasp success from 100% to 20%; temporal ensembling is very sensitive to its coefficient.

**IDEA** Split the policy in two. A slow **Latent Diffusion Policy** predicts a chunk in a compressed latent space at 1–2 Hz. A fast **Asymmetric Tokenizer** decoder turns that latent into real actions at 24 Hz, and only the decoder sees the newest tactile or wrench signal. Demonstrations come from **TactAR**, a Quest 3 AR teleoperation that shows contact force as arrows.

**RESULT** Peeling 0.95 vs 0.44 for DP, wiping 0.87 vs 0.57, bimanual lifting 0.70 vs 0.00 (scores, 10 trials per condition). The best variant uses the arm's joint-torque-estimated wrench, not an optical tactile sensor.
</div>

## 1. The problem: a chunk is a promise the robot cannot break

[[flow]]
- Before~DP | Image + state > !Chunk of 8 actions~executed open loop! > Robot | peeling after a push: 0.19
- Before~DP + touch | Image + touch + state > !Chunk of 8 actions~touch read only at boundaries! > Robot | 0.15
+ RDP | Image + touch + state > *Slow latent chunk~1–2 Hz* > *Fast decoder + latest touch~24 Hz* > Robot | 0.88
[[/flow]] Scores are for peeling with a push after contact. RDP keeps the chunk for planning but lets touch change each executed action.

The authors' failure modes for DP: "large force" (the arm keeps pushing into the cucumber), "get stuck" (DP with touch becomes cautious and stops), and "lose contact" (after a push, the rest of the chunk runs blind and leaves skin or ink behind).

## 2. Architecture

[[fig:reactive-diffusion-policy]] The tokenizer is trained first; the slow policy then learns to generate its latents. At run time, the decoder runs every step with the newest touch.

| Part | Input | Output | Role |
|---|---|---|---|
| Tactile representation | GelSight Mini or MCTac image | marker flow $F_t = [d_x, d_y]$, reduced by PCA to 15 numbers | robust to lighting and gel replacement; first components read as shear, torsion and normal force |
| Force representation | robot's estimated TCP wrench, 120 Hz | 6-D wrench, resampled to 24 Hz | used directly, no PCA |
| AT encoder $\mathcal{E}$ | action chunk $A$ (32 steps, 24 Hz) | latent $Z \in \mathbb{R}^{t \times d}$, 4× downsampled, $d$ = 4 or 8 | 1D CNN; **gets no touch** |
| AT decoder $\mathcal{D}$ (fast policy) | $Z$ and the touch sequence | actions $\hat A$ | GRU, under 1 ms per call |
| Latent Diffusion Policy (slow policy) | image, touch or wrench, state (2 frames at 12 Hz) | a latent chunk $Z$ | CNN Diffusion Policy with FiLM, 100 ms on an RTX 4090 |

The asymmetry is the design. Because the encoder never sees touch, the latent has to describe the strategy ("follow the surface, keep contact"), and the decoder must use the live touch to place the tool exactly. The paper calls the corrections "sub-millimeter".

Losses (Eq. 2 and 3 of the paper):

$$\mathcal{L}_{AT} = \mathbb{E}\big[\lVert A - \mathcal{D}(Z, F^{reduced})\rVert_1 + \lambda_{KL}\,\mathcal{L}_{KL}\big],\qquad \mathcal{L}_{LDP} = \mathbb{E}\,\lVert \varepsilon^k - \varepsilon_\theta(O,\ Z^0 + \varepsilon^k,\ k)\rVert_2$$

$\lambda_{KL}$ is kept tiny (1e-6) so the latent space is smooth but the tokenizer does not become a generative model. Two practical tricks the authors stress: actions are **relative** end-effector trajectories, and **latency matching** discards the first actions of each new chunk that are already in the past when inference finishes.

## 3. Work it by hand: how often can touch change the action?

<div class="calc" markdown="1">
Calculation card

**What and why.** Compare how long a contact change can go unanswered in DP and in RDP, and how many steps latency matching throws away.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n_{DP}$, $f_{DP}$ | DP chunk executed per call, and its rate | constants | 8 steps, 12 Hz |
| $f_{fast}$ | fast decoder rate (GelSight runs at 25 FPS) | constant | 24 Hz |
| $t_{slow}$ | slow policy inference time, RTX 4090 | measured | 100 ms |
| $t_{blind}$ | longest time touch cannot change the action | output | – |
| $n_{drop}$ | steps discarded by latency matching | output | – |

**Formulas**

$$t_{blind}^{DP} = \frac{n_{DP}}{f_{DP}},\qquad t_{blind}^{RDP} = \frac{1}{f_{fast}},\qquad n_{drop} = \left\lceil t_{slow}\, f_{fast} \right\rceil$$

**Steps**

1. DP: $8 / 12 = 0.67$ s per chunk, during which touch is not read.
2. RDP: $1 / 24 = 0.042$ s, the decoder re-reads touch every step.
3. Ratio: $0.67 / 0.042 = 16$.
4. Latency: $0.1 \times 24 = 2.4$, so about 3 steps of every new chunk are already stale when it arrives (my arithmetic; the paper says only that it drops "the first few action steps").

**Result.** DP can stay blind for 0.67 s; RDP for 42 ms, 16 times shorter.

**Why it matters.** At an illustrative 1 cm/s of relative motion (my example, not the paper's), 0.67 s is 6.7 mm of uncorrected error, larger than a peeler's cutting depth; 42 ms is 0.4 mm.
</div>

## 4. Results

[[bars:]] DP=0.44; DP + tactile image=0.41; DP + tactile embedding=0.39; RDP (GelSight)=0.90; RDP (MCTac)=0.88; *RDP (wrench)=0.95* || Peeling, overall score (fraction of skin peeled, normalised by the demonstrations), 30 trials per method.

| Peeling score | No push | Push before contact | Push after contact | All |
|---|---|---|---|---|
| DP | 0.56 | 0.58 | 0.19 | 0.44 |
| DP + tactile embedding | 0.48 | 0.55 | 0.15 | 0.39 |
| RDP (GelSight) | 0.98 | 0.93 | 0.80 | 0.90 |
| RDP (wrench) | 0.99 | 0.98 | 0.88 | 0.95 |

| Wiping score | No push | Push before contact | Push after contact | All |
|---|---|---|---|---|
| DP | 0.75 | 0.70 | 0.25 | 0.57 |
| DP + tactile embedding | 0.60 | 0.75 | 0.15 | 0.50 |
| RDP (GelSight) | 0.85 | 0.95 | 0.50 | 0.77 |
| RDP (wrench) | 0.95 | 0.85 | 0.80 | 0.87 |

| Bimanual lifting of a paper cup | Soft cup score | Hard cup score | All |
|---|---|---|---|
| DP | 0.00 | 0.00 | 0.00 |
| DP + tactile embedding | 0.10 | 0.05 | 0.08 |
| RDP (GelSight + MCTac) | 0.55 | 0.40 | 0.48 |
| RDP (wrench) | 0.80 | 0.60 | 0.70 |

- **Chunk size is not the fix.** On wiping with a push after contact, DP + touch scores 0.15 with chunk 8 and 0.10 with chunk 2 (grasp success falls to 20%). Temporal ensembling gives 0.05, 0.00 and 0.15 for $\tau$ = 0.2, 0.5, 0.8. RDP with chunk 8 scores 0.50.
- **Sensor does not matter much.** GelSight Mini ($549) and the authors' MCTac (about $50) give 0.90 and 0.88 on peeling.
- **Wrench beats optical touch** in all three tasks, although it is estimated from joint torques and is noisy during fast motion. The authors suspect lower latency and fewer dimensions.
- **Feedback during teleoperation matters.** Training on 60 demonstrations collected without AR force feedback cut the score by more than 30%.

## 5. Data and TactAR

| Item | Value |
|---|---|
| Demonstrations | 60 peeling, 80 wiping, 50 bimanual lifting (appendix) |
| Teleoperation | Meta Quest 3 ($499) in colour pass-through; tactile deformation field or force arrows drawn at the end-effector in AR; ROS2 synchronises sensors and robot |
| Effect on data | 10 users × 10 trials × 2 modes: peeled length 0.72 → 0.91, share of stable-force time 0.58 → 0.87 with feedback |
| Rates | images and slow policy 12 Hz; touch, wrench and fast policy 24 Hz; robot commands interpolated above 500 Hz |
| Robot | two Flexiv Rizon 4 arms with joint torque sensors, Flexiv Grav grippers, RealSense D435 wrist cameras (plus D415 for bimanual) |
| Compute | one RTX 4090 for collection, training and evaluation |

## 6. Can I use this on my robot?

**Short answer.** Yes, it is one of the most usable papers in this list. The best variant takes exactly what a UR10e gives, a 6-D wrist wrench, and code, data and checkpoints are public. You still need your own demonstrations with force feedback, and it is one policy per task. "Not stated" means I did not find it in the paper or project page.

| Need | What the authors used | If yours differs |
|---|---|---|
| Arm | Flexiv Rizon 4, commands streamed above 500 Hz | UR10e with RTDE servo at 500 Hz is the same pattern; relative EE actions transfer |
| Force | TCP wrench estimated from joint torques, 120 Hz → 24 Hz | The UR10e's wrist F/T is the same 6 numbers, probably less noisy |
| Tactile (optional) | GelSight Mini or MCTac on the fingertips | Skip it: the wrench variant scored higher |
| Gripper | Flexiv Grav force-controlled gripper | The tasks grasp a tool, then hold it; any gripper that holds the tool firmly should work. Not tested by the authors |
| Teleoperation | TactAR on Quest 3, [open source](https://github.com/xiaoxiaoxh/TactAR_APP) | Without force feedback, expect worse data (over 30% drop in their test) |
| Demonstrations | 50–80 per task | Plan for that per skill |
| Code license | Not stated in the paper | Check the repository |

## 7. Caveats

- Ten trials per condition. A score of 0.88 vs 0.80 is within noise; the gaps that matter are 0.95 vs 0.44 and 0.70 vs 0.00.
- Baselines are only Diffusion Policy variants; no comparison with other reactive methods.
- The fast policy reacts only to touch and force; images are still read at the slow rate.
- Single-task policies. The authors suggest replacing a VLA's action tokenizer with an asymmetric one as future work; their follow-up [ImplicitRDP](https://implicit-rdp.github.io) (RA-L 2026) continues the line.

**Carry forward:** RDP answers "how do I keep chunking and still react to force?". [FARM](farm.html) instead puts force into the action itself, and [TDC](tdc.html) leaves the fast reaction to an admittance controller. [Action chunking](action-chunking.html) and [Diffusion Policy](diffusion-policy.html) are the foundations.

**Check question:** If the GelSight were replaced by a 100 Hz sensor and the decoder ran at 100 Hz, what would $t_{blind}^{RDP}$ be, and how many steps would latency matching drop with the same 100 ms slow policy?

<details markdown="1">
<summary>Answer</summary>

$1/100 = 10$ ms; $\lceil 0.1 \times 100 \rceil = 10$ steps.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Xue, Ren, Chen và cộng sự, [arXiv 2503.02881](https://arxiv.org/abs/2503.02881) · v1 4/3/2025, v3 23/4/2025 · **RSS 2025, Best Student Paper Finalist** · Shanghai Jiao Tong, Tsinghua IIIS, Shanghai Qi Zhi, Shanghai AI Lab · [trang dự án](https://reactive-diffusion-policy.github.io/) · đã công bố [code](https://github.com/xiaoxiaoxh/reactive_diffusion_policy), [dữ liệu](https://huggingface.co/datasets/WendiChen/reactive_diffusion_policy_dataset) và [mô hình](https://huggingface.co/WendiChen/reactive_diffusion_policy_model)

**VẤN ĐỀ** [Action chunking](action-chunking.html) giúp chính sách bắt chước mượt và xử lý tốt hành vi đa mode, nhưng trong lúc một chunk được thực thi thì robot chạy vòng hở: tiếp xúc thay đổi giữa chunk bị bỏ qua cho tới chunk sau.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Thêm xúc giác vào quan sát của [Diffusion Policy](diffusion-policy.html) không giúp gì (gọt vỏ 0,39–0,41 so với 0,44 khi không có xúc giác), vì xúc giác chỉ có tác dụng ở ranh giới chunk. Chunk ngắn hơn (8 → 2) làm tỉ lệ nắm thành công rơi từ 100% xuống 20%; temporal ensembling thì rất nhạy với hệ số của nó.

**Ý TƯỞNG** Tách chính sách làm hai. Một **Latent Diffusion Policy** chậm dự đoán chunk trong không gian tiềm ẩn nén ở 1–2 Hz. Bộ giải mã nhanh của **Asymmetric Tokenizer** biến latent đó thành hành động thật ở 24 Hz, và chỉ bộ giải mã nhìn thấy tín hiệu xúc giác hoặc wrench mới nhất. Demo được thu bằng **TactAR**, teleoperation AR trên Quest 3 hiển thị lực tiếp xúc thành mũi tên.

**KẾT QUẢ** Gọt vỏ 0,95 so với 0,44 của DP, lau 0,87 so với 0,57, nâng bằng hai tay 0,70 so với 0,00 (điểm, 10 lượt mỗi điều kiện). Biến thể tốt nhất dùng wrench ước lượng từ mô-men khớp của cánh tay, không phải cảm biến xúc giác quang học.
</div>

## 1. Vấn đề: chunk là một lời hứa robot không thể nuốt lời

[[flow]]
- Trước~DP | Ảnh + trạng thái > !Chunk 8 hành động~chạy vòng hở! > Robot | gọt vỏ khi bị đẩy sau tiếp xúc: 0,19
- Trước~DP + xúc giác | Ảnh + xúc giác + trạng thái > !Chunk 8 hành động~chỉ đọc xúc giác ở ranh giới! > Robot | 0,15
+ RDP | Ảnh + xúc giác + trạng thái > *Chunk tiềm ẩn chậm~1–2 Hz* > *Giải mã nhanh + xúc giác mới nhất~24 Hz* > Robot | 0,88
[[/flow]] Điểm là của tác vụ gọt vỏ khi bị đẩy sau tiếp xúc. RDP giữ chunk để lập kế hoạch nhưng cho xúc giác thay đổi từng hành động được thực thi.

Các kiểu thất bại của DP theo tác giả: "lực lớn" (cánh tay cứ ấn vào quả dưa chuột), "kẹt" (DP có xúc giác trở nên dè dặt rồi dừng), và "mất tiếp xúc" (sau một cú đẩy, phần còn lại của chunk chạy mù và để sót vỏ hay vết mực).

## 2. Kiến trúc

[[fig:reactive-diffusion-policy]] Tokenizer được huấn luyện trước; sau đó chính sách chậm học cách sinh ra latent của nó. Khi chạy, bộ giải mã chạy ở mỗi bước với xúc giác mới nhất.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Biểu diễn xúc giác | ảnh GelSight Mini hoặc MCTac | dòng dịch chuyển marker $F_t = [d_x, d_y]$, giảm bằng PCA còn 15 số | bền với ánh sáng và việc thay gel; các thành phần đầu đọc được như lực cắt, xoắn và lực pháp tuyến |
| Biểu diễn lực | wrench TCP ước lượng của robot, 120 Hz | wrench 6 chiều, lấy mẫu lại 24 Hz | dùng thẳng, không PCA |
| Bộ mã hóa AT $\mathcal{E}$ | chunk hành động $A$ (32 bước, 24 Hz) | latent $Z \in \mathbb{R}^{t \times d}$, giảm mẫu 4 lần, $d$ = 4 hoặc 8 | CNN 1D; **không nhận xúc giác** |
| Bộ giải mã AT $\mathcal{D}$ (chính sách nhanh) | $Z$ và chuỗi xúc giác | hành động $\hat A$ | GRU, dưới 1 ms mỗi lần gọi |
| Latent Diffusion Policy (chính sách chậm) | ảnh, xúc giác hoặc wrench, trạng thái (2 khung ở 12 Hz) | một chunk tiềm ẩn $Z$ | Diffusion Policy CNN với FiLM, 100 ms trên RTX 4090 |

Sự bất đối xứng chính là thiết kế. Vì bộ mã hóa không bao giờ thấy xúc giác, latent buộc phải mô tả chiến lược ("bám theo bề mặt, giữ tiếp xúc"), còn bộ giải mã phải dùng xúc giác trực tiếp để đặt dụng cụ chính xác. Bài gọi các hiệu chỉnh này là "dưới milimét".

Hàm mất mát (Eq. 2 và 3 trong bài):

$$\mathcal{L}_{AT} = \mathbb{E}\big[\lVert A - \mathcal{D}(Z, F^{reduced})\rVert_1 + \lambda_{KL}\,\mathcal{L}_{KL}\big],\qquad \mathcal{L}_{LDP} = \mathbb{E}\,\lVert \varepsilon^k - \varepsilon_\theta(O,\ Z^0 + \varepsilon^k,\ k)\rVert_2$$

$\lambda_{KL}$ được giữ rất nhỏ (1e-6) để không gian tiềm ẩn mượt nhưng tokenizer không biến thành mô hình sinh. Hai mẹo thực hành tác giả nhấn mạnh: hành động là quỹ đạo end-effector **tương đối**, và **khớp độ trễ** bỏ đi các hành động đầu của mỗi chunk mới vốn đã thuộc về quá khứ khi suy luận xong.

## 3. Tính tay: xúc giác đổi được hành động thường xuyên tới đâu?

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** So sánh một thay đổi tiếp xúc có thể bị bỏ qua bao lâu ở DP và ở RDP, và khớp độ trễ vứt bỏ bao nhiêu bước.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n_{DP}$, $f_{DP}$ | số bước DP thực thi mỗi lần gọi, và tần số | hằng số | 8 bước, 12 Hz |
| $f_{fast}$ | tần số bộ giải mã nhanh (GelSight chạy 25 FPS) | hằng số | 24 Hz |
| $t_{slow}$ | thời gian suy luận của chính sách chậm, RTX 4090 | đo được | 100 ms |
| $t_{blind}$ | thời gian dài nhất xúc giác không đổi được hành động | output | – |
| $n_{drop}$ | số bước bị bỏ khi khớp độ trễ | output | – |

**Công thức**

$$t_{blind}^{DP} = \frac{n_{DP}}{f_{DP}},\qquad t_{blind}^{RDP} = \frac{1}{f_{fast}},\qquad n_{drop} = \left\lceil t_{slow}\, f_{fast} \right\rceil$$

**Từng bước**

1. DP: $8 / 12 = 0{,}67$ s mỗi chunk, trong lúc đó không đọc xúc giác.
2. RDP: $1 / 24 = 0{,}042$ s, bộ giải mã đọc lại xúc giác ở mỗi bước.
3. Tỉ lệ: $0{,}67 / 0{,}042 = 16$.
4. Độ trễ: $0{,}1 \times 24 = 2{,}4$, nên khoảng 3 bước đầu của mỗi chunk mới đã cũ khi nó tới (phép tính của mình; bài chỉ nói bỏ "vài bước hành động đầu").

**Kết quả.** DP có thể mù 0,67 s; RDP chỉ 42 ms, ngắn hơn 16 lần.

**Ý nghĩa.** Với chuyển động tương đối 1 cm/s (ví dụ minh họa của mình, không phải số của bài), 0,67 s là 6,7 mm sai lệch không được sửa, lớn hơn độ sâu cắt của dao gọt; 42 ms là 0,4 mm.
</div>

## 4. Kết quả

[[bars:]] DP=0.44; DP + ảnh xúc giác=0.41; DP + embedding xúc giác=0.39; RDP (GelSight)=0.90; RDP (MCTac)=0.88; *RDP (wrench)=0.95* || Gọt vỏ, điểm tổng (tỉ lệ vỏ được gọt, chuẩn hóa theo demo), 30 lượt mỗi phương pháp.

| Điểm gọt vỏ | Không đẩy | Đẩy trước tiếp xúc | Đẩy sau tiếp xúc | Tổng |
|---|---|---|---|---|
| DP | 0,56 | 0,58 | 0,19 | 0,44 |
| DP + embedding xúc giác | 0,48 | 0,55 | 0,15 | 0,39 |
| RDP (GelSight) | 0,98 | 0,93 | 0,80 | 0,90 |
| RDP (wrench) | 0,99 | 0,98 | 0,88 | 0,95 |

| Điểm lau | Không đẩy | Đẩy trước tiếp xúc | Đẩy sau tiếp xúc | Tổng |
|---|---|---|---|---|
| DP | 0,75 | 0,70 | 0,25 | 0,57 |
| DP + embedding xúc giác | 0,60 | 0,75 | 0,15 | 0,50 |
| RDP (GelSight) | 0,85 | 0,95 | 0,50 | 0,77 |
| RDP (wrench) | 0,95 | 0,85 | 0,80 | 0,87 |

| Nâng cốc giấy bằng hai tay | Điểm cốc mềm | Điểm cốc cứng | Tổng |
|---|---|---|---|
| DP | 0,00 | 0,00 | 0,00 |
| DP + embedding xúc giác | 0,10 | 0,05 | 0,08 |
| RDP (GelSight + MCTac) | 0,55 | 0,40 | 0,48 |
| RDP (wrench) | 0,80 | 0,60 | 0,70 |

- **Đổi kích thước chunk không phải lời giải.** Ở tác vụ lau bị đẩy sau tiếp xúc, DP + xúc giác đạt 0,15 với chunk 8 và 0,10 với chunk 2 (tỉ lệ nắm thành công rơi còn 20%). Temporal ensembling cho 0,05; 0,00 và 0,15 với $\tau$ = 0,2; 0,5; 0,8. RDP với chunk 8 đạt 0,50.
- **Loại cảm biến không quan trọng lắm.** GelSight Mini (549 USD) và MCTac của tác giả (khoảng 50 USD) cho 0,90 và 0,88 ở gọt vỏ.
- **Wrench thắng xúc giác quang học** ở cả ba tác vụ, dù nó được ước lượng từ mô-men khớp và nhiễu khi chuyển động nhanh. Tác giả cho rằng do độ trễ thấp hơn và ít chiều hơn.
- **Phản hồi khi teleoperation quan trọng.** Huấn luyện trên 60 demo thu mà không có phản hồi lực AR làm điểm giảm hơn 30%.

## 5. Dữ liệu và TactAR

| Mục | Giá trị |
|---|---|
| Demo | 60 gọt vỏ, 80 lau, 50 nâng bằng hai tay (phụ lục) |
| Teleoperation | Meta Quest 3 (499 USD) ở chế độ pass-through màu; trường biến dạng xúc giác hoặc mũi tên lực vẽ tại end-effector trong AR; ROS2 đồng bộ cảm biến và robot |
| Tác động lên dữ liệu | 10 người × 10 lượt × 2 chế độ: chiều dài vỏ gọt được 0,72 → 0,91, tỉ lệ thời gian lực ổn định 0,58 → 0,87 khi có phản hồi |
| Tần số | ảnh và chính sách chậm 12 Hz; xúc giác, wrench và chính sách nhanh 24 Hz; lệnh robot được nội suy trên 500 Hz |
| Robot | hai tay Flexiv Rizon 4 có cảm biến mô-men khớp, tay kẹp Flexiv Grav, camera cổ tay RealSense D435 (thêm D415 cho bài hai tay) |
| Tính toán | một RTX 4090 cho thu thập, huấn luyện và đánh giá |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Có, đây là một trong những paper dễ dùng nhất trong danh sách. Biến thể tốt nhất nhận đúng thứ UR10e cung cấp, một wrench 6 chiều ở cổ tay, và code, dữ liệu, checkpoint đều công khai. Bạn vẫn cần demo của riêng mình có phản hồi lực, và mỗi tác vụ là một chính sách. "Không nêu" nghĩa là mình không tìm thấy trong paper hay trang dự án.

| Cần | Các tác giả dùng | Nếu bạn khác |
|---|---|---|
| Cánh tay | Flexiv Rizon 4, lệnh được stream trên 500 Hz | UR10e với RTDE servo 500 Hz là cùng kiểu; hành động EE tương đối chuyển sang được |
| Lực | Wrench TCP ước lượng từ mô-men khớp, 120 Hz → 24 Hz | F/T cổ tay của UR10e cho đúng 6 số đó, có lẽ ít nhiễu hơn |
| Xúc giác (tùy chọn) | GelSight Mini hoặc MCTac ở đầu ngón | Bỏ qua được: biến thể wrench đạt điểm cao hơn |
| Tay kẹp | Tay kẹp điều khiển lực Flexiv Grav | Các tác vụ nắm một dụng cụ rồi giữ nó; tay kẹp nào giữ chắc dụng cụ chắc là được. Tác giả không thử |
| Teleoperation | TactAR trên Quest 3, [mã nguồn mở](https://github.com/xiaoxiaoxh/TactAR_APP) | Không có phản hồi lực thì dữ liệu kém hơn (giảm hơn 30% trong thử nghiệm của họ) |
| Demo | 50–80 mỗi tác vụ | Lên kế hoạch cỡ đó cho mỗi kỹ năng |
| Giấy phép code | Không nêu trong paper | Kiểm tra repository |

## 7. Lưu ý

- Mười lượt mỗi điều kiện. 0,88 so với 0,80 là nằm trong nhiễu; các khoảng cách đáng kể là 0,95 so với 0,44 và 0,70 so với 0,00.
- Baseline chỉ là các biến thể Diffusion Policy; không so với phương pháp phản ứng nhanh nào khác.
- Chính sách nhanh chỉ phản ứng với xúc giác và lực; ảnh vẫn được đọc ở tần số chậm.
- Chính sách đơn tác vụ. Tác giả đề xuất thay tokenizer hành động của một VLA bằng tokenizer bất đối xứng làm hướng tương lai; bài tiếp theo [ImplicitRDP](https://implicit-rdp.github.io) (RA-L 2026) đi tiếp hướng này.

**Mang sang bài sau:** RDP trả lời câu "làm sao giữ chunking mà vẫn phản ứng với lực?". [FARM](farm.html) thì đưa lực vào chính hành động, còn [TDC](tdc.html) giao phản ứng nhanh cho một bộ điều khiển admittance. [Action chunking](action-chunking.html) và [Diffusion Policy](diffusion-policy.html) là nền tảng.

**Câu kiểm tra:** Nếu thay GelSight bằng cảm biến 100 Hz và bộ giải mã chạy ở 100 Hz, $t_{blind}^{RDP}$ là bao nhiêu, và khớp độ trễ bỏ bao nhiêu bước với cùng chính sách chậm 100 ms?

<details markdown="1">
<summary>Đáp án</summary>

$1/100 = 10$ ms; $\lceil 0{,}1 \times 100 \rceil = 10$ bước.
</details>
:::
