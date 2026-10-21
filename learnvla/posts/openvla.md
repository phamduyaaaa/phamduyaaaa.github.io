---
slug: openvla
date: 2026-10-21
title_en: "OpenVLA: The RT-2 Recipe, Open and at 7B"
title_vi: "OpenVLA: Công thức RT-2, mở và ở cỡ 7B"
excerpt_en: "OpenVLA fine-tunes an open 7B VLM (Llama 2 with fused DINOv2 + SigLIP vision) on 970k Open X-Embodiment episodes to output 7 binned action tokens. It beats the closed 55B RT-2-X by 16.5 points over 29 tasks, fine-tunes with LoRA on one GPU, and runs in 7 GB at 4-bit."
excerpt_vi: "OpenVLA fine-tune một VLM mở 7B (Llama 2 với phần ảnh ghép DINOv2 + SigLIP) trên 970k episode Open X-Embodiment để xuất 7 token hành động chia bin. Nó hơn RT-2-X 55B đóng 16,5 điểm trên 29 tác vụ, fine-tune bằng LoRA trên một GPU, và chạy trong 7 GB ở 4-bit."
tags: [VLA, Paper Notes, OpenVLA]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Kim, Pertsch, Karamcheti et al., *OpenVLA: An Open-Source Vision-Language-Action Model*, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024

**PROBLEM** VLAs had shown that web-pretrained VLMs generalise better as robot policies, but nobody outside a few labs could use or adapt one.

**WHAT FAILED BEFORE** The paper names two gaps: existing VLAs are "largely closed and inaccessible to the public" (RT-2, RT-2-X at 55B), and prior work did not study how to *fine-tune* a VLA efficiently for a new robot. Open generalist policies such as Octo and RT-1-X were trained from scratch on robot data, and in OpenVLA's tests they often grabbed the wrong object when distractors were present.

**IDEA** Take an open VLM (Prismatic-7B: DINOv2 + SigLIP vision, 2-layer MLP projector, Llama 2 7B), and fine-tune the whole model on 970k OXE episodes to output 7 action tokens, each one of 256 bins set by the 1st–99th percentile of that action dimension. Release everything, and study LoRA fine-tuning and quantised inference.

**RESULT** +16.5 points absolute over RT-2-X across 29 tasks on WidowX and Google Robot, with 7× fewer parameters. On LIBERO after fine-tuning: 76.5% average. LoRA (rank 32) matches full fine-tuning within 1.5 points while training 1.4% of the weights; 4-bit inference keeps success (71.9% vs 71.3%) at 7.0 GB instead of 16.8 GB.
</div>

## 1. The problem: a strong recipe nobody could use

[[flow]]
- Before~RT-2-X | Web VLM, 55B > !Closed weights~cloud TPUs, no fine-tuning study! > Robot | best results, not reproducible
+ OpenVLA | Open VLM, 7B > *Full fine-tune on 970k OXE episodes~1st–99th percentile bins* > Robot | +16.5 points, open code, LoRA on one GPU
[[/flow]] The change is mostly about access and engineering: the same action-as-tokens recipe, with open parts, better data and documented fine-tuning.

## 2. Architecture and training choices

[[fig:openvla]] One image and an instruction go through a fused vision encoder, a projector and Llama 2. The model writes 7 action tokens that are mapped back to bin centres.

| Choice | OpenVLA | Why (paper) |
|---|---|---|
| Vision | DINOv2 + SigLIP, features concatenated per patch | SigLIP brings semantics, DINOv2 spatial detail; ~10 points better than a LLaVA backbone on multi-object language grounding |
| Resolution | 224×224 | 384×384 gave no gain and took 3× longer to train |
| Vision encoder | fine-tuned, not frozen | frozen vision gave worse results in their ablations |
| Action bins | 256 per dimension over the 1st–99th percentile | min–max bounds (RT-2) let outliers stretch the bins |
| Action tokens | overwrite the 256 least-used Llama tokens | Llama reserves only 100 special tokens |
| Epochs | 27, until action-token accuracy passes 95% | far more passes than usual for VLM training |
| Compute | 64 A100 × 14 days = 21,500 A100-hours, batch 2048 | – |
| Inference | 15 GB in bf16, ~6 Hz on an RTX 4090 | – |

