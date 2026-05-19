---
title: GJK 碰撞检测算法
date: 2026-05-19
description: GJK算法核心思想、Minkowski差与单纯形演化的直观讲解
---

# GJK 碰撞检测算法

GJK (Gilbert–Johnson–Keerthi) 是检测两个凸形状是否相交的高效算法，广泛用于物理引擎（Box2D、Bullet、PhysX）和游戏开发。

## 前置概念

### 凸集 (Convex Set)

集合中任意两点连线上的所有点仍在该集合内。GJK 要求输入的碰撞体必须是**凸的**，非凸物体需先做凸分解。

### 闵可夫斯基差 (Minkowski Difference)

给定两个点集 $A$ 和 $B$，定义：

$$
A \ominus B = \{ a - b \mid a \in A,\ b \in B \}
$$

**核心定理**：$A$ 与 $B$ 相交，当且仅当 $A \ominus B$ 包含原点 $(0, 0)$。

于是碰撞检测被转化为：构建 $A \ominus B$，判断其是否包含原点。但显式构建整个 Minkowski 差代价太高，GJK 用**支撑函数**隐式采样。

### 支撑函数 (Support Function)

给定方向 $\vec{d}$，返回形状中沿该方向最远的点：

$$
S_A(\vec{d}) = \argmax_{p \in A} \; p \cdot \vec{d}
$$

对 Minkowski 差，有性质：

$$
S_{A \ominus B}(\vec{d}) = S_A(\vec{d}) - S_B(-\vec{d})
$$

这让我们用 $O(1)$ 次支撑点查询就拿到 Minkowski 差边界上的一个点，无需构建整个形状。

## GJK 核心流程

GJK 维护一个**单纯形 (Simplex)**——在 2D 中是点、线段或三角形，在 3D 中是点、线段、三角形或四面体。每次迭代：

1. 取当前单纯形中距原点最近的顶点方向 $\vec{d}$
2. 用支撑函数沿 $\vec{d}$ 采样一个新顶点 $p = S_{A \ominus B}(\vec{d})$
3. 将 $p$ 加入单纯形
4. 如果 $p \cdot \vec{d} \le 0$，说明原点不可能在 Minkowski 差内 → **不相交**，提前退出
5. 更新单纯形，只保留对"包含原点"有贡献的顶点（至多 3 个 / 4 个）
6. 若单纯形包含了原点 → **相交**

```python
def gjk(shape_a, shape_b):
    # 初始化方向（任意，通常取两形状中心差）
    d = shape_a.center - shape_b.center
    simplex = [support(shape_a, shape_b, d)]

    # 下一方向指向原点
    d = -simplex[0]

    while True:
        p = support(shape_a, shape_b, d)
        if p.dot(d) <= 0:
            return False  # 不相交

        simplex.append(p)
        if handle_simplex(simplex, d):
            return True  # 相交


def support(shape_a, shape_b, d):
    return shape_a.furthest_point(d) - shape_b.furthest_point(-d)
```

## 单纯形的演化 (2D)

`handle_simplex` 是 GJK 的精髓。它在不同情形下决定保留哪些顶点、更新搜索方向：

### 两顶点（线段）

单纯形为 $\{A, B\}$。需判断原点是否在线段上。

- 若原点在线段上 → 相交（2D 中两个点连线过原点即碰撞）
- 否则，过原点作 $AB$ 的垂线，取指向原点侧的垂线方向 $\vec{d}$，保留两个顶点继续迭代

### 三顶点（三角形）

单纯形为 $\{A, B, C\}$。检查原点是否在三角形内。

若不在，选择距原点最近的边，用那条边的两顶点作为新单纯形，搜索方向设为过原点垂直于该边的方向。

反复迭代，直到单纯形包含原点（相交），或支撑点不再向原点逼近（不相交）。

## 为什么 GJK 高效

每次迭代只需一次支撑函数调用（$O(1)$），单纯形维护是 $O(1)$。实践中通常在 3~6 次迭代内收敛。相比之下，暴力检测复杂度为 $O(nm)$（$n,m$ 为两形状的顶点数）。

## 延伸：EPA 求穿透深度

GJK 只回答"是否相交"。当相交时，EPA (Expanding Polytope Algorithm) 在 GJK 找到的单纯形基础上向外膨胀，找到 Minkowski 差边界上距原点最近的点，从而得到**穿透深度**和**分离方向**。二者配合构成完整的碰撞信息。

## 参考资料

- [A Fast and Robust GJK Implementation for Collision Detection of Convex Objects](https://dl.acm.org/doi/10.1080/2151237X.1999.10129125) — GJK 原始论文
- [Video: GJK Algorithm Explanation & Implementation](https://www.youtube.com/watch?v=ajv46BSqcK4) — Casey Muratori 的直观讲解
- Box2D / Bullet 源码中 `b2Distance` / `btGjkPairDetector` 的实现
