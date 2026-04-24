---
title: UE5中的容器类型
date: 2026-02-20
description: UE5中的容器类型
---

# UE5中的容器类型

## TMap

|增 | |
|-----|-----|
| Add() | 构造一个Pair再插入Map
| Emplace() | 构造一个Pair再插入Map

|删||
|-|-|
| Remove() | 删除指定键的元素

|查||
|-|-|
|Contains()|查找是否存在某元素|
|Find()|查找是否存在某元素并返回对应的键值指针|
|FindKey()|根据值查找键，反向遍历查找，O(n)|

### Add和Emplace的区别

::: code-group
```cpp [Add]
FORCEINLINE ValueType& Add(const KeyType&  InKey, const ValueType&  InValue) { return Emplace(InKey, InValue); }
FORCEINLINE ValueType& Add(const KeyType&  InKey,		ValueType&& InValue) { return Emplace(InKey, MoveTempIfPossible(InValue)); }
FORCEINLINE ValueType& Add(		 KeyType&& InKey, const ValueType&  InValue) { return Emplace(MoveTempIfPossible(InKey), InValue); }
FORCEINLINE ValueType& Add(		 KeyType&& InKey,		ValueType&& InValue) { return Emplace(MoveTempIfPossible(InKey), MoveTempIfPossible(InValue)); }
```
```cpp [Emplace]
template <typename InitKeyType = KeyType, typename InitValueType = ValueType>
ValueType& Emplace(InitKeyType&& InKey, InitValueType&& InValue)
{
	const FSetElementId PairId = Pairs.Emplace(TPairInitializer<InitKeyType&&, InitValueType&&>(Forward<InitKeyType>(InKey), Forward<InitValueType>(InValue)));

	return Pairs[PairId].Value;
}
```
:::
Add可分别指定键值对的性质，可以自由选择常量引用和右值引用，使用MoveTempIfPossible将可转化的引用转化为右值引用，然后在Emplace中构造Pair，插入Map。

Emplace使用万能引用+完美转发。如果传入完整的对象，相比Add，需要手动将可移动构造的左值处理为右值，同时也可以更精确地控制传入对象的行为，如传入左值确保触发拷贝构造；如果传入构造参数，则可以在Map存储位置直接构造，避免左值拷贝/右值移动开销。

### Contains和Find的区别

::: code-group
```cpp [Contains]
FORCEINLINE bool Contains(KeyConstPointerType Key) const
{
	return Pairs.Contains(Key);
}
```
```cpp [Find]
FORCEINLINE ValueType* Find(KeyConstPointerType Key)
{
	if (auto* Pair = Pairs.Find(Key))
	{
		return &Pair->Value;
	}

	return nullptr;
}
```
:::
Contains仅检查该键是否存在，Find在检查键存在后还进行一次解引用，返回键对应的值。

## TArray

|增 | |
|-----|-----|
| Add() | 向Array添加一个元素
| Push() | 执行逻辑同Add
| Insert() | 可指定插入元素位置
|Emplace()|可一次性添加多个元素到末尾|

|查 | |
|-|-|
| Find() | 遍历查找首个匹配元素
| Last() | 倒序遍历查找首个匹配元素

| 删| |
|-|-|
|Remove() |遍历删除所有值匹配的元素 |
| RemoveSingle()|遍历删除首个值匹配的元素 |

改动方法可随机访问，O(1)。

Add和Emplace的区别类似TMap，Emplace可以认为是就地构造。

## TSet

|增||
|-|-|
|Add()|添加元素对象|
|Emplace()|参数构造/添加元素对象|
|Append()|将另一个TSet的值合并至当前TSet，遍历，O(n)|

|删||
|-|-|
|Remove()|删除指定元素|

|其他||
|-|-|
|Array()|序列化为一个Array|
|Sort()|自定义排序规则|
|Reserve()|预先分配内存|
|Shrink()|删除末尾空白元素|
|Compact()|将所有空白元素集合到末尾|
|CompactStable()|将所有空白元素集合到末尾，且不改变元素排序顺序|