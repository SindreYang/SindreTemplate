//
// Created by sindre on 2022/10/24.
//
#include <iostream>
#include "pywarp.h"


void python_init(const std::string& pythonHome){
    if (!Py_IsInitialized()) {
        wchar_t* pythonHome_ = Py_DecodeLocale(pythonHome.data(), nullptr);
        Py_SetProgramName(pythonHome_);
        Py_SetPythonHome(pythonHome_);
    }
//    py::initialize_interpreter(false); 不给GIL锁
    std::cout << "python start! tip:\npybind11 subinterpreters are not supported"<<std::endl;
}

bool has_pybind11_internals_static() {
    auto **&ipp = py::detail::get_internals_pp();
    return (ipp != nullptr) && (*ipp != nullptr);
}

void release_wrap() {
    //重新启动解释器以确保线程未初始化
    py::finalize_interpreter();
//    py::initialize_interpreter(false);
    std::cout<<has_pybind11_internals_static()<<std::endl;
    if (Py_IsInitialized()==0){
        // 如果没有初始化，则进行初始化;
        std::cout<<"Py_IsInitialized！"<<std::endl;
        py::scoped_interpreter guard{};
    }
    py::gil_scoped_release gil_release{};

}

void shutdown_python(){
    PyGILState_Ensure();
    py::finalize_interpreter();
}

void get_gil() {
    if(PyGILState_Check()==0){
        py::gil_scoped_acquire acquire;
    }
}

int check_python_available(){
    if(PyGILState_Check()==1 && Py_IsInitialized()==0){
        std::cout << "\n\t[check_python_available]:  use <py::scoped_interpreter> init interpreter"<<std::endl;
        return 1;
    }
    else if(PyGILState_Check()==0 && Py_IsInitialized()==1){
        std::cout << "\n\t[check_python_available]:  use <py::gil_scoped_acquire> get gil"<<std::endl;
        return 2;
    }
    else if(PyGILState_Check()==0 && Py_IsInitialized()==0){
        std::cout << "\n\t[check_python_available]:  not get gil and init interpreter !  "<<std::endl;
        return 3;
    }else{
        return 0;
    }

}

void python_global_run(const std::string& pycode){
    try
    {
        auto scope = py::globals();
        py::exec(pycode, scope);
    }
    catch (std::exception& e)
    {
        std::cout << "python global run  failed:" << e.what() << std::endl;
    }
}


template <typename T>
std::vector<T> array2vector1d(const py::array_t<T>& array){

    // 获取指向缓冲区的指针
    const auto buf{array.request()};
    // 并创建指向缓冲区的向量
    return std::vector<T>(static_cast<T*>(buf.ptr), static_cast<T*>(buf.ptr) + array.size());
}

//template<class T>
//Eigen::TensorMap<Eigen::Tensor<T, 3>> array_to_eigen3d(py::array_t<T> inArray) {
//
//    //从 Python 请求缓冲区描述符
//    py::buffer_info buffer_info = inArray.request();
//    // 提取数据输入数组的形状
//    T* data = static_cast<T*>(buffer_info.ptr);
//    std::vector<ssize_t> shape = buffer_info.shape;
//    //在 Eigen::Map 中包装 ndarray：
//    // 第二个模板参数是张量的大小，必须在编译时知道
//    Eigen::TensorMap<Eigen::Tensor<T, 3>> in_tensor(data, shape[0], shape[1], shape[2]);
//    return in_tensor
//}


void set_python_sys_path(const std::string&dirpath){
    py::module::import("sys").attr("path").cast<pybind11::list>().append(dirpath);
    py::print("sys path: ",py::module::import("sys").attr("path"));
}