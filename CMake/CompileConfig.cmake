############################# 交叉编译配置 ########################################################
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU" OR (CMAKE_CXX_COMPILER_ID MATCHES "Intel" AND NOT WIN32))
    message(STATUS "[启用GNU编译配置]")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${_cxx_std_flag}  -mavx -march=native -Wunused-parameter -Wextra -Wreorder -Wconversion -Wsign-conversion")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wold-style-cast -Wunused-variable")

elseif(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    message(STATUS "[启用MSVC编译配置]")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /O2  /arch:AVX /arch:AVX2 /openmp /EHsc /MP /bigobj  /W4  /utf-8")
    set(CMAKE_EXE_LINKER_FLAGS /MANIFEST:NO)
    set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON) #导出动态库/静态库相关符号，否则需要指定 __declspec(dllexport)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
    add_definitions(-DHAVE_CBLAS=1 -DWITH_OPENBLAS=1 -DXTENSOR_ENABLE_XSIMD=1  -DXTENSOR_USE_FLENS_BLAS=1 -DXTENSOR_USE_OPENMP=1)
    add_definitions(-DNOMINMAX -D_CRT_SECURE_NO_WARNINGS -D_SILENCE_TR1_NAMESPACE_DEPRECATION_WARNING )

elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
    message(STATUS "[启用Clang-cl编译配置]")
    # We are using clang-cl # "-Xclang -fopenmp"
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${_cxx_std_flag} /EHsc /MP /bigobj  /openmp  /arch:AVX /arch:AVX2  /utf-8 -Wno-unused-command-line-argument") # https://learn.microsoft.com/en-us/cpp/build/reference/bigobj-increase-number-of-sections-in-dot-obj-file?view=msvc-170
    set(CMAKE_EXE_LINKER_FLAGS /MANIFEST:NO) #如果不想在清单中生成 UAC 片段，请指定 /MANIFESTUAC:NO 选项 #https://learn.microsoft.com/en-us/cpp/build/reference/manifest-create-side-by-side-assembly-manifest?view=msvc-170
    set(OpenMP_CXX_FLAGS "-openmp:llvm") # https://devblogs.microsoft.com/cppblog/openmp-updates-and-fixes-for-cpp-in-visual-studio-2019-16-10/
    set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON) #导出动态库/静态库相关符号，否则需要指定 __declspec(dllexport)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>") #使用多线程，$<$<CONFIG:Debug>会根据配置，选择MultiThreaded/MultiThreadedDebugDLL
    add_definitions(-DNOMINMAX) #定义NOMINMAX宏，特定于max/min场景。 否则容易Windows.h max宏与std::max冲突问题
    add_definitions(-DHAVE_CBLAS=1 -DWITH_OPENBLAS=1 -DXTENSOR_ENABLE_XSIMD=1  -DXTENSOR_USE_FLENS_BLAS=1 -DXTENSOR_USE_OPENMP=1)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS) #让高版本忽略安全检测，从而避免scanf,fopen不准使用问题
    add_definitions(-D_SILENCE_TR1_NAMESPACE_DEPRECATION_WARNING) #对老版本代码兼容，开启std::tr1支持

else()
    message(FATAL_ERROR "不受支持的编译器: ${CMAKE_CXX_COMPILER_ID}")
endif()