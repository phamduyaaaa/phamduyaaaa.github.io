---
slug: gelsight
date: 2026-10-19
title_en: "GelSight: A Camera Under a Gel Skin That Sees Shape and Force"
title_vi: "GelSight: Camera dưới lớp da gel nhìn ra hình dạng và lực"
excerpt_en: "Pressure-array tactile sensors tell a robot where it is pressed and how hard, in cells about 5 mm wide. GelSight puts a camera behind a soft gel and reads the gel's deformation instead: shape at 20-30 micrometres, plus shear, torque and slip."
excerpt_vi: "Cảm biến xúc giác dạng lưới áp suất cho robot biết chỗ bị ấn và ấn mạnh bao nhiêu, theo ô rộng khoảng 5 mm. GelSight đặt camera sau một lớp gel mềm và đọc sự biến dạng của gel: hình dạng ở mức 20-30 micromet, cộng với lực cắt, mô-men và trượt."
tags: [Force, Tactile, GelSight, Sensors, Paper Notes]
---

:::en
<div class="tldr" markdown="1">
**PAPER** Yuan, Dong, Adelson, *GelSight: High-Resolution Robot Tactile Sensors for Estimating Geometry and Force*, Sensors 2017, 17, 2762 · 11/2017 (journal paper, a review of the sensor's development; the first prototype dates from 2009)

**PROBLEM** What kind of touch signal does a robot actually need? A person can feel shape, texture, softness and slip, yet cannot measure force precisely.

**WHAT FAILED BEFORE** Most robot tactile sensors "detect the contact and contact force, or force distribution over the fingertip area". The commercial array from Pressure Profile Systems measures normal pressure at 5 mm resolution. Other designs fall short in other ways: Tar and Cserey's dome gives three-axis force but no spatial measurement; TacTip tracks markers but does not measure force; Ito et al.'s sensor is too large for a robot hand. The paper names four open challenges: shear force, contact area, compact hardware, and fabrication others can copy.

**IDEA** Treat geometry as equally important as force. Put a soft elastomer with a thin reflective skin over a camera and coloured lights; the camera sees the gel's deformation as a coloured image. Recover shape from shading, and force and slip from the motion of printed dots.

**RESULT** On the fingertip version: 30 Hz images, 18 × 14 mm sensing area, 20-30 µm resolution, minimum detectable force below 0.05 N, and force readings with $R^2 > 0.9$ on unseen simple objects.
</div>

## 1. The problem: touch sensors that only report "how hard"

[[flow]]
- Before~Pressure arrays | Contact > !Pressure per ~5 mm cell~force and place, no fine shape! > Robot | knows "touched", not what it touched
+ GelSight | Contact > *Camera sees the gel deform~colour image* > Shape + shear + slip | 20-30 µm fingertip detail
[[/flow]] The change is what the sensor measures: the deformation of a soft surface, as an image, instead of a force per cell.

[[bars:µm]] Pressure array (Pressure Profile Systems)=5000; GelSight fingertip (20-30, shown at 30)=30; *GelSight optimised for resolution (1-2, shown at 2)=2* || Spatial resolution in micrometres, smaller is finer. The paper gives 5 mm for the pressure array, 20-30 µm for the fingertip version and 1-2 µm for the best case.

## 2. How it works

[[fig:gelsight]] Left: an object presses the gel; coloured lights from different sides make the deformed skin look different in each colour channel; a camera below records it. Right: the same image is used twice, once for shape and once for force.

| Part | Input | Output | Role |
|---|---|---|---|
| Clear elastomer | contact | a deformed surface | the sensing medium; typically Shore A 5-20 (fingertip: neo-Hookean, 0.145 MPa) |
| Reflective membrane | light | the same reflectance everywhere | so shading depends only on the surface slope |
| Coloured LEDs | power | light from 3+ directions | each direction in its own colour channel |
| Camera | gel image | colour image | cheap USB webcam, 30 Hz, mostly 640 × 480 |
| Lookup table | pixel colours | surface normal | built once per sensor by pressing a ball |
| Poisson solver | normals | height map | integrates slopes into a shape |
| Black markers | their motion | normal / shear / torque pattern | spread = normal force, common shift = shear, rotation = torque |

**Photometric stereo in one sentence.** If you know how a surface of a given slope looks under each light, then the three colour values at a pixel tell you the slope; integrate the slopes and you get the shape.

<div class="calc" markdown="1">

Calculation card

**What and why.** Calibration presses a ball of known size on the sensor, so the true surface normal at every pixel is known; this pairs each colour with a normal in the lookup table. Compute the normal the ball gives at a chosen pixel.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $d$, $R$ | calibration ball diameter, radius | input | 3.96 mm, 1.98 mm (the ball used in the paper's shape test) |
| $r$ | distance of the pixel from the ball's centre line | input | 1.0 mm |
| $f(r)$ | height of the surface, $\sqrt{R^2 - r^2}$ | derived | – |
| $g$ | slope (gradient magnitude) $\lvert\nabla f\rvert$ | output | – |
| $\theta$ | pitch angle $\arctan g$ | output | – |

**Formula**

$$g = \frac{r}{\sqrt{R^2 - r^2}}, \qquad \theta = \arctan g, \qquad \text{normal} \propto \left(\frac{\partial f}{\partial x}, \frac{\partial f}{\partial y}, -1\right)$$

**Steps**

1. $\sqrt{R^2 - r^2} = \sqrt{1.98^2 - 1^2} = \sqrt{3.920 - 1} = \sqrt{2.920} = 1.709$ mm.
2. $g = 1 / 1.709 = 0.585$.
3. $\theta = \arctan 0.585 = 30.3°$. The gradient points back toward the ball's centre; that direction is the yaw angle.
4. At $r = 1.5$ mm the same steps give $g = 1.5 / 1.292 = 1.16$ and $\theta = 49.2°$.

**Result.** At $r = 1$ mm the surface is tilted 30.3°; at $r = 1.5$ mm it is tilted 49.2°. A small ball therefore covers many slopes in one press.

**Why it matters.** The paper stores the answer in an 80 × 80 × 80 table (8-bit, 3 colour channels; 512,000 entries) and averages many ball presses. The table is why GelSight needs per-sensor calibration, and why a hemispherical ball is a good choice: it contains surface normals in all directions.
</div>

## 3. From the image to force and slip

- **Markers:** the black dots move with the gel's surface. The pattern says what kind of force it is; the size is "roughly proportional" to the force.
- **Why a network:** that proportionality only holds for a fixed contact shape. For unknown shapes the paper trains a CNN (VGG-16 pre-trained on ImageNet, last layer replaced by four outputs: $F_x$, $F_y$, $F_z$, torque $T_z$) on the difference between the current image and the untouched one, with mean squared error.
- **Slip alarm:** slip starts at the edge of the contact patch, so markers there move less than markers in the middle. The paper measures how uneven the marker motion is with entropy, $H(X) = -\int p(x)\log p(x)\,dx$, and says a warning threshold on $H$ can prevent slip.

| Marker motion in the contact patch | Histogram of marker displacement | Entropy (discrete, natural log) |
|---|---|---|
| all markers move the same (stuck) | one bin holds everything | $H = 0$ |
| edge markers lag, four equally common displacement levels | four equal bins | $H = \ln 4 = 1.39$ |

(Illustrative numbers; the paper reports that entropy keeps increasing as partial slip grows.)

## 4. Versions of the sensor

| Version | Size and resolution | Light and coating | Note |
|---|---|---|---|
| Desktop (Johnson & Adelson 2009) | 30 cm cube; sensing range about 60 × 40 mm | 3 LED arrays at 60°, semi-specular bronze-flake coating | the first GelSight |
| Side-lit (Johnson et al. 2011) | higher resolution (best case 1-2 µm when optimised) | 6 white LEDs lit in turn, matte 1 µm silver powder | too slow for real-time touch |
| Fingertip v1 (Li et al.) | 35 × 35 × 60 mm, for a Baxter gripper | 4 colours, acrylic light guides | normals not precise; hard to build by hand |
| Fingertip v2 (Dong et al. 2017) | similar size, hexagonal; 18 × 14 mm field, 20-30 µm | RGB LEDs tilted 71°, matte coating | 3D-printable, drawings open-sourced |

## 5. What the paper reports

- **Force sensitivity:** mostly below 0.05 N (one case, a soft flat contact read from shape, needs 0.08 N), calibrated with an ATI Nano-17 F/T sensor, which itself limits the test to 0.05 N.
- **Force from images:** about 28,815 training images from six balls (12-87 mm), five cylinders (10-70 mm) and two flat plates; tested on 6,705 images of a 25 mm ball, a 22 mm cylinder and a flat plane. $R^2 > 0.9$ for the force readings.
- **Uses:** recognising fabrics by texture, estimating hardness, locating a USB plug in the hand before inserting it, and adding a fine point cloud to a gripper's view.

## 6. Caveats

- The paper calls its force results "preliminary", on basic shapes only. The network depends on its training data and is biased by contact geometry; the authors suggest more complete data (possibly from simulation) or other methods.
- Viscoelasticity: loading and unloading curves differ, so only loading data were used for training.
- Camera latency: a USB webcam with H.264 encoding adds noticeable delay.
- This note is based on the paper's text; I did not check the numeric values printed inside Figure 14 (per-object RMSE).

**Carry forward:** GelSight-type sensors are what [VLA-Touch](vla-touch.html), [TaF-VLA](taf-vla.html) and others turn into tokens. [Survey 2](survey-force-sensing.html) compares them with wrist F/T and taxel arrays.

**Check question:** the same 3.96 mm ball, a pixel at $r = 0.5$ mm. What are the slope $g$ and the pitch angle $\theta$?

<details markdown="1">
<summary>Answer</summary>

$\sqrt{1.98^2 - 0.5^2} = \sqrt{3.920 - 0.25} = 1.916$ mm; $g = 0.5 / 1.916 = 0.261$; $\theta = \arctan 0.261 = 14.6°$. Near the ball's centre line the surface is almost flat.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**PAPER** Yuan, Dong, Adelson, *GelSight: High-Resolution Robot Tactile Sensors for Estimating Geometry and Force*, Sensors 2017, 17, 2762 · 11/2017 (bài báo tạp chí, tổng quan quá trình phát triển cảm biến; nguyên mẫu đầu tiên có từ 2009)

**VẤN ĐỀ** Robot thực sự cần loại tín hiệu xúc giác nào? Con người cảm nhận được hình dạng, kết cấu, độ mềm và sự trượt, dù không đo lực chính xác.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Phần lớn cảm biến xúc giác cho robot "phát hiện tiếp xúc và lực tiếp xúc, hoặc phân bố lực trên vùng đầu ngón". Mảng cảm biến thương mại của Pressure Profile Systems đo áp suất pháp tuyến với độ phân giải 5 mm. Các thiết kế khác thiếu ở chỗ khác: vòm cao su của Tar và Cserey cho lực ba trục nhưng không có phép đo không gian; TacTip theo dõi các điểm đánh dấu nhưng không đo lực; cảm biến của Ito và cộng sự quá lớn cho bàn tay robot. Paper nêu bốn thách thức mở: lực cắt, vùng tiếp xúc, phần cứng gọn, và quy trình chế tạo mà người khác sao chép được.

**Ý TƯỞNG** Coi hình học quan trọng ngang lực. Đặt một lớp đàn hồi mềm có da phản xạ mỏng lên trên camera và đèn nhiều màu; camera thấy sự biến dạng của gel thành một ảnh màu. Dựng hình dạng từ độ sáng tối, còn lực và sự trượt từ chuyển động của các chấm in sẵn.

**KẾT QUẢ** Với bản đầu ngón: ảnh 30 Hz, vùng cảm biến 18 × 14 mm, độ phân giải 20-30 µm, lực nhỏ nhất phát hiện được dưới 0,05 N, và số đo lực có $R^2 > 0{,}9$ trên các vật đơn giản chưa từng thấy.
</div>

## 1. Vấn đề: cảm biến chạm chỉ nói "mạnh bao nhiêu"

[[flow]]
- Trước~Mảng áp suất | Tiếp xúc > !Áp suất mỗi ô ~5 mm~biết lực và chỗ, không có hình dạng mịn! > Robot | biết "đã chạm", không biết chạm vào gì
+ GelSight | Tiếp xúc > *Camera thấy gel biến dạng~ảnh màu* > Hình dạng + lực cắt + trượt | chi tiết 20-30 µm ở đầu ngón
[[/flow]] Thay đổi nằm ở thứ cảm biến đo: sự biến dạng của một bề mặt mềm dưới dạng ảnh, thay cho một giá trị lực mỗi ô.

[[bars:µm]] Mảng áp suất (Pressure Profile Systems)=5000; GelSight đầu ngón (20-30, hiển thị 30)=30; *GelSight tối ưu độ phân giải (1-2, hiển thị 2)=2* || Độ phân giải không gian tính bằng micromet, càng nhỏ càng mịn. Paper nêu 5 mm cho mảng áp suất, 20-30 µm cho bản đầu ngón và 1-2 µm cho trường hợp tốt nhất.

## 2. Cách hoạt động

[[fig:gelsight]] Trái: một vật ấn vào gel; đèn nhiều màu từ các phía làm lớp da biến dạng hiện khác nhau ở từng kênh màu; camera bên dưới ghi lại. Phải: cùng một ảnh được dùng hai lần, một lần cho hình dạng và một lần cho lực.

| Bộ phận | Input | Output | Vai trò |
|---|---|---|---|
| Lớp đàn hồi trong suốt | tiếp xúc | một bề mặt biến dạng | môi trường cảm nhận; thường Shore A 5-20 (đầu ngón: neo-Hookean, 0,145 MPa) |
| Màng phản xạ | ánh sáng | cùng một độ phản xạ ở mọi nơi | để độ sáng tối chỉ phụ thuộc độ dốc bề mặt |
| Đèn LED nhiều màu | điện | ánh sáng từ 3 hướng trở lên | mỗi hướng một kênh màu |
| Camera | ảnh gel | ảnh màu | webcam USB rẻ tiền, 30 Hz, phần lớn 640 × 480 |
| Bảng tra | màu của pixel | pháp tuyến bề mặt | dựng một lần cho mỗi cảm biến bằng cách ấn một quả bóng |
| Bộ giải Poisson | pháp tuyến | bản đồ độ cao | tích phân các độ dốc thành hình dạng |
| Chấm đen đánh dấu | chuyển động của chúng | mẫu lực pháp / lực cắt / mô-men | tỏa ra = lực pháp tuyến, cùng dịch = lực cắt, xoay = mô-men |

**Photometric stereo trong một câu.** Nếu biết một bề mặt có độ dốc nhất định trông thế nào dưới từng đèn, thì ba giá trị màu tại một pixel cho biết độ dốc; tích phân các độ dốc là ra hình dạng.

<div class="calc" markdown="1">

Thẻ tính tay

**Tính gì và vì sao.** Hiệu chuẩn ấn một quả bóng có kích thước đã biết lên cảm biến, nên pháp tuyến thật tại mọi pixel là biết trước; điều này ghép mỗi màu với một pháp tuyến trong bảng tra. Hãy tính pháp tuyến mà quả bóng cho ở một pixel chọn trước.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $d$, $R$ | đường kính, bán kính quả bóng hiệu chuẩn | input | 3,96 mm, 1,98 mm (quả bóng dùng trong thử nghiệm hình dạng của paper) |
| $r$ | khoảng cách từ pixel đến trục tâm quả bóng | input | 1,0 mm |
| $f(r)$ | độ cao bề mặt, $\sqrt{R^2 - r^2}$ | suy ra | – |
| $g$ | độ dốc (độ lớn gradient) $\lvert\nabla f\rvert$ | output | – |
| $\theta$ | góc nghiêng $\arctan g$ | output | – |

**Công thức**

$$g = \frac{r}{\sqrt{R^2 - r^2}}, \qquad \theta = \arctan g, \qquad \text{pháp tuyến} \propto \left(\frac{\partial f}{\partial x}, \frac{\partial f}{\partial y}, -1\right)$$

**Từng bước**

1. $\sqrt{R^2 - r^2} = \sqrt{1{,}98^2 - 1^2} = \sqrt{3{,}920 - 1} = \sqrt{2{,}920} = 1{,}709$ mm.
2. $g = 1 / 1{,}709 = 0{,}585$.
3. $\theta = \arctan 0{,}585 = 30{,}3°$. Gradient hướng về tâm quả bóng; hướng đó là góc yaw.
4. Tại $r = 1{,}5$ mm, các bước tương tự cho $g = 1{,}5 / 1{,}292 = 1{,}16$ và $\theta = 49{,}2°$.

**Kết quả.** Tại $r = 1$ mm bề mặt nghiêng 30,3°; tại $r = 1{,}5$ mm nghiêng 49,2°. Vì vậy một quả bóng nhỏ bao quát nhiều độ dốc chỉ trong một lần ấn.

**Ý nghĩa.** Paper lưu kết quả trong một bảng 80 × 80 × 80 (8 bit, 3 kênh màu; 512.000 ô) và lấy trung bình nhiều lần ấn bóng. Bảng này là lý do GelSight cần hiệu chuẩn riêng cho từng cảm biến, và vì sao quả bóng bán cầu là lựa chọn tốt: nó chứa pháp tuyến bề mặt theo mọi hướng.
</div>

## 3. Từ ảnh đến lực và sự trượt

- **Chấm đánh dấu:** các chấm đen di chuyển theo bề mặt gel. Mẫu chuyển động cho biết loại lực; độ lớn "xấp xỉ tỉ lệ" với lực.
- **Vì sao cần mạng nơ-ron:** sự tỉ lệ đó chỉ đúng khi hình dạng tiếp xúc cố định. Với hình dạng chưa biết, paper huấn luyện một CNN (VGG-16 tiền huấn luyện trên ImageNet, lớp cuối thay bằng bốn đầu ra: $F_x$, $F_y$, $F_z$, mô-men $T_z$) trên hiệu của ảnh hiện tại và ảnh lúc chưa chạm, với sai số bình phương trung bình.
- **Chuông báo trượt:** sự trượt bắt đầu từ rìa vùng tiếp xúc, nên các chấm ở rìa dịch chuyển ít hơn các chấm ở giữa. Paper đo độ không đồng đều của chuyển động chấm bằng entropy, $H(X) = -\int p(x)\log p(x)\,dx$, và nói có thể đặt ngưỡng cảnh báo trên $H$ để ngăn trượt.

| Chuyển động chấm trong vùng tiếp xúc | Histogram độ dịch chuyển của chấm | Entropy (rời rạc, log tự nhiên) |
|---|---|---|
| mọi chấm dịch như nhau (dính) | một bin chứa tất cả | $H = 0$ |
| chấm ở rìa tụt lại, bốn mức dịch chuyển phổ biến như nhau | bốn bin bằng nhau | $H = \ln 4 = 1{,}39$ |

(Số minh họa; paper báo cáo entropy tăng liên tục khi trượt từng phần tăng.)

## 4. Các phiên bản của cảm biến

| Phiên bản | Kích thước và độ phân giải | Ánh sáng và lớp phủ | Ghi chú |
|---|---|---|---|
| Để bàn (Johnson & Adelson 2009) | khối lập phương 30 cm; vùng cảm biến khoảng 60 × 40 mm | 3 dãy LED ở 60°, lớp phủ bán phản xạ từ vảy đồng | GelSight đầu tiên |
| Chiếu bên (Johnson và cộng sự 2011) | độ phân giải cao hơn (tốt nhất 1-2 µm khi tối ưu) | 6 LED trắng bật lần lượt, bột bạc 1 µm mờ | quá chậm cho xúc giác thời gian thực |
| Đầu ngón v1 (Li và cộng sự) | 35 × 35 × 60 mm, cho tay kẹp Baxter | 4 màu, tấm dẫn sáng acrylic | pháp tuyến chưa chính xác; chế tạo tay rất cầu kỳ |
| Đầu ngón v2 (Dong và cộng sự 2017) | cỡ tương tự, hình lục giác; vùng 18 × 14 mm, 20-30 µm | LED RGB nghiêng 71°, lớp phủ mờ | in 3D được, bản vẽ mở nguồn |

## 5. Paper báo cáo gì

- **Độ nhạy lực:** phần lớn dưới 0,05 N (một trường hợp, tiếp xúc phẳng mềm đọc từ hình dạng, cần 0,08 N), hiệu chuẩn bằng cảm biến F/T ATI Nano-17, chính cảm biến này cũng giới hạn phép thử ở 0,05 N.
- **Lực từ ảnh:** khoảng 28.815 ảnh huấn luyện từ sáu quả bóng (12-87 mm), năm hình trụ (10-70 mm) và hai tấm phẳng; kiểm tra trên 6.705 ảnh của một quả bóng 25 mm, một hình trụ 22 mm và một mặt phẳng. $R^2 > 0{,}9$ cho các số đo lực.
- **Ứng dụng:** nhận diện vải qua kết cấu, ước lượng độ cứng, định vị đầu cắm USB trong tay trước khi cắm, và bổ sung đám mây điểm mịn cho góc nhìn của tay kẹp.

## 6. Lưu ý

- Paper gọi kết quả về lực là "sơ bộ", chỉ trên các hình cơ bản. Mạng phụ thuộc dữ liệu huấn luyện và bị lệch theo hình học tiếp xúc; các tác giả đề xuất bộ dữ liệu đầy đủ hơn (có thể từ mô phỏng) hoặc phương pháp khác.
- Tính nhớt-đàn hồi: đường tải và dỡ tải khác nhau, nên chỉ dùng dữ liệu lúc tải để huấn luyện.
- Độ trễ camera: webcam USB với mã hóa H.264 gây trễ đáng kể.
- Bài này dựa trên văn bản của paper; mình chưa kiểm tra các giá trị số in trong Hình 14 (RMSE từng vật).

**Mang theo:** các cảm biến kiểu GelSight là thứ mà [VLA-Touch](vla-touch.html), [TaF-VLA](taf-vla.html) và các phương pháp khác biến thành token. [Survey 2](survey-force-sensing.html) so sánh chúng với F/T ở cổ tay và lưới taxel.

**Câu hỏi kiểm tra:** cùng quả bóng 3,96 mm, một pixel ở $r = 0{,}5$ mm. Độ dốc $g$ và góc nghiêng $\theta$ bằng bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$\sqrt{1{,}98^2 - 0{,}5^2} = \sqrt{3{,}920 - 0{,}25} = 1{,}916$ mm; $g = 0{,}5 / 1{,}916 = 0{,}261$; $\theta = \arctan 0{,}261 = 14{,}6°$. Gần trục tâm quả bóng, bề mặt gần như phẳng.
</details>
:::
