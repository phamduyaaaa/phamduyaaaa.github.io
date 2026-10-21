---
slug: gr00t-n1
date: 2026-10-21
title_en: "GR00T N1: A Dual-System VLA Trained on a Data Pyramid"
title_vi: "GR00T N1: VLA hai hệ thống học trên kim tự tháp dữ liệu"
excerpt_en: "NVIDIA's GR00T N1 pairs a 10 Hz vision-language model (System 2) with a 120 Hz flow-matching diffusion transformer (System 1) and per-robot adapters. It fills the gap in robot data with human videos and generated videos labelled by latent actions. On a real GR-1 humanoid, it reaches 76.8% vs 46.4% for Diffusion Policy, and 42.6% with only 10% of the data."
excerpt_vi: "GR00T N1 của NVIDIA ghép một mô hình thị giác-ngôn ngữ 10 Hz (Hệ 2) với một diffusion transformer flow matching 120 Hz (Hệ 1) và adapter riêng cho từng robot. Nó bù thiếu hụt dữ liệu robot bằng video người và video sinh ra, gắn nhãn bằng latent action. Trên người máy GR-1 thật, nó đạt 76,8% so với 46,4% của Diffusion Policy, và 42,6% khi chỉ có 10% dữ liệu."
tags: [VLA, Paper Notes, GR00T, Humanoid]
---

