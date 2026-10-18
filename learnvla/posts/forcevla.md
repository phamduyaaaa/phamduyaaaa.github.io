---
slug: forcevla
date: 2026-10-18
title_en: "ForceVLA: Force-aware MoE for Contact-rich Manipulation"
title_vi: "ForceVLA: MoE nhận biết lực cho thao tác giàu tiếp xúc"
excerpt_en: "ForceVLA treats 6-axis force as its own modality and fuses it into π0 after the VLM with a sparse mixture of experts (FVLMoE). Architecture, training and results."
excerpt_vi: "ForceVLA coi lực 6 trục là một modality riêng và gộp vào π0 sau VLM bằng mixture-of-experts thưa (FVLMoE). Kiến trúc, cách huấn luyện và kết quả."
tags: [VLA, Force, Paper Notes, MoE, π0]
---

:::en
Paper: [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) (NeurIPS 2025), built on π0.

## The pain it cures

Vision-language-action models are good at coarse motion but fail when the task is decided by contact: inserting a plug, wiping a board, peeling a cucumber. Naively concatenating force to the robot state barely helps. ForceVLA's claim is that force should be a **first-class modality** with its own token, and that it should be fused **after** the VLM has already processed vision and language.

## Try the naive way first

The obvious move is to append the 6 force numbers to the robot-state vector and fine-tune. The paper reports what happens:

| Model | Without force | Force concatenated to state |
|---|---|---|
| π0-base | 37.3% | 40.2% |
| π0-fast | 31.0% | 14.2% |

Three points gained for one model, seventeen lost for the other. Six numbers inside a long sequence of image and state tokens are easy to ignore, and a signal that only matters during contact is near zero on every free-space step. Putting a MoE **before** the VLM was worse still: 0% in the ablation.

## Work it by hand: one top-1 routing step

FVLMoE sends each token to exactly one of 4 experts. A router maps the token to 4 scores (logits), softmax turns them into probabilities, and the largest wins. Two tokens:

- a token from a free-space step, logits $(2.0,\ 0.5,\ 0.1,\ -1.0)$
- a token from a step where the plug is being pushed in, logits $(0.2,\ 0.1,\ 2.5,\ 0.3)$

First token: $e^{2.0}=7.389$, $e^{0.5}=1.649$, $e^{0.1}=1.105$, $e^{-1}=0.368$, sum $10.511$, so $p=(0.703,\ 0.157,\ 0.105,\ 0.035)$: expert 0.

Second token: $e^{0.2}=1.221$, $e^{0.1}=1.105$, $e^{2.5}=12.182$, $e^{0.3}=1.350$, sum $15.858$, so $p_2 = 0.768$: expert 2.

The same layer applies different weights to "moving" and "touching" tokens without being told which is which: the force token reaches every token through the encoder's self-attention and shifts the logits. The residual keeps the original token, output $= h + \text{expert}(h)$, so an expert only learns a correction. (Many top-1 MoEs also scale the expert output by its probability; the paper does not say whether FVLMoE does.) In the paper's routing analysis, expert 0 handles nearly half of all tokens.

## Architecture

[[fig:forcevla]] ForceVLA: the force token E_F joins the VLM output, passes an encoder and a 4-expert top-1 MoE (FVLMoE), and the result is added to the action expert's suffix before flow-matching decoding.

Read it left to right:

1. **VLM.** Base and wrist RGB plus the instruction go through a SigLIP-based PaliGemma VLM, giving $E_{VL}$.
2. **Force token.** The raw 6-axis force-torque reading $f \in \mathbb{R}^6$ goes through one linear layer to $\mathbb{R}^{2048}$, giving a single token $E_F$.
3. **Concatenate and encode.** $E_{in} = [E_{VL}; E_F]$ passes a Transformer encoder block ($D=2048$, 8 heads) with self-attention and an FFN.
4. **FVLMoE.** A sparse MoE with 4 expert MLPs and a top-1 router picks one expert per token; a residual connection adds the input back.
5. **Inject into the action expert.** A linear layer maps $2048 \to 1024$, the last $H_{action}$ tokens become $G$, and $G$ is added element-wise to $S_{suffix}$ (the processed robot state plus noisy action). A flow-matching head decodes the action chunk.

The ablation supports the "after the VLM" choice: fusing with a linear layer before the VLM scored 55%, a MoE before the VLM collapsed to 0%, concatenation after the VLM 60%, and full ForceVLA 80% (on the ablation task).

