# CMake C++ Template

一个不绑定开发机路径和预编译二进制的跨平台 CMake 模板。

## 配置和构建

```powershell
cmake -S . -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo
cmake --build build --config RelWithDebInfo
ctest --test-dir build --output-on-failure -C RelWithDebInfo
```

可选能力通过 CMake 选项开启：

```powershell
cmake -S . -B build -DSINDRE_ENABLE_OPENMP=ON
cmake -S . -B build -DSINDRE_BUILD_VTK_DEMO=ON
```

VTK、OpenMP 和其他第三方依赖必须由当前平台的包管理器提供。模板不再
提交 `3rdparty` 二进制包、开发机 vcpkg 路径或平台专用 DLL。

## 适合谁？

如果你要写跨平台 C++ 库、命令行工具或带可选第三方依赖的应用，这个模板提供了干净的 CMake 起点。

## 第一次构建

Windows、Linux 和 macOS 都建议使用源码外构建目录：

```powershell
cmake -S . -B build -DSINDRE_BUILD_VTK_DEMO=OFF
cmake --build build --config RelWithDebInfo
ctest --test-dir build --output-on-failure -C RelWithDebInfo
```

如果 CMake 找不到编译器，请先安装 Visual Studio Build Tools、clang 或 GCC，并确认编译器已经加入当前终端环境。模板不会自动下载编译器或第三方库。

## 可选能力

OpenMP：

```powershell
cmake -S . -B build-openmp -DSINDRE_ENABLE_OPENMP=ON
cmake --build build-openmp --config RelWithDebInfo
```

VTK 示例需要当前环境已经安装 VTK，并能被 `find_package(VTK CONFIG REQUIRED)` 找到：

```powershell
cmake -S . -B build-vtk -DSINDRE_BUILD_VTK_DEMO=ON
cmake --build build-vtk --config RelWithDebInfo
```

## 为什么使用这个模板？

- 不绑定某台电脑的 vcpkg、CUDA 或 DLL 路径。
- C++ 标准、输出目录和可选功能集中在顶层配置。
- 第三方库默认关闭，普通项目可以先快速编译。
- 构建目录可删除，不会污染源码。
- 可以在后续提交中逐步增加库、测试和安装规则。

## 常见问题

- `CMAKE_CXX_COMPILER` 找不到：安装编译器或打开正确的开发者命令行。
- Windows SDK 找不到：在 Visual Studio Installer 中安装对应 Windows 10/11 SDK。
- VTK 找不到：关闭 `SINDRE_BUILD_VTK_DEMO`，或配置 `CMAKE_PREFIX_PATH` 指向 VTK 安装目录。

## 目录

```text
CMakeLists.txt       顶层项目和可选项
cpp/                 C++ 子项目
cpp/vtk_demo/        可选 VTK 示例
build/               构建目录，不提交
```
