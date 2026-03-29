---
title: UE5 智能指针
date: 2026-03-05
description: UE5 TPtr
---

# UE5 智能指针

## TSharedPtr 智能指针

### 构造方式
```cpp
class Test {
public:
	int a;
};

Test* t = new Test(1)

//init with MakeShared
TSharedPtr<Test> test = MakeShared<Test>(1);

//init with origin class
TSharedPtr<Test> test1(t);

//init with shared ptr
TSharedPtr<Test> testFromTest(test);

//ref to ptr(implicit)
TSharedRef<Test> Testref = test.ToSharedRef();
TSharedPtr<Test> test2 = Testref;

//init with MakeShareable
TSharedPtr<Test> test3 = MakeShareable(new Test(2));
```

如代码所示，`TSharedPtr<T>`智能指针的构造方式一般为这几种：

- `TSharedPtr<T> sharedPtr(originT)` 使用原对象指针构造
- `TSharedPtr<T> sharedPtr(otherSharedPtr)` 使用其他智能指针构造
- `TSharedPtr<T> sharedPtr = sharedRef` 使用引用指针拷贝构造
- `TSharedPtr<T> sharedPtr = MakeShared<T>(...TParams)` MakeShared构造
- `TSharedPtr<T> sharedPtr = MakeShareable(new T(...TParam))`

其他构造方式类似，不再重复说明。以下按顺序分析构造实现细节。

#### TSharedPtr sharedPtr(originT) 使用原对象指针构造

```cpp
template <
	typename OtherType
	UE_REQUIRES(std::is_convertible_v<OtherType*, ObjectType*>)
>
FORCEINLINE explicit TSharedPtr( OtherType* InObject ): Object( InObject )
	, SharedReferenceCount( SharedPointerInternals::NewDefaultReferenceController< Mode >( InObject ) )
{
	// If the object happens to be derived from TSharedFromThis, the following method
	// will prime the object with a weak pointer to itself.
	SharedPointerInternals::EnableSharedFromThis( this, InObject );
}
```

传入参数为对象的原指针，直接赋值为当前智能指针的对象指针，构造函数执行一次检查，如果当前模版参数类是`TSharedFromThis`的派生类，则为对象自身添加一个指向自身的弱引用。

> 为什么要添加一个指向自身的弱引用？
> 为了使该对象能够获取自身智能指针的控制块，便于实现AsShared()或SharedFromThis()，返回和当前对象相同控制块的指针，防止双重释放等问题
> 同时弱引用不会导致存在一个内部不会被释放的指针(指针由对象内部持有，在对象回收前永远不会被释放，反过来导致对象不会被回收)，使引用计数永远>=1，导致内存泄漏

我们知道智能指针的引用计数是依据控制块计算的，但是在构造函数内并没有看到AddRef()或类似的操作？

这是因为构造函数参数中的`SharedReferenceCount`真实类型是`FSharedReferencer`，该类型拷贝构造实现如下：

```cpp 
/** Copy constructor creates a new reference to the existing object */
FORCEINLINE FSharedReferencer( FSharedReferencer const& InSharedReference )
	: ReferenceController( InSharedReference.ReferenceController )
{
	// If the incoming reference had an object associated with it, then go ahead and increment the
	// shared reference count
	if( ReferenceController != nullptr )
	{
		ReferenceController->AddSharedReference();
	}
}
```
在拷贝构造中调用了控制块的引用计数增加操作，所以引擎其实正确实现了控制块的计数操作(当然)。

#### TSharedPtr sharedPtr(otherSharedPtr) 使用其他智能指针构造

```cpp
template <
	typename OtherType
	UE_REQUIRES(std::is_convertible_v<OtherType*, ObjectType*>)
>
FORCEINLINE TSharedPtr( TSharedPtr< OtherType, Mode > const& InSharedPtr )
	: Object( InSharedPtr.Object )
	, SharedReferenceCount( InSharedPtr.SharedReferenceCount )
{
}
```

这部分没有什么要注意的，只是换了构造参数。

#### TSharedPtr sharedPtr = sharedRef 使用引用指针拷贝构造

```cpp
template <
	typename OtherType
	UE_REQUIRES(std::is_convertible_v<OtherType*, ObjectType*>)
>
FORCEINLINE TSharedPtr( TSharedRef< OtherType, Mode > const& InSharedRef )
	: Object( InSharedRef.Object )
	, SharedReferenceCount( InSharedRef.SharedReferenceCount )
{
	// There is no rvalue overload of this constructor, because 'stealing' the pointer from a
	// TSharedRef would leave it as null, which would invalidate its invariant.
}
```

