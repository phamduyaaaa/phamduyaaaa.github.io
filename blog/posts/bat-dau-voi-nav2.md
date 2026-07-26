---
slug: bat-dau-voi-nav2
date: 2026-07-25
title_en: Getting Started with Nav2 on a Real Robot
title_vi: Bắt đầu với Nav2 trên robot thật
excerpt_en: Notes on the gap between Nav2 in simulation and Nav2 on a robot that has to work every single time, on a real floor.
excerpt_vi: Ghi chú về khoảng cách giữa Nav2 trên mô phỏng và Nav2 trên robot phải chạy đúng mọi lúc, trên sàn nhà thật.
tags: [ROS2, Nav2, SLAM]
---

:::en
## Simulation lies, gently

Every Nav2 tutorial starts the same way: spin up Gazebo, load a clean map,
watch the robot glide to its goal. It works. It always works in simulation,
because simulation doesn't have a reflective floor, a Wi-Fi dead zone, or a
customer standing exactly where the costmap said was clear.

The first time I deployed Nav2 into a hospital corridor, three things broke
that never once broke in sim:

- **AMCL lost localization** near a long, flat, low-texture wall — not enough
  features for the particle filter to converge confidently.
- **The local costmap thrashed** every time a sliding glass door opened,
  because the LiDAR briefly saw "through" it.
- **DDS discovery** intermittently dropped nodes on the facility's crowded
  2.4GHz network, which looks nothing like a lab's dedicated switch.

None of this means Nav2 is fragile. It means the tutorial map is a lie by
omission — a useful one, for learning the API, but not for planning your
deployment timeline.

## What actually matters in production

If I were re-teaching myself Nav2 for deployment (not for a demo), I'd
spend disproportionate time on three things:

1. **Costmap tuning under real sensor noise.** Turn on your actual LiDAR in
   the actual environment before you touch a single planner parameter.
2. **Recovery behaviors as a first-class citizen**, not an afterthought.
   `spin`, `back_up`, and `wait` cost you almost nothing to configure and
   save you from a surprising number of stuck states.
3. **Operator-facing failure messages.** A robot that silently fails a goal
   is a support ticket. A robot that says "I couldn't find a path — the
   hallway looks blocked" is a five-second fix by a non-technical operator.

```bash
ros2 launch nav2_bringup navigation_launch.py \
  params_file:=./config/nav2_params_production.yaml \
  use_sim_time:=false
```

The `params_file` flag is doing more work than it looks like — that's where
the difference between "works in Gazebo" and "works on the third floor of a
building with bad Wi-Fi" actually lives.
:::

:::vi
## Mô phỏng nói dối, một cách nhẹ nhàng

Mọi tutorial về Nav2 đều bắt đầu giống nhau: mở Gazebo, nạp một bản đồ sạch
sẽ, xem robot lướt êm tới đích. Nó chạy được. Nó luôn chạy được trong mô
phỏng, vì mô phỏng không có sàn phản chiếu ánh sáng, không có vùng chết
Wi-Fi, và không có khách hàng đứng đúng chỗ mà costmap báo là trống.

Lần đầu tiên tôi triển khai Nav2 vào hành lang bệnh viện, ba thứ đã hỏng mà
chưa từng hỏng dù chỉ một lần trong mô phỏng:

- **AMCL mất định vị** gần một bức tường dài, phẳng, ít đặc trưng — không đủ
  feature để particle filter hội tụ một cách chắc chắn.
- **Local costmap loạn nhịp** mỗi khi cửa kính trượt mở ra, vì LiDAR thoáng
  chốc "nhìn xuyên" qua nó.
- **DDS discovery** thỉnh thoảng rớt node trên mạng 2.4GHz đông đúc của tòa
  nhà — hoàn toàn khác với switch riêng trong phòng lab.

Điều này không có nghĩa Nav2 mong manh. Nó có nghĩa là bản đồ trong tutorial
là một lời nói dối do thiếu sót — hữu ích để học API, nhưng không đủ để lên
kế hoạch triển khai thực tế.

## Điều thực sự quan trọng khi đưa vào sản xuất

Nếu phải học lại Nav2 để triển khai (không phải để demo), tôi sẽ dành phần
lớn thời gian cho ba việc:

1. **Tinh chỉnh costmap dưới nhiễu cảm biến thật.** Bật LiDAR thật trong môi
   trường thật trước khi đụng vào bất kỳ tham số planner nào.
2. **Coi recovery behaviors là công dân hạng nhất**, không phải chuyện phụ.
   `spin`, `back_up`, và `wait` gần như không tốn công cấu hình mà cứu bạn
   khỏi rất nhiều trạng thái bị kẹt.
3. **Thông báo lỗi hướng tới người vận hành.** Một robot âm thầm fail mục
   tiêu là một ticket hỗ trợ. Một robot nói "Tôi không tìm được đường —
   hành lang có vẻ bị chặn" là một lần sửa 5 giây bởi người vận hành không
   chuyên kỹ thuật.

```bash
ros2 launch nav2_bringup navigation_launch.py \
  params_file:=./config/nav2_params_production.yaml \
  use_sim_time:=false
```

Cờ `params_file` đang gánh nhiều việc hơn vẻ ngoài của nó — đó chính là nơi
tạo ra khác biệt giữa "chạy được trên Gazebo" và "chạy được ở tầng ba của
tòa nhà có Wi-Fi kém".
:::
