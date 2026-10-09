//
// Created by sindre on 2022/10/24.
//

#ifndef C_DEPLOY_PYWARP_H
#define C_DEPLOY_PYWARP_H
#include <pybind11/embed.h>
#include <pybind11/eval.h>
#include "pybind11/stl.h"
//#include "pybind11/eigen.h"
#include <pybind11/numpy.h>
#include <pybind11/pytypes.h>
namespace py = pybind11;
using namespace py::literals;

// 初始化 python,没有获取GIL锁
void python_init(const std::string& pythonHome);

// 检测相关环境是否满足直接使用python
///
/// \return 0:满足所有条件;1:未初始化环境，但线程已获得锁;2:未获取锁，但环境已初始化,3:未初始化环境，未获取锁，
int check_python_available();


// 设置python全局变量，一般用于加载第三库；
void python_global_run(const std::string&pycode);

// 如果有锁，则不获取，如果没有锁，则获取锁
void get_gil();

// 强制释放GIL锁,用于提供多线程使用，保证python系统处于待给予锁状态
void release_wrap();

// 退出python，释放内存
void shutdown_python();

// 设置可供python库的路径
void set_python_sys_path(const std::string&dirpath);

// 检测pybind11内部指针是否激活
bool has_pybind11_internals_static();

template <typename T>
std::vector<T> array2vector1d(const py::array_t<T>& array);


#endif //C_DEPLOY_PYWARP_H