:::en
<div class="tldr" markdown="1">
**PAPER** NVIDIA, *GR00T N1: An Open Foundation Model for Generalist Humanoid Robots*, [arXiv 2503.14734](https://arxiv.org/abs/2503.14734) · 03/2025

**PROBLEM** A foundation model for humanoids and other robots, where each body has different sensors, degrees of freedom and control modes, and real teleoperation data is scarce.

**WHAT FAILED BEFORE** The paper calls the robot data landscape "an archipelago of data islands": each robot's data has its own embodiment, so there is no Internet-scale robot dataset. Human videos and generated videos are plentiful but have no action labels, so standard VLA training cannot use them.

**IDEA** A dual-system model: System 2, a pre-trained VLM (Eagle-2, 1.34B) running at 10 Hz; System 1, a diffusion transformer trained with flow matching that cross-attends to the VLM's features and outputs 16-step action chunks at 120 Hz. Per-embodiment MLP encoders and decoders handle different state and action sizes. Train on a "data pyramid": web data and human videos at the base, simulation and generated ("neural") trajectories in the middle, real robot data on top. Action-less data gets labels from a latent-action VQ-VAE or an inverse dynamics model.

**RESULT** 2.2B parameters, ~50,000 H100 hours of pre-training, weights released. In simulation with 100 demos per task: 45.0% average vs 33.4% for Diffusion Policy. On a real GR-1 humanoid: 76.8% vs 46.4%, and 42.6% with 10% of the data (DP: 10.2%).
</div>

## 1. The problem: every robot is a data island

[[flow]]
- Before~Per-robot data | Teleop on one body > !Data islands~no actions for videos! > Small policy | little data per body, no use for human video
+ GR00T N1 | Web + human video + sim + generated + real > *Latent actions / IDM labels~per-body adapters* > One model | pre-train on the pyramid, post-train per robot
[[/flow]] The change is to make action-less and other-body data usable: give it pseudo-actions, and keep body-specific parts in small adapters.

## 2. Architecture

[[fig:gr00t-n1]] The VLM runs slowly and is read through cross-attention; the DiT denoises state + action tokens fast; small MLPs adapt the model to each body.

| Part | GR00T-N1-2B |
|---|---|
| System 2 (VLM) | Eagle-2: SigLIP-2 image encoder + SmolLM2; 224×224 images, pixel shuffle → 64 tokens per frame; 1.34B; features from the 12th LLM layer (faster and better than the last layer) |
| System 1 (DiT) | flow matching; self-attention over state + noisy actions, cross-attention to VLM tokens; $H = 16$; $K = 4$ Euler steps |
| Adapters | one MLP state encoder, action encoder and action decoder per embodiment |
| Timing | VLM 10 Hz on an L40; actions at 120 Hz; 63.9 ms to sample a 16-action chunk (bf16, L40) |
| Total | 2.2B parameters |
| Pre-training | up to 1,024 GPUs per model; ~50,000 H100 hours |
| Fine-tuning | one A6000 enough when tuning adapters + DiT (batch up to 200) |

Compared with [π0](pi0.html): both use a VLM plus a flow-matching action module. π0's expert shares attention layers with the VLM; GR00T's DiT is a separate network reading the VLM through cross-attention (see [cross-attention](cross-attention.html)), so the two can run at different rates.

<div class="calc" markdown="1">

Calculation card

**What and why.** Can System 1 keep up with 120 Hz control? Compare how long a chunk lasts on the robot with how long it takes to compute.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $H$ | actions per chunk | input | 16 |
| $f$ | control rate | input | 120 Hz |
| $t_{inf}$ | time to sample one chunk | input | 63.9 ms (paper, L40) |
| $T_{chunk}$ | time the chunk covers | output | – |
| $u$ | share of that time spent computing | output | – |

**Formula**

$$T_{chunk} = \frac{H}{f}, \qquad u = \frac{t_{inf}}{T_{chunk}}$$

**Steps**

1. $T_{chunk} = 16 / 120 = 0.1333$ s $= 133.3$ ms.
2. $u = 63.9 / 133.3 = 0.48$.
3. With $K = 4$ Euler steps, each denoising step costs at most $63.9 / 4 \approx 16$ ms (the VLM pass is included in the 63.9 ms, so the real per-step cost is lower).

**Result.** One chunk covers 133 ms and takes 64 ms to compute: the GPU is busy about half the time.

**Why it matters.** The next chunk can be computed while the current one is running, so the robot never waits. With $K = 10$ steps, as in π0, the same arithmetic would leave much less margin; few-step flow matching is what makes 120 Hz feasible.
</div>

## 3. The data pyramid

| Layer | Source | How actions are obtained |
|---|---|---|
| Base | web data (in VLM pre-training), open human egocentric videos | latent actions from a VQ-VAE trained on frame pairs |
| Middle | simulation trajectories; "neural trajectories" from fine-tuned video generation models | simulation: real actions; generated videos: latent actions or an inverse dynamics model (IDM) |
| Top | real teleoperation on the target robots | real actions |

Neural trajectories multiplied the in-house teleoperation data about 10×, from 88 hours to 827 hours, with counterfactual scenes and new instructions.

## 4. Results

[[bars:%]] DP 10% data=10.2; *GR00T 10% data=42.6*; DP full=46.4; *GR00T full=76.8* || Real GR-1 humanoid, average over four task groups (Table 3).

| Simulation, 100 demos per task (Table 2) | RoboCasa | DexMG | GR-1 | Average |
|---|---|---|---|---|
| BC Transformer | 26.3% | 53.9% | 16.1% | 26.4% |
| Diffusion Policy | 25.6% | 56.1% | 32.7% | 33.4% |
| GR00T-N1-2B | 32.1% | 66.5% | 50.0% | 45.0% |

Real-world task groups: pick-and-place, articulated objects, industrial, bimanual coordination; 10 trials per task. With 10% of the data GR00T is only 3.8 points below Diffusion Policy trained on all of it.

## 5. Caveats

- Checked against the full text: architecture sizes and rates, $H$, $K$, the 12th-layer choice, compute, data pyramid, Tables 2 and 3.
- The paper notes that the benefit of pre-training shrinks when the fine-tuning dataset is large.
- GR00T is the backbone of [FIRe](fire.html) on this site (a residual policy on top of a frozen GR00T).

**Carry forward:** [SmolVLA](smolvla.html) uses the same "read a middle layer of a small VLM" idea at 0.45B; [LingBot-VLA 2.0](lingbotv2.html) also pre-trains on human egocentric video.

**Check question:** a policy outputs chunks of $H = 8$ actions at 60 Hz and needs 90 ms per chunk. Can it keep up without waiting?

<details markdown="1">
<summary>Answer</summary>

$T_{chunk} = 8/60 = 133$ ms; $u = 90/133 = 0.68$. Yes, if the next chunk is computed while the current one runs; the margin is smaller than GR00T's.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** NVIDIA, *GR00T N1: An Open Foundation Model for Generalist Humanoid Robots*, [arXiv 2503.14734](https://arxiv.org/abs/2503.14734) · 03/2025

**VẤN ĐỀ** Một mô hình nền cho người máy và các robot khác, trong đó mỗi thân robot có cảm biến, số bậc tự do và chế độ điều khiển khác nhau, còn dữ liệu điều khiển từ xa thật thì khan hiếm.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Paper gọi bức tranh dữ liệu robot là "một quần đảo các hòn đảo dữ liệu": dữ liệu của mỗi robot gắn với thân riêng của nó, nên không có bộ dữ liệu robot cỡ Internet. Video người và video sinh ra thì nhiều nhưng không có nhãn hành động, nên cách học VLA thông thường không dùng được.

**Ý TƯỞNG** Mô hình hai hệ: Hệ 2 là một VLM đã tiền huấn luyện (Eagle-2, 1,34B) chạy 10 Hz; Hệ 1 là một diffusion transformer học bằng flow matching, cross-attention tới đặc trưng của VLM và xuất chunk 16 bước ở 120 Hz. Bộ mã hóa và giải mã MLP riêng cho từng thân robot xử lý kích thước trạng thái và hành động khác nhau. Học trên một "kim tự tháp dữ liệu": dữ liệu web và video người ở đáy, quỹ đạo mô phỏng và quỹ đạo sinh ra ("neural") ở giữa, dữ liệu robot thật ở đỉnh. Dữ liệu không có hành động được gắn nhãn bằng VQ-VAE latent action hoặc mô hình động lực học ngược.

**KẾT QUẢ** 2,2B tham số, khoảng 50.000 giờ H100 cho tiền huấn luyện, trọng số được công bố. Trong mô phỏng với 100 demo mỗi tác vụ: trung bình 45,0% so với 33,4% của Diffusion Policy. Trên người máy GR-1 thật: 76,8% so với 46,4%, và 42,6% khi chỉ dùng 10% dữ liệu (DP: 10,2%).
</div>

## 1. Vấn đề: mỗi robot là một hòn đảo dữ liệu

[[flow]]
- Trước~Dữ liệu riêng từng robot | Điều khiển từ xa trên một thân > !Đảo dữ liệu~video không có hành động! > Policy nhỏ | ít dữ liệu mỗi thân, không dùng được video người
+ GR00T N1 | Web + video người + mô phỏng + video sinh + thật > *Nhãn latent action / IDM~adapter riêng mỗi thân* > Một mô hình | tiền huấn luyện trên kim tự tháp, hậu huấn luyện từng robot
[[/flow]] Thay đổi là làm cho dữ liệu không có hành động và dữ liệu thân khác dùng được: gán hành động giả cho nó, và giữ phần riêng của mỗi thân trong các adapter nhỏ.

## 2. Kiến trúc

[[fig:gr00t-n1]] VLM chạy chậm và được đọc qua cross-attention; DiT khử nhiễu token trạng thái + hành động thật nhanh; các MLP nhỏ thích nghi mô hình cho từng thân.

| Phần | GR00T-N1-2B |
|---|---|
| Hệ 2 (VLM) | Eagle-2: bộ mã hóa ảnh SigLIP-2 + SmolLM2; ảnh 224×224, pixel shuffle → 64 token mỗi khung; 1,34B; đặc trưng lấy từ lớp LLM thứ 12 (nhanh hơn và tốt hơn lớp cuối) |
| Hệ 1 (DiT) | flow matching; self-attention trên trạng thái + hành động nhiễu, cross-attention tới token VLM; $H = 16$; $K = 4$ bước Euler |
| Adapter | mỗi thân một MLP mã hóa trạng thái, mã hóa hành động và giải mã hành động |
| Thời gian | VLM 10 Hz trên L40; hành động 120 Hz; 63,9 ms để lấy mẫu một chunk 16 hành động (bf16, L40) |
| Tổng | 2,2B tham số |
| Tiền huấn luyện | tới 1.024 GPU cho một mô hình; ~50.000 giờ H100 |
| Fine-tune | một A6000 là đủ khi chỉnh adapter + DiT (batch tới 200) |

So với [π0](pi0.html): cả hai dùng VLM cộng một mô-đun hành động flow matching. Expert của π0 dùng chung các lớp attention với VLM; DiT của GR00T là một mạng riêng đọc VLM qua cross-attention (xem [cross-attention](cross-attention.html)), nên hai phần chạy được ở tần số khác nhau.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Hệ 1 có theo kịp điều khiển 120 Hz không? So thời gian một chunk kéo dài trên robot với thời gian để tính nó.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $H$ | số hành động mỗi chunk | đầu vào | 16 |
| $f$ | tần số điều khiển | đầu vào | 120 Hz |
| $t_{inf}$ | thời gian lấy mẫu một chunk | đầu vào | 63,9 ms (paper, L40) |
| $T_{chunk}$ | thời gian chunk bao phủ | đầu ra | – |
| $u$ | tỉ lệ thời gian dành để tính | đầu ra | – |

**Công thức**

$$T_{chunk} = \frac{H}{f}, \qquad u = \frac{t_{inf}}{T_{chunk}}$$

**Các bước**

1. $T_{chunk} = 16 / 120 = 0{,}1333$ s $= 133{,}3$ ms.
2. $u = 63{,}9 / 133{,}3 = 0{,}48$.
3. Với $K = 4$ bước Euler, mỗi bước khử nhiễu tốn tối đa $63{,}9 / 4 \approx 16$ ms (lượt qua VLM đã nằm trong 63,9 ms, nên chi phí thật mỗi bước thấp hơn).

**Kết quả.** Một chunk bao phủ 133 ms và tốn 64 ms để tính: GPU bận khoảng một nửa thời gian.

**Vì sao quan trọng.** Chunk kế tiếp được tính trong lúc chunk hiện tại đang chạy, nên robot không phải chờ. Với $K = 10$ bước như π0, cùng phép tính đó sẽ để lại ít dư địa hơn nhiều; flow matching ít bước là thứ làm 120 Hz khả thi.
</div>

## 3. Kim tự tháp dữ liệu

| Tầng | Nguồn | Lấy hành động thế nào |
|---|---|---|
| Đáy | dữ liệu web (trong tiền huấn luyện VLM), video người góc nhìn thứ nhất mở | latent action từ một VQ-VAE học trên cặp khung hình |
| Giữa | quỹ đạo mô phỏng; "quỹ đạo neural" từ mô hình sinh video đã fine-tune | mô phỏng: hành động thật; video sinh: latent action hoặc mô hình động lực học ngược (IDM) |
| Đỉnh | điều khiển từ xa thật trên robot đích | hành động thật |

Quỹ đạo neural nhân dữ liệu điều khiển từ xa nội bộ lên khoảng 10 lần, từ 88 giờ lên 827 giờ, với cảnh giả định và câu lệnh mới.

## 4. Kết quả

[[bars:%]] DP 10% dữ liệu=10.2; *GR00T 10% dữ liệu=42.6*; DP đầy đủ=46.4; *GR00T đầy đủ=76.8* || Người máy GR-1 thật, trung bình trên bốn nhóm tác vụ (Bảng 3).

| Mô phỏng, 100 demo mỗi tác vụ (Bảng 2) | RoboCasa | DexMG | GR-1 | Trung bình |
|---|---|---|---|---|
| BC Transformer | 26,3% | 53,9% | 16,1% | 26,4% |
| Diffusion Policy | 25,6% | 56,1% | 32,7% | 33,4% |
| GR00T-N1-2B | 32,1% | 66,5% | 50,0% | 45,0% |

Nhóm tác vụ thật: gắp-đặt, vật có khớp, công nghiệp, phối hợp hai tay; 10 lượt mỗi tác vụ. Với 10% dữ liệu, GR00T chỉ kém Diffusion Policy học trên toàn bộ dữ liệu 3,8 điểm.

## 5. Lưu ý

- Đã đối chiếu với toàn văn: kích thước và tần số các phần, $H$, $K$, lựa chọn lớp thứ 12, tài nguyên tính toán, kim tự tháp dữ liệu, Bảng 2 và 3.
- Paper lưu ý lợi ích của tiền huấn luyện giảm dần khi bộ dữ liệu fine-tune lớn.
- GR00T là backbone của [FIRe](fire.html) trên trang này (một policy residual trên GR00T đóng băng).

**Mang theo:** [SmolVLA](smolvla.html) dùng cùng ý "đọc lớp giữa của một VLM nhỏ" ở cỡ 0,45B; [LingBot-VLA 2.0](lingbotv2.html) cũng tiền huấn luyện trên video người góc nhìn thứ nhất.

**Câu hỏi kiểm tra:** một policy xuất chunk $H = 8$ hành động ở 60 Hz và cần 90 ms mỗi chunk. Nó có theo kịp mà không phải chờ không?

<details markdown="1">
<summary>Đáp án</summary>

$T_{chunk} = 8/60 = 133$ ms; $u = 90/133 = 0{,}68$. Có, nếu chunk kế được tính trong lúc chunk hiện tại đang chạy; dư địa nhỏ hơn GR00T.
</details>
:::
