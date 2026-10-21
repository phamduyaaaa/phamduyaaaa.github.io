---
slug: contact-rich-control
date: 2026-10-21
title_en: "Contact-Rich Control: Impedance, Admittance and Hybrid Force–Position"
title_vi: "Điều khiển giàu tiếp xúc: Impedance, admittance và lai lực–vị trí"
excerpt_en: "A position controller told to be 2 mm inside a rigid part will push until something gives. Impedance control makes the robot act like a spring instead, admittance turns measured force into motion, and hybrid control splits axes into force and position. Worked: the force from a stiff versus a soft setting, and critical damping."
excerpt_vi: "Bộ điều khiển vị trí được bảo phải nằm sâu 2 mm trong một chi tiết cứng sẽ ấn tới khi có thứ gì đó chịu thua. Điều khiển impedance khiến robot cư xử như một lò xo, admittance biến lực đo được thành chuyển động, còn điều khiển lai chia các trục thành trục lực và trục vị trí. Tính tay: lực sinh ra với độ cứng cao so với thấp, và giảm chấn tới hạn."
tags: [VLA, Foundations, Force, Control]
---

:::en
<div class="tldr" markdown="1">
**CONCEPT** Low-level control for contact. Classic sources: N. Hogan, *Impedance Control: An Approach to Manipulation* (1985); M. Raibert and J. Craig, *Hybrid Position/Force Control of Manipulators* (1981)

**PROBLEM** A VLA outputs poses a few to 50 times per second; between them, a low-level controller decides what the motors do. Against a rigid part, a millimetre of pose error can mean a large force.

**WHAT FAILED BEFORE** Stiff position control treats any error as something to remove at all costs, so pressing into a surface makes force climb until the part breaks or the robot's protective stop triggers. Pure force control has no notion of where to go and drifts in free space.

**IDEA** Control the *relationship* between motion and force. Impedance control makes the end-effector behave like a spring and damper around the target; admittance control measures force and moves in response; hybrid control regulates force along some axes and position along the others.

**RESULT** The force VLAs on this site all sit on top of such a controller: FIRe uses task-space impedance at 1 kHz, Facet-0 a 200 Hz compliant controller, CR-VLA-Force an adaptive impedance (400–2500 N/m) on a UR5e, ForceVLA2 and Tabero hybrid force–position control.
</div>

## 1. The problem: a small error against a hard surface

[[flow]]
- Before~Stiff position control | Target inside the part > !Remove the error at any cost! > Motors | force spikes, protective stop
- Before~Pure force control | Force target > !No position reference! > Motors | drifts when not touching
+ Impedance / hybrid | Target + stiffness (+ force) > *Spring-like behaviour~force grows gently with error* > Motors | safe contact, still goes where told
[[/flow]] The change is that the controller is told *how stiff to be*, not only where to be.

## 2. Three controllers

[[fig:contact-rich-control]] Top: the same target 2 mm inside a part, under three control laws. Bottom: the VLA sets targets slowly; the controller reads force and closes the loop fast.

| Controller | Law | What you set | Good for |
|---|---|---|---|
| Impedance | $F = K(x_d - x) - D\dot x$ (+ feedforward $F_d$) | stiffness $K$, damping $D$ | torque-controlled arms; gentle contact |
| Admittance | measure $F$, move: $\dot x = (F - F_d)/D_a$ | admittance (how much motion per newton) | position-controlled arms with a force sensor, such as UR arms |
| Hybrid force–position | force law on chosen axes, position law on the others | which axes are force-controlled, force targets | pressing, wiping, inserting along one axis |

<div class="calc" markdown="1">
Calculation card

**What and why.** A pose target lands 2 mm inside a rigid part (a perception error). Compare the force under a stiff and a soft setting, and pick the damping that stops a soft spring from oscillating.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $\Delta x$ | how far the target is inside the part | input | 0.002 m |
| $K$ | controller stiffness | input | 50,000 N/m (stiff) or 1,000 N/m (soft) |
| $m$ | apparent mass of the end-effector | constant | 2 kg (illustrative) |
| $F$ | steady contact force | output | – |
| $D_{crit}$ | critical damping | output | – |

**Formulas** (part much stiffer than the controller)

$$F \approx K\,\Delta x, \qquad D_{crit} = 2\sqrt{K m}$$

**Steps**

1. Stiff: $F = 50{,}000 \times 0.002 = 100$ N. CR-VLA-Force reports its UR5e stopping above 75 N.
2. Soft: $F = 1{,}000 \times 0.002 = 2$ N.
3. Damping for the soft setting: $D_{crit} = 2\sqrt{1{,}000 \times 2} = 2 \times 44.7 = 89.4$ N·s/m.