## Training and data

- Base: π0 with a conditional flow-matching action generator.
- ForceVLA-Data: 244 trajectories, about 140 thousand synchronized timesteps, five tasks (bottle pumping, plug insertion, USB insertion, whiteboard wiping, cucumber peeling), collected by VR teleoperation on a Flexiv Rizon arm.
- Optimiser: Adam ($\beta_1=0.9$, $\beta_2=0.95$), peak learning rate $2.5\times10^{-5}$ decaying to $2.5\times10^{-6}$ over 30,000 steps, bfloat16, gradient clipping 1.0.

## Results

On the five tasks ForceVLA averages **60.5%** success against **37.3%** for a π0-base baseline, a gain of 23.2 points. In the multi-task setting it reaches 67.5% average (plug insertion 100%).

## Caveats from reading the paper

- Control frequency and the numeric action-chunk length are not stated.
- The paper labels the 37.3% baseline inconsistently ("with force" in one sentence, "without" elsewhere), and the ablation baseline (45%) is on a different footing.
- Which parts are frozen during fine-tuning is not stated.
**Carry forward:** ForceVLA reads force but still outputs only an end-effector pose, so it cannot say how hard to push. [ForceVLA2](forcevla2.html) changes the output itself.

**Check question:** a token's router logits are $(1.0,\ 1.0,\ 0.0,\ 3.0)$. Which expert does it go to, and with what probability? And why might a MoE placed before the VLM collapse to 0%?

*Answer:* $e^{1}=2.718$ twice, $e^{0}=1$, $e^{3}=20.086$, sum $26.522$: expert 3 with $p = 0.757$. Before the VLM, force features enter a model pretrained only on images and text and disturb the vision-language representation it relies on; after the VLM that representation is already formed and force only modulates the action. (The paper reports the 0%; this explanation is my reading of it.)
:::