<div class="calc" markdown="1">

Calculation card

**What and why.** OpenVLA bins each action dimension between its 1st and 99th percentile instead of its min and max. How much resolution does one outlier cost with min–max bins? (Illustrative numbers.)

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $q_{1}, q_{99}$ | 1st and 99th percentile of $\Delta x$ | input | −0.02 m, +0.02 m |
| $x_{min}, x_{max}$ | min and max of $\Delta x$, one spike at 0.20 m | input | −0.02 m, +0.20 m |
| $B$ | number of bins | input | 256 |
| $w$ | bin width | output | – |

**Formula**

$$w = \frac{\text{upper} - \text{lower}}{B}$$

**Steps**

1. Percentile bins: $w = 0.04 / 256 = 0.000156$ m $= 0.16$ mm.
2. Min–max bins: $w = 0.22 / 256 = 0.00086$ m $= 0.86$ mm.
3. Ratio: $0.86 / 0.16 = 5.5$.
4. With min–max, the normal motions (within ±0.02 m) use only $0.04 / 0.00086 \approx 46$ of the 256 bins.

**Result.** One outlier makes every bin 5.5× wider, and leaves 46 usable bins instead of 256.

**Why it matters.** The rounding error is half a bin: 0.08 mm against 0.43 mm per step. For precise insertion that is the difference between a fine and a coarse controller. Values outside the 1st–99th percentile are clipped to the end bins, which is the price of this choice.
</div>

## 3. Results

- **Out of the box** (WidowX Bridge and Google Robot, 29 tasks): +16.5 points absolute over RT-2-X; RT-1-X and Octo often manipulated the wrong object. RT-2-X still did better on semantic generalisation, which the paper links to its larger web pre-training.
- **Fine-tuning to a new Franka setup** (7 tasks, 10–150 demos): Diffusion Policy from scratch is strong on narrow single-instruction tasks; OpenVLA and Octo are better on diverse tasks with several objects and language grounding. OpenVLA is the only method above 50% on every task.
- **LIBERO** (fine-tuned per suite): 76.5% average against 75.1% for Octo and 72.4% for Diffusion Policy; see [LIBERO](libero.html) for the protocol.
- **Efficient adaptation:** the full comparison of fine-tuning strategies (full, last layer, frozen vision, sandwich, LoRA) is on the [backbone post](backbone.html). LoRA cuts compute 8× and fits a new task in 10–15 h on one A100.

[[bars:GB]] bf16=16.8; int8=10.2; *int4=7.0* || GPU memory at inference (Table 2). Success on 8 Bridge tasks: 71.3%, 58.1%, 71.9%.

## 4. Limits the paper states

- One image as input: no wrist camera, no history, no proprioception in the released model.
- ~6 Hz on a 4090 is too slow for high-frequency control such as ALOHA at 50 Hz.
- Success is usually below 90%, so it is not yet reliable enough to deploy as is.

## 5. Caveats

- Checked against the full text: architecture, data, compute, tokenisation, LIBERO table, quantisation table and limitations.
- The calculation card uses made-up action ranges.

**Carry forward:** OpenVLA's one-token-per-dimension output is what [FAST](action-tokenization.html) compresses and what [π0](pi0.html) replaces with flow matching; [SmolVLA](smolvla.html) asks how small such a model can be.

**Check question:** a gripper rotation dimension has $q_1 = -0.10$ rad and $q_{99} = 0.10$ rad. What is the bin width with 256 bins, and the largest rounding error?

<details markdown="1">
<summary>Answer</summary>

$w = 0.20 / 256 = 0.00078$ rad (about 0.045°). Largest rounding error: half a bin, 0.00039 rad (about 0.022°).
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Kim, Pertsch, Karamcheti và cộng sự, *OpenVLA: An Open-Source Vision-Language-Action Model*, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024

**VẤN ĐỀ** VLA đã cho thấy VLM tiền huấn luyện trên web tổng quát tốt hơn khi làm policy robot, nhưng ngoài vài lab thì không ai dùng hay chỉnh được.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Paper nêu hai khoảng trống: các VLA hiện có "phần lớn đóng và công chúng không tiếp cận được" (RT-2, RT-2-X ở 55B), và chưa ai nghiên cứu cách *fine-tune* VLA hiệu quả cho robot mới. Các policy tổng quát mở như Octo và RT-1-X học từ đầu trên dữ liệu robot, và trong thử nghiệm của OpenVLA chúng hay gắp nhầm vật khi có vật gây nhiễu.

