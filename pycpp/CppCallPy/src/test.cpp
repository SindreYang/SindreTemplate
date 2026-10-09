//
// Created by sindre on 2022/10/24.
//
#include <iostream>
#include <thread>
#include "pywarp.h"

int test_other( )
{

    //查看系统路径
    py::print("\npython 环境变量");
    py::module sys=py::module::import("sys");
    py::print(sys.attr("path"));

    py::print("\n尝试导入numpy\n");
    //pybind11::module::import("sys").attr("path").cast<pybind11::list>().append("D:/software/develop/Miniconda3/Library/bin");
    py::module np = py::module::import("numpy");
    py::print("\t numpy版本:\n");
    py::print(np.attr("__version__"));


    py::print("\n尝试导入torch_gpu cuda11.3\n");
    py::module torch = py::module::import("torch");
    py::print("\t torch版本:\n");
    py::print(torch.attr("__version__"));
    py::print("\t torch GPU是否可用:\n");
    py::print(torch.attr("cuda").attr("is_available")());
    py::print("\t torch GPU-0设备名称:\n");
    py::print(torch.attr("cuda").attr("get_device_name")(0));
    py::print("\t torch 支持GPU架构列表:\n");
    py::print(torch.attr("cuda").attr("get_arch_list")());


    py::print("\n获取pythonHome，ProgramName\n");
    py::print(Py_GetPythonHome());
    py::print(Py_GetProgramName());


    py::print("\nstd::vector --> numpy  --> py::array_t\n");
    std::vector<std::vector<double>> v{{1000.0, 2.0,1.0}, {3.4, 7.0, 50.0}};
    py::array_t<double> array =np.attr("array")(v);
    std::cout <<"type:" << typeid(array).name() << std::endl;


//    py::print(" \nnumpy  --> std::vector\n");
//    std::vector<double> out = array_to_vector1d(array);
//    py::print(out);
//    py::print();
//    std::cout <<"type:" << typeid(out).name() << std::endl;

//    py::print("\neigen测试\n");
//    Eigen::MatrixXd matrixXd =Eigen::MatrixXd::Random(3,3);
//    py::print("\tC++输出:\n");
//    std::cout<<matrixXd<<std::endl;
//    std::cout<<std::endl<<"type:" << typeid(matrixXd).name()<<std::endl;
//    py::print("\n\tpython输出:\n");
//    py::print(matrixXd);

//  //执行推理
//        py::dict out =T.attr("return_dict")(sampled);
//        f<<"load return_dict ...."<<endl;
//        points=out["points"].cast<MatD3ai>();

    system("pause");
    return 0;
}

void test_thread_fun(int id){
    printf("\n\t\033[0m\033[1;32m[Thread %d] start!\033[0m",id);
    py::gil_scoped_acquire acquire;
    py::print("\n[Thread {}] 获取GIL锁"_s.format(id));
    py::print("\n[Thread {}] [python] 是否可用:"_s.format(id),check_python_available()==0);
    py::print("\n[Thread {}] [pybind11] 内部状态:"_s.format(id),has_pybind11_internals_static());
    py::print("\n[Thread {}] 测试numpy"_s.format(id));
    py::module np = py::module::import("numpy");
    py::print("\n\t numpy版本:{}"_s.format(np.attr("__version__")));
    py::exec(R"(print('test py::exec\n'))");
    printf("\n\t\033[0m\033[1;32m[Thread %d] done!\033[0m",id);


}
void main_thread() {

    //检测环境是否准备就绪
    py::print("\n[python] 是否可用:",check_python_available()==0);
    py::print("\n[pybind11] 内部状态:",has_pybind11_internals_static());
    py::gil_scoped_release gil_release;
    std::cout <<"\n[python] GIL是否就绪(没有则不能使用py):"<<bool(check_python_available()==2)<< std::endl;
    std::cout <<"\n[pybind11] 内部状态:"<<bool(has_pybind11_internals_static())<< std::endl;

    std::cout <<"\n\t[线程测试] 开始!"<< std::endl;
    std::thread th[10];
    try{
        for (int i = 0; i < 10; i++){
            th[i] = std::thread(test_thread_fun, i);
        }
        for (auto & i : th){
            i.join();
        }
    } catch (std::exception& e)
    {
        std::cout << "[运行异常]:" << e.what() << std::endl;
    }catch (std::bad_alloc& e)
    {
        std::cout << "[内存异常]:" << e.what() << std::endl;
    }catch (std::out_of_range& e)
    {
        std::cout << "[索引异常]:" << e.what() << std::endl;
    }catch (py::error_already_set &eas) {
        eas.discard_as_unraisable(__func__);
        std::cout << "[pybind11异常]:" << eas.what() << std::endl;
    }

    std::cout <<"\n\t[线程测试] 完成!"<< std::endl;
}

int main(){
    system("mode con cp select=65001");//支持中文
    python_init("./");//用于定义python位置,否则无法初始化
    py::scoped_interpreter guard;//必须在主线程初始化，因为pybind11无法在其他位置彻底清除python变量，从而导致崩溃问题；
    main_thread();
    main_thread();
}