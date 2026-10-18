---
slug: pi0
date: 2026-10-18
title_en: "π0: A VLM With a Flow-Matching Action Expert"
title_vi: "π0: VLM kèm action expert dùng flow matching"
excerpt_en: "Earlier VLAs write actions as text-like tokens one at a time, which struggles with dexterous, high-frequency control. π0 attaches a 300M flow-matching action expert to a 3B VLM and outputs a 50-step action chunk in 10 integration steps."
excerpt_vi: "Các VLA trước viết hành động như token giống chữ, từng token một, nên khó với điều khiển khéo léo, tần số cao. π0 gắn một action expert flow matching 300M vào VLM 3B và xuất đoạn hành động 50 bước chỉ với 10 bước tích phân."
tags: [VLA, Paper Notes, π0, Flow Matching]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Physical Intelligence, *π0: A Vision-Language-Action Flow Model for General Robot Control*, [arXiv 2410.24164](https://arxiv.org/abs/2410.24164) · 10/2024

**PROBLEM** One model should follow language and also handle dexterous, high-frequency control (the paper's tasks include folding laundry).

**WHAT FAILED BEFORE** The paper says prior VLAs "employ autoregressive discretization to represent actions in a manner analogous to text tokens", and that high-frequency action chunks (up to 50 Hz) and dexterous tasks "pose a major challenge" for such VLAs.

**IDEA** Keep a pre-trained VLM (PaliGemma, 3B) for semantics. Add a separate 300M "action expert" that outputs a continuous action chunk by flow matching, attending to the VLM's tokens.

**RESULT** 3.3B parameters, chunk of $H = 50$ actions, up to 50 Hz, 10 Euler steps. Pre-trained on about 10,000 hours from 7 robot configurations, then fine-tuned per task.
</div>

## 1. The problem: actions as text are slow and coarse

[[flow]]
- Before~Autoregressive VLA | Image + text > !Bin each action dim~one token at a time! > Action | one network pass per token; hard at high frequency
+ π0 | Image + text > *Action expert~flow matching, continuous* > 50-step chunk | 10 passes of a small expert
[[/flow]] The change is the output head: continuous chunk by flow matching instead of text-like tokens.

## 2. Architecture

[[fig:pi0]] Image and language tokens go through the VLM. Robot-specific tokens (state and noisy actions) use a separate set of weights, the action expert, and attend to the VLM's tokens. The expert is run 10 times to turn noise into an action chunk.

| Block | Input | Output | Role |
|---|---|---|---|
| VLM (PaliGemma, 3B) | 2-3 images, language | tokens with semantics | inherits internet-scale knowledge |
| State token | joint configuration $q_t$ | one token | robot state |
| Action tokens | noisy chunk $A^\tau_t$, timestep $\tau$ | tokens for 50 steps | what the expert denoises |
| Action expert (300M) | the three above, plus VLM tokens | velocity $v_\theta$ | separate weights, trained from scratch; actions attend to each other bidirectionally |
| Euler integration | $A^\tau_t$, $v_\theta$ | $A^{\tau+\delta}_t$ | 10 steps, $\delta = 0.1$ |

[[bars:B]] VLM backbone=3; Action expert=0.3; *π0 total=3.3*; π0-small (no VLM)=0.47 || Parameters in billions. π0-small is the paper's baseline without VLM initialisation.

<div class="calc" markdown="1">

Calculation card

**What and why.** How many *sequential* network passes does one action chunk need with text-like tokens, versus with π0's flow expert? This is the reason for the new head.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $H$ | actions per chunk | input | 50 (paper) |
| $d$ | action dimensions (the paper pads to 18) | input | 18 |
| $N$ | Euler steps | input | 10 (paper) |
| $P_{AR}$ | sequential passes, one token per value | output | – |
| $P_{flow}$ | sequential passes, flow expert | output | – |

**Formula**

$$P_{AR} = H \times d, \qquad P_{flow} = N$$

**Steps**

1. $P_{AR} = 50 \times 18 = 900$.
2. $P_{flow} = 10$.
3. Ratio $900 / 10 = 90$.

**Result.** 900 sequential passes against 10.

**Why it matters.** The 90× is an illustration of the sequential depth: it ignores compression such as FAST, and passes differ in cost. π0 also caches the VLM's keys and values and re-runs only the 300M expert in each of the 10 steps, so each pass is cheaper than a full-model pass.
</div>

## 3. Training

- **Loss:** flow matching with $\tau = 0$ noise and $\tau = 1$ data: $A^\tau_t = \tau A_t + (1-\tau)\varepsilon$, target velocity $A_t - \varepsilon$. Details in [flow matching](flowmatching.html).
- **Timestep sampling:** a Beta distribution that emphasises lower (noisier) $\tau$.
- **Pre-training data:** 903M timesteps from the authors' own robots (68 tasks, 7 robot configurations including single-arm, bimanual and mobile) plus open-source data (OXE, Bridge v2, DROID) as 9.1% of the mixture.
- **Post-training:** fine-tune on curated data for the target task: from 5 hours (simplest) to 100+ hours (hardest), as the paper states.

## 4. What the paper reports

- Pre-trained π0 follows language better than the 470M π0-small baseline and beats prior VLAs in the paper's comparisons.
- Pre-training helps fine-tuning, in the paper's summary up to about 2× on some tasks.
- On multi-stage tasks the paper reports more than 50% of the maximum score across tasks.

## 5. Caveats

- These results come from a summary of the paper's later sections; I did not read the numbers in the figures, so none are quoted.
- Appendix A (architecture and inference details) was not read verbatim. The attention layout of the three token groups is from a summary, not checked.
- The paper says not all evaluated tasks work reliably, and the comparison with π0-small is confounded by model size.

**Carry forward:** force papers build on this: [ForceVLA](forcevla.html) adds force tokens to a π0-style model, and [TaF-VLA](taf-vla.html) plugs tactile tokens into the action expert of π0.5.

**Check question:** $H = 50$, $d = 14$. How many sequential passes would one-token-per-value need, and how many does flow with $N = 10$ need?

<details markdown="1">
<summary>Answer</summary>

$P_{AR} = 50 \times 14 = 700$; $P_{flow} = 10$. Ratio 70.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Physical Intelligence, *π0: A Vision-Language-Action Flow Model for General Robot Control*, [arXiv 2410.24164](https://arxiv.org/abs/2410.24164) · 10/2024

**VẤN ĐỀ** Một mô hình vừa theo được ngôn ngữ vừa xử lý điều khiển khéo léo, tần số cao (các tác vụ của paper gồm gấp quần áo).

**PAPER TRƯỚC HỎNG Ở ĐÂU** Paper nói các VLA trước "dùng rời rạc hóa tự hồi quy để biểu diễn hành động giống như token chữ", và rằng đoạn hành động tần số cao (đến 50 Hz) cùng tác vụ khéo léo "là thách thức lớn" với loại VLA này.

**Ý TƯỞNG** Giữ một VLM tiền huấn luyện (PaliGemma, 3B) cho ngữ nghĩa. Thêm một "action expert" riêng 300M xuất đoạn hành động liên tục bằng flow matching, chú ý đến token của VLM.

**KẾT QUẢ** 3,3B tham số, đoạn $H = 50$ hành động, tới 50 Hz, 10 bước Euler. Tiền huấn luyện trên khoảng 10.000 giờ từ 7 cấu hình robot, rồi tinh chỉnh theo từng tác vụ.
</div>

## 1. Vấn đề: hành động dạng chữ chậm và thô

[[flow]]
- Trước~VLA tự hồi quy | Ảnh + chữ > !Chia bin từng chiều~một token mỗi lần! > Hành động | một lượt qua mạng cho mỗi token; khó ở tần số cao
+ π0 | Ảnh + chữ > *Action expert~flow matching, liên tục* > Đoạn 50 bước | 10 lượt của một expert nhỏ
[[/flow]] Thay đổi là đầu ra: đoạn liên tục bằng flow matching thay cho token giống chữ.

## 2. Kiến trúc

[[fig:pi0]] Token ảnh và ngôn ngữ đi qua VLM. Token riêng của robot (trạng thái và hành động nhiễu) dùng một bộ trọng số riêng, action expert, và chú ý đến token của VLM. Expert chạy 10 lần để biến nhiễu thành đoạn hành động.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| VLM (PaliGemma, 3B) | 2-3 ảnh, ngôn ngữ | token có ngữ nghĩa | thừa hưởng tri thức quy mô internet |
| Token trạng thái | cấu hình khớp $q_t$ | một token | trạng thái robot |
| Token hành động | đoạn nhiễu $A^\tau_t$, bước $\tau$ | token cho 50 bước | thứ expert khử nhiễu |
| Action expert (300M) | ba thứ trên, cùng token VLM | vận tốc $v_\theta$ | trọng số riêng, huấn luyện từ đầu; các token hành động chú ý hai chiều lẫn nhau |
| Tích phân Euler | $A^\tau_t$, $v_\theta$ | $A^{\tau+\delta}_t$ | 10 bước, $\delta = 0{,}1$ |

[[bars:B]] Backbone VLM=3; Action expert=0.3; *π0 tổng=3.3*; π0-small (không VLM)=0.47 || Số tham số, đơn vị tỉ. π0-small là baseline của paper, không khởi tạo từ VLM.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Một đoạn hành động cần bao nhiêu lượt qua mạng *tuần tự* với token giống chữ, so với flow expert của π0? Đây là lý do của đầu ra mới.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $H$ | số hành động mỗi đoạn | input | 50 (paper) |
| $d$ | số chiều hành động (paper đệm thành 18) | input | 18 |
| $N$ | số bước Euler | input | 10 (paper) |
| $P_{AR}$ | số lượt tuần tự, một token mỗi giá trị | output | – |
| $P_{flow}$ | số lượt tuần tự, flow expert | output | – |

**Công thức**

$$P_{AR} = H \times d, \qquad P_{flow} = N$$

**Các bước**

1. $P_{AR} = 50 \times 18 = 900$.
2. $P_{flow} = 10$.
3. Tỉ số $900 / 10 = 90$.

**Kết quả.** 900 lượt tuần tự so với 10.

**Ý nghĩa.** 90 lần là minh họa độ sâu tuần tự: bỏ qua nén như FAST, và các lượt có chi phí khác nhau. π0 còn lưu cache key và value của VLM và chỉ chạy lại expert 300M ở mỗi trong 10 bước, nên mỗi lượt rẻ hơn lượt toàn mô hình.
</div>

## 3. Huấn luyện

- **Loss:** flow matching với $\tau = 0$ là nhiễu và $\tau = 1$ là dữ liệu: $A^\tau_t = \tau A_t + (1-\tau)\varepsilon$, vận tốc mục tiêu $A_t - \varepsilon$. Chi tiết trong [flow matching](flowmatching.html).
- **Lấy mẫu bước thời gian:** phân phối Beta nhấn vào $\tau$ thấp (nhiễu hơn).
- **Dữ liệu tiền huấn luyện:** 903 triệu timestep từ robot của chính nhóm (68 tác vụ, 7 cấu hình robot gồm một tay, hai tay và di động) cùng dữ liệu mở (OXE, Bridge v2, DROID) chiếm 9,1% hỗn hợp.
- **Hậu huấn luyện:** tinh chỉnh trên dữ liệu chọn lọc cho tác vụ đích: từ 5 giờ (đơn giản nhất) đến hơn 100 giờ (khó nhất), theo paper.

## 4. Paper báo cáo gì

- π0 tiền huấn luyện theo ngôn ngữ tốt hơn baseline π0-small 470M và vượt các VLA trước trong các so sánh của paper.
- Tiền huấn luyện giúp tinh chỉnh, theo tóm tắt paper tới khoảng 2 lần trên một số tác vụ.
- Với tác vụ nhiều giai đoạn, paper báo cáo trên 50% điểm tối đa ở mọi tác vụ.

## 5. Lưu ý

- Các kết quả này đến từ bản tóm tắt phần sau của paper; tôi chưa đọc số trong các hình nên không trích số.
- Phụ lục A (chi tiết kiến trúc và suy luận) chưa đọc nguyên văn. Cách chia ba nhóm token trong attention lấy từ bản tóm tắt, chưa kiểm.
- Paper nói không phải tác vụ nào được đánh giá cũng chạy ổn định, và so sánh với π0-small bị lẫn yếu tố kích thước mô hình.

**Mang theo:** các paper lực xây trên nó: [ForceVLA](forcevla.html) thêm token lực vào mô hình kiểu π0, và [TaF-VLA](taf-vla.html) cắm token xúc giác vào action expert của π0.5.

**Câu hỏi kiểm tra:** $H = 50$, $d = 14$. Một token mỗi giá trị cần bao nhiêu lượt tuần tự, còn flow với $N = 10$ cần bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$P_{AR} = 50 \times 14 = 700$; $P_{flow} = 10$. Tỉ số 70.
</details>
:::