**Ý TƯỞNG** Lấy một VLM mở (Prismatic-7B: ảnh qua DINOv2 + SigLIP, projector MLP 2 lớp, Llama 2 7B), và fine-tune toàn bộ mô hình trên 970k episode OXE để xuất 7 token hành động, mỗi token là một trong 256 bin đặt theo phân vị 1–99 của chiều hành động đó. Công bố mọi thứ, và nghiên cứu fine-tune bằng LoRA cùng suy luận lượng tử hóa.

**KẾT QUẢ** Hơn RT-2-X 16,5 điểm tuyệt đối trên 29 tác vụ ở WidowX và Google Robot, với số tham số ít hơn 7 lần. Trên LIBERO sau fine-tune: trung bình 76,5%. LoRA (hạng 32) ngang fine-tune toàn bộ trong vòng 1,5 điểm khi chỉ huấn luyện 1,4% trọng số; suy luận 4-bit giữ nguyên thành công (71,9% so với 71,3%) với 7,0 GB thay vì 16,8 GB.
</div>

## 1. Vấn đề: công thức mạnh nhưng không ai dùng được

[[flow]]
- Trước~RT-2-X | VLM web, 55B > !Trọng số đóng~TPU đám mây, không nghiên cứu fine-tune! > Robot | kết quả tốt nhất, không tái hiện được
+ OpenVLA | VLM mở, 7B > *Fine-tune toàn bộ trên 970k episode OXE~bin theo phân vị 1–99* > Robot | +16,5 điểm, mã mở, LoRA trên một GPU
[[/flow]] Thay đổi chủ yếu nằm ở khả năng tiếp cận và kỹ thuật: vẫn công thức hành động-là-token, với linh kiện mở, dữ liệu tốt hơn và cách fine-tune có tài liệu.

## 2. Kiến trúc và các lựa chọn huấn luyện

[[fig:openvla]] Một ảnh và một câu lệnh đi qua bộ mã hóa ảnh ghép, projector và Llama 2. Mô hình viết 7 token hành động, rồi ánh xạ ngược về tâm của bin.

| Lựa chọn | OpenVLA | Lý do (theo paper) |
|---|---|---|
| Ảnh | DINOv2 + SigLIP, nối đặc trưng theo từng ô | SigLIP mang ngữ nghĩa, DINOv2 mang chi tiết không gian; hơn backbone LLaVA khoảng 10 điểm ở bài gắn ngôn ngữ nhiều vật |
| Độ phân giải | 224×224 | 384×384 không tốt hơn mà huấn luyện lâu gấp 3 |
| Bộ mã hóa ảnh | fine-tune, không đóng băng | đóng băng phần ảnh cho kết quả kém hơn trong ablation |
| Bin hành động | 256 mỗi chiều trong khoảng phân vị 1–99 | biên min–max (RT-2) để giá trị ngoại lai kéo giãn bin |
| Token hành động | ghi đè 256 token Llama ít dùng nhất | Llama chỉ dành sẵn 100 token đặc biệt |
| Số epoch | 27, tới khi độ chính xác token hành động vượt 95% | nhiều lượt hơn hẳn so với huấn luyện VLM thông thường |
| Tính toán | 64 A100 × 14 ngày = 21.500 giờ A100, batch 2048 | – |
| Suy luận | 15 GB ở bf16, ~6 Hz trên RTX 4090 | – |

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** OpenVLA chia bin mỗi chiều hành động giữa phân vị 1 và 99 thay vì giữa min và max. Một giá trị ngoại lai làm mất bao nhiêu độ phân giải nếu dùng min–max? (Số minh họa.)

| Ký hiệu | Ý nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $q_{1}, q_{99}$ | phân vị 1 và 99 của $\Delta x$ | đầu vào | −0,02 m, +0,02 m |
| $x_{min}, x_{max}$ | min và max của $\Delta x$, có một gai ở 0,20 m | đầu vào | −0,02 m, +0,20 m |
| $B$ | số bin | đầu vào | 256 |
| $w$ | độ rộng bin | đầu ra | – |

