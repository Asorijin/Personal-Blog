---
title: GAMES101-Animation
date: 2026-05-08
description: 动画与物理模拟
---

# 动画与物理模拟

## 动画基础

动画本质上是连续播放序列帧，利用人眼的视觉暂留产生运动错觉。

### 关键帧动画 Keyframe Animation

由艺术家手动设置关键姿态（关键帧），中间帧由计算机自动插值生成。

线性插值简单但会导致运动僵硬。实际常用样条插值（如 Catmull-Rom 样条），使运动曲线更平滑。

### 物理模拟

对真实世界物理规律的数值近似，相较于人工设置关键帧，物理模拟产生的动画更加真实，也是现代图形学中动画的主要实现方式。

## 质点弹簧系统 Mass-Spring System

质点弹簧系统是最基础的物理模拟模型，由质点和弹簧组成，用于模拟布料、头发等柔性物体。

### 理想弹簧

弹簧两端分别连接两个质点 a 和 b。根据胡克定律：

$$ f_{a \to b} = k_s \cdot (|\mathbf{p}_a - \mathbf{p}_b| - l) $$

其中 $k_s$ 为弹簧劲度系数，$l$ 为弹簧静止长度。

力的方向：由 a 指向 b（拉伸时拉回，压缩时推开）。

### 阻尼力

仅有弹簧的系统会永远振动。引入阻尼力使能量衰减：

$$ f = -k_d \cdot (\mathbf{v}_a - \mathbf{v}_b) $$

阻尼力与两质点的相对速度成正比，方向相反，模拟能量耗散。

> 阻尼力只减缓振动速度，不会改变弹簧的静止长度。

### 布料模拟中的弹簧结构

仅用结构弹簧（连接相邻顶点）不足以模拟真实布料，因为布料抵抗剪切和弯曲。实际需要三种弹簧：

- **结构弹簧（Structural）**：连接 (i,j) 与 (i±1,j)、(i,j±1)，抵抗拉伸
- **剪切弹簧（Shear）**：连接 (i,j) 与 (i±1,j±1)，抵抗剪切变形
- **弯曲弹簧（Bend）**：连接 (i,j) 与 (i±2,j)、(i,j±2)，抵抗弯曲

## 粒子系统 Particle System

粒子系统用于模拟烟雾、火焰、水流、爆炸等模糊现象。

基本框架：
1. **生成粒子**：设定初始位置、速度、生命周期
2. **更新粒子**：每帧计算受力（重力、风力、碰撞等），更新速度和位置
3. **移除死亡粒子**：生命周期结束或超出边界的粒子
4. **渲染粒子**：将粒子渲染为小面片或体积元素

> 粒子之间通常不计算相互作用力，这是粒子系统高效的关键。

## 运动学

### 正向运动学 Forward Kinematics

给定各关节的角度，求解末端效应器（end effector）的位置。

关节类型：
- **旋转关节（Revolute）**：仅能绕轴旋转，1 DOF
- **球关节（Ball/Socket）**：可绕多个轴旋转，3 DOF
- **平移关节（Prismatic）**：仅能沿轴平移，1 DOF

通过变换矩阵链式相乘计算末端位置：

$$ P_{end} = M_0 \cdot M_1(\theta_1) \cdot M_2(\theta_2) \cdot ... \cdot M_n(\theta_n) \cdot P_{origin} $$

正向运动学计算简单，但动画师通常关心的是"手要到达哪里"，而非"关节该转多少度"。

### 逆运动学 Inverse Kinematics

给定末端效应器的目标位置，反求各关节角度。这是一个非线性优化问题。

求解方法：
- **雅可比矩阵法（Jacobian）**：利用雅可比矩阵 $J = \frac{\partial \mathbf{e}}{\partial \theta}$ 建立关节角速度与末端速度的线性关系 $\dot{\mathbf{e}} = J \dot{\theta}$，迭代求解 $\Delta\theta = J^{-1} \Delta\mathbf{e}$。当 J 不可逆时使用伪逆 $J^+$
- **CCD（Cyclic Coordinate Descent）**：从末端关节开始逐级旋转，每次使当前关节指向目标方向，收敛较慢但实现简单

> IK 可能存在多解或无解的情况，需要通过约束和优先级来处理。

## 骨骼绑定与蒙皮 Rigging & Skinning

### 骨骼绑定 Rigging

为角色模型建立骨骼层级结构，定义骨骼之间的父子关系。每个骨骼节点记录相对于父节点的变换。

动画师通过移动骨骼来驱动角色姿态，相比直接操控顶点高效得多。

### 蒙皮 Skinning

蒙皮决定骨骼运动如何影响顶点位置。

**线性混合蒙皮（LBS / Skeletal Subspace Deformation）**：

$$ \mathbf{v}' = \sum_{i} w_i \cdot M_i \cdot \mathbf{v} $$

其中 $w_i$ 为骨骼 i 对该顶点的权重（$\sum w_i = 1$），$M_i$ 为骨骼 i 的变换矩阵。

LBS 的问题：
- 关节处容易出现"糖纸效应"（candy-wrapper artifact）——肘部弯曲时体积塌陷
- 改进方案：双四元数蒙皮（DQS），用双四元数混合代替矩阵混合，能保持体积

## 动作捕捉 Motion Capture

通过传感器记录真实演员的动作数据来驱动虚拟角色。

