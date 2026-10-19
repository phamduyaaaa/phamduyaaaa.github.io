---
slug: survey-force-map
date: 2026-10-18
title_en: "Survey 1: Where Does Force Enter a VLA?"
title_vi: "Survey 1: Lực đi vào VLA ở đâu?"
excerpt_en: "Start here. A map of 33 force, torque and touch VLA methods (2025-2026), sorted by the one choice every one of them has to make: where the contact signal joins the pipeline. With a reading order, a one-page matrix, and references."
excerpt_vi: "Bắt đầu từ đây. Bản đồ 33 phương pháp VLA dùng lực, mô-men và xúc giác (2025-2026), xếp theo một lựa chọn mà phương pháp nào cũng phải đưa ra: tín hiệu tiếp xúc nhập vào pipeline ở chỗ nào. Có lộ trình đọc, ma trận một trang và tài liệu tham khảo."
tags: [VLA, Force, Tactile, Survey]
---

:::en
<div class="tldr" markdown="1">
**SERIES** Survey 1 of 3 · [Survey 2: sensing](survey-force-sensing.html) · [Survey 3: outputs and learning](survey-force-output.html)

**THE PROBLEM** Models like π0, OpenVLA and RDT see pictures and read words. They cannot feel. So they fail exactly where touch decides the job: pushing a part into a slot, wiping a table, holding an egg, working with a hand hidden from the camera.

**THE OBVIOUS FIX THAT DOES NOT WORK** Just append the force reading to the robot state. In ForceVLA's tests this gave +2.9 points for π0-base and −16.8 for π0-fast [2]. One force number gets lost among about 800 image and text tokens (worked out below).

**THE MAP** Six places where force can join: the VLM's input, right after the VLM, inside the action expert, outside the VLA, in training only, or as something the model predicts.

**TAKEAWAY** Most recent methods give force its own protected and fast path, and a growing number drop the force sensor at run time.
</div>

## 0. How to read this page (and this site)

[[fig:survey-roadmap]] Read basics once, then π0, then this map. Surveys 2 and 3 zoom in on two questions the map raises. Paper notes come last, picked by the entry point you care about.

| Route | Time | What to read | You end up knowing |
|---|---|---|---|
| Quick look | 5 min | the summary box above, the matrix in section 3 | which design families exist |
| Working knowledge | 30 min | this survey, then [Survey 2](survey-force-sensing.html) and [Survey 3](survey-force-output.html); do the three calculation cards | how to choose a design for your robot |
| Deep | a few evenings | the basics, [π0](pi0.html), the surveys, then the paper notes for your entry point | enough to reproduce or extend a method |

## 1. Why one force number gets ignored

Picture a meeting of 789 people where one person has something important to say but speaks at the same volume as everyone else. Nobody notices. A transformer's attention works the same way: every token competes for attention, and one force token competes with hundreds of image tokens.

[[flow]]
- Naive~force in the crowd | 768 image + 20 text tokens > !+ 1 force token! > VLM attention | gets about 0.1% of attention
+ Most methods | force > *Its own path~MoE, adapter, bypass, controller* > Action | force cannot be drowned out
[[/flow]] The pattern behind almost every design in this survey.

<div class="calc" markdown="1">
Calculation card

**What and why.** How much attention does one force token get, and how much louder must it be to matter? The answer explains why so many methods build a separate path for force.

| Symbol | Meaning | Type | Example |
|---|---|---|---|
| $N$ | total tokens: 3 views × 256 image tokens + text + 1 force token | input | $768 + 20 + 1 = 789$ |
| $\Delta$ | how much larger the force token's score is than every other token's | unknown | – |
| $p_F$ | share of attention that lands on the force token | output | – |

**Formula** (softmax, every other score equal)

$$p_F = \frac{e^{\Delta}}{e^{\Delta} + (N - 1)}$$

**Steps**

1. Equal scores ($\Delta = 0$): $p_F = 1/789 \approx 0.0013$.
2. To reach $p_F = 0.5$ we need $e^{\Delta} = N - 1 = 788$.
3. So $\Delta = \ln 788 \approx 6.7$.

**Result.** The force token must outscore every other token by about 6.7 to get half the attention.

**Why it matters.** The model would have to learn that gap from a few hundred demonstrations, and only on the few steps where contact happens. A dedicated path skips the competition.
</div>

## 2. The map: six entry points

[[fig:survey-force-flow-anim]] Animated: a force signal travelling along each of the four paths that touch the running pipeline (entry points ① to ④). Entry points ⑤ and ⑥ are about training and prediction, so they are not on this picture.

[[fig:survey-force-map]] The same six entry points with the methods that use each. DAM-VLA (*) treats force/torque as its high-rate modality.

| # | Entry point | In plain words | Typical form |
|---|---|---|---|
| ① | VLM input | force goes in next to the image, as a token or as words | token, text, prompt |
| ② | After the VLM | the VLM finishes first; a separate module then mixes in force | MoE, cross-attention |
| ③ | Inside the action expert | force goes straight into the part that produces actions | extra tokens, adapters, grafted expert |
| ④ | Outside the VLA | a faster controller or small corrector changes the action the VLA chose | fast loop beside the VLA |
| ⑤ | Training only | force teaches the model but is absent when it runs | teacher, reward, curriculum |
| ⑥ | Predicted | the model forecasts future force or touch | extra training target, world model |

[[bars:]] ① VLM input=7; ② After the VLM=7; ③ Action expert=7; *④ Outside the VLA=13*; ⑤ Training only=5; ⑥ Predicted=8 || How many of the 33 methods use each entry point (many use two, so the total is above 33).

## 3. All 33 on one page

[[fig:survey-force-matrix]] One row per method, ordered by arXiv date; a dot means the method uses that entry point. Filled yellow dots mark methods that have a full note on this site. Look down a column to see what a design family looks like; look along a row to see how a method combines choices.

[[bars:]] Q2 2025=2; Q3 2025=5; Q4 2025=0; Q1 2026=9; Q2 2026=4; *Q3 2026=13* || New methods per quarter (arXiv first submission, from the 33 below). My search found none for Q4 2025; the surge in Q3 2026 may partly reflect how recent the search was.

## 4. Five patterns that keep showing up

