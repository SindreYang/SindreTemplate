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

## 目录

```text
CMakeLists.txt       顶层项目和可选项
cpp/                 C++ 子项目
cpp/vtk_demo/        可选 VTK 示例
build/               构建目录，不提交
```
