---
slug: contrastive-learning
date: 2026-10-21
title_en: "Contrastive Learning: Learning by Telling the Right Pair from the Wrong Ones"
title_vi: "Contrastive learning: Học bằng cách phân biệt cặp đúng với các cặp sai"
excerpt_en: "Classifiers learn a fixed list of labels. Contrastive learning only asks which caption goes with which image, using the rest of the batch as counter-examples. InfoNCE worked by hand, and where it shows up in VLAs: the SigLIP image encoder and TaF-VLA's touch–force alignment."
excerpt_vi: "Bộ phân loại học một danh sách nhãn cố định. Contrastive learning chỉ hỏi chú thích nào đi với ảnh nào, dùng phần còn lại của batch làm phản ví dụ. Tính tay InfoNCE, và nó xuất hiện ở đâu trong VLA: bộ mã hóa ảnh SigLIP và việc căn xúc giác với lực của TaF-VLA."
tags: [VLA, Foundations, Contrastive Learning, InfoNCE]
---

:::en
<div class="tldr" markdown="1">
**PAPERS** InfoNCE from Contrastive Predictive Coding, [arXiv 1807.03748](https://arxiv.org/abs/1807.03748) · 07/2018. CLIP, [arXiv 2103.00020](https://arxiv.org/abs/2103.00020) · 02/2021. SigLIP, [arXiv 2303.15343](https://arxiv.org/abs/2303.15343) · 03/2023

**PROBLEM** We want an image encoder (or a touch encoder) whose vectors mean something, without labelling millions of examples by hand.

**WHAT FAILED BEFORE** Supervised classifiers predict "a fixed set of predetermined object categories"; CLIP's authors note that this "restricted form of supervision limits their generality", because any new concept needs new labels.

**IDEA** Take pairs that belong together (an image and its caption, a touch image and the force measured at the same moment). Train two encoders so that each item is more similar to its own partner than to every other item in the batch.

**RESULT** CLIP learned from 400 million image–text pairs found on the internet and transfers to new tasks without labels. SigLIP replaces the batch softmax with one sigmoid per pair; it is the image encoder in PaliGemma and therefore in π0. TaF-VLA uses the same loss to align touch with force.
</div>

## 1. The problem: labels are a narrow teacher

[[flow]]
- Before~Classifier | Image > !Fixed label list~1,000 classes! > Class id | every new concept needs new labels
+ Contrastive | Image + its caption > *Match against the batch~pairs are the labels* > Shared vector space | any concept a caption can name
[[/flow]] The change is where supervision comes from: the pairing that already exists in the data.

## 2. How it works

[[fig:contrastive-learning]] Each row is an image, each column a caption. The diagonal holds the true pairs. InfoNCE asks the diagonal to win its row; SigLIP asks every cell for a yes or no.

| Block | Input | Output | Role |
|---|---|---|---|
| Two encoders | images; captions (or touch; force) | one vector each, length 1 | put both kinds into one space |
| Similarity matrix | $N$ image vectors, $N$ caption vectors | $N \times N$ cosine similarities | how well each image fits each caption |
| Temperature $\tau$ | similarities | logits $s/\tau$ | how sharply the loss separates pairs (learned in CLIP) |
| Loss | logits | scalar | InfoNCE: cross-entropy along each row (and column); SigLIP: binary loss per cell |

<div class="calc" markdown="1">
Calculation card

**What and why.** Compute the InfoNCE loss for one image in a batch of three, once when the right caption clearly wins and once when it barely wins.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $s_{11}$ | similarity of image 1 with its own caption | input | 0.9 (clear) or 0.5 (barely) |
| $s_{12},\ s_{13}$ | similarity with the two other captions | input | 0.3, 0.1 (clear) or 0.45, 0.1 (barely) |
| $\tau$ | temperature | constant | 0.1 (illustrative) |
| $L_1$ | loss for image 1 | output | – |

**Formula**

$$L_1 = -\log \frac{e^{s_{11}/\tau}}{\sum_{j} e^{s_{1j}/\tau}}$$

**Steps** (clear case)

1. Logits: $0.9/0.1 = 9$, $0.3/0.1 = 3$, $0.1/0.1 = 1$.
2. $e^9 = 8103.1$, $e^3 = 20.1$, $e^1 = 2.7$; sum $= 8125.9$.
3. Probability of the right caption $= 8103.1 / 8125.9 = 0.9972$; $L_1 = -\log 0.9972 = 0.0028$.

Barely case: logits 5, 4.5, 1; $e^5 = 148.4$, $e^{4.5} = 90.0$, $e^1 = 2.7$; probability $= 148.4 / 241.1 = 0.615$; $L_1 = 0.486$.

**Result.** 0.003 when the right caption clearly wins, 0.49 when it only just wins.

**Why it matters.** The loss is a classification over the batch: "which of these $N$ captions is mine?". It keeps pushing until the right partner stands out, so vectors end up meaning what captions describe. More items in the batch means more and harder counter-examples, which is why CLIP used batches of 32,768. SigLIP's per-cell sigmoid does not need the whole row at once, which makes large batches cheaper, and its paper reports better results at small batch sizes too.
</div>

## 3. In VLA

- **Image encoder:** PaliGemma, used by π0 and π0.5, builds on the SigLIP So400m encoder, trained contrastively on image–text pairs. A robot rarely trains this part from scratch ([ViT](vit.html)).
- **Touch meets force:** [TaF-VLA](taf-vla.html) pulls each tactile-image sequence toward the force code measured at the same moment with InfoNCE, so the touch encoder learns force, not texture.
- **Time:** CPC, where InfoNCE comes from, predicts the future in latent space; the same idea appears when a policy learns representations by predicting what comes next.

**Carry forward:** an encoder trained this way gives vectors a language model can relate to words. Joining the two into one model is a [VLM](vlm.html).

**Check question:** $\tau = 0.1$, $s_{11} = 0.8$, $s_{12} = 0.6$, $s_{13} = 0.0$. What is $L_1$?

<details markdown="1">
<summary>Answer</summary>

Logits 8, 6, 0. $e^8 = 2981.0$, $e^6 = 403.4$, $e^0 = 1$; sum $= 3385.4$. Probability $= 2981.0 / 3385.4 = 0.881$, so $L_1 = -\log 0.881 = 0.127$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** InfoNCE từ Contrastive Predictive Coding, [arXiv 1807.03748](https://arxiv.org/abs/1807.03748) · 07/2018. CLIP, [arXiv 2103.00020](https://arxiv.org/abs/2103.00020) · 02/2021. SigLIP, [arXiv 2303.15343](https://arxiv.org/abs/2303.15343) · 03/2023

**VẤN ĐỀ** Ta muốn một bộ mã hóa ảnh (hoặc mã hóa xúc giác) có vector mang ý nghĩa, mà không phải gán nhãn tay hàng triệu ví dụ.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Bộ phân loại có giám sát dự đoán "một tập cố định các loại vật định sẵn"; các tác giả CLIP nhận xét "dạng giám sát hạn hẹp này giới hạn tính tổng quát", vì mỗi khái niệm mới lại cần nhãn mới.

**Ý TƯỞNG** Lấy những cặp vốn đi cùng nhau (một ảnh và chú thích của nó, một ảnh xúc giác và lực đo cùng lúc). Huấn luyện hai bộ mã hóa sao cho mỗi phần tử giống bạn đồng hành của nó hơn giống mọi phần tử khác trong batch.

**KẾT QUẢ** CLIP học từ 400 triệu cặp ảnh–chữ trên internet và chuyển sang tác vụ mới mà không cần nhãn. SigLIP thay softmax trên cả batch bằng một sigmoid cho từng cặp; nó là bộ mã hóa ảnh trong PaliGemma và do đó trong π0. TaF-VLA dùng cùng hàm loss để căn xúc giác với lực.
</div>

## 1. Vấn đề: nhãn là một người thầy hẹp

[[flow]]
- Trước~Bộ phân loại | Ảnh > !Danh sách nhãn cố định~1.000 lớp! > Mã lớp | mỗi khái niệm mới cần nhãn mới
+ Contrastive | Ảnh + chú thích của nó > *So khớp với cả batch~chính các cặp là nhãn* > Không gian vector chung | mọi khái niệm mà một câu chú thích gọi tên được
[[/flow]] Thay đổi nằm ở nguồn giám sát: chính việc ghép cặp vốn đã có sẵn trong dữ liệu.

## 2. Cách hoạt động

[[fig:contrastive-learning]] Mỗi hàng là một ảnh, mỗi cột là một chú thích. Đường chéo chứa các cặp đúng. InfoNCE đòi đường chéo thắng cả hàng của nó; SigLIP hỏi từng ô một câu có hoặc không.

| Khối | Input | Output | Vai trò |
|---|---|---|---|
| Hai bộ mã hóa | ảnh; chú thích (hoặc xúc giác; lực) | mỗi thứ một vector, độ dài 1 | đưa cả hai loại vào một không gian |
| Ma trận tương đồng | $N$ vector ảnh, $N$ vector chú thích | $N \times N$ độ tương đồng cosine | mỗi ảnh hợp với mỗi chú thích tới đâu |
| Nhiệt độ $\tau$ | độ tương đồng | logit $s/\tau$ | loss tách các cặp sắc tới mức nào (CLIP học tham số này) |
| Loss | logit | một số | InfoNCE: cross-entropy theo mỗi hàng (và cột); SigLIP: loss nhị phân cho mỗi ô |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Tính loss InfoNCE cho một ảnh trong batch ba cặp, một lần khi chú thích đúng thắng rõ, một lần khi nó chỉ thắng sát nút.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $s_{11}$ | độ tương đồng giữa ảnh 1 và chú thích của nó | input | 0,9 (rõ) hoặc 0,5 (sát nút) |
| $s_{12},\ s_{13}$ | độ tương đồng với hai chú thích còn lại | input | 0,3; 0,1 (rõ) hoặc 0,45; 0,1 (sát nút) |
| $\tau$ | nhiệt độ | hằng số | 0,1 (minh họa) |
| $L_1$ | loss của ảnh 1 | output | – |

**Công thức**

$$L_1 = -\log \frac{e^{s_{11}/\tau}}{\sum_{j} e^{s_{1j}/\tau}}$$

**Từng bước** (trường hợp rõ)

1. Logit: $0{,}9/0{,}1 = 9$, $0{,}3/0{,}1 = 3$, $0{,}1/0{,}1 = 1$.
2. $e^9 = 8103{,}1$, $e^3 = 20{,}1$, $e^1 = 2{,}7$; tổng $= 8125{,}9$.
3. Xác suất của chú thích đúng $= 8103{,}1 / 8125{,}9 = 0{,}9972$; $L_1 = -\log 0{,}9972 = 0{,}0028$.

Trường hợp sát nút: logit 5; 4,5; 1; $e^5 = 148{,}4$, $e^{4{,}5} = 90{,}0$, $e^1 = 2{,}7$; xác suất $= 148{,}4 / 241{,}1 = 0{,}615$; $L_1 = 0{,}486$.

**Kết quả.** 0,003 khi chú thích đúng thắng rõ, 0,49 khi nó chỉ vừa thắng.

**Ý nghĩa.** Loss này là một bài phân loại trên batch: "trong $N$ chú thích này, cái nào là của mình?". Nó cứ đẩy cho tới khi bạn đồng hành đúng nổi bật hẳn, nên vector rốt cuộc mang ý nghĩa mà chú thích mô tả. Batch càng nhiều phần tử thì càng nhiều phản ví dụ và càng khó, vì thế CLIP dùng batch 32.768. Sigmoid theo từng ô của SigLIP không cần cả hàng cùng lúc, nên batch lớn rẻ hơn, và paper của nó báo cáo kết quả tốt hơn cả ở batch nhỏ.
</div>

## 3. Trong VLA

- **Bộ mã hóa ảnh:** PaliGemma, mà π0 và π0.5 dùng, xây trên bộ mã hóa SigLIP So400m, được huấn luyện contrastive trên các cặp ảnh–chữ. Robot hiếm khi huấn luyện phần này từ đầu ([ViT](vit.html)).
- **Xúc giác gặp lực:** [TaF-VLA](taf-vla.html) dùng InfoNCE kéo mỗi chuỗi ảnh xúc giác về phía mã lực đo cùng thời điểm, để bộ mã hóa xúc giác học lực chứ không học kết cấu bề mặt.
- **Thời gian:** CPC, nơi InfoNCE ra đời, dự đoán tương lai trong không gian latent; cùng ý tưởng xuất hiện khi một chính sách học biểu diễn bằng cách đoán điều sắp tới.

**Mang theo:** bộ mã hóa học theo cách này cho ra các vector mà mô hình ngôn ngữ liên hệ được với chữ. Ghép hai thứ đó thành một mô hình là [VLM](vlm.html).

**Câu kiểm tra:** $\tau = 0{,}1$, $s_{11} = 0{,}8$, $s_{12} = 0{,}6$, $s_{13} = 0{,}0$. $L_1$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

Logit 8; 6; 0. $e^8 = 2981{,}0$, $e^6 = 403{,}4$, $e^0 = 1$; tổng $= 3385{,}4$. Xác suất $= 2981{,}0 / 3385{,}4 = 0{,}881$, nên $L_1 = -\log 0{,}881 = 0{,}127$.
</details>
:::
