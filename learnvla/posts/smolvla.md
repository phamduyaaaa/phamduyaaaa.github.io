---
slug: smolvla
date: 2026-10-21
title_en: "SmolVLA: A 0.45B VLA Trained on Community Data"
title_vi: "SmolVLA: VLA 0,45B học trên dữ liệu cộng đồng"
excerpt_en: "SmolVLA cuts a VLA down to 0.45B parameters: a small VLM with only half its layers used, 64 tokens per image, and a light flow-matching expert that alternates cross- and self-attention. Pre-trained on 22.9K community episodes, it scores 87.3% on LIBERO and beats π0 (3.5B) on real SO-100 tasks; asynchronous inference finishes tasks about 30% faster."
excerpt_vi: "SmolVLA thu nhỏ VLA còn 0,45B tham số: một VLM nhỏ chỉ dùng nửa số lớp, 64 token mỗi ảnh, và một expert flow matching nhẹ xen kẽ cross- và self-attention. Tiền huấn luyện trên 22,9K episode cộng đồng, nó đạt 87,3% trên LIBERO và thắng π0 (3,5B) trên tác vụ SO-100 thật; suy luận bất đồng bộ làm xong tác vụ nhanh hơn khoảng 30%."
tags: [VLA, Paper Notes, SmolVLA, LeRobot]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Shukor, Aubakirova, Capuano et al. (Hugging Face), *SmolVLA: A vision-language-action model for affordable and efficient robotics*, [arXiv 2506.01844](https://arxiv.org/abs/2506.01844) · 06/2025

**PROBLEM** A VLA that a person can train on one GPU and run on a consumer GPU or even a CPU, for low-cost arms.

**WHAT FAILED BEFORE** VLAs had billions of parameters (OpenVLA 7B, π0 3.3B) and were trained on large datasets collected by labs and companies, so training and deployment needed expensive hardware. Running chunks synchronously (finish a chunk, then think) leaves the robot blind while it waits for the next chunk.

**IDEA** Shrink every part: SmolVLM-2 as backbone with only the first half of its LLM layers used, no image tiling (64 tokens per frame), an action expert at 0.75× the VLM width whose layers alternate cross-attention to the VLM and causal self-attention, chunks of 50. Pre-train on 481 community datasets from the Hugging Face hub (22.9K episodes) with VLM-cleaned instructions. Add an asynchronous inference stack.

**RESULT** 0.45B parameters. LIBERO 87.3% average (π0 3.3B: 86.0%), Meta-World 57.3% (π0: 47.9%). Real SO-100: 78.3% vs π0 61.7% and ACT 48.3%. Asynchronous inference: same success, 9.7 s instead of 13.75 s per task.
</div>

## 1. The problem: VLAs need a lab's hardware

[[flow]]
- Before~π0 / OpenVLA | 3–7B VLM > !Large model, large lab data~expensive GPUs to train and run! > Robot | out of reach for hobby and small-lab arms
+ SmolVLA | 0.45B, half the VLM layers > *Light expert, 64 tokens/image~community data, async queue* > SO-100 arm | one GPU to train, CPU-capable inference
[[/flow]] The change is a set of efficiency choices, each tested in an ablation, plus training only on community-collected data.

## 2. Architecture and training

[[fig:smolvla]] Half of a small VLM produces features; a light expert reads them through interleaved cross-attention and denoises a chunk of 50 actions; an action queue decouples thinking from acting.

| Choice | SmolVLA | Effect |
|---|---|---|
| Backbone | SmolVLM-2 (SigLIP + SmolLM2) | small VLM built for multi-image input |
| Layers used | features up to layer $N = L/2$ | roughly halves the cost of LLM and expert; best features are not always in the last layer |
| Visual tokens | global image only, pixel shuffle → 64 per frame | no tiling, faster |
| Action expert | width $0.75 \times d$; cross-attention and causal self-attention layers interleaved | lighter than π0's expert; ablated against pure self-attention |
| Objective | flow matching, $\tau$ from a Beta distribution | ablation: better than regression |
| Chunk | $n = 50$ | – |
| Data | 481 community datasets, 22.9K episodes, 10.6M frames; instructions re-written by Qwen2.5-VL-3B; camera names normalised | about 10× less data than prior art |

<div class="calc" markdown="1">

Calculation card

**What and why.** In asynchronous mode the client asks for a new chunk when the queue falls below a fraction $g$ of the chunk. If $g$ is too small, the queue runs empty before the new chunk arrives. The paper gives the condition $g \ge \mathbb{E}[\ell_S] / (\Delta t \, n)$.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\ell_S$ | server inference latency | input | 100 ms, then 500 ms (illustrative) |
| $\Delta t$ | control period | input | 33 ms (30 fps, paper) |
| $n$ | chunk size | input | 50 |
| $g$ | minimum queue threshold | output | – |

**Formula**

$$g \ge \frac{\ell_S}{\Delta t \cdot n}$$

**Steps**

1. Chunk length in time: $\Delta t \cdot n = 33 \times 50 = 1{,}650$ ms.
2. $\ell_S = 100$ ms: $g \ge 100 / 1650 = 0.061$, so ask when about 3 actions are left.
3. $\ell_S = 500$ ms (e.g. a CPU): $g \ge 500 / 1650 = 0.303$, so ask when about 15 actions are left.

**Result.** A fast GPU can wait until the last 6% of the chunk; a slow device must ask with 30% left.

**Why it matters.** A larger $g$ means fresher observations but more inference calls. The threshold lets the same policy run on a GPU server or a slow edge device without the robot ever stopping to wait.
</div>

## 3. Results

| LIBERO (from Table 2) | Spatial | Object | Goal | Long | Avg |
|---|---|---|---|---|---|
| OpenVLA (7B) | 84.7 | 88.4 | 79.2 | 53.7 | 76.5 |
| π0 (3.3B, robot pre-trained) | 90 | 86 | 95 | 73 | 86.0 |
| SmolVLA (0.45B) | 90 | 96 | 92 | 71 | 87.3 |
| SmolVLA (2.25B) | 93 | 94 | 91 | 77 | 88.75 |

[[bars:%]] ACT single-task=48.3; π0 3.5B=61.7; *SmolVLA 0.45B=78.3* || Real SO-100, average of pick-place, stacking and sorting (Table 3).

- **Pre-training and multi-task matter:** on SO-100, single-task SmolVLA 40%, multi-task without community pre-training 51.7%, with it 78.3% (Table 5).
- **Asynchronous inference:** same success rate; 9.7 s vs 13.75 s per task (about 30% faster); in a fixed time, 19 pick-and-place cycles vs 9.
- **Cost:** compared with π0, about 40% faster to train and 6× less memory.
- The LIBERO protocol here is 10 trials per task; see [LIBERO](libero.html) for why the 1–2 point gaps in this table are within noise.

## 4. For a UR10e reader

SmolVLA is the cheapest way to try a VLA end to end, and LeRobot supports it directly. It was built and tested on low-cost arms (SO-100/101) with position control and no force input, so for contact work on a UR10e it is a starting backbone, not a solution: the force entry points in the [force survey](survey-force-map.html) apply to it just as to π0.

## 5. Caveats

- Checked against the full text: architecture choices, data statistics, Tables 2–5, asynchronous results, the threshold condition.
- The latencies in the calculation card are illustrative.

**Carry forward:** [LingBot-VLA 2.0](lingbotv2.html) goes in the opposite direction, with 60,000 hours of data and more degrees of freedom.

**Check question:** with $\Delta t = 20$ ms, $n = 30$ and $\ell_S = 240$ ms, what is the smallest safe $g$, and how many actions are left in the queue at that moment?

<details markdown="1">
<summary>Answer</summary>

$g \ge 240 / (20 \times 30) = 0.4$; $0.4 \times 30 = 12$ actions left.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Shukor, Aubakirova, Capuano và cộng sự (Hugging Face), *SmolVLA: A vision-language-action model for affordable and efficient robotics*, [arXiv 2506.01844](https://arxiv.org/abs/2506.01844) · 06/2025

**VẤN ĐỀ** Một VLA mà một người có thể huấn luyện trên một GPU và chạy trên GPU phổ thông, thậm chí CPU, cho các tay máy giá rẻ.

**PAPER TRƯỚC HỎNG Ở ĐÂU** VLA có hàng tỉ tham số (OpenVLA 7B, π0 3,3B) và học trên bộ dữ liệu lớn do lab và công ty thu, nên huấn luyện và triển khai cần phần cứng đắt tiền. Chạy chunk đồng bộ (chạy hết chunk rồi mới nghĩ) khiến robot "mù" trong lúc chờ chunk kế.

**Ý TƯỞNG** Thu nhỏ mọi phần: backbone SmolVLM-2 chỉ dùng nửa đầu số lớp LLM, không chia ô ảnh (64 token mỗi khung), action expert rộng 0,75 lần VLM với các lớp xen kẽ cross-attention tới VLM và self-attention nhân quả, chunk 50. Tiền huấn luyện trên 481 bộ dữ liệu cộng đồng từ Hugging Face hub (22,9K episode) với câu lệnh được VLM làm sạch. Thêm hệ thống suy luận bất đồng bộ.

**KẾT QUẢ** 0,45B tham số. LIBERO trung bình 87,3% (π0 3,3B: 86,0%), Meta-World 57,3% (π0: 47,9%). SO-100 thật: 78,3% so với π0 61,7% và ACT 48,3%. Suy luận bất đồng bộ: cùng tỉ lệ thành công, 9,7 s thay vì 13,75 s mỗi tác vụ.
</div>

## 1. Vấn đề: VLA cần phần cứng của phòng lab

[[flow]]
- Trước~π0 / OpenVLA | VLM 3–7B > !Mô hình lớn, dữ liệu lab lớn~GPU đắt để học và chạy! > Robot | ngoài tầm với tay máy nghiệp dư và lab nhỏ
+ SmolVLA | 0,45B, nửa số lớp VLM > *Expert nhẹ, 64 token/ảnh~dữ liệu cộng đồng, hàng đợi bất đồng bộ* > Tay SO-100 | một GPU để học, suy luận chạy được trên CPU
[[/flow]] Thay đổi là một loạt lựa chọn về hiệu quả, mỗi cái đều được kiểm tra bằng ablation, cộng với việc chỉ học trên dữ liệu cộng đồng thu thập.

## 2. Kiến trúc và huấn luyện

[[fig:smolvla]] Nửa đầu của một VLM nhỏ tạo đặc trưng; một expert nhẹ đọc chúng qua cross-attention xen kẽ và khử nhiễu một chunk 50 hành động; hàng đợi hành động tách việc nghĩ khỏi việc làm.

| Lựa chọn | SmolVLA | Tác dụng |
|---|---|---|
| Backbone | SmolVLM-2 (SigLIP + SmolLM2) | VLM nhỏ làm cho đầu vào nhiều ảnh |
| Số lớp dùng | đặc trưng tới lớp $N = L/2$ | giảm khoảng một nửa chi phí LLM và expert; đặc trưng tốt nhất không phải lúc nào cũng ở lớp cuối |
| Token ảnh | chỉ ảnh tổng, pixel shuffle → 64 mỗi khung | không chia ô, nhanh hơn |
| Action expert | rộng $0{,}75 \times d$; xen kẽ lớp cross-attention và self-attention nhân quả | nhẹ hơn expert của π0; có ablation so với chỉ self-attention |
| Mục tiêu | flow matching, $\tau$ lấy từ phân phối Beta | ablation: tốt hơn hồi quy |
| Chunk | $n = 50$ | – |
| Dữ liệu | 481 bộ dữ liệu cộng đồng, 22,9K episode, 10,6M khung; câu lệnh được Qwen2.5-VL-3B viết lại; chuẩn hóa tên camera | ít hơn khoảng 10 lần so với các công trình trước |

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Ở chế độ bất đồng bộ, client xin chunk mới khi hàng đợi còn dưới một tỉ lệ $g$ của chunk. Nếu $g$ quá nhỏ, hàng đợi cạn trước khi chunk mới tới. Paper đưa ra điều kiện $g \ge \mathbb{E}[\ell_S] / (\Delta t \, n)$.

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\ell_S$ | độ trễ suy luận ở server | đầu vào | 100 ms, rồi 500 ms (minh họa) |
| $\Delta t$ | chu kỳ điều khiển | đầu vào | 33 ms (30 khung/s, paper) |
| $n$ | kích thước chunk | đầu vào | 50 |
| $g$ | ngưỡng hàng đợi tối thiểu | đầu ra | – |

**Công thức**

$$g \ge \frac{\ell_S}{\Delta t \cdot n}$$

**Các bước**

1. Độ dài chunk theo thời gian: $\Delta t \cdot n = 33 \times 50 = 1.650$ ms.
2. $\ell_S = 100$ ms: $g \ge 100 / 1650 = 0{,}061$, tức xin khi còn khoảng 3 hành động.
3. $\ell_S = 500$ ms (vd. trên CPU): $g \ge 500 / 1650 = 0{,}303$, tức xin khi còn khoảng 15 hành động.

**Kết quả.** GPU nhanh có thể chờ tới 6% cuối chunk; thiết bị chậm phải xin khi còn 30%.

**Vì sao quan trọng.** $g$ lớn hơn nghĩa là quan sát mới hơn nhưng gọi suy luận nhiều hơn. Ngưỡng này cho phép cùng một policy chạy trên GPU server hay thiết bị biên chậm mà robot không bao giờ phải dừng lại chờ.
</div>

## 3. Kết quả

| LIBERO (từ Bảng 2) | Spatial | Object | Goal | Long | TB |
|---|---|---|---|---|---|
| OpenVLA (7B) | 84,7 | 88,4 | 79,2 | 53,7 | 76,5 |
| π0 (3,3B, tiền huấn luyện robot) | 90 | 86 | 95 | 73 | 86,0 |
| SmolVLA (0,45B) | 90 | 96 | 92 | 71 | 87,3 |
| SmolVLA (2,25B) | 93 | 94 | 91 | 77 | 88,75 |

[[bars:%]] ACT một tác vụ=48.3; π0 3,5B=61.7; *SmolVLA 0,45B=78.3* || SO-100 thật, trung bình gắp-đặt, xếp chồng và phân loại (Bảng 3).

- **Tiền huấn luyện và đa tác vụ quan trọng:** trên SO-100, SmolVLA một tác vụ 40%, đa tác vụ không tiền huấn luyện cộng đồng 51,7%, có tiền huấn luyện 78,3% (Bảng 5).
- **Suy luận bất đồng bộ:** cùng tỉ lệ thành công; 9,7 s so với 13,75 s mỗi tác vụ (nhanh hơn khoảng 30%); trong cùng thời gian cố định, 19 vòng gắp-đặt so với 9.
- **Chi phí:** so với π0, huấn luyện nhanh hơn khoảng 40% và tốn ít bộ nhớ hơn 6 lần.
- Quy trình LIBERO ở đây là 10 lượt mỗi tác vụ; xem [LIBERO](libero.html) để biết vì sao chênh 1–2 điểm trong bảng này nằm trong nhiễu.

## 4. Với người dùng UR10e

SmolVLA là cách rẻ nhất để thử một VLA từ đầu tới cuối, và LeRobot hỗ trợ nó trực tiếp. Nó được dựng và thử trên tay máy giá rẻ (SO-100/101) với điều khiển vị trí và không có đầu vào lực, nên với công việc tiếp xúc trên UR10e nó là backbone khởi đầu, không phải lời giải: các điểm đưa lực vào trong [survey về lực](survey-force-map.html) áp dụng cho nó y như cho π0.

## 5. Lưu ý

- Đã đối chiếu với toàn văn: các lựa chọn kiến trúc, thống kê dữ liệu, Bảng 2–5, kết quả bất đồng bộ, điều kiện ngưỡng.
- Độ trễ trong thẻ tính tay là minh họa.

**Mang theo:** [LingBot-VLA 2.0](lingbotv2.html) đi theo hướng ngược lại, với 60.000 giờ dữ liệu và nhiều bậc tự do hơn.

**Câu hỏi kiểm tra:** với $\Delta t = 20$ ms, $n = 30$ và $\ell_S = 240$ ms, $g$ an toàn nhỏ nhất là bao nhiêu, và lúc đó hàng đợi còn bao nhiêu hành động?

<details markdown="1">
<summary>Đáp án</summary>

$g \ge 240 / (20 \times 30) = 0{,}4$; $0{,}4 \times 30 = 12$ hành động.
</details>
:::