| Pattern | What it means | Evidence | Methods |
|---|---|---|---|
| Fuse after the VLM, not before | give force its own module once the VLM has understood the scene | MoE before the VLM scored 0%, after it 80% (ForceVLA); decoder adapters beat encoder ones (TA-VLA) | ForceVLA [2], [TA-VLA](ta-vla.html) [7] |
| Do not disturb the pretrained model | new paths start at "add nothing" and grow | residuals, zero-initialised paths, gated cross-attention | MoDE-VLA [14], TORL-VLA [18], LIFT [22], DAM-VLA [19] |
| Fast next to slow | force changes in milliseconds, a VLA replans a few times per second | a fast part runs beside the VLA | FAVLA [12], LIFT [22], ForceDelta-VLA [29], DAM-VLA [19], TacPAC [26], TER-DAgger [13] |
| Remove the sensor | use force only to train, or infer it from joint torque | no sensor to break or buy | FD-VLA [10], HapticVLA [16], FWBC-VLA [25] |
| Output more than a pose | the policy asks for a force or a stiffness ([Survey 3](survey-force-output.html)) | force target or stiffness in the action | ForceVLA2 [15], Tabero [17], Tactile-VLA [3], Opt2VLA [32], CompVLA [31] |

## 5. Which note should I read? A scenario map

Pick the row that looks most like your robot and your task. ● means start there, ○ means read it next.

[[fig:survey-force-readmap]] Ten concrete situations against the posts on this site. Each situation is explained in the table below.

| Scenario: a concrete picture | What goes wrong with a plain VLA | Start with, and why | Then |
|---|---|---|---|
| **A.** A robot arm has a force/torque sensor at the wrist and must push a plug into a socket, wipe a whiteboard or peel a cucumber | It sees the plug but not how hard it pushes. Simply appending force to the state barely helps (+2.9 points for π0-base) | [ForceVLA](forcevla.html): gives force its own module after the VLM. 60.5% against 37.3% for π0-base on five tasks | [ForceVLA2](forcevla2.html) if you also want to ask for a force; [TORL-VLA](torl-vla.html) to keep improving online |
| **B.** The instruction says "pick up the egg gently", or the object is a thin waffle | A pose-only policy cannot squeeze less; the force comes from the controller's stiffness | [Tabero](tabero.html): policy that outputs force targets; 89% less grip force when told "gently". [ForceVLA2](forcevla2.html): outputs pose and force; 66% against 48% for π0 on its five tasks (wiping, pressing, assembling) | [HapticVLA](hapticvla.html) if the deployed gripper has no touch sensor |
| **C.** A parallel gripper carries a gel touch sensor; tasks involve a tool or a deformable object | Touch images are read like extra camera views: texture is captured, how hard the press is is not | [TaF-VLA](taf-vla.html): aligns touch with force first. 64.8% against 42.8% for FreeTacMan and 37.1% for π0.5 without touch | [VLA-Touch](vla-touch.html) (touch without retraining the VLA); [GelSight](gelsight.html) (how the sensor works) |
| **D.** You use a VLA such as RDT and do not want to change it, but a planner should tell hard from soft by touch | A language model cannot read raw touch images; it answers that it cannot determine | [VLA-Touch](vla-touch.html): turns touch into words for the planner and adds a small refiner. Out of 20: cup placing 10 against 7, wiping 12 against 5, peeling 10 against 6 | [GelSight](gelsight.html) |
| **E.** A force sensor is available in the lab but not on the deployed robot (cost, breakage) | Anything that reads force at run time stops working | [FD-VLA](fd-vla.html): train with force, deploy without; 61.1% against 46.7% for π0 on whiteboard cleaning, pressing an emergency button and plug insertion. [HapticVLA](hapticvla.html): jar, waffles, egg; 86.7% | [TA-VLA](ta-vla.html) (torque from the motors), [FWBC-VLA](fwbc-vla.html) |
| **F.** A 7-joint arm has only motor currents; it must push a button, plug a charger, turn a door handle | Plain π0 got 0 of 20 on the charger | [TA-VLA](ta-vla.html): one torque-history token in the decoder. 86% against 23% (my averages over five tasks) | [FWBC-VLA](fwbc-vla.html) (force from torque for the whole body), [MoDE-VLA](mode-vla.html) |
| **G.** Insert a USB or a two- or three-pin plug with tight tolerance; a person can help but should not have to watch all day | A cloned policy drifts and fails exactly at contact (see [imitation learning](imitation-learning.html)) | [TER-DAgger](ter-dagger.html): a force-error alarm calls the human; a fast residual corrects. 77.2% against 40.0% for the best baseline | [TORL-VLA](torl-vla.html) |
| **H.** A wheel-legged mobile robot wipes a whiteboard or pushes a spring-closed door | Arm-only force policies adapt the arm, but the pushed body is not corrected | [FWBC-VLA](fwbc-vla.html): door 52% against 12% for ForceVLA, whiteboard 64% against 24% | [ForceVLA](forcevla.html) |
| **I.** A multi-fingered hand and a second arm peel an apple, rearrange tubes or assemble gears | New force and touch signals overwrite what the pretrained model knows | [MoDE-VLA](mode-vla.html): separate sparse-MoE path with residuals. 34% against 15% for π0 on average | [ForceVLA](forcevla.html) as the simpler baseline |
| **J.** The robot keeps failing the same contact (cup into a narrow holder, a latch, a fragile egg) even after fine-tuning | Offline demonstrations stop improving the policy | [TORL-VLA](torl-vla.html): online reinforcement learning on top of a force-aware VLA | [TER-DAgger](ter-dagger.html) |

Two cautions. The numbers in the "start with" column come from different papers, with different tasks and robots, so they show the size of a gain *inside* each paper, not which method is best ([Survey 3](survey-force-output.html) shows ForceVLA alone scoring 12% to 60.5% depending on who ran it). And if no row fits, go to [Survey 2](survey-force-sensing.html) to find your sensor, then [Survey 3](survey-force-output.html) to choose what the policy should output.

## 6. The full table

"Read": **full** = detailed note on this site, checked against the full text; **abstract+** = abstract plus a targeted look at the full text for the fields marked n/s; **abstract** = classified from the arXiv abstract only. n/s = not stated in what I read. The number in the first column is the reference number at the end of this page.

