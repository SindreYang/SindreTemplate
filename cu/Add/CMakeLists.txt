# 一个最小 CUDA 可执行示例，依赖由顶层 CMake 的 CUDA 语言启用提供。
add_executable(sindre_cuda_add_example
  src/main.cpp
  src/add_kernel.cu
)
target_link_libraries(sindre_cuda_add_example PRIVATE sindre_project_options)
target_include_directories(sindre_cuda_add_example PRIVATE include)
set_target_properties(sindre_cuda_add_example PROPERTIES
  CUDA_STANDARD 20
  CUDA_STANDARD_REQUIRED ON
  CUDA_EXTENSIONS OFF
)
