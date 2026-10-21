---
slug: backbone
date: 2026-10-21
title_en: "Backbone and Fine-Tuning: How Much of a Pretrained Model to Retrain"
title_vi: "Backbone và fine-tuning: Huấn luyện lại bao nhiêu phần của mô hình đã pretrain"
excerpt_en: "A VLA starts from a pretrained backbone. Retraining all of it costs memory; freezing it costs accuracy. LoRA learns a small low-rank correction instead. OpenVLA's own comparison, and the parameter count of LoRA worked by hand."
excerpt_vi: "VLA khởi đầu từ một backbone đã pretrain. Huấn luyện lại toàn bộ thì tốn bộ nhớ; đóng băng thì mất độ chính xác. LoRA học một phần hiệu chỉnh hạng thấp nhỏ thay vào đó. So sánh của chính OpenVLA, và tính tay số tham số của LoRA."
tags: [VLA, Foundations, Fine-tuning, LoRA]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** LoRA, [arXiv 2106.09685](https://arxiv.org/abs/2106.09685) · 06/2021. Fine-tuning comparison in OpenVLA, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024

**PROBLEM** A VLA has billions of parameters learned from internet data. Adapting it to your robot and task means changing some of them, with limited GPUs and maybe 50 to 150 demonstrations.

**WHAT FAILED BEFORE** Full fine-tuning updates every weight: for the 7B OpenVLA that took 163.3 GB of GPU memory, split over two GPUs. Freezing most of the model is cheap but loses accuracy: in OpenVLA's test, training only the last layer reached 30.3% and freezing the vision encoder 47.0%, against 69.7% for full fine-tuning.

**IDEA** Keep every pretrained matrix $W$ frozen and learn a correction $\Delta W = BA$ of low rank $r$. Only $A$ and $B$ are trained, and they can be merged into $W$ afterwards, so inference is unchanged.

**RESULT** In OpenVLA, LoRA with rank 32 reached 68.2%, close to full fine-tuning, training 97.6M parameters (1.4%) in 59.7 GB. The openpi README lists more than 22.5 GB of GPU memory for LoRA fine-tuning of π0.5 against more than 70 GB for full fine-tuning.
</div>

## 1. The problem: retrain everything, or nothing?

[[flow]]
- Before~Full fine-tuning | All 7B weights > !Gradients + optimiser state for each! > Model | 163.3 GB for OpenVLA, two GPUs
- Before~Freeze most of it | Only the last layer > !Visual features never adapt! > Model | 30.3%
+ LoRA | Frozen W > *Learn BA, rank r~1.4% of weights* > Model | 68.2%, 59.7 GB
[[/flow]] The change is the assumption that the *update* needed for a new task is simple, even if the model is not.

## 2. Words and choices

[[fig:backbone]] Which parts are trained in four common recipes. Shaded boxes are trained; in LoRA the frozen matrices get a small trained side path.

| Term | Meaning |
|---|---|
| Backbone | the pretrained part that turns inputs into features (here the VLM: vision encoder + language model) |
| Head | the small part that turns features into the output (action tokens, or an action expert) |
| Frozen | weights not updated; no gradients or optimiser state needed for them |
| Full fine-tuning | update everything, starting from the pretrained values |
| LoRA | freeze $W$, train $A$ ($r \times d_{in}$) and $B$ ($d_{out} \times r$); $B$ starts at zero, so training starts exactly at the pretrained model |

[[bars:%]] Last layer only=30.3; Frozen vision=47.0; Sandwich=62.1; LoRA rank 32=68.2; *Full fine-tuning=69.7* || OpenVLA fine-tuning strategies on the same Franka tasks, mean success over 33 rollouts each (paper's Table 1; standard errors about ±7 points).

<div class="calc" markdown="1">
Calculation card

**What and why.** How many numbers does LoRA train for one square layer, compared with full fine-tuning? And why does a rank-1 correction already change the layer's output?

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $d$ | layer width (input = output) | constant | 2048 (Gemma-2B) |
| $r$ | LoRA rank | constant | 16 |
| $N_{full}$ | trainable numbers, full fine-tuning | output | – |
| $N_{LoRA}$ | trainable numbers, LoRA | output | – |

**Formula**

$$W' = W + BA, \qquad N_{full} = d^2, \qquad N_{LoRA} = r\,d + d\,r = 2rd$$

**Steps**

1. $N_{full} = 2048^2 = 4{,}194{,}304$.
2. $N_{LoRA} = 2 \times 16 \times 2048 = 65{,}536$.
3. Ratio: $65{,}536 / 4{,}194{,}304 = 1.56\%$.
4. Tiny rank-1 example, $d = 2$: $B = (1, 0)^\top$, $A = (0.5,\ 0.5)$ give $BA = \begin{pmatrix}0.5 & 0.5\\ 0 & 0\end{pmatrix}$. For an input $x = (2, 2)$, $BAx = (2, 0)$: a full 2×2 correction built from one column and one row. At $d = 2048$, rank 1 trains 4,096 numbers instead of 4.2 million.

**Result.** One layer trains 65,536 numbers instead of 4.2 million, 1.56%; across OpenVLA's linear layers the paper reports 1.4%.

**Why it matters.** Memory during training is dominated not by the weights but by what each *trained* weight needs: its gradient and the optimiser's running statistics. Freezing $W$ removes those for 98% of the model. The bet is that adapting to a new robot is a low-rank change, and OpenVLA's numbers suggest it mostly is.
</div>

## 3. What to freeze in a VLA

- **Do not freeze the eyes blindly.** OpenVLA's frozen-vision and last-layer-only runs did worst; the authors conclude that "adaptation of the visual features to the target scene is crucial".
- **Freezing protects knowledge.** A frozen VLM cannot forget its internet knowledge while it learns actions. Several force papers on this site freeze the VLM and train only a new part: FIRe tunes the action head and then freezes the whole VLA; Facet-0 freezes the vision-language backbone during refinement; TaF-VLA freezes its pretrained touch adapter.
- **New modalities enter through new parts.** ForceVLA and CR-VLA-Force add a force module next to the backbone instead of retraining it to read force, which is also how they avoid overwriting what it knows ([MoE](moe.html)).

**Carry forward:** adding a module "next to" the backbone often means a mixture of experts. What that is, and how a router picks experts: [MoE](moe.html).

**Check question:** A layer with $d_{in} = 1152$ and $d_{out} = 2048$ gets LoRA with $r = 8$. How many numbers are trained, and what fraction of the full matrix is that?

<details markdown="1">
<summary>Answer</summary>

$A$ is $8 \times 1152 = 9{,}216$, $B$ is $2048 \times 8 = 16{,}384$; total $25{,}600$. The full matrix has $1152 \times 2048 = 2{,}359{,}296$, so $25{,}600 / 2{,}359{,}296 = 1.09\%$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** LoRA, [arXiv 2106.09685](https://arxiv.org/abs/2106.09685) · 06/2021. So sánh các cách fine-tune trong OpenVLA, [arXiv 2406.09246](https://arxiv.org/abs/2406.09246) · 06/2024

**VẤN ĐỀ** VLA có hàng tỉ tham số học từ dữ liệu internet. Thích nghi nó với robot và tác vụ của bạn nghĩa là đổi một phần trong số đó, với số GPU có hạn và có lẽ chỉ 50 tới 150 demo.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Fine-tune toàn bộ cập nhật mọi trọng số: với OpenVLA 7 tỉ tham số, việc đó cần 163,3 GB bộ nhớ GPU, chia trên hai GPU. Đóng băng phần lớn mô hình thì rẻ nhưng mất độ chính xác: trong thử nghiệm của OpenVLA, chỉ huấn luyện lớp cuối đạt 30,3% và đóng băng bộ mã hóa ảnh đạt 47,0%, so với 69,7% khi fine-tune toàn bộ.

**Ý TƯỞNG** Giữ đóng băng mọi ma trận đã pretrain $W$ và học một phần hiệu chỉnh $\Delta W = BA$ có hạng thấp $r$. Chỉ $A$ và $B$ được huấn luyện, và có thể gộp vào $W$ sau đó, nên lúc suy luận không đổi gì.

**KẾT QUẢ** Trong OpenVLA, LoRA hạng 32 đạt 68,2%, gần bằng fine-tune toàn bộ, chỉ huấn luyện 97,6 triệu tham số (1,4%) với 59,7 GB. README của openpi ghi cần hơn 22,5 GB bộ nhớ GPU để fine-tune π0.5 bằng LoRA, so với hơn 70 GB khi fine-tune toàn bộ.
</div>

## 1. Vấn đề: huấn luyện lại tất cả, hay không gì cả?

[[flow]]
- Trước~Fine-tune toàn bộ | Cả 7 tỉ trọng số > !Gradient + trạng thái optimizer cho từng cái! > Mô hình | 163,3 GB với OpenVLA, hai GPU
- Trước~Đóng băng phần lớn | Chỉ lớp cuối > !Đặc trưng thị giác không bao giờ thích nghi! > Mô hình | 30,3%
+ LoRA | W đóng băng > *Học BA, hạng r~1,4% trọng số* > Mô hình | 68,2%, 59,7 GB
[[/flow]] Thay đổi nằm ở giả định rằng *phần cập nhật* cần cho một tác vụ mới là đơn giản, dù bản thân mô hình không đơn giản.

## 2. Thuật ngữ và lựa chọn

[[fig:backbone]] Bộ phận nào được huấn luyện trong bốn công thức phổ biến. Ô tô màu là được huấn luyện; ở LoRA, các ma trận đóng băng có thêm một đường phụ nhỏ được huấn luyện.

| Thuật ngữ | Nghĩa |
|---|---|
| Backbone | phần đã pretrain biến đầu vào thành đặc trưng (ở đây là VLM: bộ mã hóa ảnh + mô hình ngôn ngữ) |
| Head | phần nhỏ biến đặc trưng thành đầu ra (token hành động, hoặc một action expert) |
| Đóng băng | trọng số không được cập nhật; không cần gradient hay trạng thái optimizer cho chúng |
| Fine-tune toàn bộ | cập nhật mọi thứ, xuất phát từ giá trị đã pretrain |
| LoRA | đóng băng $W$, huấn luyện $A$ ($r \times d_{in}$) và $B$ ($d_{out} \times r$); $B$ khởi đầu bằng 0, nên việc huấn luyện xuất phát đúng tại mô hình đã pretrain |

[[bars:%]] Chỉ lớp cuối=30.3; Đóng băng ảnh=47.0; Sandwich=62.1; LoRA hạng 32=68.2; *Fine-tune toàn bộ=69.7* || Các chiến lược fine-tune OpenVLA trên cùng các tác vụ Franka, thành công trung bình qua 33 lượt mỗi cách (Bảng 1 của paper; sai số chuẩn khoảng ±7 điểm).

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** LoRA huấn luyện bao nhiêu con số cho một lớp vuông, so với fine-tune toàn bộ? Và vì sao một hiệu chỉnh hạng 1 đã đổi được đầu ra của lớp?

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $d$ | độ rộng lớp (vào = ra) | hằng số | 2048 (Gemma-2B) |
| $r$ | hạng LoRA | hằng số | 16 |
| $N_{full}$ | số con số được huấn luyện, fine-tune toàn bộ | output | – |
| $N_{LoRA}$ | số con số được huấn luyện, LoRA | output | – |

**Công thức**

$$W' = W + BA, \qquad N_{full} = d^2, \qquad N_{LoRA} = r\,d + d\,r = 2rd$$

**Từng bước**

1. $N_{full} = 2048^2 = 4.194.304$.
2. $N_{LoRA} = 2 \times 16 \times 2048 = 65.536$.
3. Tỉ lệ: $65.536 / 4.194.304 = 1{,}56\%$.
4. Ví dụ hạng 1 tí hon, $d = 2$: $B = (1, 0)^\top$, $A = (0{,}5;\ 0{,}5)$ cho $BA = \begin{pmatrix}0{,}5 & 0{,}5\\ 0 & 0\end{pmatrix}$. Với đầu vào $x = (2, 2)$, $BAx = (2, 0)$: một phần hiệu chỉnh 2×2 đầy đủ dựng từ một cột và một hàng. Với $d = 2048$, hạng 1 chỉ huấn luyện 4.096 số thay vì 4,2 triệu.

**Kết quả.** Một lớp huấn luyện 65.536 số thay vì 4,2 triệu, tức 1,56%; trên mọi lớp tuyến tính của OpenVLA paper báo cáo 1,4%.

**Ý nghĩa.** Bộ nhớ khi huấn luyện không chủ yếu nằm ở trọng số mà ở những thứ mỗi trọng số *được huấn luyện* cần: gradient của nó và các thống kê chạy của optimizer. Đóng băng $W$ bỏ được những thứ đó cho 98% mô hình. Ván cược ở đây là thích nghi với một robot mới chỉ là một thay đổi hạng thấp, và số liệu của OpenVLA cho thấy phần lớn là vậy.
</div>

## 3. Nên đóng băng gì trong VLA

- **Đừng đóng băng đôi mắt một cách mù quáng.** Hai cách đóng băng ảnh và chỉ huấn luyện lớp cuối của OpenVLA cho kết quả tệ nhất; các tác giả kết luận "việc thích nghi đặc trưng thị giác với khung cảnh mới là thiết yếu".
- **Đóng băng bảo vệ kiến thức.** VLM đóng băng không thể quên kiến thức internet trong khi học hành động. Một số bài lực trên trang này đóng băng VLM và chỉ huấn luyện phần mới: FIRe tinh chỉnh đầu hành động rồi đóng băng cả VLA; Facet-0 đóng băng backbone thị giác-ngôn ngữ khi tinh chỉnh; TaF-VLA đóng băng adapter xúc giác đã pretrain.
- **Phương thức mới đi vào qua bộ phận mới.** ForceVLA và CR-VLA-Force thêm một mô-đun lực cạnh backbone thay vì huấn luyện lại backbone để đọc lực, cũng là cách chúng tránh ghi đè lên những gì nó đã biết ([MoE](moe.html)).

**Mang theo:** thêm một mô-đun "cạnh" backbone thường có nghĩa là một mixture of experts. Đó là gì, và router chọn expert ra sao: [MoE](moe.html).

**Câu kiểm tra:** Một lớp có $d_{in} = 1152$ và $d_{out} = 2048$ được gắn LoRA với $r = 8$. Có bao nhiêu con số được huấn luyện, và chiếm bao nhiêu phần của ma trận đầy đủ?

<details markdown="1">
<summary>Đáp án</summary>

$A$ là $8 \times 1152 = 9.216$, $B$ là $2048 \times 8 = 16.384$; tổng $25.600$. Ma trận đầy đủ có $1152 \times 2048 = 2.359.296$, nên $25.600 / 2.359.296 = 1{,}09\%$.
</details>
:::