| 方法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 光学式 | 多个相机追踪反光标记点 | 精度高，动作自由 | 昂贵，遮挡问题 |
| 惯性式 | 穿戴惯性传感器 | 便携，无遮挡 | 精度较低，漂移 |
| 机械式 | 外骨骼机械装置 | 成本低 | 限制运动范围 |

动作捕捉能生成非常自然的动画，但数据需要清理和重定向才能应用到不同的角色上。

## 单粒子模拟与数值积分

### 运动方程

单粒子在力场中的运动由牛顿第二定律描述：

$$ m \cdot \ddot{\mathbf{x}} = \mathbf{F}(\mathbf{x}, \dot{\mathbf{x}}, t) $$

这是一个二阶常微分方程，可改写为一阶方程组：

$$ \begin{cases} \dot{\mathbf{x}} = \mathbf{v} \\ \dot{\mathbf{v}} = \mathbf{F}(\mathbf{x}, \mathbf{v}, t) / m \end{cases} $$

### 显式欧拉方法 Forward/Explicit Euler

当前帧的状态直接推算下一帧：

$$ \mathbf{v}_{t+\Delta t} = \mathbf{v}_t + \Delta t \cdot \mathbf{a}_t $$
$$ \mathbf{x}_{t+\Delta t} = \mathbf{x}_t + \Delta t \cdot \mathbf{v}_t $$

优点：简单直接。
缺点：**无条件不稳定**——误差随步长累积，系统能量不守恒，弹簧系统会逐渐发散。

### 中点法 Midpoint Method

改进的显式方法，先计算半步位置，用半步点的速度做全程更新：

$$ \mathbf{v}_{mid} = \mathbf{v}_t + \frac{\Delta t}{2} \cdot \mathbf{a}(\mathbf{x}_t) $$
$$ \mathbf{x}_{mid} = \mathbf{x}_t + \frac{\Delta t}{2} \cdot \mathbf{v}_t $$
$$ \mathbf{x}_{t+\Delta t} = \mathbf{x}_t + \Delta t \cdot \mathbf{v}_{mid} $$

### 自适应步长 Adaptive Step Size

先以步长 $\Delta t$ 计算一步得到 $\mathbf{x}_a$，再以步长 $\Delta t / 2$ 计算两步得到 $\mathbf{x}_b$，比较两者的差异：

$$ |\mathbf{x}_b - \mathbf{x}_a| > \text{threshold} $$

如果误差过大则减半步长重新计算，在误差可接受范围内动态调整步长。

### 隐式欧拉方法 Backward/Implicit Euler

用下一帧的加速度来更新速度：

$$ \mathbf{v}_{t+\Delta t} = \mathbf{v}_t + \Delta t \cdot \mathbf{a}(\mathbf{x}_{t+\Delta t}) $$
$$ \mathbf{x}_{t+\Delta t} = \mathbf{x}_t + \Delta t \cdot \mathbf{v}_{t+\Delta t} $$

需要求解非线性方程组，通常用牛顿迭代法。计算量大，但**无条件稳定**。

### 龙格-库塔方法 Runge-Kutta Methods

RK4 是常用的四阶方法，每步采样四个点的导数值做加权平均：

$$ \mathbf{k}_1 = \Delta t \cdot f(\mathbf{y}_t) $$
$$ \mathbf{k}_2 = \Delta t \cdot f(\mathbf{y}_t + \frac{1}{2}\mathbf{k}_1) $$
$$ \mathbf{k}_3 = \Delta t \cdot f(\mathbf{y}_t + \frac{1}{2}\mathbf{k}_2) $$
$$ \mathbf{k}_4 = \Delta t \cdot f(\mathbf{y}_t + \mathbf{k}_3) $$
$$ \mathbf{y}_{t+\Delta t} = \mathbf{y}_t + \frac{1}{6}(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4) $$

精度为 $O(\Delta t^4)$，远优于欧拉方法的 $O(\Delta t)$。

### 基于位置的方法 Position-Based Dynamics

直接修正质点位置以满足约束（如弹簧静止长度、不可压缩性），而非通过力的积分。简单、稳定、不易发散，被广泛用于游戏物理引擎。

## 刚体模拟 Rigid Body Simulation

刚体不会发生形变，模拟时需额外处理旋转。

状态量：
- 位置 $\mathbf{x}$ 和速度 $\mathbf{v}$
- 朝向（四元数 $\mathbf{q}$）和角速度 $\boldsymbol{\omega}$

力矩 $\boldsymbol{\tau}$ 与角加速度 $\boldsymbol{\alpha}$ 的关系：$\boldsymbol{\tau} = I \cdot \boldsymbol{\alpha}$，其中 $I$ 为惯性张量。

每帧更新朝向时使用四元数避免万向节锁。

## 流体模拟

### 基于粒子的方法 SPH

平滑粒子流体动力学（Smoothed Particle Hydrodynamics）将流体看作大量粒子，粒子之间通过核函数平滑处理物理量，不需要网格。

### 基于网格的方法

将空间划分为网格，在每个格点求解纳维-斯托克斯方程（Navier-Stokes equations），能较好地保持体积和不可压缩性。

### 混合方法

结合粒子和网格的优点，如 FLIP / PIC 方法，常用于电影级特效。

| 方法 | 优点 | 缺点 |
|------|------|------|
| 粒子法 (SPH) | 质量守恒自然满足，实现简单 | 不可压缩性弱 |
| 网格法 (Eulerian) | 压力求解精确，不可压缩性好 | 体积守恒难保证 |
| 混合法 (FLIP/PIC) | 兼顾两者优点 | 实现复杂 |
