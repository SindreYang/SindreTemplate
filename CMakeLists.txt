cmake_minimum_required(VERSION 3.21)

project(SindreCppTemplate VERSION 0.1.0 LANGUAGES CXX)

# 默认只构建无第三方依赖的 C++ 示例；其余能力必须显式打开。
option(SINDRE_ENABLE_OPENMP "启用 OpenMP" OFF)
option(SINDRE_BUILD_VTK_DEMO "构建可选的 VTK 示例" OFF)
option(SINDRE_BUILD_CUDA_EXAMPLE "构建可选的 CUDA 示例" OFF)
option(SINDRE_BUILD_PYTHON_EMBED "构建可选的 Python 嵌入示例" OFF)
# 警告默认开启，帮助模板使用者尽早发现跨平台代码问题。
option(SINDRE_ENABLE_WARNINGS "启用编译器警告" ON)
# Sanitizer 适合 Debug/测试构建，不建议直接用于发布构建。
option(SINDRE_ENABLE_SANITIZERS "启用 Address/Undefined sanitizers" OFF)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")

include(GNUInstallDirs)

add_library(sindre_project_options INTERFACE)
target_compile_features(sindre_project_options INTERFACE cxx_std_20)

if(SINDRE_ENABLE_WARNINGS)
  if(MSVC)
    target_compile_options(sindre_project_options INTERFACE /W4 /permissive-)
  else()
    target_compile_options(sindre_project_options INTERFACE -Wall -Wextra -Wpedantic)
  endif()
endif()

if(SINDRE_ENABLE_SANITIZERS)
  if(MSVC)
    # MSVC/clang-cl 的 AddressSanitizer 由编译器自动链接运行库。
    target_compile_options(sindre_project_options INTERFACE /fsanitize=address)
  else()
    # GCC/Clang 使用统一的 AddressSanitizer 和 UndefinedBehaviorSanitizer。
    target_compile_options(sindre_project_options INTERFACE -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(sindre_project_options INTERFACE -fsanitize=address,undefined)
  endif()
endif()

include(CTest)

# 查找一次后由具体 target 显式链接，避免全局污染其他目标。
if(SINDRE_ENABLE_OPENMP)
  find_package(OpenMP REQUIRED)
endif()

add_subdirectory(cpp)

if(SINDRE_BUILD_CUDA_EXAMPLE)
  include(CheckLanguage)
  check_language(CUDA)
  if(NOT CMAKE_CUDA_COMPILER)
    message(FATAL_ERROR "SINDRE_BUILD_CUDA_EXAMPLE=ON requires a CUDA compiler (nvcc)")
  endif()
  enable_language(CUDA)
  add_subdirectory(cu)
endif()

if(SINDRE_BUILD_PYTHON_EMBED)
  find_package(Python 3.10 COMPONENTS Interpreter Development NumPy REQUIRED)
  find_package(pybind11 CONFIG REQUIRED)
  add_subdirectory(pycpp)
endif()

install(TARGETS sindre_template_example
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
)