**Công thức**

$$w = \frac{\text{cận trên} - \text{cận dưới}}{B}$$

**Các bước**

1. Bin theo phân vị: $w = 0{,}04 / 256 = 0{,}000156$ m $= 0{,}16$ mm.
2. Bin min–max: $w = 0{,}22 / 256 = 0{,}00086$ m $= 0{,}86$ mm.
3. Tỉ lệ: $0{,}86 / 0{,}16 = 5{,}5$.
4. Với min–max, các cử động bình thường (trong ±0,02 m) chỉ dùng $0{,}04 / 0{,}00086 \approx 46$ trên 256 bin.

**Kết quả.** Một giá trị ngoại lai làm mọi bin rộng gấp 5,5 lần, và chỉ còn 46 bin dùng được thay vì 256.

**Vì sao quan trọng.** Sai số làm tròn là nửa bin: 0,08 mm so với 0,43 mm mỗi bước. Với lắp ghép chính xác, đó là khác biệt giữa bộ điều khiển tinh và thô. Giá trị ngoài khoảng phân vị 1–99 bị cắt về bin ở hai đầu, đó là cái giá của lựa chọn này.
</div>

## 3. Kết quả

- **Không fine-tune** (WidowX Bridge và Google Robot, 29 tác vụ): hơn RT-2-X 16,5 điểm tuyệt đối; RT-1-X và Octo thường thao tác nhầm vật. RT-2-X vẫn tốt hơn ở tổng quát hóa ngữ nghĩa, paper cho là nhờ tiền huấn luyện web lớn hơn.
- **Fine-tune sang bộ Franka mới** (7 tác vụ, 10–150 demo): Diffusion Policy học từ đầu mạnh ở tác vụ hẹp một câu lệnh; OpenVLA và Octo tốt hơn ở tác vụ đa dạng nhiều vật có gắn ngôn ngữ. OpenVLA là phương pháp duy nhất trên 50% ở mọi tác vụ.
- **LIBERO** (fine-tune từng bộ): trung bình 76,5% so với 75,1% của Octo và 72,4% của Diffusion Policy; xem [LIBERO](libero.html) để biết quy trình.
- **Thích nghi hiệu quả:** so sánh đầy đủ các cách fine-tune (toàn bộ, lớp cuối, đóng băng ảnh, sandwich, LoRA) nằm ở [bài backbone](backbone.html). LoRA giảm tính toán 8 lần và học một tác vụ mới trong 10–15 giờ trên một A100.

[[bars:GB]] bf16=16.8; int8=10.2; *int4=7.0* || Bộ nhớ GPU khi suy luận (Bảng 2). Thành công trên 8 tác vụ Bridge: 71,3%, 58,1%, 71,9%.

## 4. Giới hạn paper tự nêu

- Đầu vào chỉ một ảnh: không camera cổ tay, không lịch sử, không cảm thụ bản thể trong mô hình đã công bố.
- ~6 Hz trên 4090 là quá chậm cho điều khiển tần số cao như ALOHA ở 50 Hz.
- Thành công thường dưới 90%, nên chưa đủ tin cậy để triển khai nguyên trạng.

## 5. Lưu ý

- Đã đối chiếu với toàn văn: kiến trúc, dữ liệu, tính toán, cách token hóa, bảng LIBERO, bảng lượng tử hóa và phần giới hạn.
- Thẻ tính tay dùng khoảng hành động tự đặt.

**Mang theo:** đầu ra mỗi chiều một token của OpenVLA chính là thứ [FAST](action-tokenization.html) nén lại và [π0](pi0.html) thay bằng flow matching; [SmolVLA](smolvla.html) hỏi một mô hình như vậy nhỏ được tới đâu.

**Câu hỏi kiểm tra:** một chiều quay tay kẹp có $q_1 = -0{,}10$ rad và $q_{99} = 0{,}10$ rad. Độ rộng bin với 256 bin là bao nhiêu, và sai số làm tròn lớn nhất là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$w = 0{,}20 / 256 = 0{,}00078$ rad (khoảng 0,045°). Sai số làm tròn lớn nhất: nửa bin, 0,00039 rad (khoảng 0,022°).
</details>
:::