**Result.** The same 2 mm error gives 100 N with the stiff setting and 2 N with the soft one; about 89 N·s/m of damping lets the soft spring settle without bouncing.

**Why it matters.** Stiffness converts position error into force. A policy that is a few millimetres off is normal; with a soft controller that costs a few newtons, with a stiff one it costs the part. The price of softness is accuracy against disturbances, which is why CR-VLA-Force adapts $K$ between its bounds from the force error, and why many policies output a force or stiffness as well as a pose ([Survey 3](survey-force-output.html)).
</div>

## 3. Choosing in practice

- **Your arm decides first.** Torque-controlled arms (Franka, Flexiv) run impedance control directly. Position-controlled arms such as UR arms usually do admittance-style control on top of a wrist force sensor; UR arms offer a force mode in their scripting language for this. CR-VLA-Force builds its controller on a UR5e through RTDE.
- **Press, insert, wipe: hybrid.** Pushing a cap onto a can is naturally force along the pressing axis and position across it: hold 10 N down, stay centred.
- **Let the policy set the controller.** ForceVLA2 outputs pose and force; CR-VLA-Force outputs a desired force that the controller tracks; FIRe adds a learned residual on top of an impedance controller ([residual policy](residual-policy.html)).

**Carry forward:** with sensing and control in place, the force papers differ in where they put force into the VLA. The map of all of them: [Survey 1](survey-force-map.html).