:::vi
Bài báo: [arXiv 2505.22159](https://arxiv.org/abs/2505.22159) (NeurIPS 2025), xây trên π0.

## Vấn đề cần chữa

Các mô hình VLA làm tốt chuyển động thô nhưng thất bại khi nhiệm vụ do tiếp xúc quyết định: cắm phích, lau bảng, gọt dưa chuột. Chỉ nối lực vào state của robot gần như không giúp được gì. Ý tưởng của ForceVLA: lực phải là một **modality hạng nhất** với token riêng, và phải được gộp **sau** khi VLM đã xử lý xong ảnh và ngôn ngữ.

## Thử cách ngây thơ trước

Cách hiển nhiên nhất là nối 6 con số lực vào vector state của robot rồi fine-tune. Bài báo cho biết kết quả:

| Mô hình | Không lực | Nối lực vào state |
|---|---|---|
| π0-base | 37,3% | 40,2% |
| π0-fast | 31,0% | 14,2% |

Một mô hình tăng 3 điểm, mô hình kia mất 17 điểm. Sáu con số lẫn trong một dãy dài token ảnh và state rất dễ bị bỏ qua, và một tín hiệu chỉ có ý nghĩa khi tiếp xúc thì gần bằng 0 ở mọi bước di chuyển tự do. Đặt MoE **trước** VLM còn tệ hơn: 0% trong ablation.

## Tính tay: một bước định tuyến top-1

FVLMoE gửi mỗi token tới đúng một trong 4 expert. Router biến token thành 4 điểm số (logit), softmax biến chúng thành xác suất, cái lớn nhất thắng. Hai token:

- token ở một bước di chuyển tự do, logit $(2.0,\ 0.5,\ 0.1,\ -1.0)$
- token ở bước đang ấn phích vào ổ, logit $(0.2,\ 0.1,\ 2.5,\ 0.3)$

Token thứ nhất: $e^{2.0}=7.389$, $e^{0.5}=1.649$, $e^{0.1}=1.105$, $e^{-1}=0.368$, tổng $10.511$, nên $p=(0.703,\ 0.157,\ 0.105,\ 0.035)$: expert 0.

Token thứ hai: $e^{0.2}=1.221$, $e^{0.1}=1.105$, $e^{2.5}=12.182$, $e^{0.3}=1.350$, tổng $15.858$, nên $p_2 = 0.768$: expert 2.

Cùng một lớp áp dụng trọng số khác nhau cho token "đang di chuyển" và token "đang chạm" mà không ai phải nói cho nó biết: token lực lan tới mọi token qua self-attention của encoder và làm lệch logit. Residual giữ lại token gốc, đầu ra $= h + \text{expert}(h)$, nên expert chỉ cần học phần hiệu chỉnh. (Nhiều MoE top-1 còn nhân đầu ra expert với xác suất của nó; bài không nói FVLMoE có làm vậy không.) Trong phân tích định tuyến của bài, expert 0 xử lý gần một nửa số token.

## Kiến trúc

[[fig:forcevla]] ForceVLA: token lực E_F nhập vào đầu ra của VLM, đi qua một encoder và MoE 4 expert top-1 (FVLMoE), kết quả được cộng vào suffix của action expert trước khi giải mã flow-matching.

Đọc từ trái sang phải:

1. **VLM.** Ảnh RGB từ camera nền và camera cổ tay cùng câu lệnh đi qua VLM PaliGemma (dựa trên SigLIP), cho ra $E_{VL}$.
2. **Token lực.** Số đo lực-mô men 6 trục $f \in \mathbb{R}^6$ qua một lớp linear lên $\mathbb{R}^{2048}$, thành một token $E_F$.
3. **Nối và mã hóa.** $E_{in} = [E_{VL}; E_F]$ đi qua một block Transformer encoder ($D=2048$, 8 head) gồm self-attention và FFN.
4. **FVLMoE.** MoE thưa với 4 expert MLP và router top-1 chọn một expert cho mỗi token; kết nối residual cộng đầu vào trở lại.
5. **Tiêm vào action expert.** Một lớp linear $2048 \to 1024$, lấy $H_{action}$ token cuối làm $G$, rồi cộng từng phần tử vào $S_{suffix}$ (state đã xử lý cộng với action nhiễu). Đầu flow-matching giải mã ra chuỗi hành động.

Ablation ủng hộ lựa chọn "sau VLM": gộp bằng linear trước VLM đạt 55%, MoE trước VLM sụp xuống 0%, concat sau VLM 60%, ForceVLA đầy đủ 80% (trên task dùng cho ablation).

## Huấn luyện và dữ liệu

- Nền: π0 với bộ sinh hành động conditional flow matching.
- ForceVLA-Data: 244 quỹ đạo, khoảng 140 nghìn timestep đồng bộ, năm task (bơm chai, cắm phích, cắm USB, lau bảng, gọt dưa chuột), thu bằng teleoperation VR trên tay Flexiv Rizon.
- Optimizer: Adam ($\beta_1=0.9$, $\beta_2=0.95$), learning rate đỉnh $2.5\times10^{-5}$ giảm về $2.5\times10^{-6}$ trong 30.000 bước, bfloat16, clip gradient 1.0.

## Kết quả

Trên năm task, ForceVLA trung bình **60,5%** thành công so với **37,3%** của baseline π0-base, hơn 23,2 điểm. Ở cài đặt multi-task đạt trung bình 67,5% (cắm phích 100%).

## Lưu ý khi đọc bài

- Tần số điều khiển và độ dài action chunk (con số cụ thể) không được nêu.
- Bài gắn nhãn baseline 37,3% không nhất quán (chỗ ghi "có lực", chỗ ghi "không lực"), và baseline của ablation (45%) nằm trên một nền khác.
- Không nêu phần nào bị đóng băng khi fine-tune.

**Mang theo sang bài sau:** ForceVLA đọc được lực nhưng đầu ra vẫn chỉ là pose của end-effector, nên không nói được cần ấn mạnh đến đâu. [ForceVLA2](forcevla2.html) thay đổi chính đầu ra.

**Câu kiểm tra:** logit router của một token là $(1.0,\ 1.0,\ 0.0,\ 3.0)$. Token đi tới expert nào, với xác suất bao nhiêu? Và vì sao đặt MoE trước VLM có thể sụp xuống 0%?

*Đáp án:* $e^{1}=2.718$ hai lần, $e^{0}=1$, $e^{3}=20.086$, tổng $26.522$: expert 3 với $p = 0.757$. Đặt trước VLM, đặc trưng lực đi vào một mô hình chỉ được pretrain trên ảnh và văn bản, làm xáo trộn biểu diễn thị giác-ngôn ngữ mà nó dựa vào; đặt sau VLM thì biểu diễn đó đã hình thành và lực chỉ điều chỉnh hành động. (Bài chỉ báo con số 0%; lời giải thích này là cách tôi đọc kết quả.)
:::
