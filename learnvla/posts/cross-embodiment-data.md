---
slug: cross-embodiment-data
date: 2026-10-21
title_en: "Cross-Embodiment Data: Training One Policy on Many Robots"
title_vi: "Dữ liệu cross-embodiment: Huấn luyện một chính sách trên nhiều robot"
excerpt_en: "One lab's robot data is small; pooling data from many robots is large but messy: different arms, cameras, action sizes and rates. How Open X-Embodiment, π0 and GR00T make it one dataset, and π0's re-weighting of big and small datasets worked by hand."
excerpt_vi: "Dữ liệu robot của một phòng thí nghiệm thì ít; gộp dữ liệu từ nhiều robot thì nhiều nhưng lộn xộn: cánh tay, camera, kích thước hành động và tần số khác nhau. Cách Open X-Embodiment, π0 và GR00T biến nó thành một bộ dữ liệu, và tính tay cách π0 cân lại các bộ dữ liệu lớn nhỏ."
tags: [VLA, Foundations, Data, Cross-embodiment]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** Open X-Embodiment, [arXiv 2310.08864](https://arxiv.org/abs/2310.08864) · 10/2023. DROID, [arXiv 2403.12945](https://arxiv.org/abs/2403.12945) · 03/2024. Mixture recipe in [π0](pi0.html) · 10/2024

**PROBLEM** A VLA needs far more robot experience than one lab collects, but every robot has a different body: number of joints, gripper, cameras, control rate and action convention.

**WHAT FAILED BEFORE** In the Open X-Embodiment authors' words, robot learning methods "train a separate model for every application, every robot, and even every environment", so nothing learned on one robot helps another.

**IDEA** Put many robots' data into one standard format, make inputs and outputs the same size (pad, mask, or give each body its own small input and output layers), normalise each dataset, and re-weight the mixture so the largest datasets do not drown the rest.

**RESULT** Open X-Embodiment pooled 22 robots from 21 institutions, 527 skills (160,266 tasks); RT-1-X trained on the mix had a 50% higher mean success than the methods trained on each robot's own data. DROID adds 76k trajectories (350 hours) from 564 scenes. π0 pre-trains on its own 903M timesteps plus open data.
</div>

## 1. The problem: everyone's data is different

[[flow]]
- Before~One model per robot | Lab A data > !Model A only~knowledge does not transfer! > Robot A | small data, narrow skills
+ Cross-embodiment | Data from many robots > *Standard format~pad, normalise, re-weight* > One policy | positive transfer, then fine-tune
[[/flow]] The change is treating different robots as different *dialects* of one task language instead of different languages.

## 2. What has to be made the same

[[fig:cross-embodiment-data]] Format, size, scale and weight must be unified before one model can learn from all of them.

| Problem | What π0 and others do |
|---|---|
| Different action and state sizes (7 for a UR5e arm with gripper, 14 for two arms, 17 for a mobile base with two arms) | π0 makes every vector the size of its largest robot, 18, and zero-pads smaller ones. GR00T N1 instead gives each body its own small MLP into a shared space |
| Different numbers of cameras | π0 masks out the missing image slots |
| Different units and ranges | normalise each dimension with each dataset's statistics ([action spaces](action-spaces.html)) |
| Very different dataset sizes | π0 weights each task–robot combination by $n^{0.43}$, where $n$ is its number of samples |
| Different control rates (2–10 Hz in open datasets, up to 50 Hz in π0's own) | keep the rate per dataset; chunk length in time differs |

<div class="calc" markdown="1">
Calculation card

**What and why.** Two task–robot combinations, one with a million samples and one with ten thousand. Compare their share of training batches when sampled in proportion to size and with π0's $n^{0.43}$ weighting.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $n_A,\ n_B$ | samples in each combination | input | 1,000,000 and 10,000 |
| $w = n^{0.43}$ | π0's weight | derived | – |
| $s_A$ | share of batches from A | output | – |

**Formula**

$$s_A = \frac{w_A}{w_A + w_B}, \qquad w = n^{0.43}$$

**Steps**

1. Proportional sampling: $s_A = 1{,}000{,}000 / 1{,}010{,}000 = 99.0\%$; B gets 1.0%.
2. $w_A = (10^6)^{0.43} = 10^{2.58} = 380.2$; $w_B = (10^4)^{0.43} = 10^{1.72} = 52.5$.
3. $s_A = 380.2 / (380.2 + 52.5) = 87.9\%$; B gets 12.1%.

**Result.** The small dataset goes from 1% to 12% of training batches.

**Why it matters.** With proportional sampling a model barely sees the rare robot or task. An exponent below 1 compresses the sizes: 100× more data becomes about $100^{0.43} = 7.2$× more weight. An exponent of 0 would give every combination the same share and over-repeat tiny datasets; π0's 0.43 sits in between.
</div>

## 3. Where it helps, and where it does not

- **Positive transfer is real but uneven.** RT-1-X's 50% gain was measured on the smaller datasets of the mix; Open X-Embodiment also reports that large-data domains need high-capacity models to benefit.
- **It builds general skills, not your skill.** π0's recipe pre-trains on the mixture, then post-trains on 5 to over 100 hours for a hard task. Cross-embodiment pre-training is the starting point for fine-tuning ([backbone](backbone.html)), not a replacement.
- **Force data is still scarce.** Most pooled datasets record images, state and actions but no wrench. That is why force papers on this site collect their own (Facet-0's ManuFacet-1K, about 1,000 force-synchronised hours) or work without a sensor (FD-VLA, TA-VLA).

**Carry forward:** a big model trained on a big mixture is slow and may need sensors your robot lacks. Transferring what it learned into a smaller or sensor-free model is [distillation](distillation.html).

**Check question:** With π0's weighting, what share does a combination with 100,000 samples get against one with 1,000,000?

<details markdown="1">
<summary>Answer</summary>

$w = (10^5)^{0.43} = 10^{2.15} = 141.3$ against $380.2$; share $= 141.3 / (141.3 + 380.2) = 27.1\%$ (proportional sampling would give 9.1%).
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Open X-Embodiment, [arXiv 2310.08864](https://arxiv.org/abs/2310.08864) · 10/2023. DROID, [arXiv 2403.12945](https://arxiv.org/abs/2403.12945) · 03/2024. Công thức trộn dữ liệu trong [π0](pi0.html) · 10/2024

**VẤN ĐỀ** VLA cần lượng kinh nghiệm robot lớn hơn nhiều so với những gì một phòng thí nghiệm thu được, nhưng mỗi robot có một cơ thể khác: số khớp, tay kẹp, camera, tần số điều khiển và quy ước hành động.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Theo lời các tác giả Open X-Embodiment, các phương pháp học robot "huấn luyện một mô hình riêng cho mỗi ứng dụng, mỗi robot, thậm chí mỗi môi trường", nên điều học được trên robot này không giúp gì cho robot khác.

**Ý TƯỞNG** Đưa dữ liệu của nhiều robot về một định dạng chuẩn, làm đầu vào và đầu ra cùng kích thước (đệm, che, hoặc cho mỗi cơ thể lớp vào/ra nhỏ riêng), chuẩn hóa từng bộ dữ liệu, và cân lại tỉ lệ trộn để các bộ lớn nhất không nhấn chìm phần còn lại.

**KẾT QUẢ** Open X-Embodiment gộp 22 robot từ 21 cơ sở, 527 kỹ năng (160.266 tác vụ); RT-1-X huấn luyện trên hỗn hợp này có tỉ lệ thành công trung bình cao hơn 50% so với các phương pháp huấn luyện trên dữ liệu riêng của từng robot. DROID thêm 76 nghìn quỹ đạo (350 giờ) từ 564 khung cảnh. π0 pretrain trên 903 triệu bước thời gian của riêng họ cộng dữ liệu mở.
</div>

## 1. Vấn đề: dữ liệu của mỗi người một khác

[[flow]]
- Trước~Mỗi robot một mô hình | Dữ liệu phòng A > !Chỉ mô hình A~kiến thức không chuyển được! > Robot A | ít dữ liệu, kỹ năng hẹp
+ Cross-embodiment | Dữ liệu từ nhiều robot > *Định dạng chuẩn~đệm, chuẩn hóa, cân lại* > Một chính sách | chuyển giao tích cực, rồi fine-tune
[[/flow]] Thay đổi nằm ở việc coi các robot khác nhau là các *phương ngữ* của cùng một ngôn ngữ tác vụ, thay vì các ngôn ngữ khác nhau.

## 2. Những gì phải làm cho giống nhau

[[fig:cross-embodiment-data]] Định dạng, kích thước, thang đo và trọng số phải được thống nhất trước khi một mô hình học được từ tất cả.

| Vấn đề | π0 và các mô hình khác làm gì |
|---|---|
| Kích thước hành động và trạng thái khác nhau (7 cho một cánh tay UR5e có tay kẹp, 14 cho hai cánh tay, 17 cho đế di động có hai cánh tay) | π0 cho mọi vector có kích thước của robot lớn nhất, 18, và đệm số 0 cho robot nhỏ hơn. GR00T N1 thì cho mỗi cơ thể một MLP nhỏ riêng vào một không gian chung |
| Số camera khác nhau | π0 che các ô ảnh bị thiếu |
| Đơn vị và khoảng giá trị khác nhau | chuẩn hóa từng chiều bằng thống kê của từng bộ dữ liệu ([không gian hành động](action-spaces.html)) |
| Kích thước bộ dữ liệu chênh lệch lớn | π0 đánh trọng số mỗi tổ hợp tác vụ–robot bằng $n^{0{,}43}$, với $n$ là số mẫu của nó |
| Tần số điều khiển khác nhau (2–10 Hz ở dữ liệu mở, tới 50 Hz ở dữ liệu riêng của π0) | giữ tần số theo từng bộ dữ liệu; độ dài chunk tính theo thời gian sẽ khác nhau |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Hai tổ hợp tác vụ–robot, một có một triệu mẫu và một có mười nghìn. So sánh phần batch huấn luyện của chúng khi lấy mẫu theo tỉ lệ kích thước và khi dùng trọng số $n^{0{,}43}$ của π0.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $n_A,\ n_B$ | số mẫu của mỗi tổ hợp | input | 1.000.000 và 10.000 |
| $w = n^{0{,}43}$ | trọng số của π0 | suy ra | – |
| $s_A$ | phần batch lấy từ A | output | – |

**Công thức**

$$s_A = \frac{w_A}{w_A + w_B}, \qquad w = n^{0{,}43}$$

**Từng bước**

1. Lấy mẫu theo tỉ lệ: $s_A = 1.000.000 / 1.010.000 = 99{,}0\%$; B được 1,0%.
2. $w_A = (10^6)^{0{,}43} = 10^{2{,}58} = 380{,}2$; $w_B = (10^4)^{0{,}43} = 10^{1{,}72} = 52{,}5$.
3. $s_A = 380{,}2 / (380{,}2 + 52{,}5) = 87{,}9\%$; B được 12,1%.

**Kết quả.** Bộ dữ liệu nhỏ tăng từ 1% lên 12% số batch huấn luyện.

**Ý nghĩa.** Lấy mẫu theo tỉ lệ thì mô hình gần như không thấy robot hay tác vụ hiếm. Một số mũ nhỏ hơn 1 nén khoảng cách kích thước: nhiều dữ liệu hơn 100 lần chỉ thành nặng hơn khoảng $100^{0{,}43} = 7{,}2$ lần. Số mũ 0 sẽ cho mọi tổ hợp cùng một phần và lặp lại quá nhiều các bộ dữ liệu tí hon; 0,43 của π0 nằm ở giữa.
</div>

## 3. Nó giúp ở đâu, và không giúp ở đâu

- **Chuyển giao tích cực có thật nhưng không đều.** Mức tăng 50% của RT-1-X được đo trên các bộ dữ liệu nhỏ hơn trong hỗn hợp; Open X-Embodiment cũng báo cáo các miền nhiều dữ liệu cần mô hình dung lượng lớn mới hưởng lợi.
- **Nó xây kỹ năng chung, không phải kỹ năng của bạn.** Công thức của π0 pretrain trên hỗn hợp, rồi hậu huấn luyện với từ 5 tới hơn 100 giờ cho một tác vụ khó. Pretrain cross-embodiment là điểm xuất phát để fine-tune ([backbone](backbone.html)), không thay thế nó.
- **Dữ liệu lực vẫn khan hiếm.** Phần lớn bộ dữ liệu gộp ghi ảnh, trạng thái và hành động nhưng không có wrench. Đó là lý do các bài lực trên trang này tự thu dữ liệu (ManuFacet-1K của Facet-0, khoảng 1.000 giờ đồng bộ lực) hoặc làm việc không cần cảm biến (FD-VLA, TA-VLA).

**Mang theo:** một mô hình lớn học trên hỗn hợp lớn thì chậm và có thể cần những cảm biến mà robot của bạn không có. Chuyển những gì nó học được sang một mô hình nhỏ hơn hoặc không cần cảm biến là [distillation](distillation.html).

**Câu kiểm tra:** Với trọng số của π0, một tổ hợp có 100.000 mẫu chiếm bao nhiêu phần khi so với một tổ hợp có 1.000.000 mẫu?

<details markdown="1">
<summary>Đáp án</summary>

$w = (10^5)^{0{,}43} = 10^{2{,}15} = 141{,}3$ so với $380{,}2$; phần $= 141{,}3 / (141{,}3 + 380{,}2) = 27{,}1\%$ (lấy mẫu theo tỉ lệ sẽ cho 9,1%).
</details>
:::