**Check question:** With $K = 2{,}500$ N/m (CR-VLA-Force's upper bound) and the same 2 mm error, what is the force? What damping is critical for $m = 2$ kg?

<details markdown="1">
<summary>Answer</summary>

$F = 2{,}500 \times 0.002 = 5$ N. $D_{crit} = 2\sqrt{2{,}500 \times 2} = 2 \times 70.7 = 141.4$ N·s/m.
</details>
:::

:::vi
<div class="tldr" markdown="1">
**KHÁI NIỆM** Điều khiển mức thấp cho tiếp xúc. Nguồn kinh điển: N. Hogan, *Impedance Control: An Approach to Manipulation* (1985); M. Raibert và J. Craig, *Hybrid Position/Force Control of Manipulators* (1981)

**VẤN ĐỀ** VLA xuất pose vài tới 50 lần mỗi giây; giữa các lần đó, một bộ điều khiển mức thấp quyết định động cơ làm gì. Khi ép vào một chi tiết cứng, sai một milimét pose có thể thành một lực lớn.

**PAPER TRƯỚC HỎNG Ở ĐÂU** Điều khiển vị trí cứng coi mọi sai số là thứ phải xóa bằng mọi giá, nên ấn vào một bề mặt làm lực tăng tới khi chi tiết gãy hoặc cơ chế dừng bảo vệ của robot kích hoạt. Điều khiển lực thuần túy không biết phải đi đâu và trôi khi ở trong không khí.

**Ý TƯỞNG** Điều khiển *mối quan hệ* giữa chuyển động và lực. Điều khiển impedance khiến đầu công tác cư xử như lò xo và bộ giảm chấn quanh đích; điều khiển admittance đo lực rồi di chuyển đáp lại; điều khiển lai điều chỉnh lực theo một số trục và vị trí theo các trục còn lại.

**KẾT QUẢ** Các VLA lực trên trang này đều đặt trên một bộ điều khiển như vậy: FIRe dùng impedance không gian tác vụ ở 1 kHz, Facet-0 một bộ điều khiển mềm 200 Hz, CR-VLA-Force một impedance thích nghi (400–2500 N/m) trên UR5e, ForceVLA2 và Tabero điều khiển lai lực–vị trí.
</div>

## 1. Vấn đề: một sai số nhỏ trước một bề mặt cứng

[[flow]]
- Trước~Điều khiển vị trí cứng | Đích nằm trong chi tiết > !Xóa sai số bằng mọi giá! > Động cơ | lực vọt lên, dừng bảo vệ
- Trước~Điều khiển lực thuần | Đích lực > !Không có mốc vị trí! > Động cơ | trôi khi không chạm
+ Impedance / lai | Đích + độ cứng (+ lực) > *Cư xử như lò xo~lực tăng từ tốn theo sai số* > Động cơ | tiếp xúc an toàn, vẫn đi đúng chỗ
[[/flow]] Thay đổi nằm ở chỗ bộ điều khiển được bảo *cứng tới mức nào*, chứ không chỉ phải ở đâu.

## 2. Ba bộ điều khiển

[[fig:contact-rich-control]] Trên: cùng một đích nằm sâu 2 mm trong chi tiết, dưới ba luật điều khiển. Dưới: VLA đặt đích chậm; bộ điều khiển đọc lực và khép vòng nhanh.

| Bộ điều khiển | Luật | Bạn đặt gì | Hợp với |
|---|---|---|---|
| Impedance | $F = K(x_d - x) - D\dot x$ (+ lực bù trước $F_d$) | độ cứng $K$, giảm chấn $D$ | cánh tay điều khiển mô-men; tiếp xúc nhẹ nhàng |
| Admittance | đo $F$, rồi di chuyển: $\dot x = (F - F_d)/D_a$ | độ dẫn nạp (bao nhiêu chuyển động cho mỗi newton) | cánh tay điều khiển vị trí có cảm biến lực, như cánh tay UR |
| Lai lực–vị trí | luật lực trên các trục được chọn, luật vị trí trên các trục còn lại | trục nào điều khiển lực, đích lực | ấn, lau, cắm theo một trục |

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một đích pose rơi sâu 2 mm vào trong một chi tiết cứng (do sai số nhận thức). So lực sinh ra với độ cứng cao và thấp, và chọn giảm chấn để lò xo mềm không dao động.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $\Delta x$ | đích nằm sâu trong chi tiết bao nhiêu | input | 0,002 m |
| $K$ | độ cứng bộ điều khiển | input | 50.000 N/m (cứng) hoặc 1.000 N/m (mềm) |
| $m$ | khối lượng biểu kiến của đầu công tác | hằng số | 2 kg (minh họa) |
| $F$ | lực tiếp xúc ổn định | output | – |
| $D_{crit}$ | giảm chấn tới hạn | output | – |

**Công thức** (chi tiết cứng hơn nhiều so với bộ điều khiển)

$$F \approx K\,\Delta x, \qquad D_{crit} = 2\sqrt{K m}$$

**Từng bước**

1. Cứng: $F = 50.000 \times 0{,}002 = 100$ N. CR-VLA-Force báo cáo UR5e của họ dừng khi vượt 75 N.
2. Mềm: $F = 1.000 \times 0{,}002 = 2$ N.
3. Giảm chấn cho thiết lập mềm: $D_{crit} = 2\sqrt{1.000 \times 2} = 2 \times 44{,}7 = 89{,}4$ N·s/m.

**Kết quả.** Cùng sai số 2 mm cho 100 N với thiết lập cứng và 2 N với thiết lập mềm; khoảng 89 N·s/m giảm chấn giúp lò xo mềm ổn định mà không nảy.

**Ý nghĩa.** Độ cứng biến sai số vị trí thành lực. Một chính sách lệch vài milimét là chuyện bình thường; với bộ điều khiển mềm, cái giá là vài newton, với bộ cứng, cái giá là chi tiết. Cái giá của sự mềm là độ chính xác khi có nhiễu, vì thế CR-VLA-Force điều chỉnh $K$ trong giới hạn của nó theo sai số lực, và vì sao nhiều chính sách xuất thêm một lực hoặc độ cứng bên cạnh pose ([Survey 3](survey-force-output.html)).
</div>

## 3. Chọn trong thực tế

- **Cánh tay của bạn quyết định trước.** Cánh tay điều khiển mô-men (Franka, Flexiv) chạy trực tiếp điều khiển impedance. Cánh tay điều khiển vị trí như cánh tay UR thường làm điều khiển kiểu admittance dựa trên cảm biến lực cổ tay; cánh tay UR có một chế độ lực (force mode) trong ngôn ngữ script của nó cho việc này. CR-VLA-Force xây bộ điều khiển của họ trên UR5e qua RTDE.
- **Ấn, cắm, lau: dùng điều khiển lai.** Ấn một cái nắp vào bình tự nhiên là bài toán lực theo trục ấn và vị trí theo các trục ngang: giữ 10 N xuống, giữ đúng tâm.
- **Để chính sách đặt cấu hình cho bộ điều khiển.** ForceVLA2 xuất pose và lực; CR-VLA-Force xuất một lực mong muốn để bộ điều khiển bám theo; FIRe cộng một residual học được lên trên một bộ điều khiển impedance ([residual policy](residual-policy.html)).

**Mang theo:** khi đã có cảm biến và điều khiển, các paper lực khác nhau ở chỗ đưa lực vào VLA ở đâu. Bản đồ của tất cả: [Survey 1](survey-force-map.html).

**Câu kiểm tra:** Với $K = 2.500$ N/m (giới hạn trên của CR-VLA-Force) và cùng sai số 2 mm, lực là bao nhiêu? Giảm chấn tới hạn với $m = 2$ kg là bao nhiêu?

<details markdown="1">
<summary>Đáp án</summary>

$F = 2.500 \times 0{,}002 = 5$ N. $D_{crit} = 2\sqrt{2.500 \times 2} = 2 \times 70{,}7 = 141{,}4$ N·s/m.
</details>
:::
