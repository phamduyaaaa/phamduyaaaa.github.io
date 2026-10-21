---
slug: vit
date: 2026-10-18
title_en: "ViT: When an Image Becomes Tokens"
title_vi: "ViT: Ảnh trở thành token"
excerpt_en: "A Transformer reads a sequence, an image is a grid, and one token per pixel is far too many. ViT cuts the image into patches, projects each one and adds a position vector. Worked by hand on a 4×4 image."
excerpt_vi: "Transformer đọc một dãy, ảnh là một lưới, và mỗi pixel một token thì quá nhiều. ViT cắt ảnh thành patch, chiếu từng patch và cộng một vector vị trí. Tính tay trên ảnh 4×4."
tags: [VLA, Foundations, ViT, Transformer]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Dosovitskiy et al., *An Image is Worth 16x16 Words*, [arXiv 2010.11929](https://arxiv.org/abs/2010.11929) · 10/2020

**PROBLEM** A Transformer reads a sequence of vectors; an image is a grid. One token per pixel of a 224×224 image gives 50,176 tokens and about 2.5 billion attention pairs per layer.

**WHAT FAILED BEFORE** Vision was ruled by convolutional networks (CNNs). Attention was used with them or to replace some of their parts, keeping the CNN structure. Applying attention to every pixel was too expensive.

**IDEA** Cut the image into patches, flatten each patch, project it linearly to a vector of size $d$, add a position vector, and feed the sequence to a standard Transformer.

**RESULT** Pre-trained on ImageNet-21k or JFT-300M, the best model reaches 88.55% on ImageNet. Trained on ImageNet alone, ViT ends a few points *below* ResNets of similar size. VLAs inherit pretrained ViT-style encoders, for example SigLIP in PaliGemma and π0.
</div>

## 1. The problem: a grid is not a sequence

[[flow]]
- Before~One token per pixel | 224×224 image > !50,176 tokens~2.5 billion pairs per layer! > Transformer | too expensive
- Before~CNN | Image > !Convolutions~locality built in! > Features | strong on small data, but a separate architecture from language
+ ViT | Image > *Patches + projection~256 tokens* > *+ position* > Transformer | the same machine as for text
[[/flow]] The change is the unit: a patch, not a pixel. A lone pixel means almost nothing, like a single letter.

## 2. The pipeline

[[fig:vit]] Cut, flatten, project, add position, then plain self-attention. In code, "cut and project" is one convolution whose kernel size and stride both equal the patch size.

| Step | Input | Output | Why |
|---|---|---|---|
| Cut into patches | $H \times W$ image | $N = (H/P)(W/P)$ patches of $P \times P$ | fewer, more meaningful pieces |
| Flatten | one $P \times P \times 3$ patch | vector of $3P^2$ numbers | a fixed order keeps pixel positions inside the patch |
| Linear projection $W_p$ | $3P^2$ numbers | vector of size $d$ | each column of $W_p$ is a learned template (edge, colour, texture) |
| Add position | patch vector | vector + $\mathrm{pos}_i$ | attention itself is blind to order |
| Transformer | $N$ vectors | $N$ contextual vectors | patches exchange information |

[[bars:tokens]] One token per pixel=50176; 16×16 patches (original ViT)=196; *14×14 patches (SigLIP, PaliGemma)=256* || Tokens for a 224×224 image. Patches cut the count by about 200×, and attention pairs by about 40,000×.

<div class="calc" markdown="1">
Calculation card

**What and why.** Follow one tiny image all the way to tokens: a 4×4 grayscale image, 2×2 patches, $d = 2$. It shows that projection is pattern matching and that the position vector is what tells the patches apart.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $p_A$ | patch A flattened row by row | input | $(1, 2, 3, 4)$ |
| $W_p$ | projection, $4 \times 2$ (toy values) | weights | columns $(1,0,1,0)$ and $(0,1,0,1)$ |
| $\mathrm{pos}_A,\ \mathrm{pos}_B$ | position vectors (toy values) | weights | $(0,0)$, $(1,0)$ |
| $z_A$ | patch embedding | output | – |
| $\tilde z_A$ | embedding with position | output | – |

The image (made-up numbers) and its four patches:

$$\begin{pmatrix} 1&2&5&6\\ 3&4&7&8\\ 9&0&3&2\\ 1&8&4&6 \end{pmatrix} \Rightarrow A=\begin{pmatrix}1&2\\3&4\end{pmatrix},\ B=\begin{pmatrix}5&6\\7&8\end{pmatrix},\ C=\begin{pmatrix}9&0\\1&8\end{pmatrix},\ D=\begin{pmatrix}3&2\\4&6\end{pmatrix}$$

**Formula**

$$z = p\,W_p, \qquad \tilde z_i = z_i + \mathrm{pos}_i$$

**Steps**

1. Flatten: $p_A = (1,2,3,4)$, $p_B = (5,6,7,8)$, $p_C = (9,0,1,8)$, $p_D = (3,2,4,6)$.
2. Project A: first column adds entries 1 and 3, second adds 2 and 4: $z_A = (1+3,\ 2+4) = (4, 6)$. Likewise $z_B = (12, 14)$, $z_C = (10, 8)$, $z_D = (7, 8)$.
3. Add position with $\mathrm{pos} = (0,0), (1,0), (0,1), (1,1)$ for A, B, C, D: $\tilde z_A = (4,6)$, $\tilde z_B = (13,14)$, $\tilde z_C = (10,9)$, $\tilde z_D = (8,9)$.

**Result.** Sixteen pixels became four tokens of size 2, and each token now carries both *what* (the projection) and *where* (the position).

**Why it matters.** Without step 3, swapping patches A and D would only swap two vectors in the set; attention, which treats its inputs as a set, would give the same answers. For a robot that must know whether the cup is left or right of the gripper, that is fatal. (The original ViT simply numbers the patches $0 \dots N-1$ and learns one vector per number; the toy uses column and row to make the idea visible.)
</div>

## 3. The price of having no built-in assumptions

A convolution assumes two things before seeing any data: nearby pixels belong together (locality), and a pattern means the same thing wherever it appears (weight sharing). ViT assumes neither; it has to learn them. That is why it trails ResNets when trained on ImageNet alone and overtakes them only with much more data. The paper's words: "large scale training trumps inductive bias".

For a VLA this has a practical consequence. Nobody trains the image encoder from robot data alone; it comes pretrained on hundreds of millions of image–text pairs ([contrastive learning](contrastive-learning.html)), and the robot data only adapts it.

## 4. In VLA

- PaliGemma, used by π0, encodes a 224×224 image with SigLIP So400m/14 into 256 tokens; with two or three cameras, images are most of the sequence.
- The [CLS] token that the original ViT adds for classification is usually dropped; all patch tokens go to the language model.
- Tactile images from gel sensors ([GelSight](gelsight.html)) are images too, so the same patch encoder can read them, as in TaF-VLA.

**Carry forward:** a ViT trained only to classify knows categories, not language. Encoders that a language model can talk to are trained by matching images with captions: [contrastive learning](contrastive-learning.html).

**Check question:** A 448×448 image is cut into 14×14 patches. How many tokens is that, and how many attention pairs per layer?

<details markdown="1">
<summary>Answer</summary>

$448 / 14 = 32$, so $32 \times 32 = 1024$ tokens and $1024^2 = 1{,}048{,}576$ pairs: four times the tokens of a 224×224 image, sixteen times the pairs.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Dosovitskiy và cộng sự, *An Image is Worth 16x16 Words*, [arXiv 2010.11929](https://arxiv.org/abs/2010.11929) · 10/2020

**VẤN ĐỀ** Transformer đọc một dãy vector; ảnh là một lưới. Mỗi pixel một token thì ảnh 224×224 thành 50.176 token và khoảng 2,5 tỉ cặp attention mỗi lớp.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Thị giác máy do mạng tích chập (CNN) thống trị. Attention được dùng kèm CNN hoặc thay một vài bộ phận của nó, vẫn giữ cấu trúc CNN. Áp attention lên từng pixel thì quá tốn.

**Ý TƯỞNG** Cắt ảnh thành patch, duỗi phẳng từng patch, chiếu tuyến tính thành vector cỡ $d$, cộng một vector vị trí, rồi đưa cả dãy vào một Transformer bình thường.

**KẾT QUẢ** Pretrain trên ImageNet-21k hoặc JFT-300M, mô hình tốt nhất đạt 88,55% trên ImageNet. Chỉ huấn luyện trên ImageNet thì ViT kém ResNet cùng cỡ vài điểm. VLA thừa hưởng các bộ mã hóa kiểu ViT đã pretrain, ví dụ SigLIP trong PaliGemma và π0.
</div>

## 1. Vấn đề: lưới không phải là dãy

[[flow]]
- Trước~Mỗi pixel một token | Ảnh 224×224 > !50.176 token~2,5 tỉ cặp mỗi lớp! > Transformer | quá tốn
- Trước~CNN | Ảnh > !Tích chập~tính cục bộ cài sẵn! > Đặc trưng | mạnh khi ít dữ liệu, nhưng là kiến trúc tách biệt với ngôn ngữ
+ ViT | Ảnh > *Patch + phép chiếu~256 token* > *+ vị trí* > Transformer | cùng một cỗ máy như với chữ
[[/flow]] Thay đổi nằm ở đơn vị: một patch chứ không phải một pixel. Một pixel đứng riêng gần như không nói gì, như một chữ cái đứng một mình.

## 2. Quy trình

[[fig:vit]] Cắt, duỗi phẳng, chiếu, cộng vị trí, rồi self-attention bình thường. Trong code, "cắt và chiếu" là một phép tích chập có kích thước kernel và bước nhảy đều bằng cỡ patch.

| Bước | Input | Output | Vì sao |
|---|---|---|---|
| Cắt patch | ảnh $H \times W$ | $N = (H/P)(W/P)$ patch cỡ $P \times P$ | ít mảnh hơn, mỗi mảnh có nghĩa hơn |
| Duỗi phẳng | một patch $P \times P \times 3$ | vector $3P^2$ số | thứ tự cố định giữ vị trí pixel bên trong patch |
| Chiếu tuyến tính $W_p$ | $3P^2$ số | vector cỡ $d$ | mỗi cột của $W_p$ là một khuôn mẫu học được (cạnh, màu, kết cấu) |
| Cộng vị trí | vector patch | vector + $\mathrm{pos}_i$ | bản thân attention không biết thứ tự |
| Transformer | $N$ vector | $N$ vector có ngữ cảnh | các patch trao đổi thông tin |

[[bars:token]] Mỗi pixel một token=50176; Patch 16×16 (ViT gốc)=196; *Patch 14×14 (SigLIP, PaliGemma)=256* || Số token của ảnh 224×224. Patch giảm số token khoảng 200 lần và số cặp attention khoảng 40.000 lần.

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Đi theo một ảnh tí hon tới tận token: ảnh xám 4×4, patch 2×2, $d = 2$. Phép tính cho thấy phép chiếu là so khớp khuôn mẫu, và vector vị trí là thứ giúp phân biệt các patch.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $p_A$ | patch A duỗi phẳng theo hàng | input | $(1, 2, 3, 4)$ |
| $W_p$ | phép chiếu $4 \times 2$ (giá trị minh họa) | trọng số | các cột $(1,0,1,0)$ và $(0,1,0,1)$ |
| $\mathrm{pos}_A,\ \mathrm{pos}_B$ | vector vị trí (giá trị minh họa) | trọng số | $(0,0)$, $(1,0)$ |
| $z_A$ | embedding của patch | output | – |
| $\tilde z_A$ | embedding có vị trí | output | – |

Ảnh (số bịa để minh họa) và bốn patch của nó:

$$\begin{pmatrix} 1&2&5&6\\ 3&4&7&8\\ 9&0&3&2\\ 1&8&4&6 \end{pmatrix} \Rightarrow A=\begin{pmatrix}1&2\\3&4\end{pmatrix},\ B=\begin{pmatrix}5&6\\7&8\end{pmatrix},\ C=\begin{pmatrix}9&0\\1&8\end{pmatrix},\ D=\begin{pmatrix}3&2\\4&6\end{pmatrix}$$

**Công thức**

$$z = p\,W_p, \qquad \tilde z_i = z_i + \mathrm{pos}_i$$

**Từng bước**

1. Duỗi phẳng: $p_A = (1,2,3,4)$, $p_B = (5,6,7,8)$, $p_C = (9,0,1,8)$, $p_D = (3,2,4,6)$.
2. Chiếu A: cột thứ nhất cộng phần tử 1 và 3, cột thứ hai cộng 2 và 4: $z_A = (1+3,\ 2+4) = (4, 6)$. Tương tự $z_B = (12, 14)$, $z_C = (10, 8)$, $z_D = (7, 8)$.
3. Cộng vị trí với $\mathrm{pos} = (0,0), (1,0), (0,1), (1,1)$ cho A, B, C, D: $\tilde z_A = (4,6)$, $\tilde z_B = (13,14)$, $\tilde z_C = (10,9)$, $\tilde z_D = (8,9)$.

**Kết quả.** Mười sáu pixel thành bốn token cỡ 2, và mỗi token giờ mang cả *cái gì* (phép chiếu) lẫn *ở đâu* (vị trí).

**Ý nghĩa.** Không có bước 3, đổi chỗ patch A và D chỉ làm đổi chỗ hai vector trong tập; attention, vốn xử lý đầu vào như một tập hợp, sẽ cho cùng câu trả lời. Với robot cần biết cái cốc nằm bên trái hay bên phải tay kẹp, đó là lỗi chết người. (ViT gốc chỉ đánh số các patch $0 \dots N-1$ và học một vector cho mỗi số; ví dụ tí hon dùng cột và hàng để thấy rõ ý tưởng.)
</div>

## 3. Cái giá của việc không giả định gì sẵn

Một phép tích chập giả định hai điều trước khi thấy dữ liệu: các pixel gần nhau thuộc về nhau (tính cục bộ), và một hoa văn có cùng ý nghĩa dù xuất hiện ở đâu (chia sẻ trọng số). ViT không giả định điều nào; nó phải tự học. Vì thế nó thua ResNet khi chỉ huấn luyện trên ImageNet và chỉ vượt lên khi có nhiều dữ liệu hơn hẳn. Lời của paper: "huấn luyện quy mô lớn thắng thiên kiến quy nạp".

Với VLA, điều này có hệ quả thực tế. Không ai huấn luyện bộ mã hóa ảnh chỉ bằng dữ liệu robot; nó được pretrain sẵn trên hàng trăm triệu cặp ảnh–chú thích ([contrastive learning](contrastive-learning.html)), và dữ liệu robot chỉ để thích nghi nó.

## 4. Trong VLA

- PaliGemma, mà π0 dùng, mã hóa ảnh 224×224 bằng SigLIP So400m/14 thành 256 token; với hai hoặc ba camera, ảnh chiếm phần lớn dãy.
- Token [CLS] mà ViT gốc thêm để phân loại thường bị bỏ; mọi token patch đều được đưa vào mô hình ngôn ngữ.
- Ảnh xúc giác từ cảm biến gel ([GelSight](gelsight.html)) cũng là ảnh, nên cùng bộ mã hóa patch đọc được chúng, như trong TaF-VLA.

**Mang theo:** một ViT chỉ học phân loại thì biết các lớp đồ vật chứ không biết ngôn ngữ. Bộ mã hóa mà mô hình ngôn ngữ "nói chuyện" được thì được huấn luyện bằng cách ghép ảnh với chú thích: [contrastive learning](contrastive-learning.html).

**Câu kiểm tra:** Ảnh 448×448 cắt thành patch 14×14. Được bao nhiêu token, và bao nhiêu cặp attention mỗi lớp?

<details markdown="1">
<summary>Đáp án</summary>

$448 / 14 = 32$, nên $32 \times 32 = 1024$ token và $1024^2 = 1{.}048{.}576$ cặp: gấp bốn lần số token của ảnh 224×224, gấp mười sáu lần số cặp.
</details>
:::
