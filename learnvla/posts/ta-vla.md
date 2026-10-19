---
slug: ta-vla
date: 2026-10-19
title_en: "TA-VLA: Joint Torque as a Force Sensor for a VLA"
title_vi: "TA-VLA: Dùng mô-men khớp thay cảm biến lực cho VLA"
excerpt_en: "Most force-aware policies need an external F/T sensor, and VLAs such as π0 know nothing about contact. TA-VLA reads torque from the motor currents and studies where and how to feed it to π0: one history token in the decoder, plus a future-torque prediction task."
excerpt_vi: "Đa số chính sách có nhận biết lực cần cảm biến F/T gắn ngoài, còn các VLA như π0 không biết gì về tiếp xúc. TA-VLA đọc mô-men từ dòng điện động cơ và khảo sát nên đưa nó vào π0 ở đâu và bằng cách nào: một token lịch sử ở decoder, cộng thêm nhiệm vụ dự đoán mô-men tương lai."
tags: [VLA, Force, Torque, Paper Notes, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2509.07962](https://arxiv.org/abs/2509.07962) · 09/2025 · built on π0 (also tested on RDT)

**PROBLEM** A robot needs to feel contact to push a button, plug a charger or turn a door handle. Camera images cannot tell a failed insertion from a successful one, but joint torques can.

**WHAT FAILED BEFORE** The paper names two gaps. Many force-aware imitation methods rely on extra 6D force sensors, which cost money and fail in harsh conditions. And methods that fuse force with vision and language "typically train policies from scratch and fail to leverage the advantages of pretrained VLA models"; FACTR is cited as needing a complex training pipeline. Plain π0 gets 0/20 on charger plugging.

**IDEA** Estimate torque from motor current, then answer three questions systematically: *where* to put it (decoder, not encoder), *how* (the whole 2-second history in one token), and *as what* (also predict future torque as a second training target).

**RESULT** On five contact-rich tasks, the average success rate of π0 goes from 23% to 86% (my average of the paper's Table 5; 20 trials per task).
</div>

## 1. The problem: π0 cannot feel the difference between a miss and a hit

[[flow]]
- Before~π0 / external F/T methods | Images + language + joint angles > !No contact signal~or an extra sensor to buy! > Action | charger plugging: 0/20
+ TA-VLA | Same + motor-current torque > *1 history token in the decoder~+ future-torque target* > Action + future torque | charger plugging: 17/20
[[/flow]] The change is where and how the torque enters, not a bigger model.

## 2. Architecture

[[fig:ta-vla]] Torque history becomes one token for the action expert; the output layer predicts actions and future torques together.

| Block | Input | Output | Role |
|---|---|---|---|
| Torque from current | motor current $i$ | torque $\tau = k_t\, i$ | no force sensor; $k_t$ is the motor constant |
| History token | 10 frames from the past 2 s, 14 values each (140 numbers) | 1 token, via an MLP | what happened recently, in one token |
| Action expert (decoder) | torque token, state token, noisy chunk, plus the VLM's tokens | velocity for actions and torques | torque is placed next to the joint-angle state |
| Output layer | decoder features | action part + torque part | one widened linear layer, new weights start small |

**Why torque carries contact.** The arm's dynamics give $\tau_{measured} = \tau_{model} + J^\top F_{ext}$: what is left after the arm's own motion is explained is the external force mapped through the Jacobian. The paper's Section 3 states this; [Survey 2](survey-force-sensing.html) works it by hand.

[[bars:%]] ACT=14; RDT=15; π0=23; *π0 + torque obs + objective=86* || Average success over the five contact-rich tasks, 20 trials each (my average of the paper's Table 5).

<div class="calc" markdown="1">

Calculation card

**What and why.** What does "one token for the whole history" change inside the decoder? Count the tokens the decoder sees. The paper argues that extra history tokens "disturb the decoder's input pattern", and its results agree.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n_f$ | frames in the history (uniform over the past 2 s) | input | 10 |
| $d_\tau$ | torque values per frame (14 joints) | input | 14 |
| $w$ | decoder width | constant | 1024 |
| $L_0$ | decoder tokens in π0: 1 state + 50 action | input | 51 |
| $N_1$, $N_H$ | decoder tokens with one history token / one token per frame | output | – |

**Formula**

$$d_{in} = n_f\, d_\tau \ (\text{one token}), \qquad N_1 = L_0 + 1, \qquad N_H = L_0 + n_f$$

**Steps**

1. One-token input size: $d_{in} = 10 \times 14 = 140$, fed to an MLP $140 \to 2w \to w$.
2. $N_1 = 51 + 1 = 52$ tokens (+2% over π0).
3. $N_H = 51 + 10 = 61$ tokens (+20%).

**Result.** Single history token: 52 tokens. One token per frame: 61 tokens.

**Why it matters.** The decoder was pre-trained on 51 tokens; the one-token design barely changes what it sees. In the paper's Table 3 the one-token decoder scores 15/20 and 16/20 on button pushing and charger plugging; the one-token-per-frame decoder scores 9/20 and 7/20.
</div>

## 3. Three design questions, three answers

| Question | Options tried | Winner | Evidence (paper's tables, 20 trials) |
|---|---|---|---|
| Where? | encoder token; decoder, merged into the state token; decoder, own token | decoder, own token | button pushing 7, 8, 10 of 20 (π0: 5); charger plugging 8, 11, 12 (π0: 0) |
| How much history? | single frame; history as H tokens; history as 1 token | history as 1 token, in the decoder | 15/20 and 16/20 (single frame in the decoder: 10 and 12) |
| As what? | observation only; also predict torque | both together | average 86% against 78% (observation only) and 64% (objective only) |

- **Why the decoder:** the paper measures (HSIC) that torque is more aligned with joint-angle features, and that the decoder reacts more to small input changes than the encoder: adding noise hurts the decoder more.
- **The training objective:** $L = L_{action} + \beta L_{torque}$, with $\beta = 1$ for the objective-only variant and $\beta = 0.1$ when combined with the observation token. The future torque has length $H = 5$.

## 4. Training and data

| Item | Value |
|---|---|
| Base | public π0 checkpoint, LoRA on encoder and decoder; also RDT (1B), full-parameter |
| Steps | π0: 30k on 4 × L20 GPUs; RDT: 40k |
| Data | 400 demonstrations per task; Cobot Magic ALOHA, 7-DoF dual arm, three cameras |
| Inference | π0 action horizon 50, RDT 64, on an RTX 4090 |
| Cross-embodiment | ROKAE SR arm: 200 demonstrations, 50k steps, charger insertion with a retry after a failed attempt |

## 5. What the paper reports

- **Contact-rich tasks (successes of 20):** π0 gets 5, 0, 0, 16, 2 on button pushing, charger plugging, USB plugging, socket unplugging, door handle turning; π0 + torque observation + objective gets 18, 17, 17, 19, 15.
- **Regular tasks:** torque also helps slightly or leaves things unchanged (π0 average 85%, with torque 89%, my averages).
- **Cross model:** on RDT the same additions raise button pushing from 4/20 to 16/20 and charger plugging from 1/20 to 15/20.
- **Behaviour:** after a failed attempt the torque profile changes, and the robot retries.

## 6. Caveats

- The averages (14%, 15%, 23%, 86%) are mine, computed from the paper's Table 5; the paper reports per-task counts.
- Torque comes from motor currents, so calibration, noise and heat can degrade it; the paper says this is its main limitation, and that scaling to other modalities under a shared token budget is unclear.
- With 20 trials per task, small differences between rows are within noise; the large gaps (for example 0/20 to 17/20) are not (see [how to evaluate a VLA](danh-gia-vla.html)).

**Carry forward:** TA-VLA keeps force as a number stream. [TaF-VLA](taf-vla.html) instead aligns touch images with force before they reach the VLA.

**Check question:** with 5 history frames of 14 torque values and the π0 decoder of 51 tokens, what is the one-token input size and how many decoder tokens $N_1$ result?

<details markdown="1">
<summary>Answer</summary>

Input size $5 \times 14 = 70$. $N_1 = 51 + 1 = 52$ tokens, the same as with 10 frames: the number of frames only changes the size of the MLP input, not the token count.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2509.07962](https://arxiv.org/abs/2509.07962) · 09/2025 · xây trên π0 (có thử thêm trên RDT)

**VẤN ĐỀ** Robot cần "cảm" được tiếp xúc để bấm nút, cắm sạc hay xoay tay nắm cửa. Ảnh camera không phân biệt được một lần cắm hỏng với một lần cắm đúng, nhưng mô-men khớp thì phân biệt được.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Paper chỉ ra hai khoảng trống. Nhiều phương pháp imitation có nhận biết lực dựa vào cảm biến lực 6D gắn thêm, vừa tốn tiền vừa hỏng trong điều kiện khắc nghiệt. Còn các phương pháp trộn lực với ảnh và ngôn ngữ thì "thường huấn luyện chính sách từ đầu và bỏ phí lợi thế của VLA đã tiền huấn luyện"; FACTR được nêu là cần một quy trình huấn luyện phức tạp. π0 thường chỉ đạt 0/20 ở tác vụ cắm sạc.

**Ý TƯỞNG** Ước lượng mô-men từ dòng điện động cơ, rồi trả lời có hệ thống ba câu hỏi: đưa vào *ở đâu* (decoder, không phải encoder), *bằng cách nào* (cả lịch sử 2 giây trong một token), và *làm gì* (còn dự đoán mô-men tương lai như một mục tiêu huấn luyện thứ hai).

**KẾT QUẢ** Trên năm tác vụ giàu tiếp xúc, tỉ lệ thành công trung bình của π0 tăng từ 23% lên 86% (trung bình mình tính từ Bảng 5 của paper; 20 lượt mỗi tác vụ).
</div>

## 1. Vấn đề: π0 không phân biệt được trượt và trúng

[[flow]]
- Trước~π0 / phương pháp F/T gắn ngoài | Ảnh + ngôn ngữ + góc khớp > !Không có tín hiệu tiếp xúc~hoặc phải mua thêm cảm biến! > Hành động | cắm sạc: 0/20
+ TA-VLA | Như trên + mô-men từ dòng điện > *1 token lịch sử ở decoder~+ mục tiêu mô-men tương lai* > Hành động + mô-men tương lai | cắm sạc: 17/20
[[/flow]] Thay đổi nằm ở chỗ và cách đưa mô-men vào, không phải mô hình to hơn.

## 2. Kiến trúc

[[fig:ta-vla]] Lịch sử mô-men thành một token cho action expert; lớp đầu ra dự đoán đồng thời hành động và mô-men tương lai.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Mô-men từ dòng điện | dòng điện động cơ $i$ | mô-men $\tau = k_t\, i$ | không cần cảm biến lực; $k_t$ là hằng số động cơ |
| Token lịch sử | 10 khung trong 2 giây qua, mỗi khung 14 giá trị (140 số) | 1 token, qua một MLP | chuyện vừa xảy ra, gói trong một token |
| Action expert (decoder) | token mô-men, token trạng thái, đoạn nhiễu, cùng token của VLM | vận tốc cho hành động và mô-men | mô-men đặt cạnh trạng thái góc khớp |
| Lớp đầu ra | đặc trưng decoder | phần hành động + phần mô-men | một lớp tuyến tính được mở rộng, trọng số mới khởi tạo nhỏ |

**Vì sao mô-men chứa thông tin tiếp xúc.** Động lực học của cánh tay cho $\tau_{measured} = \tau_{model} + J^\top F_{ext}$: phần còn lại sau khi trừ chuyển động của chính cánh tay là lực ngoài được chiếu qua Jacobian. Mục 3 của paper nêu điều này; [Survey 2](survey-force-sensing.html) tính tay ví dụ.

[[bars:%]] ACT=14; RDT=15; π0=23; *π0 + mô-men (quan sát + mục tiêu)=86* || Thành công trung bình trên năm tác vụ giàu tiếp xúc, 20 lượt mỗi tác vụ (trung bình mình tính từ Bảng 5 của paper).

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** "Một token cho cả lịch sử" thay đổi gì bên trong decoder? Hãy đếm số token mà decoder thấy. Paper lập luận rằng thêm token lịch sử "làm rối khuôn đầu vào của decoder", và kết quả khớp.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n_f$ | số khung trong lịch sử (đều trong 2 giây qua) | input | 10 |
| $d_\tau$ | số giá trị mô-men mỗi khung (14 khớp) | input | 14 |
| $w$ | độ rộng decoder | hằng số | 1024 |
| $L_0$ | số token decoder của π0: 1 trạng thái + 50 hành động | input | 51 |
| $N_1$, $N_H$ | số token decoder khi dùng một token lịch sử / một token mỗi khung | output | – |

**Công thức**

$$d_{in} = n_f\, d_\tau \ (\text{một token}), \qquad N_1 = L_0 + 1, \qquad N_H = L_0 + n_f$$

**Từng bước**

1. Kích thước đầu vào của một token: $d_{in} = 10 \times 14 = 140$, đưa vào MLP $140 \to 2w \to w$.
2. $N_1 = 51 + 1 = 52$ token (+2% so với π0).
3. $N_H = 51 + 10 = 61$ token (+20%).

**Kết quả.** Một token lịch sử: 52 token. Một token mỗi khung: 61 token.

**Ý nghĩa.** Decoder được tiền huấn luyện với 51 token; thiết kế một token gần như không đổi những gì nó thấy. Ở Bảng 3 của paper, decoder dùng một token đạt 15/20 và 16/20 ở bấm nút và cắm sạc; decoder dùng một token mỗi khung đạt 9/20 và 7/20.
</div>

## 3. Ba câu hỏi thiết kế, ba câu trả lời

| Câu hỏi | Các phương án đã thử | Thắng | Bằng chứng (bảng của paper, 20 lượt) |
|---|---|---|---|
| Đặt ở đâu? | token ở encoder; ở decoder gộp vào token trạng thái; ở decoder thành token riêng | decoder, token riêng | bấm nút 7, 8, 10 trên 20 (π0: 5); cắm sạc 8, 11, 12 (π0: 0) |
| Lịch sử bao nhiêu? | một khung; lịch sử H token; lịch sử 1 token | lịch sử 1 token, ở decoder | 15/20 và 16/20 (một khung ở decoder: 10 và 12) |
| Dùng làm gì? | chỉ làm quan sát; thêm dự đoán mô-men | cả hai cùng lúc | trung bình 86% so với 78% (chỉ quan sát) và 64% (chỉ mục tiêu) |

- **Vì sao decoder:** paper đo (HSIC) thấy mô-men căn chỉnh với đặc trưng góc khớp hơn, và decoder nhạy với thay đổi nhỏ của đầu vào hơn encoder: thêm nhiễu làm decoder hỏng nhiều hơn.
- **Hàm mục tiêu huấn luyện:** $L = L_{action} + \beta L_{torque}$, với $\beta = 1$ ở biến thể chỉ có mục tiêu và $\beta = 0{,}1$ khi kết hợp với token quan sát. Chuỗi mô-men tương lai dài $H = 5$.

## 4. Huấn luyện và dữ liệu

| Mục | Giá trị |
|---|---|
| Nền | checkpoint π0 công khai, LoRA cho cả encoder và decoder; thử thêm RDT (1B), huấn luyện toàn tham số |
| Số bước | π0: 30k trên 4 GPU L20; RDT: 40k |
| Dữ liệu | 400 bản demo mỗi tác vụ; Cobot Magic ALOHA, hai tay 7 bậc tự do, ba camera |
| Suy luận | horizon hành động π0 là 50, RDT là 64, trên RTX 4090 |
| Khác robot | cánh tay ROKAE SR: 200 bản demo, 50k bước, cắm sạc có thử lại sau lần hỏng |

## 5. Paper báo cáo gì

- **Tác vụ giàu tiếp xúc (số lần thành công trên 20):** π0 đạt 5, 0, 0, 16, 2 ở bấm nút, cắm sạc, cắm USB, rút ổ cắm, xoay tay nắm cửa; π0 + token mô-men + mục tiêu đạt 18, 17, 17, 19, 15.
- **Tác vụ thường:** mô-men cũng giúp nhẹ hoặc giữ nguyên (π0 trung bình 85%, có mô-men 89%, trung bình mình tính).
- **Đổi mô hình:** trên RDT, cùng các bổ sung nâng bấm nút từ 4/20 lên 16/20 và cắm sạc từ 1/20 lên 15/20.
- **Hành vi:** sau một lần hỏng, hình dạng mô-men đổi và robot thử lại.

## 6. Lưu ý

- Các số trung bình (14%, 15%, 23%, 86%) là mình tính từ Bảng 5 của paper; paper báo cáo số lần thành công từng tác vụ.
- Mô-men lấy từ dòng điện động cơ nên hiệu chỉnh, nhiễu và nhiệt có thể làm xấu đi; paper nêu đây là hạn chế chính, và chưa rõ mở rộng sang các phương thức khác dưới ngân sách token chung có được không.
- Với 20 lượt mỗi tác vụ, chênh lệch nhỏ giữa các hàng nằm trong vùng nhiễu; các khoảng cách lớn (ví dụ 0/20 lên 17/20) thì không (xem [cách đánh giá VLA](danh-gia-vla.html)).

**Mang theo:** TA-VLA giữ lực ở dạng một dòng số. [TaF-VLA](taf-vla.html) thì căn ảnh xúc giác với lực trước khi chúng vào VLA.

**Câu hỏi kiểm tra:** với 5 khung lịch sử, mỗi khung 14 giá trị mô-men, và decoder π0 có 51 token, kích thước đầu vào của một token là bao nhiêu và số token decoder $N_1$ là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Kích thước đầu vào $5 \times 14 = 70$. $N_1 = 51 + 1 = 52$ token, bằng với trường hợp 10 khung: số khung chỉ đổi kích thước đầu vào của MLP, không đổi số token.
</details>
:::
