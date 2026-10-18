---
slug: vit
date: 2026-10-18
title_en: "ViT: When an Image Becomes Tokens"
title_vi: "ViT: Ảnh trở thành token"
excerpt_en: "How a Transformer, which eats a sequence of vectors, can read an image grid: patches, flattening, linear projection and position embeddings, worked by hand on a 4×4 image."
excerpt_vi: Transformer ăn một dãy vector, còn ảnh là một lưới số. Cắt patch, duỗi phẳng, chiếu tuyến tính và cộng mã vị trí, tính tay trên ảnh 4×4.
tags: [VLA, Foundations, ViT, Transformer]
---

:::en
## The pain to cure

A Transformer eats a sequence of vectors. An image is a grid of numbers. How do we turn the grid into a sequence without losing anything important?

## Step 1: The naive try, one token per pixel

A $4 \times 4$ grayscale image has 16 pixels, so 16 tokens. That sounds fine. But attention compares every pair of tokens, so it costs $N^2$.

| Image size | Tokens (one per pixel) | Pairs $N^2$ |
|---|---|---|
| $4 \times 4$ | 16 | 256 |
| $224 \times 224$ | 50,176 | $\approx 2.5 \times 10^9$ |

Every layer and every head would have to compute that many pairs: not feasible. Also, a lone pixel means almost nothing, like a single letter standing by itself.

## Step 2: Group pixels into patches (the ViT idea, 2020)

Cut the image into square cells and treat each cell as a "word". For a $4 \times 4$ image with $2 \times 2$ patches:

$$
\begin{pmatrix} 1&2&5&6\\ 3&4&7&8\\ 9&0&3&2\\ 1&8&4&6 \end{pmatrix}
\Rightarrow
\underbrace{\begin{pmatrix}1&2\\3&4\end{pmatrix}}_{A}\;
\underbrace{\begin{pmatrix}5&6\\7&8\end{pmatrix}}_{B}\;
\underbrace{\begin{pmatrix}9&0\\1&8\end{pmatrix}}_{C}\;
\underbrace{\begin{pmatrix}3&2\\4&6\end{pmatrix}}_{D}
$$

(The numbers are made up for illustration.) 16 tokens become 4, and the number of pairs drops from 256 to 16. For a real $224 \times 224$ image with $14 \times 14$ patches, we get 256 tokens.

## Step 3: Flatten (reshape)

Each $2 \times 2$ patch is read row by row into a 4-dimensional vector:

$$
p_A=(1,2,3,4),\; p_B=(5,6,7,8),\; p_C=(9,0,1,8),\; p_D=(3,2,4,6)
$$

This only rearranges the numbers and loses no information: the position of a pixel inside the patch is kept by the fixed order of the 4 coordinates.

## Step 4: Linear projection to an embedding vector

Each token needs a dimension $d$ that we choose (here $d=2$). We use a learned matrix $W_p$ of size $4 \times 2$:

$$
z = p\,W_p
$$

Pick a toy $W_p = \begin{pmatrix}1&0\\0&1\\1&0\\0&1\end{pmatrix}$. For patch A:

$$
z_A = (1,2,3,4)\,W_p = (1+3,\; 2+4) = (4,\,6)
$$

Likewise $z_B=(12,14)$, $z_C=(10,8)$, $z_D=(7,8)$.

**Meaning:** each column of $W_p$ is a $2\times 2$ "template", and $z$ is how well the patch matches each template (a dot product). This is pattern matching: $W_p$ learns filters for edges, colour and texture. It resembles the lookup $E$ that turns a word into a vector, except that patches have no dictionary (there are endlessly many possible patches), so we use a projection instead of a table lookup. And $W_p$ is learned by gradient like any other matrix.

## Step 5: The big problem, attention is blind to order

Recall the remaining weakness from the attention stage: shuffle the tokens and the output is just shuffled the same way. For images, that means the original image and one cut into 4 pieces and randomly reordered give the same set of representations. The model does not know that "A is in the top-left corner".

For a robot this is a disaster, because the core task is where things are.

## Step 6: Add position embeddings

Give each position a vector $\mathrm{pos}_i$ (learned, also randomly initialised then trained) and add it to the token:

