---
title: GAMES101-Shading
date: 2026-04-12
description: 着色
---

# 着色

## Definition


>shading:

>The darkening or coloring of an illustration or diagram with parallel lines or a block of color


在图形学中，可以理解为对物体应用不同的材质。

## Blinn-Phong 反射模型

着色时的输入参数：
- Viewer direction，视线方向
- Surface normal，表面法线方向
- Light direction，光线方向
- Surface parameters，物体表面的参数，如颜色、粗糙度

着色时，对于物体表面的着色是局部的，意思是不考虑自身以外的着色。比如不考虑物体在光照下投射的阴影。

### Diffuse Reflection 漫反射

将光线在物体表面均匀地向各个方向散射。反射光线的强度与物体与光线的夹角有关，因为单位面积接受到的能量不同。

![alt text](GAMES101-Shading-1.png)

因为漫反射是均匀地反射射入光线，所以不管在什么地方观察，观察到的着色效果应该是一样的。

### Specular 高光

反射方向接近于镜面反射方向。在判断是否产生高光时，计算光线入射向量和视线向量的半程向量，即取角平分线方向，只需要检查半程向量和法线向量是否足够接近。

![alt text](GAMES101-Shading-2.png)

公式中的指数p意在控制高光的大小，对于点乘，cos变换的容忍度过高，比如半程向量和法线向量偏移45°时，和完全重合计算得出的值差别并不大，导致高光的面积可能过大。因此需要进行指数运算，增强计算结果的变化率。

### Ambient Term 环境光

为物体添加一个常数光照，不受外界影响，为了避免有的地方是完全黑色的。Blinn-Phong的环境光是对实际情况的简化，仅模拟最简单的环境光。

![alt text](GAMES101-Shading-3.png)

将三种光照效果合成，就是最终的着色效果。

## Shading Frequencies

着色频率，决定每次着色区域的大小。

### Flat Shading

对每个三角形着色。同一个三角形中的所有像素点着色效果相同。

![alt text](GAMES101-Shading-4.png)

### Gouraud Shading

对每个三角形的顶点着色，三角形内部的像素着色使用顶点的着色插值着色。

![alt text](GAMES101-Shading-5.png)

### Phong Shading

只传递顶点的法线向量，对每个像素插值得到像素点的法线向量，再逐像素计算着色。

![alt text](GAMES101-Shading-6.png)


>怎样得到顶点的法线向量？

>根据和顶点相连的几个三角形，根据三角形的法线向量加权平均计算顶点的法线向量。

## Real-Time Rendering Pipeline 实时渲染管线

输入：原始3D空间

- Vertex Processing:将原始3D空间转换为屏幕视口空间
- Triangle Processing:将屏幕空间的顶点转换为三角形
- Rasterization:将需要绘制的三角形光栅化为像素点
- Fragment Processing:为像素点着色
- Framebuffer Operations:将着色后的像素点显示在屏幕上

对于不同的着色算法，着色发生的流程也有所不同。如果采用Gouraud Shading顶点着色，则着色发生在Vertex Processing(计算颜色)、Rasterization(进行颜色插值)和Fragment Processing(使用插值颜色)；Phong着色发生在Vertex Processing(传递顶点法线向量)、Rasterization(进行重心坐标插值，插值生成法线向量)和Fragment Processing(计算并使用颜色)

## Texture Mapping 纹理映射

为了使3D物体在着色时显示特定的纹理，需要对2D的纹理进行纹理映射。在3D物体上先进行纹理的绘制，储存时再展开为2D图像，再次渲染时则将展开的2D图像纹理贴回3D物体，实现纹理映射。

为了保证纹理能够贴合物体的对应位置，使用uv坐标系规定一个坐标，一般坐标范围定义为[0-1]的浮点数。在光栅化时，GPU对三角形内部的像素进行插值UV坐标，从而确定哪个像素采样纹理的哪个部分。

一般来讲，UV坐标和顶点坐标并行传递，不受各种矩阵变换的影响，在光栅化生成片元时会进行透视矫正插值，防止纹理变形。