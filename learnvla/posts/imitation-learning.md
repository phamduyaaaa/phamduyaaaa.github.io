---
slug: imitation-learning
date: 2026-10-18
title_en: "Imitation Learning: Copying an Expert, and Why the Copy Drifts"
title_vi: "Imitation Learning: Bắt chước chuyên gia, và vì sao bản sao bị trôi"
excerpt_en: "Behavior cloning turns robot control into supervised learning, but the policy then meets states the expert never showed. DAgger fixes this by letting the expert label the policy's own states."
excerpt_vi: "Behavior cloning biến điều khiển robot thành bài học có giám sát, nhưng chính sách sẽ gặp những trạng thái mà chuyên gia chưa từng làm mẫu. DAgger sửa bằng cách để chuyên gia gán nhãn cho chính các trạng thái mà chính sách đi qua."
tags: [VLA, Foundations, Imitation Learning, DAgger]
---

:::en
<div class="tldr" markdown="1">
**PAPER** DAgger (Ross, Gordon, Bagnell), [arXiv 1011.0686](https://arxiv.org/abs/1011.0686) · 11/2010

**PROBLEM** Writing a controller by hand, or doing RL with a hand-made reward, is slow. Showing the robot what to do is easier, so we record (observation, action) pairs and fit a model.

**WHAT FAILED BEFORE** Plain behavior cloning (BC) trains only on states the *expert* visited. Once the policy makes a small error it lands in a state never seen in training, errs more, and drifts. The error grows like $T^2\varepsilon$ over $T$ steps.

**IDEA** Run the *policy*, let the expert label the states the policy actually reaches, add them to the dataset, retrain, repeat.

**RESULT** Error grows only like $T\varepsilon$ in the paper's analysis. Every VLA in this site starts from BC; the force papers TER-DAgger and HG-DAgger-style methods extend DAgger.
</div>

## 1. The problem: train states ≠ test states

[[flow]]
- Before~Hand-coded / RL | Task > !Write controller or reward~slow, brittle! > Policy | engineer time or millions of trials
+ Behavior cloning | Expert demos > *Supervised regression~min ‖π(o) − a‖²* > Policy | no reward needed; but only sees expert states
[[/flow]] BC turns control into plain supervised learning. The catch is hidden in the data: the policy is trained on the expert's states and tested on its own.

## 2. How to read it

[[fig:imitation-learning]] Top: BC fits once and then drifts. Bottom: DAgger keeps adding the states the policy itself visits, labelled by the expert.

| Term | Meaning |
|---|---|
| Observation $o$ | what the policy sees (images, robot state) |
| Action $a$ | what the expert did (joint targets, end-effector delta) |
| Policy $\pi(o)$ | the network being trained |
| Horizon $T$ | number of steps in one episode |
| $\varepsilon$ | average per-step mistake of the policy on the expert's states |

<div class="calc" markdown="1">

Calculation card

**What and why.** How much worse than the expert is a cloned policy over a whole episode? The bound shows why BC drifts and DAgger does not.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $T$ | steps per episode | input | 100 |
| $\varepsilon$ | per-step error rate | input | 0.001 |
| $J^*$ | expert's total cost | reference | – |
| $\Delta_{BC}$ | extra cost of BC | output | – |
| $\Delta_{DAgger}$ | extra cost of DAgger | output | – |

**Formula** (worst-case bounds: the BC bound is from Ross and Bagnell, 2010; the DAgger bound from the DAgger paper, which also carries a constant $u$ for how much one mistake can cost, here taken as 1)

$$\Delta_{BC} \lesssim T^2\varepsilon \qquad \Delta_{DAgger} \lesssim u\,T\varepsilon$$

**Steps**

1. $\Delta_{BC} = 100^2 \times 0.001 = 10{,}000 \times 0.001 = 10$.
2. $\Delta_{DAgger} = 100 \times 0.001 = 0.1$.
3. Ratio: $10 / 0.1 = 100 = T$.

**Result.** The extra cost of BC is $T$ times larger than DAgger's: 10 against 0.1.

**Why it matters.** Where does $T^2$ come from? Suppose the policy slips with probability $\varepsilon$ at each step and, once lost, never recovers. A slip at step 1 costs about $T$ lost steps, a slip at step 2 about $T-1$, and so on, so the expected loss is about $\varepsilon(T + (T-1) + \dots + 1) \approx \varepsilon T^2/2$. DAgger trains on the states the policy really reaches, so a slip is something the policy has learned to recover from and costs only that step. These are worst-case bounds, so real gaps are usually smaller, but they grow with $T$. One honest caveat: the two $\varepsilon$ are not quite the same quantity (BC's is measured on the expert's states, DAgger's on the states its own policies visited), and the calculation treats them as equal.
</div>

## 3. The second trap: averaging two good answers

The loss $\lVert \pi(o) - a\rVert^2$ hides a second problem. Suppose that, in front of an obstacle, the expert went left ($a = -1$) in half of the demonstrations and right ($a = +1$) in the other half. The single number that minimises the squared error over both is their mean, $0.5\times(-1) + 0.5\times(+1) = 0$: straight into the obstacle. Both demonstrations were good; their average is not.

This is why VLAs do not regress one action with a squared loss. They either classify over bins ([action tokenization](action-tokenization.html)), or learn a whole distribution and sample from it ([diffusion policy](diffusion-policy.html), [flow matching](flowmatching.html)), or add a latent variable for "which way" ([action chunking](action-chunking.html), ACT).

## 4. Where it shows up in VLA

- Every VLA (π0, OpenVLA, ForceVLA…) is trained by BC on teleoperation data.
- Contact-rich tasks drift fast, because a few millimetres of error in an insertion changes the force completely. [TER-DAgger](ter-dagger.html) lets a force-error detector call the human back in.

**Carry forward:** the observation $o$ has two halves: what the cameras see, and what the robot knows about its own body. The second half is [proprioception](proprioception.html).

**Check question:** $T = 50$, $\varepsilon = 0.002$. What are $\Delta_{BC}$ and $\Delta_{DAgger}$?

<details markdown="1">
<summary>Answer</summary>

$\Delta_{BC} = 50^2 \times 0.002 = 2500 \times 0.002 = 5$. $\Delta_{DAgger} = 50 \times 0.002 = 0.1$. Ratio 50 = $T$.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** DAgger (Ross, Gordon, Bagnell), [arXiv 1011.0686](https://arxiv.org/abs/1011.0686) · 11/2010

**VẤN ĐỀ** Viết bộ điều khiển bằng tay, hoặc làm RL với hàm thưởng tự thiết kế, rất chậm. Làm mẫu cho robot dễ hơn: ghi lại các cặp (quan sát, hành động) rồi khớp một mô hình.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Behavior cloning (BC) thuần chỉ huấn luyện trên các trạng thái mà *chuyên gia* đi qua. Khi chính sách mắc một lỗi nhỏ, nó rơi vào trạng thái chưa từng thấy, sai nhiều hơn và trôi dần. Lỗi tăng như $T^2\varepsilon$ qua $T$ bước.

**Ý TƯỞNG** Chạy *chính sách*, nhờ chuyên gia gán nhãn cho các trạng thái chính sách thực sự đến, thêm vào tập dữ liệu, huấn luyện lại, lặp.

**KẾT QUẢ** Trong phân tích của paper, lỗi chỉ tăng như $T\varepsilon$. Mọi VLA trên trang này đều khởi đầu từ BC; TER-DAgger và các phương pháp kiểu HG-DAgger mở rộng DAgger.
</div>

## 1. Vấn đề: trạng thái lúc học ≠ trạng thái lúc chạy

[[flow]]
- Trước~Viết tay / RL | Tác vụ > !Viết bộ điều khiển hoặc hàm thưởng~chậm, dễ vỡ! > Chính sách | tốn công kỹ sư hoặc hàng triệu lần thử
+ Behavior cloning | Demo chuyên gia > *Hồi quy có giám sát~min ‖π(o) − a‖²* > Chính sách | không cần hàm thưởng; nhưng chỉ thấy trạng thái của chuyên gia
[[/flow]] BC biến điều khiển thành học có giám sát thông thường. Cái bẫy nằm trong dữ liệu: chính sách học trên trạng thái của chuyên gia nhưng chạy trên trạng thái của chính nó.

## 2. Cách đọc

[[fig:imitation-learning]] Trên: BC khớp một lần rồi trôi. Dưới: DAgger liên tục thêm các trạng thái mà chính sách tự đi qua, do chuyên gia gán nhãn.

| Thuật ngữ | Nghĩa |
|---|---|
| Quan sát $o$ | thứ chính sách thấy (ảnh, trạng thái robot) |
| Hành động $a$ | thứ chuyên gia đã làm (mục tiêu khớp, độ dời đầu kẹp) |
| Chính sách $\pi(o)$ | mạng đang được huấn luyện |
| Horizon $T$ | số bước trong một episode |
| $\varepsilon$ | lỗi trung bình mỗi bước của chính sách trên trạng thái của chuyên gia |

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Bản sao BC tệ hơn chuyên gia bao nhiêu trên cả episode? Cận dưới đây cho thấy vì sao BC trôi còn DAgger thì không.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $T$ | số bước mỗi episode | input | 100 |
| $\varepsilon$ | tỉ lệ lỗi mỗi bước | input | 0,001 |
| $J^*$ | tổng chi phí của chuyên gia | tham chiếu | – |
| $\Delta_{BC}$ | chi phí dư của BC | output | – |
| $\Delta_{DAgger}$ | chi phí dư của DAgger | output | – |

**Công thức** (cận trường hợp xấu nhất: cận của BC lấy từ Ross và Bagnell, 2010; cận của DAgger lấy từ paper DAgger, có thêm hằng số $u$ cho biết một lỗi có thể tốn bao nhiêu, ở đây lấy bằng 1)

$$\Delta_{BC} \lesssim T^2\varepsilon \qquad \Delta_{DAgger} \lesssim u\,T\varepsilon$$

**Các bước**

1. $\Delta_{BC} = 100^2 \times 0{,}001 = 10\,000 \times 0{,}001 = 10$.
2. $\Delta_{DAgger} = 100 \times 0{,}001 = 0{,}1$.
3. Tỉ số: $10 / 0{,}1 = 100 = T$.

**Kết quả.** Chi phí dư của BC lớn gấp $T$ lần DAgger: 10 so với 0,1.

**Ý nghĩa.** $T^2$ từ đâu ra? Giả sử mỗi bước chính sách trượt với xác suất $\varepsilon$ và một khi đã lạc thì không quay về được. Trượt ở bước 1 tốn khoảng $T$ bước lạc, trượt ở bước 2 tốn khoảng $T-1$, cứ thế, nên tổn thất kỳ vọng xấp xỉ $\varepsilon(T + (T-1) + \dots + 1) \approx \varepsilon T^2/2$. DAgger học trên chính các trạng thái mà chính sách đi tới, nên một lần trượt là thứ nó đã học cách gỡ lại và chỉ tốn đúng bước đó. Đây là cận xấu nhất nên khoảng cách thật thường nhỏ hơn, nhưng nó tăng theo $T$. Một lưu ý trung thực: hai $\varepsilon$ không hẳn là cùng một đại lượng (của BC đo trên trạng thái của chuyên gia, của DAgger đo trên trạng thái mà các chính sách của nó đi qua), và phép tính coi chúng bằng nhau.
</div>

## 3. Cái bẫy thứ hai: lấy trung bình hai câu trả lời đúng

Hàm loss $\lVert \pi(o) - a\rVert^2$ còn giấu một vấn đề nữa. Giả sử trước một vật cản, chuyên gia rẽ trái ($a = -1$) ở một nửa số demo và rẽ phải ($a = +1$) ở nửa còn lại. Con số duy nhất làm sai số bình phương nhỏ nhất trên cả hai là trung bình của chúng, $0{,}5\times(-1) + 0{,}5\times(+1) = 0$: lao thẳng vào vật cản. Cả hai demo đều tốt; trung bình của chúng thì không.

Đó là lý do VLA không hồi quy một hành động bằng loss bình phương. Chúng hoặc phân loại trên các bin ([action tokenization](action-tokenization.html)), hoặc học cả một phân phối rồi lấy mẫu ([diffusion policy](diffusion-policy.html), [flow matching](flowmatching.html)), hoặc thêm một biến ẩn cho "đi lối nào" ([action chunking](action-chunking.html), ACT).

## 4. Trong VLA nó xuất hiện ở đâu

- Mọi VLA (π0, OpenVLA, ForceVLA…) đều được huấn luyện bằng BC trên dữ liệu teleoperation.
- Tác vụ giàu tiếp xúc trôi rất nhanh, vì vài milimét lệch khi lắp ghép làm lực đổi hoàn toàn. [TER-DAgger](ter-dagger.html) để bộ phát hiện sai số lực gọi con người quay lại.

**Mang theo:** quan sát $o$ có hai nửa: thứ camera thấy, và thứ robot biết về chính cơ thể nó. Nửa thứ hai là [proprioception](proprioception.html).

**Câu hỏi kiểm tra:** $T = 50$, $\varepsilon = 0{,}002$. $\Delta_{BC}$ và $\Delta_{DAgger}$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\Delta_{BC} = 50^2 \times 0{,}002 = 2500 \times 0{,}002 = 5$. $\Delta_{DAgger} = 50 \times 0{,}002 = 0{,}1$. Tỉ số 50 = $T$.
</details>
:::