$$
\tilde z_i = z_i + \mathrm{pos}_i
$$

Toy example: $\mathrm{pos}_A=(0,0)$, $\mathrm{pos}_B=(1,0)$, $\mathrm{pos}_C=(0,1)$, $\mathrm{pos}_D=(1,1)$ (column, row). Then:

$$
\tilde z_A=(4,6),\quad \tilde z_B=(13,14),\quad \tilde z_C=(10,9),\quad \tilde z_D=(8,9)
$$

Now each token carries both content (what the patch looks like) and coordinates (where it is). Permuting tokens changes the result, because each token is already labelled with its position.

## Step 7: From here on it is pure Transformer

The four vectors $\tilde z_A,\dots,\tilde z_D$ enter exactly the attention mechanism: $q,k,v$, softmax, mixing. Image tokens look at each other just like text tokens. A "cup handle" patch pulls in information from the surrounding patches to become the representation of "cup".

## Summary of the flow

$$
\text{image (grid)} \xrightarrow{\text{cut}} \text{patches} \xrightarrow{\text{flatten}} p_i \xrightarrow{W_p} z_i \xrightarrow{+\mathrm{pos}} \tilde z_i \xrightarrow{\text{attention}} \text{contextual tokens}
$$

Carry forward: the image is now continuous tokens used only as **input**, and nothing has to be generated. Actions are different: the robot must produce them. That tension is what the next stage resolves (see [Tokenizer & Action Tokenization](action-tokenization.html)).

**Check question:** if we drop step 6 (no pos), which two images give the same set of representations, and what trouble does the robot get into?

*Answer:* the original image and a version cut into patches and shuffled (for example a cup on the left versus on the right) give the same set of representations. The robot cannot tell whether an object is to the left or right of its hand, so it does not know which way to move.
:::

:::vi
## Cái đau cần chữa

Transformer ăn một dãy vector. Ảnh lại là một lưới số. Làm sao biến lưới thành dãy mà không mất thứ gì quan trọng?

## Bước 1: Thử cách ngây thơ nhất, mỗi pixel một token

Ảnh $4 \times 4$ thang xám có 16 pixel, tức 16 token. Nghe ổn. Nhưng attention so mọi cặp token, nên tốn $N^2$.

| Kích thước ảnh | Số token (mỗi pixel) | Số cặp $N^2$ |
|---|---|---|
| $4 \times 4$ | 16 | 256 |
| $224 \times 224$ | 50,176 | $\approx 2.5 \times 10^9$ |

Mỗi lớp, mỗi head đều phải tính chừng đó cặp: không khả thi. Thêm nữa, một pixel đơn lẻ gần như vô nghĩa, như một chữ cái đứng riêng.

## Bước 2: Gom pixel thành patch (ý tưởng của ViT, 2020)

Chia ảnh thành các ô vuông, mỗi ô là một "từ". Với ảnh $4 \times 4$ và patch $2 \times 2$:

$$
\begin{pmatrix} 1&2&5&6\\ 3&4&7&8\\ 9&0&3&2\\ 1&8&4&6 \end{pmatrix}
\Rightarrow
\underbrace{\begin{pmatrix}1&2\\3&4\end{pmatrix}}_{A}\;
\underbrace{\begin{pmatrix}5&6\\7&8\end{pmatrix}}_{B}\;
\underbrace{\begin{pmatrix}9&0\\1&8\end{pmatrix}}_{C}\;
\underbrace{\begin{pmatrix}3&2\\4&6\end{pmatrix}}_{D}
$$

(Số bịa để minh họa.) Từ 16 token còn 4 token, và số cặp giảm từ 256 xuống 16. Với ảnh thật $224 \times 224$, patch $14 \times 14$ cho 256 token.

## Bước 3: Duỗi phẳng (reshape)

Mỗi patch $2 \times 2$ đọc theo hàng thành vector 4 chiều:

$$
p_A=(1,2,3,4),\; p_B=(5,6,7,8),\; p_C=(9,0,1,8),\; p_D=(3,2,4,6)
$$

Đây chỉ là sắp lại các con số, không mất thông tin gì: vị trí pixel trong patch được giữ bởi thứ tự cố định của 4 tọa độ.

## Bước 4: Chiếu tuyến tính thành vector embedding

