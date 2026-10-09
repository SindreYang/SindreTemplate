#include <cmath>
#include <cuda_runtime.h>
#include <iostream>

#include "add.h"

// 每个线程处理一个起始位置，并以 stride 方式覆盖完整数组。
__global__ void add_kernel(const float* x, const float* y, float* z, int n) {
    const int index = threadIdx.x + blockIdx.x * blockDim.x;
    const int stride = blockDim.x * gridDim.x;
    for (int i = index; i < n; i += stride) {
        z[i] = x[i] + y[i];
    }
}

void get_cuda_info() {
    int device = 0;
    cudaDeviceProp properties{};
    if (cudaGetDeviceProperties(&properties, device) != cudaSuccess) {
        std::cerr << "Unable to query CUDA device information" << std::endl;
        return;
    }
    std::cout << "CUDA device " << device << ": " << properties.name << std::endl;
    std::cout << "Global memory: "
              << properties.totalGlobalMem / 1024.0 / 1024.0 / 1024.0 << " GB" << std::endl;
    std::cout << "Multiprocessors: " << properties.multiProcessorCount << std::endl;
    std::cout << "Max threads per block: " << properties.maxThreadsPerBlock << std::endl;
}

void add_test() {
    get_cuda_info();
    constexpr int count = 1 << 20;
    const std::size_t bytes = static_cast<std::size_t>(count) * sizeof(float);
    float* x = nullptr;
    float* y = nullptr;
    float* z = nullptr;

    if (cudaMallocManaged(&x, bytes) != cudaSuccess ||
        cudaMallocManaged(&y, bytes) != cudaSuccess ||
        cudaMallocManaged(&z, bytes) != cudaSuccess) {
        std::cerr << "Unable to allocate CUDA managed memory" << std::endl;
        cudaFree(x);
        cudaFree(y);
        cudaFree(z);
        return;
    }

    for (int i = 0; i < count; ++i) {
        x[i] = 10.0F;
        y[i] = 20.0F;
    }

    const dim3 block_size(256);
    const dim3 grid_size((count + block_size.x - 1) / block_size.x);
    add_kernel<<<grid_size, block_size>>>(x, y, z, count);

    const cudaError_t sync_status = cudaDeviceSynchronize();
    if (sync_status != cudaSuccess) {
        std::cerr << "CUDA kernel execution failed: "
                  << cudaGetErrorString(sync_status) << std::endl;
    }

    float max_error = 0.0F;
    for (int i = 0; i < count; ++i) {
        max_error = fmax(max_error, fabs(z[i] - 30.0F));
    }
    std::cout << "Maximum error: " << max_error << std::endl;

    cudaFree(x);
    cudaFree(y);
    cudaFree(z);
}
