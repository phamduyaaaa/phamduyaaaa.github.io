---
slug: taf-vla
date: 2026-10-18
title_en: "TaF-VLA: Aligning Tactile Images with Force Before the VLA"
title_vi: "TaF-VLA: Căn chỉnh ảnh xúc giác với lực trước khi vào VLA"
excerpt_en: "Earlier visuo-tactile policies such as FreeTacMan read a gel image as texture. TaF-VLA first aligns tactile images with real force over 10 million paired frames, then plugs the frozen adapter into π0.5: 64.8% vs 42.8%."
excerpt_vi: "Các chính sách thị giác-xúc giác trước, như FreeTacMan, đọc ảnh gel như một kết cấu bề mặt. TaF-VLA trước hết căn ảnh xúc giác với lực thật trên 10 triệu cặp khung, rồi gắn adapter đóng băng vào π0.5: 64,8% so với 42,8%."
tags: [VLA, Force, Tactile, Paper Notes, π0.5]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) · 01/2026 · built on π0.5

**PROBLEM** A vision-based tactile sensor shows how the gel *deforms*, not how hard it is pressed. VLAs built on it remain "force-blind".

**WHAT FAILED BEFORE** Methods such as FreeTacMan treat tactile images "as auxiliary visual textures" (the paper's words), missing the link between deformation and force. FreeTacMan scores 42.8%.

**IDEA** Pretrain a TaF-Adapter that pulls each tactile-image sequence towards the matching real force (6-axis F/T + 12×12 pressure map) by contrastive learning, then feed its tokens, frozen, to π0.5's action expert.

**RESULT** 64.8% average success vs 37.1% for vision-only π0.5 and 42.8% for FreeTacMan.
</div>

## 1. The problem: tactile read as texture

[[flow]]
- Before~FreeTacMan | Tactile image > !Image encoder~learns texture! > Policy | knows how the gel looks, not how hard it is pressed: 42.8%
+ TaF-VLA | Tactile image > *TaF-Adapter~aligned to F/T + pressure* > π0.5 action expert | tokens carry force meaning: 64.8%
[[/flow]] The change is in what the tactile encoder is trained to agree with: real force instead of nothing.

## 2. Architecture

[[fig:taf-vla]] Stage (a) aligns a tactile encoder with quantised force codes by InfoNCE; stage (b) plugs the frozen adapter into the π0.5 action expert.

| Block | Input | Output | Role |
|---|---|---|---|
| Force encoder | window of 5: pressure map $F'$ (12×12), wrench $F''$ (6) | codes $c^*$ (two VQ codebooks) | stable "physical anchors" |
| Tactile encoder | window of 5 tactile images | $z^*$ (ViT + causal Transformer) | what the adapter outputs later |
| InfoNCE | pairs $(z^*, c^*)$ | loss | pull matching pairs together |
| π0.5 action expert | VLM features $\phi_t$, $z^{tac}_t$, proprio $q_t$ | action chunk | policy, Euler step 0.1 |

## 3. Work it by hand: one InfoNCE term

<div class="calc" markdown="1">
Calculation card

**What and why.** InfoNCE is the loss that teaches the tactile encoder to agree with real force. Computing it shows when it is small (well aligned) and when it is large.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $z^*_1$ | tactile embedding of sample 1 | input | – |
| $s_+$ | cosine similarity of $z^*_1$ with its own force code $c^*_1$ | input | 0.9 |
| $s_-$ | similarity with the other force code $c^*_2$ | input | 0.2 |
| $\tau$ | temperature | constant | 0.1 (illustrative; not given in the paper) |
| $L_1$ | loss for sample 1 | output | – |

**Formula** (batch of two pairs)

$$L_1 = -\log \frac{e^{s_+/\tau}}{e^{s_+/\tau} + e^{s_-/\tau}} = \log\left(1 + e^{(s_- - s_+)/\tau}\right)$$

**Steps**

1. $(s_- - s_+)/\tau = (0.2 - 0.9)/0.1 = -7$.
2. $e^{-7} \approx 0.00091$.
3. $L_1 = \log(1.00091) \approx 0.0009$.

Badly aligned case, $s_+ = 0.5$, $s_- = 0.4$: $(0.4 - 0.5)/0.1 = -1$, $L_1 = \log(1 + e^{-1}) = \log 1.368 \approx 0.313$.

**Result.** 0.0009 when the tactile embedding is clearly closer to its own force; 0.313 when it barely is.

**Why it matters.** The loss only goes to zero when each tactile sequence points to *its own* force reading, so the adapter's output becomes a force-like signal.
</div>

## 4. Results

[[bars:%]] ACT=26.7; Diffusion Policy=29.5; π0.5 (vision only)=37.1; FreeTacMan=42.8; *TaF-VLA=64.8* || Average success, 15 rollouts per task.

- The adapter helps other backbones too: ACT 26.7% → 47.6%, Diffusion Policy 29.5% → 44.7%.
- Ablation (whiteboard): full 60.0%, no history 26.7%, one shared codebook 13.3%.

## 5. Data

| Item | Value |
|---|---|
| TaF-Dataset | > 10 million synchronised tactile, 6-axis F/T and 12×12 pressure frames |
| Rig | automated press-and-perturb device, > 60 indenters, 30 Hz |
| Policy data | > 10,000 force-aware episodes, > 20 scenarios |

## 6. Can I use this on my robot?

**Short answer.** You can reuse the idea with a modest setup, but not the result. The 64.8% came from a gel touch sensor on the robot, a pretrained adapter that needs a custom rig and about 10 million frames to reproduce, and a fine-tuned π0.5. "Stated" means the paper says it; "not stated" means I looked in the full text and it is not there, so I do not guess.

**Hardware at run time**

| Need | What the paper used | If yours differs | Source |
|---|---|---|---|
| Touch sensor | Gel-type camera sensors, 30 Hz: 4 custom-built (marker-free, 4×4, 7×7, 9×9 markers) and 2 GelSight Mini. All gels have the same hardness | Different gel hardness is untested. Capacitive, magnetic or piezoresistive sensors: "inconclusive" in the paper | Stated |
| Force sensor on the robot | **None needed.** The paper's own words: it removes the need for a costly F/T sensor at deployment | The F/T sensor and pressure array are only used to build the adapter, not to run it | Stated |
| Cameras | One third-person camera, one wrist camera, plus language | Fewer views is untested | Stated |
| Arm and gripper | Demonstrations were collected on a Franka Research 3 with a joint-space exoskeleton (master-puppet) | Other arms are untested. The gripper model and how the sensor is mounted on it are not given | Partly stated |
| Proprioception | Joint state $q_t$ goes into the action expert | Any arm that reports joint state | Stated |
| Computer | One workstation with an NVIDIA RTX 4090 ran inference for all models | See the next table for training | Stated |

**Data and training**

| Need | Paper | What it means for you | Source |
|---|---|---|---|
| Pretrained TaF-Adapter | Trained on the TaF-Dataset: more than 10 million tactile, force and pressure frames from 6 sensors | Paper text does not say whether the adapter weights or the dataset are public, and the project page linked in the paper returned a GitHub 404 when I opened it (2026-10-19). **Check before planning around it** | Not stated |
| Rebuilding the adapter data | Custom rig: 5 Dynamixel XM540 servos, ATI Axia80 6-axis F/T sensor, 12×12 piezoresistive pressure array, a 3D-printed frame (25×20×45 cm, assembled in under 4 hours), 60+ indenters (40 rigid, 20 soft). Over 100K frames per hour | My arithmetic: 10,000,000 frames ÷ 100,000 frames per hour ≈ 100 hours of continuous running, if the rate holds. Plus building and swapping indenters by hand | Stated, arithmetic mine |
| Policy demonstrations | More than 10,000 force-aware episodes over 20+ scenarios, each with a language instruction describing force ("gently", "use minimal force") written by an LLM from a fixed template | You need your own demonstrations for your own task. The paper gives no per-task count for the main results, only subsets of 100, 150 and 200 for three tasks | Partly stated |
| How many demonstrations | At 100 demonstrations TaF-VLA matched or beat π0.5 trained on 200 (three tasks) | If your tasks are like those, expect about half the data of a vision-only baseline. Not a promise for other tasks | Stated |
| Fine-tuning recipe | π0.5 with the adapter frozen, fine-tuned on the demonstrations | Learning rate, steps, whether the VLM is trained in full or with LoRA, and training time are **not stated**. The text also mentions task-specific tuning of the encoder, so "frozen" may not be strict | Not stated |
| Training GPU | Not stated | Estimate, not from the paper: the openpi README lists more than 22.5 GB of GPU memory for LoRA fine-tuning and more than 70 GB for full fine-tuning of π0.5 (an 80 GB A100 or H100). The adapter adds a ViT and a small causal Transformer on top. Low confidence | Estimate |

**What the sensor and the task must allow**

- **Does the task need force at all?** The paper says it depends: for light objects such as chocolate, vision-only π0.5 did about as well. Gains were largest where force must be actively controlled (heavy part lifting, power bank extraction, where vision-only degraded a lot, and tweezer weights, where it failed completely).
- **Speed.** The policy outputs a chunk of actions and re-plans after it. The authors say this is too slow for fast force spikes, such as the moment a blade goes through jelly and meets the balloon.
- **Where it fails.** Most failures came *before* contact: the hand stopped millimetres short, so the touch loop never started.
- **A new sensor of the same family.** On sensors unseen in pretraining the adapter scored 60.3% and 53.3%, against 75.0% and 65.0% on seen ones. A new sensor loses some, but far less than the force-regression baseline (30.0% and 23.3%).

**Which route fits you**

[[flow]]
- A~Weights public + gel sensor like theirs | Download adapter > *Fine-tune π0.5 on your demos* > Deploy with touch only | least work: you still need demos and a GPU
- B~Weights not public, you have an F/T sensor and a gel sensor | Build the rig or your own pairing > Pretrain adapter > Fine-tune π0.5 | most work: about 100 h of collection at the paper's rate
- C~No gel sensor, or no time for the rig | Pick another post | VLA-Touch adds touch without retraining the VLA; FD-VLA and TA-VLA need no extra sensor; Survey 1 section 5 lists more
[[/flow]]

## 7. Caveats

- The task count (8 in text, 7 in Table I) and the number of baselines are inconsistent in the paper.
- The adapter is called frozen, yet the text also mentions task-specific fine-tuning.

**Carry forward:** TaF-VLA needed a custom rig and 10 million real frames. [Tabero](tabero.html) gets vision–touch–force data by replaying existing trajectories in a tactile simulator.

**Check question:** $\tau = 0.1$, $s_+ = 0.8$, $s_- = 0.6$. What is $L_1$?

<details markdown="1">
<summary>Answer</summary>

$(0.6 - 0.8)/0.1 = -2$; $L_1 = \log(1 + e^{-2}) = \log 1.135 \approx 0.127$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2601.20321](https://arxiv.org/abs/2601.20321) · 01/2026 · nền π0.5

**VẤN ĐỀ** Cảm biến xúc giác thị giác cho thấy gel *biến dạng* ra sao, không cho biết bị ấn mạnh đến đâu. VLA xây trên nó vẫn "mù lực".

**PAPER TRƯỚC HỎNG Ở ĐÂU** Các phương pháp như FreeTacMan coi ảnh xúc giác "như kết cấu thị giác phụ trợ" (lời bài báo), bỏ lỡ mối liên hệ giữa biến dạng và lực. FreeTacMan đạt 42,8%.

**Ý TƯỞNG** Pretrain một TaF-Adapter kéo mỗi chuỗi ảnh xúc giác về phía lực thật tương ứng (F/T 6 trục + bản đồ áp suất 12×12) bằng học tương phản, rồi đưa token của nó (đóng băng) vào action expert của π0.5.

**KẾT QUẢ** Thành công trung bình 64,8%, so với 37,1% của π0.5 chỉ dùng thị giác và 42,8% của FreeTacMan.
</div>

## 1. Vấn đề: xúc giác bị đọc như kết cấu bề mặt

[[flow]]
- Trước~FreeTacMan | Ảnh xúc giác > !Encoder ảnh~học kết cấu! > Chính sách | biết gel trông thế nào, không biết bị ấn mạnh đến đâu: 42,8%
+ TaF-VLA | Ảnh xúc giác > *TaF-Adapter~căn với F/T + áp suất* > Action expert π0.5 | token mang nghĩa lực: 64,8%
[[/flow]] Thay đổi nằm ở thứ mà bộ mã hóa xúc giác được dạy để khớp với: lực thật, thay vì không gì cả.

## 2. Kiến trúc

[[fig:taf-vla]] Giai đoạn (a) căn bộ mã hóa xúc giác với mã lực đã lượng tử hóa bằng InfoNCE; giai đoạn (b) gắn adapter đóng băng vào action expert của π0.5.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Bộ mã hóa lực | cửa sổ 5 bước: bản đồ áp suất $F'$ (12×12), wrench $F''$ (6) | mã $c^*$ (hai codebook VQ) | "mỏ neo vật lý" ổn định |
| Bộ mã hóa xúc giác | cửa sổ 5 ảnh xúc giác | $z^*$ (ViT + Transformer nhân quả) | thứ adapter xuất ra sau này |
| InfoNCE | các cặp $(z^*, c^*)$ | loss | kéo các cặp khớp lại gần |
| Action expert π0.5 | đặc trưng VLM $\phi_t$, $z^{tac}_t$, proprio $q_t$ | chunk hành động | chính sách, bước Euler 0,1 |

## 3. Tính tay: một số hạng InfoNCE

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** InfoNCE là loss dạy bộ mã hóa xúc giác khớp với lực thật. Tính nó để thấy khi nào loss nhỏ (căn tốt) và khi nào lớn.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $z^*_1$ | embedding xúc giác của mẫu 1 | input | – |
| $s_+$ | cosine similarity giữa $z^*_1$ và mã lực của chính nó $c^*_1$ | input | 0.9 |
| $s_-$ | similarity với mã lực còn lại $c^*_2$ | input | 0.2 |
| $\tau$ | nhiệt độ | hằng số | 0.1 (minh họa; bài không nêu) |
| $L_1$ | loss của mẫu 1 | output | – |

**Công thức** (batch hai cặp)

$$L_1 = -\log \frac{e^{s_+/\tau}}{e^{s_+/\tau} + e^{s_-/\tau}} = \log\left(1 + e^{(s_- - s_+)/\tau}\right)$$

**Từng bước**

1. $(s_- - s_+)/\tau = (0.2 - 0.9)/0.1 = -7$.
2. $e^{-7} \approx 0.00091$.
3. $L_1 = \log(1.00091) \approx 0.0009$.

Trường hợp căn kém, $s_+ = 0.5$, $s_- = 0.4$: $(0.4 - 0.5)/0.1 = -1$, $L_1 = \log(1 + e^{-1}) = \log 1.368 \approx 0.313$.

**Kết quả.** 0,0009 khi embedding xúc giác gần lực của chính nó rõ rệt; 0,313 khi chỉ gần hơn chút ít.

**Ý nghĩa.** Loss chỉ về 0 khi mỗi chuỗi xúc giác chỉ đúng về *lực của chính nó*, nên đầu ra của adapter trở thành một tín hiệu giống lực.
</div>

## 4. Kết quả

[[bars:%]] ACT=26.7; Diffusion Policy=29.5; π0.5 (chỉ thị giác)=37.1; FreeTacMan=42.8; *TaF-VLA=64.8* || Thành công trung bình, 15 lượt mỗi task.

- Adapter giúp cả backbone khác: ACT 26,7% → 47,6%, Diffusion Policy 29,5% → 44,7%.
- Ablation (lau bảng): đầy đủ 60,0%, không lịch sử 26,7%, dùng chung một codebook 13,3%.

## 5. Dữ liệu

| Mục | Giá trị |
|---|---|
| TaF-Dataset | > 10 triệu khung đồng bộ: xúc giác, F/T 6 trục, áp suất 12×12 |
| Thiết bị | máy ấn-và-nhiễu tự động, > 60 vật ấn, 30 Hz |
| Dữ liệu chính sách | > 10.000 episode có lực, > 20 kịch bản |

## 6. Mình có dùng được cho robot của bạn không?

**Trả lời ngắn.** Ý tưởng dùng lại được với một bộ thiết bị khiêm tốn, nhưng kết quả thì chưa chắc. Con số 64,8% đến từ một cảm biến chạm kiểu gel gắn trên robot, một adapter đã pretrain mà muốn tự làm lại phải có thiết bị riêng và khoảng 10 triệu khung, cùng một π0.5 đã fine-tune. "Có nêu" nghĩa là bài báo viết rõ; "không nêu" nghĩa là mình đã tìm trong toàn văn mà không thấy, nên không đoán.

**Phần cứng khi chạy thật**

| Cần | Bài báo dùng | Nếu bạn khác | Nguồn |
|---|---|---|---|
| Cảm biến chạm | Cảm biến gel dùng camera, 30 Hz: 4 loại tự chế (không marker, marker 4×4, 7×7, 9×9) và 2 chiếc GelSight Mini. Mọi lớp gel cùng độ cứng | Gel có độ cứng khác thì chưa thử. Cảm biến điện dung, từ hoặc điện trở áp: bài viết "chưa kết luận được" | Có nêu |
| Cảm biến lực trên robot | **Không cần.** Lời bài báo: bỏ được nhu cầu một cảm biến F/T đắt tiền lúc triển khai | Cảm biến F/T và mảng áp suất chỉ dùng để tạo adapter, không dùng khi chạy | Có nêu |
| Camera | Một camera góc ngoài, một camera cổ tay, cộng câu lệnh | Ít góc nhìn hơn thì chưa thử | Có nêu |
| Cánh tay và tay kẹp | Demo thu trên Franka Research 3 bằng bộ exoskeleton khớp (master-puppet) | Cánh tay khác chưa thử. Không nêu mẫu tay kẹp, cũng không nêu cách gắn cảm biến lên nó | Nêu một phần |
| Proprioception | Trạng thái khớp $q_t$ vào action expert | Cánh tay nào báo được trạng thái khớp | Có nêu |
| Máy tính | Một máy trạm RTX 4090 chạy suy luận cho mọi mô hình | Phần huấn luyện xem bảng sau | Có nêu |

**Dữ liệu và huấn luyện**

| Cần | Bài báo | Với bạn nghĩa là | Nguồn |
|---|---|---|---|
| TaF-Adapter đã pretrain | Huấn luyện trên TaF-Dataset: hơn 10 triệu khung xúc giác, lực và áp suất từ 6 cảm biến | Văn bản bài báo không nói trọng số adapter hay bộ dữ liệu có công khai không, và trang dự án mà bài dẫn link trả về lỗi 404 của GitHub khi mình mở (19/10/2026). **Hãy kiểm tra trước khi lên kế hoạch dựa vào nó** | Không nêu |
| Tự làm lại dữ liệu adapter | Thiết bị tự chế: 5 servo Dynamixel XM540, cảm biến F/T 6 trục ATI Axia80, mảng áp suất điện trở áp 12×12, khung in 3D (25×20×45 cm, lắp dưới 4 giờ), hơn 60 vật ấn (40 cứng, 20 mềm). Trên 100K khung mỗi giờ | Mình tính: 10.000.000 khung ÷ 100.000 khung/giờ ≈ 100 giờ chạy liên tục, nếu giữ được tốc độ đó. Chưa kể công làm và đổi vật ấn bằng tay | Có nêu, phép tính của mình |
| Demo cho chính sách | Hơn 10.000 episode có lực, hơn 20 kịch bản, mỗi episode kèm một câu lệnh mô tả lực ("nhẹ nhàng", "dùng lực tối thiểu") do LLM viết theo một khuôn cố định | Bạn cần demo cho đúng tác vụ của mình. Bài không cho số demo theo từng tác vụ ở kết quả chính, chỉ có các tập con 100, 150, 200 cho ba tác vụ | Nêu một phần |
| Cần bao nhiêu demo | Với 100 demo, TaF-VLA bằng hoặc hơn π0.5 huấn luyện bằng 200 (ba tác vụ) | Nếu tác vụ của bạn giống vậy, kỳ vọng khoảng một nửa số demo của baseline chỉ thị giác. Không phải lời hứa cho tác vụ khác | Có nêu |
| Công thức fine-tune | π0.5 với adapter đóng băng, fine-tune trên demo | Tốc độ học, số bước, VLM được huấn luyện đầy đủ hay bằng LoRA, và thời gian huấn luyện đều **không nêu**. Văn bản còn nhắc tinh chỉnh encoder theo tác vụ, nên "đóng băng" có thể không tuyệt đối | Không nêu |
| GPU huấn luyện | Không nêu | Ước lượng, không từ bài báo: README của openpi ghi cần hơn 22,5 GB bộ nhớ GPU để fine-tune π0.5 bằng LoRA và hơn 70 GB để fine-tune đầy đủ (A100 80 GB hoặc H100). Adapter thêm một ViT và một Transformer nhân quả nhỏ. Độ tin cậy thấp | Ước lượng |

**Cảm biến và tác vụ phải cho phép**

- **Tác vụ của bạn có cần lực không?** Bài nói là tùy: với vật nhẹ như sô-cô-la, π0.5 chỉ thị giác làm gần bằng. Mức tăng lớn nhất ở tác vụ phải chủ động điều khiển lực (nhấc chi tiết nặng, lấy pin dự phòng, nơi chỉ thị giác kém đi nhiều, và gắp quả cân bằng nhíp, nơi nó thất bại hoàn toàn).
- **Tốc độ.** Chính sách xuất một chunk hành động rồi mới lập kế hoạch lại. Các tác giả nói điều này quá chậm cho những xung lực nhanh, như lúc lưỡi dao xuyên qua thạch và chạm vào quả bóng bay.
- **Hỏng ở đâu.** Phần lớn lỗi xảy ra *trước* khi chạm: tay dừng cách bề mặt vài milimét nên vòng phản hồi xúc giác không bao giờ bắt đầu.
- **Cảm biến mới cùng họ.** Với cảm biến chưa thấy lúc pretrain, adapter đạt 60,3% và 53,3%, so với 75,0% và 65,0% ở cảm biến đã thấy. Cảm biến mới mất một phần, nhưng ít hơn nhiều so với baseline hồi quy lực (30,0% và 23,3%).

**Con đường nào hợp với bạn**

[[flow]]
- A~Trọng số công khai + cảm biến gel giống họ | Tải adapter > *Fine-tune π0.5 trên demo của bạn* > Chạy chỉ với xúc giác | ít việc nhất: vẫn cần demo và GPU
- B~Trọng số không công khai, bạn có F/T và cảm biến gel | Dựng thiết bị hoặc cách ghép cặp riêng > Pretrain adapter > Fine-tune π0.5 | nhiều việc nhất: khoảng 100 giờ thu dữ liệu theo tốc độ của bài
- C~Không có cảm biến gel, hoặc không có thời gian dựng thiết bị | Chọn bài khác | VLA-Touch thêm xúc giác mà không huấn luyện lại VLA; FD-VLA và TA-VLA không cần cảm biến thêm; Survey 1 mục 5 liệt kê thêm
[[/flow]]

## 7. Lưu ý

- Số task (8 trong văn bản, 7 ở Bảng I) và số baseline không nhất quán trong bài.
- Adapter được gọi là đóng băng, nhưng văn bản cũng nhắc fine-tune theo task.

**Mang sang bài sau:** TaF-VLA cần một thiết bị tự chế và 10 triệu khung thật. [Tabero](tabero.html) có dữ liệu thị giác–xúc giác–lực bằng cách phát lại quỹ đạo sẵn có trong mô phỏng xúc giác.

**Câu kiểm tra:** $\tau = 0.1$, $s_+ = 0.8$, $s_- = 0.6$. $L_1$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$(0.6 - 0.8)/0.1 = -2$; $L_1 = \log(1 + e^{-2}) = \log 1.135 \approx 0.127$.
</details>
:::