| # | Method | Date | Signal | Enters at | Output | Learning | Read |
|---|---|---|---|---|---|---|---|
| 1 | [VTLA](https://arxiv.org/abs/2505.09577) | 05/2025 | tactile | ① | actions | preference learning (DPO) | abstract |
| 2 | [ForceVLA](forcevla.html) | 05/2025 | wrist F/T | ② | pose | imitation, π0 | full |
| 3 | [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 07/2025 | tactile | ① ④ | to hybrid position-force control | few demonstrations | abstract |
| 4 | [VLA-Touch](vla-touch.html) | 07/2025 | GelSight | ① planner text, ④ refiner | refined chunk | refiner only, RDT | full |
| 5 | [VLH](https://arxiv.org/abs/2508.01361) | 08/2025 | none (haptics is an output to a human) | – | motion + haptic commands | LoRA, OpenVLA | abstract |
| 6 | [OmniVTLA](https://arxiv.org/abs/2508.08706) | 08/2025 | vision- and force-based tactile | ① | actions | semantic-aligned encoder | abstract |
| 7 | [TA-VLA](ta-vla.html) | 09/2025 | joint torque from motor current | ③ ⑥ | actions + torque | LoRA imitation on π0 (also RDT), action-torque diffusion | full |
| 8 | [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 01/2026 | F/T at the controller | ④ | stiffness + damping | VLM-guided | abstract |
| 9 | [TaF-VLA](taf-vla.html) | 01/2026 | vision tactile aligned to F/T | ③ ⑤ | actions | contrastive pretraining, π0.5 | full |
| 10 | [FD-VLA](fd-vla.html) | 02/2026 | F/T (training only) | ① ⑤ | actions | distillation, SmolVLA | full |
| 11 | [CRAFT](https://arxiv.org/abs/2602.12532) | 02/2026 | force | ⑤ | actions | curriculum fine-tuning | abstract |
| 12 | [FAVLA](https://arxiv.org/abs/2602.23648) | 02/2026 | F/T | ③ | fast actions | fast-slow | abstract |
| 13 | [TER-DAgger](ter-dagger.html) | 03/2026 | wrench from joint torque | ④ ⑥ | base + residual | DAgger, ACT (not a VLA) | full |
| 14 | [MoDE-VLA](mode-vla.html) | 03/2026 | joint torque, fingertip tactile | ② | arm/hand residual | imitation + RL hand skill, π0 | full |
| 15 | [ForceVLA2](forcevla2.html) | 03/2026 | wrist F/T, force prompt | ① ② | pose + force | imitation, π0 | full |
| 16 | [HapticVLA](hapticvla.html) | 03/2026 | taxel arrays (training only) | ⑤ | actions | reward-weighted + distillation, SmolVLA | full |
| 17 | [Tabero](tabero.html) | 05/2026 | simulated tactile + fingertip force | ① ④ | pose + grip/applied force | LoRA imitation, π0 | full |
| 18 | [TORL-VLA](torl-vla.html) | 06/2026 | piezo pads → wrench | ② ⑥ | actions + future wrench | imitation + online RL, π0.5 | full |
| 19 | [DAM-VLA](https://arxiv.org/abs/2606.12105) | 06/2026 | force/torque as the high-rate modality (X-VLA backbone) | ③ | 100 Hz actions | n/s | abstract+ |
| 20 | [UniTacVLA](https://arxiv.org/abs/2606.31723) | 06/2026 | fingertip visuo-tactile (DM-Tac W) | ④ ⑥ | chunk + fast corrections | two stages: backbone, then a residual tactile controller | abstract+ |
| 21 | [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 07/2026 | tactile, human video | ⑤ ⑥ | actions + future touch | human pretraining | abstract |
| 22 | [LIFT](https://arxiv.org/abs/2607.14236) | 07/2026 | 6D end-effector force | ③ | actions | post-training + DAgger | abstract |
| 23 | [FM-VLA](https://arxiv.org/abs/2607.18231) | 07/2026 | force history | ③ | actions | VAE memory | abstract |
| 24 | [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 08/2026 | six-axis force sensor, ultrasound probe | ② | probe motion | n/s | abstract+ |
| 25 | [FWBC-VLA](fwbc-vla.html) | 09/2026 | sensorless, from joint torque | ③ ④ | actions + base residual | imitation, π0.5 | full |
| 26 | [TacPAC](https://arxiv.org/abs/2609.05266) | 09/2026 | tactile images | ④ ⑥ | corrected chunk | flow-matching world-action model + tactile corrector trained on its own plans | abstract+ |
| 27 | [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 09/2026 | F/T sequence | ② ④ | via compliance controller | multi-stage imitation | abstract |
| 28 | [DeCAL](https://arxiv.org/abs/2609.09119) | 09/2026 | tactile images + 6-DoF fingertip force estimated from them | ② ⑥ | actions | mixture-of-transformers, factorised flow matching for arm and hand | abstract+ |
| 29 | [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 09/2026 | force history | ④ | corrected actions | distillation | abstract |
| 30 | [ForceRFT](https://arxiv.org/abs/2609.22840) | 09/2026 | wrist wrench | ④ | pose residuals | residual RL, SmolVLA prior | abstract |
| 31 | [CompVLA](https://arxiv.org/abs/2609.23614) | 09/2026 | force-feedback teleoperation demos (training) | ④ | stiffness + virtual displacement | stiffness and virtual displacement inferred from demos | abstract+ |
| 32 | [Opt2VLA](https://arxiv.org/abs/2609.23968) | 09/2026 | joint-torque references from trajectory optimisation (training) | ④ | motion + force references | trajectory-optimisation force supervision + RL whole-body controllers | abstract+ |
| 33 | [DexTacWAM](https://arxiv.org/abs/2609.24976) | 09/2026 | fingertip tactile | ⑥ | actions + predicted touch | video world model | abstract |

## 7. Caveats

- 14 of the 33 rows come from abstracts only and 7 from abstracts plus a targeted look at the full text (only for fields that were unclear); "n/s" means I could not tell, not that the paper lacks it.
- The set reflects one search in October 2026. It is a snapshot, not a complete census.
- Dates are the first arXiv submission (v1).
- Some details in the full notes come from summaries of long papers; each note lists what was not read word for word.

**Carry forward:** the map says *where* force enters. Before that comes *what* is measured and in what form it reaches the network: [Survey 2](survey-force-sensing.html).

**Check question:** 3 × 256 image tokens, 30 text tokens, 1 force token. What is $p_F$ under equal scores, and what $\Delta$ gives $p_F = 0.5$?

<details markdown="1">
<summary>Answer</summary>

$N = 799$: $p_F = 1/799 \approx 0.00125$. $e^{\Delta} = 798$, so $\Delta = \ln 798 \approx 6.7$.
</details>

## References

Numbers match the first column of the table. Titles are as listed on arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.

Base models mentioned: π0 ([arXiv:2410.24164](https://arxiv.org/abs/2410.24164)), see also the [π0 note](pi0.html).
:::

:::vi
<div class="tldr" markdown="1">
**SERIES** Survey 1 / 3 · [Survey 2: cảm biến](survey-force-sensing.html) · [Survey 3: đầu ra và cách học](survey-force-output.html)

**VẤN ĐỀ** Các mô hình như π0, OpenVLA, RDT nhìn được ảnh và đọc được chữ, nhưng không "sờ" được. Vì thế chúng hỏng đúng lúc xúc giác quyết định thành bại: nhét chi tiết vào khe, lau bàn, cầm quả trứng, hay làm việc khi bàn tay bị che khỏi camera.

**CÁCH SỬA HIỂN NHIÊN NHƯNG KHÔNG ĂN THUA** Cứ nối số đo lực vào trạng thái robot. Trong thí nghiệm của ForceVLA, cách này chỉ hơn 2,9 điểm với π0-base và còn tệ đi 16,8 điểm với π0-fast [2]. Một con số lực lạc giữa khoảng 800 token ảnh và chữ (tính ngay bên dưới).

**BẢN ĐỒ** Có sáu chỗ để lực đi vào: đầu vào của VLM, ngay sau VLM, bên trong action expert, ở ngoài VLA, chỉ lúc huấn luyện, hoặc là thứ mô hình tự dự đoán.

**RÚT RA** Phần lớn phương pháp gần đây cho lực một đường đi riêng, được bảo vệ và nhanh. Ngày càng nhiều phương pháp bỏ hẳn cảm biến lực khi chạy thật.
</div>

## 0. Cách đọc trang này (và cả site này)

[[fig:survey-roadmap]] Đọc phần cơ bản một lần, rồi đến π0, rồi đến bản đồ này. Survey 2 và 3 phóng to vào hai câu hỏi mà bản đồ gợi ra. Các bài về từng paper để cuối, chọn theo chỗ lực đi vào mà bạn quan tâm.

| Lộ trình | Thời gian | Đọc gì | Bạn sẽ biết |
|---|---|---|---|
| Xem nhanh | 5 phút | khung tóm tắt phía trên, ma trận ở mục 3 | có những họ thiết kế nào |
| Nắm được việc | 30 phút | survey này, rồi [Survey 2](survey-force-sensing.html) và [Survey 3](survey-force-output.html); tự tính ba thẻ tính tay | chọn thiết kế cho robot của mình |
| Đi sâu | vài buổi tối | phần cơ bản, [π0](pi0.html), ba survey, rồi các bài paper theo điểm đi vào bạn chọn | đủ để tái hiện hoặc mở rộng một phương pháp |

## 1. Vì sao một con số lực bị bỏ qua

Hình dung một cuộc họp 789 người, trong đó một người có điều rất quan trọng cần nói nhưng chỉ nói to bằng mọi người khác. Chẳng ai để ý. Attention của transformer cũng vậy: mọi token tranh nhau sự chú ý, và một token lực phải tranh với hàng trăm token ảnh.

[[flow]]
- Cách ngây thơ~lực lẫn trong đám đông | 768 token ảnh + 20 token chữ > !+ 1 token lực! > Attention của VLM | chỉ nhận khoảng 0,1% attention
+ Đa số phương pháp | lực > *Đường đi riêng~MoE, adapter, bypass, bộ điều khiển* > Hành động | lực không bị nhấn chìm
[[/flow]] Đây là khuôn mẫu đứng sau gần như mọi thiết kế trong survey này.

<div class="calc" markdown="1">
Thẻ tính tay

**Tính gì và vì sao.** Một token lực nhận được bao nhiêu attention, và nó phải "to tiếng" hơn bao nhiêu mới có trọng lượng? Câu trả lời giải thích vì sao nhiều phương pháp dựng riêng một đường cho lực.

| Ký hiệu | Nghĩa | Loại | Ví dụ |
|---|---|---|---|
| $N$ | tổng số token: 3 góc nhìn × 256 token ảnh + chữ + 1 token lực | input | $768 + 20 + 1 = 789$ |
| $\Delta$ | điểm của token lực cao hơn điểm của mỗi token khác bao nhiêu | ẩn số | – |
| $p_F$ | phần attention rơi vào token lực | output | – |

**Công thức** (softmax, mọi điểm khác bằng nhau)

$$p_F = \frac{e^{\Delta}}{e^{\Delta} + (N - 1)}$$

**Từng bước**

1. Điểm bằng nhau ($\Delta = 0$): $p_F = 1/789 \approx 0{,}0013$.
2. Muốn $p_F = 0{,}5$ thì cần $e^{\Delta} = N - 1 = 788$.
3. Suy ra $\Delta = \ln 788 \approx 6{,}7$.

**Kết quả.** Token lực phải vượt điểm của mọi token khác khoảng 6,7 mới giành được một nửa attention.

**Ý nghĩa.** Mô hình phải học ra khoảng cách đó từ vài trăm bản demo, mà chỉ ở vài bước có tiếp xúc. Cho lực một đường riêng thì khỏi phải tranh giành.
</div>

## 2. Bản đồ: sáu chỗ để lực đi vào

[[fig:survey-force-flow-anim]] Hình động: tín hiệu lực chạy lần lượt qua bốn đường nối vào pipeline đang chạy (điểm ① đến ④). Điểm ⑤ và ⑥ liên quan đến huấn luyện và dự đoán nên không nằm trên hình này.

[[fig:survey-force-map]] Cùng sáu điểm đó, kèm các phương pháp dùng từng điểm. DAM-VLA (*) coi F/T là tín hiệu tốc độ cao của nó.

| # | Điểm đi vào | Nói đơn giản | Dạng thường gặp |
|---|---|---|---|
| ① | Đầu vào VLM | lực vào cùng chỗ với ảnh, dưới dạng token hoặc lời nói | token, văn bản, prompt |
| ② | Sau VLM | VLM xử lý xong rồi mới có một khối riêng trộn lực vào | MoE, cross-attention |
| ③ | Trong action expert | lực đi thẳng vào bộ phận sinh hành động | token thêm, adapter, expert ghép |
| ④ | Ngoài VLA | một bộ điều khiển nhanh hoặc bộ chỉnh nhỏ sửa hành động VLA đã chọn | vòng nhanh đặt cạnh VLA |
| ⑤ | Chỉ lúc huấn luyện | lực dạy mô hình nhưng khi chạy thì không còn | thầy, phần thưởng, giáo trình |
| ⑥ | Được dự đoán | mô hình đoán trước lực hoặc xúc giác tương lai | mục tiêu phụ, world model |

[[bars:]] ① Đầu vào VLM=7; ② Sau VLM=7; ③ Action expert=7; *④ Ngoài VLA=13*; ⑤ Chỉ khi huấn luyện=5; ⑥ Được dự đoán=8 || Số phương pháp (trong 33) dùng mỗi điểm đi vào. Nhiều phương pháp dùng hai điểm nên tổng lớn hơn 33.

## 3. Cả 33 phương pháp trên một trang

[[fig:survey-force-matrix]] Mỗi hàng là một phương pháp, xếp theo ngày đăng arXiv; chấm tròn nghĩa là phương pháp dùng điểm đi vào đó. Chấm vàng đặc là những phương pháp đã có bài riêng trên site này. Nhìn dọc một cột để thấy một họ thiết kế trông ra sao; nhìn ngang một hàng để thấy phương pháp đó kết hợp các lựa chọn thế nào.

[[bars:]] Q2/2025=2; Q3/2025=5; Q4/2025=0; Q1/2026=9; Q2/2026=4; *Q3/2026=13* || Số phương pháp mới theo quý (lần đăng arXiv đầu tiên, tính trên 33 phương pháp bên dưới). Lần tìm của mình không thấy phương pháp nào ở Q4/2025; đợt tăng ở Q3/2026 có thể một phần do lần tìm này còn mới.

## 4. Năm khuôn mẫu lặp đi lặp lại

| Khuôn mẫu | Nghĩa là gì | Bằng chứng | Phương pháp |
|---|---|---|---|
| Trộn lực sau VLM, đừng trước | để VLM hiểu cảnh xong rồi mới cho lực một khối riêng | MoE đặt trước VLM đạt 0%, đặt sau đạt 80% (ForceVLA); adapter ở decoder tốt hơn ở encoder (TA-VLA) | ForceVLA [2], [TA-VLA](ta-vla.html) [7] |
| Đừng làm xáo trộn mô hình đã huấn luyện | đường mới khởi đầu ở mức "không thêm gì" rồi lớn dần | residual, đường khởi tạo bằng không, cross-attention có cổng | MoDE-VLA [14], TORL-VLA [18], LIFT [22], DAM-VLA [19] |
| Nhanh đặt cạnh chậm | lực đổi trong vài mili giây, còn VLA chỉ lập lại kế hoạch vài lần mỗi giây | có một phần nhanh chạy cạnh VLA | FAVLA [12], LIFT [22], ForceDelta-VLA [29], DAM-VLA [19], TacPAC [26], TER-DAgger [13] |
| Bỏ cảm biến | chỉ dùng lực để huấn luyện, hoặc suy ra từ mô-men khớp | không có cảm biến để hỏng hay phải mua | FD-VLA [10], HapticVLA [16], FWBC-VLA [25] |
| Xuất ra nhiều hơn một pose | chính sách yêu cầu một lực hoặc một độ cứng ([Survey 3](survey-force-output.html)) | mục tiêu lực hoặc độ cứng nằm trong hành động | ForceVLA2 [15], Tabero [17], Tactile-VLA [3], Opt2VLA [32], CompVLA [31] |

## 5. Mình nên đọc bài nào? Bản đồ theo tình huống

Hãy chọn hàng giống nhất với robot và tác vụ của bạn. ● nghĩa là bắt đầu từ đó, ○ nghĩa là đọc tiếp sau đó.

[[fig:survey-force-readmap]] Mười tình huống cụ thể đặt cạnh các bài trên site này. Từng tình huống được giải thích trong bảng bên dưới.

| Tình huống: một hình dung cụ thể | Với VLA thường, chuyện gì hỏng | Bắt đầu từ đâu, và vì sao | Đọc tiếp |
|---|---|---|---|
| **A.** Cánh tay robot có cảm biến lực/mô-men ở cổ tay, cần ấn đầu cắm vào ổ, lau bảng trắng hoặc gọt dưa chuột | Nó thấy đầu cắm nhưng không biết đang ấn mạnh thế nào. Chỉ nối lực vào trạng thái thì gần như không giúp (+2,9 điểm với π0-base) | [ForceVLA](forcevla.html): cho lực một khối riêng sau VLM. 60,5% so với 37,3% của π0-base trên năm tác vụ | [ForceVLA2](forcevla2.html) nếu bạn còn muốn yêu cầu một lực; [TORL-VLA](torl-vla.html) để tiếp tục cải thiện online |
| **B.** Câu lệnh là "nhặt quả trứng nhẹ nhàng", hoặc vật là chiếc bánh waffle mỏng | Chính sách chỉ xuất pose thì không bóp nhẹ hơn được; lực do độ cứng bộ điều khiển quyết định | [Tabero](tabero.html): chính sách xuất lực mục tiêu; lực kẹp giảm 89% khi được dặn "nhẹ nhàng". [ForceVLA2](forcevla2.html): xuất pose và lực; 66% so với 48% của π0 trên năm tác vụ của nó (lau, ấn, lắp ráp) | [HapticVLA](hapticvla.html) nếu tay kẹp khi triển khai không có cảm biến chạm |
| **C.** Tay kẹp song song gắn cảm biến chạm kiểu gel; tác vụ có dùng dụng cụ hoặc vật biến dạng | Ảnh xúc giác bị đọc như thêm một góc camera: nắm được kết cấu, không nắm được ấn mạnh đến đâu | [TaF-VLA](taf-vla.html): căn xúc giác với lực trước. 64,8% so với 42,8% của FreeTacMan và 37,1% của π0.5 không có xúc giác | [VLA-Touch](vla-touch.html) (thêm xúc giác mà không huấn luyện lại VLA); [GelSight](gelsight.html) (cảm biến hoạt động ra sao) |
| **D.** Bạn dùng VLA như RDT và không muốn đổi nó, nhưng một planner cần phân biệt cứng và mềm bằng xúc giác | Mô hình ngôn ngữ không đọc được ảnh xúc giác thô; nó trả lời là không xác định được | [VLA-Touch](vla-touch.html): đổi xúc giác thành lời cho planner và thêm một bộ tinh chỉnh nhỏ. Trên 20 lượt: đặt cốc 10 so với 7, lau 12 so với 5, gọt 10 so với 6 | [GelSight](gelsight.html) |
| **E.** Trong phòng thí nghiệm có cảm biến lực nhưng robot triển khai thì không (tốn tiền, dễ hỏng) | Mọi thứ đọc lực lúc chạy thật đều ngừng hoạt động | [FD-VLA](fd-vla.html): huấn luyện có lực, triển khai không có; 61,1% so với 46,7% của π0 trên lau bảng, bấm nút khẩn cấp và cắm phích. [HapticVLA](hapticvla.html): hũ, bánh waffle, trứng; 86,7% | [TA-VLA](ta-vla.html) (mô-men từ động cơ), [FWBC-VLA](fwbc-vla.html) |
| **F.** Cánh tay 7 khớp chỉ có dòng điện động cơ; cần bấm nút, cắm sạc, xoay tay nắm cửa | π0 thường đạt 0 trên 20 ở cắm sạc | [TA-VLA](ta-vla.html): một token lịch sử mô-men ở decoder. 86% so với 23% (trung bình mình tính trên năm tác vụ) | [FWBC-VLA](fwbc-vla.html) (lực từ mô-men cho cả thân), [MoDE-VLA](mode-vla.html) |
| **G.** Lắp USB hoặc phích hai, ba chân với dung sai chặt; người có thể giúp nhưng không nên phải ngồi canh cả ngày | Chính sách sao chép bị trôi và hỏng đúng lúc tiếp xúc (xem [imitation learning](imitation-learning.html)) | [TER-DAgger](ter-dagger.html): chuông báo sai số lực gọi người; residual nhanh hiệu chỉnh. 77,2% so với 40,0% của baseline mạnh nhất | [TORL-VLA](torl-vla.html) |
| **H.** Robot di động chân-bánh lau bảng trắng hoặc đẩy cánh cửa có lò xo tự đóng | Chính sách lực chỉ cho cánh tay thì cánh tay thích nghi, nhưng thân bị đẩy đi thì không ai chỉnh | [FWBC-VLA](fwbc-vla.html): cửa 52% so với 12% của ForceVLA, bảng trắng 64% so với 24% | [ForceVLA](forcevla.html) |
| **I.** Một bàn tay nhiều ngón và cánh tay thứ hai gọt táo, sắp xếp ống hoặc lắp bánh răng | Tín hiệu lực và xúc giác mới ghi đè lên những gì mô hình đã tiền huấn luyện biết | [MoDE-VLA](mode-vla.html): đường MoE thưa riêng cùng residual. Trung bình 34% so với 15% của π0 | [ForceVLA](forcevla.html) làm baseline đơn giản hơn |
| **J.** Robot cứ hỏng cùng một tiếp xúc (đặt cốc vào khe hẹp, một chốt cài, quả trứng dễ vỡ) dù đã tinh chỉnh | Demo offline không cải thiện chính sách thêm được nữa | [TORL-VLA](torl-vla.html): học tăng cường online trên nền một VLA nhận biết lực | [TER-DAgger](ter-dagger.html) |

Hai điều cần lưu ý. Các con số ở cột "bắt đầu từ đâu" đến từ những paper khác nhau, với tác vụ và robot khác nhau, nên chúng cho thấy mức cải thiện *trong* từng paper chứ không cho biết phương pháp nào tốt nhất ([Survey 3](survey-force-output.html) cho thấy riêng ForceVLA đạt từ 12% đến 60,5% tùy ai chạy). Và nếu không hàng nào khớp, hãy sang [Survey 2](survey-force-sensing.html) để xác định cảm biến của bạn, rồi [Survey 3](survey-force-output.html) để chọn chính sách nên xuất ra gì.

## 6. Bảng đầy đủ

"Đã đọc": **full** = có bài ghi chú chi tiết trên site, đã đối chiếu toàn văn; **abstract+** = abstract cộng với việc xem có chủ đích toàn văn cho các ô ghi n/s; **abstract** = chỉ phân loại từ abstract trên arXiv. n/s = trong phần mình đọc không thấy nói. Số ở cột đầu là số thứ tự của tài liệu tham khảo ở cuối trang.

| # | Phương pháp | Ngày | Tín hiệu | Đi vào ở | Đầu ra | Cách học | Đã đọc |
|---|---|---|---|---|---|---|---|
| 1 | [VTLA](https://arxiv.org/abs/2505.09577) | 05/2025 | xúc giác | ① | hành động | học theo sở thích (DPO) | abstract |
| 2 | [ForceVLA](forcevla.html) | 05/2025 | F/T cổ tay | ② | pose | imitation, π0 | full |
| 3 | [Tactile-VLA](https://arxiv.org/abs/2507.09160) | 07/2025 | xúc giác | ① ④ | sang điều khiển lai vị trí-lực | vài bản demo | abstract |
| 4 | [VLA-Touch](vla-touch.html) | 07/2025 | GelSight | ① văn bản cho planner, ④ bộ tinh chỉnh | đoạn hành động đã tinh chỉnh | chỉ huấn luyện bộ tinh chỉnh, RDT | full |
| 5 | [VLH](https://arxiv.org/abs/2508.01361) | 08/2025 | không có (haptics là đầu ra cho người) | – | chuyển động + lệnh haptic | LoRA, OpenVLA | abstract |
| 6 | [OmniVTLA](https://arxiv.org/abs/2508.08706) | 08/2025 | xúc giác dựa ảnh và dựa lực | ① | hành động | encoder căn theo ngữ nghĩa | abstract |
| 7 | [TA-VLA](ta-vla.html) | 09/2025 | mô-men khớp từ dòng điện động cơ | ③ ⑥ | hành động + mô-men | LoRA imitation trên π0 (thử cả RDT), diffusion hành động-mô-men | full |
| 8 | [CompliantVLA-adaptor](https://arxiv.org/abs/2601.15541) | 01/2026 | F/T tại bộ điều khiển | ④ | độ cứng + giảm chấn | VLM dẫn đường | abstract |
| 9 | [TaF-VLA](taf-vla.html) | 01/2026 | xúc giác ảnh căn với F/T | ③ ⑤ | hành động | tiền huấn luyện contrastive, π0.5 | full |
| 10 | [FD-VLA](fd-vla.html) | 02/2026 | F/T (chỉ khi huấn luyện) | ① ⑤ | hành động | chưng cất, SmolVLA | full |
| 11 | [CRAFT](https://arxiv.org/abs/2602.12532) | 02/2026 | lực | ⑤ | hành động | tinh chỉnh theo giáo trình | abstract |
| 12 | [FAVLA](https://arxiv.org/abs/2602.23648) | 02/2026 | F/T | ③ | hành động nhanh | nhanh-chậm | abstract |
| 13 | [TER-DAgger](ter-dagger.html) | 03/2026 | wrench suy từ mô-men khớp | ④ ⑥ | cơ sở + residual | DAgger, ACT (không phải VLA) | full |
| 14 | [MoDE-VLA](mode-vla.html) | 03/2026 | mô-men khớp, xúc giác đầu ngón | ② | residual cho tay máy/bàn tay | imitation + RL cho kỹ năng bàn tay, π0 | full |
| 15 | [ForceVLA2](forcevla2.html) | 03/2026 | F/T cổ tay, prompt lực | ① ② | pose + lực | imitation, π0 | full |
| 16 | [HapticVLA](hapticvla.html) | 03/2026 | lưới taxel (chỉ khi huấn luyện) | ⑤ | hành động | trọng số theo thưởng + chưng cất, SmolVLA | full |
| 17 | [Tabero](tabero.html) | 05/2026 | xúc giác mô phỏng + lực đầu ngón | ① ④ | pose + lực kẹp/lực tác dụng | LoRA imitation, π0 | full |
| 18 | [TORL-VLA](torl-vla.html) | 06/2026 | đệm piezo → wrench | ② ⑥ | hành động + wrench tương lai | imitation + RL online, π0.5 | full |
| 19 | [DAM-VLA](https://arxiv.org/abs/2606.12105) | 06/2026 | F/T làm tín hiệu tốc độ cao (backbone X-VLA) | ③ | hành động 100 Hz | n/s | abstract+ |
| 20 | [UniTacVLA](https://arxiv.org/abs/2606.31723) | 06/2026 | xúc giác thị giác ở đầu ngón (DM-Tac W) | ④ ⑥ | đoạn hành động + chỉnh nhanh | hai giai đoạn: backbone, rồi bộ điều khiển xúc giác residual | abstract+ |
| 21 | [H-Tac / TTP](https://arxiv.org/abs/2607.01067) | 07/2026 | xúc giác, video người | ⑤ ⑥ | hành động + xúc giác tương lai | tiền huấn luyện từ người | abstract |
| 22 | [LIFT](https://arxiv.org/abs/2607.14236) | 07/2026 | lực 6D tại đầu công cụ | ③ | hành động | hậu huấn luyện + DAgger | abstract |
| 23 | [FM-VLA](https://arxiv.org/abs/2607.18231) | 07/2026 | lịch sử lực | ③ | hành động | bộ nhớ VAE | abstract |
| 24 | [ForceU-VLA](https://arxiv.org/abs/2608.15009) | 08/2026 | cảm biến lực sáu trục, đầu dò siêu âm | ② | chuyển động đầu dò | n/s | abstract+ |
| 25 | [FWBC-VLA](fwbc-vla.html) | 09/2026 | không cảm biến, suy từ mô-men khớp | ③ ④ | hành động + residual cho thân | imitation, π0.5 | full |
| 26 | [TacPAC](https://arxiv.org/abs/2609.05266) | 09/2026 | ảnh xúc giác | ④ ⑥ | đoạn hành động đã chỉnh | world-action model flow matching + bộ chỉnh xúc giác huấn luyện trên chính kế hoạch của nó | abstract+ |
| 27 | [CR-VLA-Force](https://arxiv.org/abs/2609.05832) | 09/2026 | chuỗi F/T | ② ④ | qua bộ điều khiển mềm dẻo | imitation nhiều giai đoạn | abstract |
| 28 | [DeCAL](https://arxiv.org/abs/2609.09119) | 09/2026 | ảnh xúc giác + lực 6 bậc ở đầu ngón ước lượng từ chính ảnh đó | ② ⑥ | hành động | mixture-of-transformers, flow matching phân tách cho tay máy và bàn tay | abstract+ |
| 29 | [ForceDelta-VLA](https://arxiv.org/abs/2609.18242) | 09/2026 | lịch sử lực | ④ | hành động đã chỉnh | chưng cất | abstract |
| 30 | [ForceRFT](https://arxiv.org/abs/2609.22840) | 09/2026 | wrench cổ tay | ④ | residual cho pose | RL residual, tiên nghiệm SmolVLA | abstract |
| 31 | [CompVLA](https://arxiv.org/abs/2609.23614) | 09/2026 | demo teleoperation có phản hồi lực (khi huấn luyện) | ④ | độ cứng + độ dời ảo | độ cứng và độ dời ảo suy ra từ demo | abstract+ |
| 32 | [Opt2VLA](https://arxiv.org/abs/2609.23968) | 09/2026 | tham chiếu mô-men khớp từ tối ưu quỹ đạo (khi huấn luyện) | ④ | chuyển động + tham chiếu lực | giám sát lực từ tối ưu quỹ đạo + bộ điều khiển toàn thân bằng RL | abstract+ |
| 33 | [DexTacWAM](https://arxiv.org/abs/2609.24976) | 09/2026 | xúc giác đầu ngón | ⑥ | hành động + xúc giác dự đoán | world model video | abstract |

## 7. Lưu ý

- 14 trên 33 hàng chỉ dựa vào abstract và 7 hàng dựa vào abstract cộng việc xem có chủ đích toàn văn (chỉ cho các ô chưa rõ); "n/s" nghĩa là mình không biết, chứ không phải paper không có.
- Danh sách phản ánh một lần tìm kiếm vào tháng 10/2026. Đây là ảnh chụp tại một thời điểm, không phải điều tra đầy đủ.
- Ngày là ngày đăng arXiv lần đầu (v1).
- Một số chi tiết trong các bài chi tiết đến từ bản tóm tắt của paper dài; mỗi bài đều ghi rõ phần nào chưa đọc nguyên văn.

**Mang theo:** bản đồ cho biết lực đi vào *ở đâu*. Trước đó còn câu hỏi *đo cái gì* và tín hiệu đến mạng dưới dạng nào: [Survey 2](survey-force-sensing.html).

**Câu hỏi kiểm tra:** 3 × 256 token ảnh, 30 token chữ, 1 token lực. $p_F$ khi điểm bằng nhau là bao nhiêu, và $\Delta$ bằng bao nhiêu thì $p_F = 0{,}5$?

<details markdown="1">
<summary>Đáp án</summary>

$N = 799$: $p_F = 1/799 \approx 0{,}00125$. $e^{\Delta} = 798$ nên $\Delta = \ln 798 \approx 6{,}7$.
</details>

## Tài liệu tham khảo

Số thứ tự khớp với cột đầu của bảng. Tiêu đề giữ nguyên như trên arXiv.

1. VTLA: Vision-Tactile-Language-Action Model with Preference Learning for Insertion Manipulation. [arXiv:2505.09577](https://arxiv.org/abs/2505.09577), 2025-05-14.
2. ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation. [arXiv:2505.22159](https://arxiv.org/abs/2505.22159), 2025-05-28.
3. Tactile-VLA: Unlocking Vision-Language-Action Model's Physical Knowledge for Tactile Generalization. [arXiv:2507.09160](https://arxiv.org/abs/2507.09160), 2025-07-12.
4. VLA-Touch: Enhancing Vision-Language-Action Models with Dual-Level Tactile Feedback. [arXiv:2507.17294](https://arxiv.org/abs/2507.17294), 2025-07-23.
5. VLH: Vision-Language-Haptics Foundation Model. [arXiv:2508.01361](https://arxiv.org/abs/2508.01361), 2025-08-02.
6. OmniVTLA: Vision-Tactile-Language-Action Models with Semantic-Aligned Tactile Sensing. [arXiv:2508.08706](https://arxiv.org/abs/2508.08706), 2025-08-12.
7. TA-VLA: Elucidating the Design Space of Torque-aware Vision-Language-Action Models. [arXiv:2509.07962](https://arxiv.org/abs/2509.07962), 2025-09-09.
8. CompliantVLA-adaptor: VLM-Guided Variable Impedance Action for Safe Contact-Rich Manipulation. [arXiv:2601.15541](https://arxiv.org/abs/2601.15541), 2026-01-21.
9. TaF-VLA: Tactile-Force Alignment in Vision-Language-Action Models for Force-aware Manipulation. [arXiv:2601.20321](https://arxiv.org/abs/2601.20321), 2026-01-28.
10. FD-VLA: Force-Distilled Vision-Language-Action Model for Contact-Rich Manipulation. [arXiv:2602.02142](https://arxiv.org/abs/2602.02142), 2026-02-02.
11. CRAFT: Adapting VLA Models to Contact-rich Manipulation via Force-aware Curriculum Fine-tuning. [arXiv:2602.12532](https://arxiv.org/abs/2602.12532), 2026-02-13.
12. FAVLA: A Force-Adaptive Fast-Slow VLA model for Contact-Rich Robotic Manipulation. [arXiv:2602.23648](https://arxiv.org/abs/2602.23648), 2026-02-27.
13. Force-Aware Residual DAgger via Trajectory Editing for Precision Insertion with Impedance Control. [arXiv:2603.04038](https://arxiv.org/abs/2603.04038), 2026-03-04.
14. Towards Human-Like Manipulation through RL-Augmented Teleoperation and Mixture-of-Dexterous-Experts VLA. [arXiv:2603.08122](https://arxiv.org/abs/2603.08122), 2026-03-09.
15. ForceVLA2: Unleashing Hybrid Force-Position Control with Force Awareness for Contact-Rich Manipulation. [arXiv:2603.15169](https://arxiv.org/abs/2603.15169), 2026-03-16.
16. HapticVLA: Contact-Rich Manipulation via Vision-Language-Action Model without Inference-Time Tactile Sensing. [arXiv:2603.15257](https://arxiv.org/abs/2603.15257), 2026-03-16.
17. Tabero: Learning Gentle Manipulation with Closed-Loop Force Feedback from Vision, Touch, and Language. [arXiv:2605.27886](https://arxiv.org/abs/2605.27886), 2026-05-27.
18. TORL-VLA: Tactile Guided Online Reinforcement Learning for Contact-Rich Manipulation. [arXiv:2606.09337](https://arxiv.org/abs/2606.09337), 2026-06-08.
19. DAM-VLA: Decoupled Asynchronous Multimodal Vision Language Action model. [arXiv:2606.12105](https://arxiv.org/abs/2606.12105), 2026-06-10.
20. UniTacVLA: Unified Tactile Understanding and Prediction in Vision Language Action Models. [arXiv:2606.31723](https://arxiv.org/abs/2606.31723), 2026-06-30.
21. Human-Centric Transferable Tactile Pre-Training for Dexterous Robotic Manipulation. [arXiv:2607.01067](https://arxiv.org/abs/2607.01067), 2026-07-01.
22. Never Too Late for Force: Accelerating VLA Post-Training with Reactive Force Injection. [arXiv:2607.14236](https://arxiv.org/abs/2607.14236), 2026-07-15.
23. FM-VLA: Force-based Memory for Vision-Language-Action Models in Contact-Rich Manipulation. [arXiv:2607.18231](https://arxiv.org/abs/2607.18231), 2026-07-20.
24. ForceU-VLA: A Force-Aware Vision-Language-Action Model for Embodied Ultrasound Scanning. [arXiv:2608.15009](https://arxiv.org/abs/2608.15009), 2026-08-15.
25. FWBC-VLA: Force-Aware Whole-Body Compensation for Contact-Rich Loco-Manipulation. [arXiv:2609.03889](https://arxiv.org/abs/2609.03889), 2026-09-03.
26. TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation. [arXiv:2609.05266](https://arxiv.org/abs/2609.05266), 2026-09-04.
27. CR-VLA-Force: Learning Control-aware Compliance VLA Model for Robust Contact-rich Robotic Manipulation. [arXiv:2609.05832](https://arxiv.org/abs/2609.05832), 2026-09-05.
28. DeCAL: Towards Physically-Grounded Dexterous Vision-Language-Action Models via Contact-Aware Latent Co-Imagination. [arXiv:2609.09119](https://arxiv.org/abs/2609.09119), 2026-09-08.
29. ForceDelta-VLA: Distilling Force-Conditioned ActionCorrections for Contact-Rich Manipulation. [arXiv:2609.18242](https://arxiv.org/abs/2609.18242), 2026-09-16.
30. ForceRFT: Refining VLA Actions through Force-Guided Residual Reinforcement Learning. [arXiv:2609.22840](https://arxiv.org/abs/2609.22840), 2026-09-19.
31. CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation. [arXiv:2609.23614](https://arxiv.org/abs/2609.23614), 2026-09-20.
32. Opt2VLA: Force-Aware Vision-Language-Action for Contact-Rich Humanoid Whole-Body Manipulation. [arXiv:2609.23968](https://arxiv.org/abs/2609.23968), 2026-09-21.
33. DexTacWAM: A Visuo-Tactile World-Action Model for Dexterous Manipulation. [arXiv:2609.24976](https://arxiv.org/abs/2609.24976), 2026-09-21.

Broader surveys:

- Learning Physical Interaction: A Survey of Tactile- and Force-aware Robot Learning. [arXiv:2608.07558](https://arxiv.org/abs/2608.07558), 2026-08-02.
- Tactile-based Multimodal Fusion in Embodied Intelligence: A Survey of Vision, Language, and Contact-Driven Paradigms. [arXiv:2605.17336](https://arxiv.org/abs/2605.17336), 2026-05-17.

Mô hình nền được nhắc tới: π0 ([arXiv:2410.24164](https://arxiv.org/abs/2410.24164)), xem thêm [bài về π0](pi0.html).
:::