对于使用引用指针拷贝构造，引擎允许了这种隐式转换，对引用对象和控制块进行了拷贝构造。

#### MakeShared(...TParams) 和 MakeShareable(new T(...TParam))

先分别分析构造实现，再进行对比分析。

##### MakeShared(...TParams)

```cpp
template <typename InObjectType, ESPMode InMode = ESPMode::ThreadSafe, typename... InArgTypes>
[[nodiscard]] FORCEINLINE TSharedRef<InObjectType, InMode> MakeShared(InArgTypes&&... Args)
{
	SharedPointerInternals::TIntrusiveReferenceController<InObjectType, InMode>* Controller = SharedPointerInternals::NewIntrusiveReferenceController<InMode, InObjectType>(Forward<InArgTypes>(Args)...);
	return UE::Core::Private::MakeSharedRef<InObjectType, InMode>(Controller->GetObjectPtr(), (SharedPointerInternals::TReferenceControllerBase<InMode>*)Controller);
}
```

首先创建一个控制块，其中控制块在构造时，使用传入的Args参数构造原类型对象，这里使用c++的implement new方式构造原类型，保证控制块和原类型对象在同一个存储块中，保证了快速构造和缓存友好。

```cpp
//控制块构造
template <typename ObjectType, ESPMode Mode>
class TIntrusiveReferenceController : public TReferenceControllerBase<Mode>
{
public:
	template <typename... ArgTypes>
	explicit TIntrusiveReferenceController(ArgTypes&&... Args)
	{
		::new ((void*)&ObjectStorage) ObjectType(Forward<ArgTypes>(Args)...);
	}
private:
	/** The object associated with this reference counter.  */
	mutable TTypeCompatibleBytes<ObjectType> ObjectStorage;
};

//implement new 预留内存
template<typename ElementType>
struct TTypeCompatibleBytes
{
	using ElementTypeAlias_NatVisHelper = ElementType;
	ElementType*		GetTypedPtr()		{ return (ElementType*)this;  }
	const ElementType*	GetTypedPtr() const	{ return (const ElementType*)this; }

	alignas(ElementType) uint8 Pad[sizeof(ElementType)];
};

```

然后使用刚才构造的控制块，将控制块内部的原类型对象指针和控制块指针作为参数，构造一个指针引用，返回到MakeShared函数调用点。

##### MakeShareable

```cpp
template< class ObjectType >
[[nodiscard]] FORCEINLINE SharedPointerInternals::TRawPtrProxy< ObjectType > MakeShareable( ObjectType* InObject )
{
	if constexpr (IsDerivedFromSharedFromThis<ObjectType>())
	{
		// If this goes off, you should probably be using Ptr->AsShared() or Ptr->AsWeak() instead.
		checkf(!InObject || !InObject->DoesSharedInstanceExist(), TEXT("Trying to share an already-shared object"));
	}
	return SharedPointerInternals::TRawPtrProxy< ObjectType >( InObject );
}
```

首先判断是否为SharedFromThis的派生类，如果是派生类，则不允许重复分配该对象的智能指针。

然后返回TRawPtrProxy类型的指针对象，目的是允许裸指针能够隐式转换为shared/weak指针（通过对应类型的构造函数）。

##### MakeShared/MakeShareable区别

MakeShared同步（从API层面来看）构造控制块和原类型对象，保证了一次调用完成两者的构造，且使用c++ implement new方式分配空间，在读取内存时，对于大部分情况可以将控制块和原类型对象同时读取进缓存，优化运行速度。但是要求原类型对象的构造函数为public。

MakeShareable需要传入一个构造完成的原类型对象指针，或在传入参数时构造一个原类型对象，这导致原类型对象和控制块的存储位置可能差距很大，在运行时读取相关信息会导致一次以上的读取，效率较低。但是这种方式允许传入的原类型对象构造函数为private。

## TSharedRef 指针引用

### 构造方式

构造方式和TSharedPtr大致相同，不再重复说明。

## TSharedRef 和 TSharedPtr 的区别

TSharedPtr在内部使用时没有判空检查，可以将指针赋空，且允许初始化为null。

TSharedRef在初始化时，内部有判空断言，如果使用空值构造则报错。

二者共享同一个类型的控制块，所以在使用上两者可以视作没有区别；但是从语义上讲，使用TSharedRef意在说明“该变量始终有效(不为空)”，使用TSharedPtr意味着“该变量可选择为置空”，所以TSharedRef可以直接转化为TSharedPtr类型，但是TSharedPtr转化为TSharedRef时，需要先IsVaild()检查其有效性。