Ta cần mỗi token có số chiều $d$ do ta chọn (ở đây $d=2$). Dùng ma trận học được $W_p$ cỡ $4 \times 2$:

$$
z = p\,W_p
$$

Chọn đồ chơi $W_p = \begin{pmatrix}1&0\\0&1\\1&0\\0&1\end{pmatrix}$. Khi đó với patch A:

$$
z_A = (1,2,3,4)\,W_p = (1+3,\; 2+4) = (4,\,6)
$$

Tương tự $z_B=(12,14)$, $z_C=(10,8)$, $z_D=(7,8)$.

**Ý nghĩa:** mỗi cột của $W_p$ là một "mẫu" cỡ $2\times 2$, và $z$ chính là độ khớp của patch với từng mẫu (tích vô hướng). Đây là so khớp mẫu: $W_p$ học ra các bộ lọc cạnh, màu, kết cấu. Nó giống phép tra bảng $E$ biến từ thành vector, chỉ khác là patch không có từ điển (vô số patch có thể có), nên ta dùng phép chiếu thay cho tra bảng. Đồng thời $W_p$ cũng học bằng gradient như mọi ma trận khác.

## Bước 5: Vấn đề lớn, attention mù thứ tự

Nhớ lại điểm yếu còn lại từ chặng attention: tráo các token thì kết quả chỉ tráo theo. Với ảnh, nghĩa là ảnh gốc và ảnh bị cắt 4 mảnh rồi xáo ngẫu nhiên cho ra cùng một tập biểu diễn. Mô hình không biết "A ở góc trên trái".

Với robot đây là thảm họa, vì nhiệm vụ cốt lõi là vật ở đâu.

## Bước 6: Cộng mã vị trí

Cho mỗi vị trí một vector $\mathrm{pos}_i$ (học được, cũng khởi tạo ngẫu nhiên rồi học) và cộng vào token:

$$
\tilde z_i = z_i + \mathrm{pos}_i
$$

Ví dụ đồ chơi: $\mathrm{pos}_A=(0,0)$, $\mathrm{pos}_B=(1,0)$, $\mathrm{pos}_C=(0,1)$, $\mathrm{pos}_D=(1,1)$ (tọa độ cột, hàng). Khi đó:

$$
\tilde z_A=(4,6),\quad \tilde z_B=(13,14),\quad \tilde z_C=(10,9),\quad \tilde z_D=(8,9)
$$

Giờ token vừa mang nội dung (patch trông thế nào) vừa mang tọa độ (nó nằm đâu). Hoán vị token sẽ làm thay đổi kết quả, vì mỗi token đã gắn nhãn vị trí.

## Bước 7: Từ đây trở đi là Transformer thuần túy

Bốn vector $\tilde z_A,\dots,\tilde z_D$ vào đúng cơ chế attention: $q,k,v$, softmax, trộn. Token ảnh cũng nhìn nhau như token chữ. Patch "quai cốc" hút thông tin từ patch xung quanh để thành biểu diễn "cốc".

## Tóm tắt dòng chảy

$$
\text{ảnh (lưới)} \xrightarrow{\text{cắt}} \text{patch} \xrightarrow{\text{duỗi phẳng}} p_i \xrightarrow{W_p} z_i \xrightarrow{+\mathrm{pos}} \tilde z_i \xrightarrow{\text{attention}} \text{token có ngữ cảnh}
$$

Mang theo sang chặng sau: ảnh giờ là token liên tục, chỉ làm **đầu vào**, không cần sinh ra. Còn hành động thì khác: robot phải sinh chúng. Đó là mâu thuẫn mà bài tiếp theo giải quyết (xem [Tokenizer & Action Tokenization](action-tokenization.html)).

**Câu kiểm tra:** nếu bỏ bước 6 (không cộng pos), hai ảnh nào sẽ cho cùng một tập biểu diễn, và robot sẽ gặp rắc rối gì?

*Đáp án:* ảnh gốc và ảnh bị cắt patch rồi xáo trộn (ví dụ cốc ở trái và cốc ở phải) cho cùng một tập biểu diễn. Robot không phân biệt được vật nằm bên trái hay bên phải tay mình, nên không biết phải di chuyển về hướng nào.
:::
