---
slug: tabero
date: 2026-10-18
title_en: "Tabero: Gentle Manipulation with Closed-Loop Force Feedback"
title_vi: "Tabero: Thao tác nhẹ tay với phản hồi lực vòng kín"
excerpt_en: "Told 'gently', a position-only VLA cannot squeeze less. Tabero replays LIBERO in a tactile simulator to get force data, and its VTLA outputs pose plus force targets for a fixed hybrid controller: 89% less grip force when asked."
excerpt_vi: "Được bảo 'nhẹ tay', VLA chỉ điều khiển vị trí không biết siết nhẹ hơn. Tabero phát lại LIBERO trong mô phỏng xúc giác để có dữ liệu lực, và VTLA của nó xuất pose cùng lực mục tiêu cho bộ điều khiển lai cố định: lực kẹp giảm 89% khi được yêu cầu."
tags: [VLA, Force, Tactile, Benchmark, Paper Notes, π0]
---

:::en
<div class="tldr" markdown="1">
**PAPER** [arXiv 2605.27886](https://arxiv.org/abs/2605.27886) · 05/2026 · ICML 2026 · built on π0 · [code](https://github.com/NathanWu7/Tabero)

**PROBLEM** "Pick up the egg *gently*" should change the force. Benchmarks such as LIBERO have no touch or force data, and policies trained on them "frequently damage objects" (Fig. 1).

**WHAT FAILED BEFORE** A position-only VLA closes the gripper to a width, so the squeeze depends on the object, not the word: 0% success. With tactile tokens but no force supervision, gentle runs collapse to 1%.

**IDEA** (1) Replay LIBERO trajectories in Isaac Lab with a simulated GelSight to get vision + touch + force data cheaply. (2) Tabero-VTLA predicts pose **plus** grip and applied force targets; (3) a fixed hybrid controller tracks them.

**RESULT** On Dataset B the best model keeps 52% success when told "gently" while cutting average grip force from 32.4 to 3.7 (−89%).
</div>

## 1. The problem: "gently" has no handle

[[flow]]
- Before~position-only VLA | RGB + "gently" > VLA > !Gripper width only! | squeeze set by the object: 0% success
- Before~touch, no force label | RGB + tactile tokens > VLA > !Pose only! | gentle runs collapse: 1% success
+ Tabero-VTLA | RGB + marker field + force > π0 + force supervision > *Pose + grip~+ applied force* > *Hybrid controller* | gentle grip, 52% success, −89% force
[[/flow]] Two missing pieces: force in the data, and force in the output.

[[bars:%]] No touch, no force=0; Touch tokens only=1; Force supervision only=45; *Marker field + force supervision=52* || Success under the gentle instruction, Dataset B (10% force level).

## 2. Architecture

[[fig:tabero]] Vision, language, marker-field and force tokens enter a LoRA-tuned π0; it predicts pose and force targets; a fixed hybrid controller tracks them.

| Block | Input | Output | Role |
|---|---|---|---|
| Force-Field tokenizer (TCN) | marker displacement, 8 past frames + rest frame | tactile tokens | touch → tokens |
| Force tokenizer (MLP) | fingertip forces $F_L, F_R$ | force latent | force → tokens |
| π0 + LoRA | images, language, the tokens above | $P^{pred}$, $F^{target}_{applied}$, $F^{pred}_{grip}$, width | pose and force targets |
| Applied-force loop | target vs measured applied force | corrected pose → IK | admittance control |
| Grip loop | predicted grip force | gripper width | feedforward + deadzone |

## 3. Work it by hand: two forces from two fingertips

<div class="calc" markdown="1">
Calculation card

**What and why.** The controller needs two separate numbers: how hard the gripper *squeezes* and how hard it *pushes* the object. Tabero derives both from the two fingertip force vectors. This split is what lets a policy ask for a gentle squeeze and a firm press at once.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $F_L, F_R$ | fingertip forces in one gripper frame ($z$ = closing axis, $y$ = up) | input | $(0, 1.5, 5)$, $(0, 1.5, -5)$ N |
| $F_{grip}$ | squeeze force | output | – |
| $F_{applied}$ | net force the gripper puts on the object | output | – |
| $k_{ff}$ | feedforward gain of the grip loop | constant | 0.6 (paper) |

**Formula**

$$F_{grip} = 2\min\left(|F_{L,z}|,\ |F_{R,z}|\right), \qquad F_{applied} = -(F_L + F_R), \qquad F^{target}_{grip} = (1 + k_{ff})\,F^{pred}_{grip}$$

**Steps**

1. $F_{grip} = 2 \times \min(5, 5) = 10$ N.
2. $F_L + F_R = (0,\ 3,\ 0)$, so $F_{applied} = (0,\ -3,\ 0)$ N: a 3 N push downward.
3. If the policy predicts a grip of 5 N, the loop targets $(1 + 0.6) \times 5 = 8$ N.

**Result.** Squeeze 10 N, push 3 N down; the squeeze components cancel in $F_{applied}$.

**Why it matters.** Taking the **smaller** finger makes $F_{grip}$ follow the weaker contact (5 N and 3 N give 6 N), which is the one that slips first.
</div>

## 4. The benchmark pipeline

| Step | What |
|---|---|
| Replay | LIBERO trajectories (MuJoCo) re-run in Isaac Lab with matched assets and poses |
| Sensors | simulated GelSight (Taxim images, FOTS marker field), physics ground-truth force, 20 Hz |
| Force levels | impedance gains for 100%, 25%, 10% force, paired with "firmly" / "gently" |
| Metrics | success, average and peak grip force, average and peak applied force |

## 5. Caveats

- Checked against the full text: data in the simulator are sampled at 20 Hz. Policy and controller rates and the run-time chunk length are not stated.
- The text says the force input is 6D; Table 7 lists an MLP input of 48.

**Carry forward:** every method so far needs a tactile or force sensor at run time. [FD-VLA](fd-vla.html) asks whether force can be inferred from vision and arm state instead.

**Check question:** $F_L = (0,\ 1,\ 4)$ N, $F_R = (0,\ 2,\ -6)$ N. Compute $F_{grip}$ and $F_{applied}$.

<details markdown="1">
<summary>Answer</summary>

$F_{grip} = 2\min(4, 6) = 8$ N. $F_{applied} = -(0, 3, -2) = (0, -3, 2)$ N: 3 N down, plus 2 N along the closing axis because the squeeze is uneven.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** [arXiv 2605.27886](https://arxiv.org/abs/2605.27886) · 05/2026 · ICML 2026 · nền π0 · [code](https://github.com/NathanWu7/Tabero)

**VẤN ĐỀ** "Nhặt quả trứng *nhẹ tay*" phải làm thay đổi lực. Các benchmark như LIBERO không có dữ liệu xúc giác hay lực, và chính sách học từ đó "thường làm hỏng vật" (Fig. 1).

**PAPER TRƯỚC HỎNG Ở ĐÂU** VLA chỉ điều khiển vị trí đóng kẹp tới một độ mở, nên lực siết do vật quyết định chứ không do chữ: thành công 0%. Có token xúc giác nhưng không giám sát lực thì lượt "nhẹ tay" sụp còn 1%.

**Ý TƯỞNG** (1) Phát lại quỹ đạo LIBERO trong Isaac Lab với GelSight mô phỏng để có dữ liệu thị giác + xúc giác + lực với chi phí thấp. (2) Tabero-VTLA dự đoán pose **cộng** lực kẹp và lực tác dụng mục tiêu; (3) một bộ điều khiển lai cố định bám theo.

**KẾT QUẢ** Trên Dataset B, mô hình tốt nhất giữ 52% thành công khi được bảo "nhẹ tay", đồng thời lực kẹp trung bình giảm từ 32,4 xuống 3,7 (−89%).
</div>

## 1. Vấn đề: "nhẹ tay" không có chỗ bám

[[flow]]
- Trước~VLA chỉ vị trí | RGB + "gently" > VLA > !Chỉ độ mở kẹp! | lực siết do vật quyết định: 0% thành công
- Trước~xúc giác, không nhãn lực | RGB + token xúc giác > VLA > !Chỉ pose! | lượt nhẹ tay sụp: 1% thành công
+ Tabero-VTLA | RGB + trường marker + lực > π0 + giám sát lực > *Pose + lực kẹp~+ lực tác dụng* > *Bộ điều khiển lai* | siết nhẹ, 52% thành công, lực −89%
[[/flow]] Hai mảnh còn thiếu: lực trong dữ liệu, và lực trong đầu ra.

[[bars:%]] Không xúc giác, không lực=0; Chỉ token xúc giác=1; Chỉ giám sát lực=45; *Trường marker + giám sát lực=52* || Thành công khi bảo "nhẹ tay", Dataset B (mức lực 10%).

## 2. Kiến trúc

[[fig:tabero]] Token thị giác, ngôn ngữ, trường marker và lực vào π0 tinh chỉnh LoRA; mô hình dự đoán pose và lực mục tiêu; bộ điều khiển lai cố định bám theo.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Force-Field tokenizer (TCN) | dịch chuyển marker, 8 khung trước + khung nghỉ | token xúc giác | xúc giác → token |
| Force tokenizer (MLP) | lực đầu ngón $F_L, F_R$ | latent lực | lực → token |
| π0 + LoRA | ảnh, ngôn ngữ, các token trên | $P^{pred}$, $F^{target}_{applied}$, $F^{pred}_{grip}$, độ mở | pose và lực mục tiêu |
| Vòng lực tác dụng | lực tác dụng mục tiêu và đo được | pose đã chỉnh → IK | điều khiển admittance |
| Vòng kẹp | lực kẹp dự đoán | độ mở kẹp | feedforward + vùng chết |

## 3. Tính tay: hai lực từ hai đầu ngón

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Bộ điều khiển cần hai con số riêng: kẹp đang *siết* mạnh đến đâu và đang *đẩy* vật mạnh đến đâu. Tabero suy ra cả hai từ hai vector lực đầu ngón. Việc tách này cho phép chính sách đòi siết nhẹ và ấn mạnh cùng lúc.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $F_L, F_R$ | lực đầu ngón trong một khung chung của kẹp ($z$ = trục đóng kẹp, $y$ = hướng lên) | input | $(0, 1.5, 5)$, $(0, 1.5, -5)$ N |
| $F_{grip}$ | lực siết | output | – |
| $F_{applied}$ | lực tổng kẹp tác dụng lên vật | output | – |
| $k_{ff}$ | hệ số feedforward của vòng kẹp | hằng số | 0.6 (của bài) |

**Công thức**

$$F_{grip} = 2\min\left(|F_{L,z}|,\ |F_{R,z}|\right), \qquad F_{applied} = -(F_L + F_R), \qquad F^{target}_{grip} = (1 + k_{ff})\,F^{pred}_{grip}$$

**Từng bước**

1. $F_{grip} = 2 \times \min(5, 5) = 10$ N.
2. $F_L + F_R = (0,\ 3,\ 0)$, nên $F_{applied} = (0,\ -3,\ 0)$ N: đẩy xuống 3 N.
3. Nếu chính sách dự đoán lực kẹp 5 N, vòng kẹp nhắm tới $(1 + 0.6) \times 5 = 8$ N.

**Kết quả.** Siết 10 N, đẩy xuống 3 N; hai thành phần siết triệt tiêu nhau trong $F_{applied}$.

**Ý nghĩa.** Lấy ngón **nhỏ hơn** khiến $F_{grip}$ bám theo tiếp xúc yếu hơn (5 N và 3 N cho 6 N), tức ngón sẽ trượt trước.
</div>

## 4. Pipeline benchmark

| Bước | Nội dung |
|---|---|
| Phát lại | quỹ đạo LIBERO (MuJoCo) chạy lại trong Isaac Lab với asset và tư thế khớp |
| Cảm biến | GelSight mô phỏng (ảnh Taxim, trường marker FOTS), lực chuẩn từ vật lý, 20 Hz |
| Mức lực | hệ số impedance cho lực 100%, 25%, 10%, đi kèm "firmly" / "gently" |
| Chỉ số | thành công, lực kẹp trung bình và đỉnh, lực tác dụng trung bình và đỉnh |

## 5. Lưu ý

- Đã đối chiếu với toàn văn: dữ liệu trong mô phỏng lấy mẫu ở 20 Hz. Tần số chính sách, tần số bộ điều khiển và độ dài chunk lúc chạy không được nêu.
- Văn bản nói lực đầu vào là 6D; Bảng 7 ghi đầu vào MLP là 48.

**Mang sang bài sau:** mọi phương pháp tới đây đều cần cảm biến xúc giác hoặc lực lúc chạy. [FD-VLA](fd-vla.html) hỏi: có suy ra được lực từ thị giác và state của cánh tay không?

**Câu kiểm tra:** $F_L = (0,\ 1,\ 4)$ N, $F_R = (0,\ 2,\ -6)$ N. Tính $F_{grip}$ và $F_{applied}$.

<details markdown="1">
<summary>Đáp án</summary>

$F_{grip} = 2\min(4, 6) = 8$ N. $F_{applied} = -(0, 3, -2) = (0, -3, 2)$ N: đẩy xuống 3 N, cộng 2 N dọc trục đóng kẹp vì siết không đều.
</details>
:::
