project(pycpp)
message(STATUS "[${PROJECT_NAME} 系列子库] 开始! python/C++混合编程")
############################# 第三方库配置 ########################################################
message(STATUS "[公共第三方库配置]开始!")
# python
message(STATUS "[Python]")

#set(Python_ROOT_DIR "D:\\software\\develop\\Miniconda3\\envs\\py37")
set(Python_ROOT_DIR "D:\\software\\develop\\Miniconda3\\envs\\py39")
find_package(Python 3.0.0 COMPONENTS Interpreter Development  REQUIRED)
#find_package(Python 3.0.0 COMPONENTS Interpreter Development Numpy  REQUIRED)
execute_process(COMMAND ${Python_EXECUTABLE} -c "import sys; print(sys.prefix, end='')" OUTPUT_VARIABLE PYTHON_PREFIX)
execute_process(COMMAND ${Python_EXECUTABLE} -c "import sys; print(sys.exec_prefix, end='')" OUTPUT_VARIABLE PYTHON_EXEC_PREFIX)
if(PYTHON_PREFIX STREQUAL PYTHON_EXEC_PREFIX)
    set(PYTHON_HOME ${PYTHON_PREFIX})
else()
    set(PYTHON_HOME ${PYTHON_PREFIX}:${PYTHON_EXEC_PREFIX})
endif()
message(STATUS "Version: ${Python_VERSION}")
message(STATUS "Python Prefix:        ${PYTHON_PREFIX}")
message(STATUS "Python Exec Prefix:   ${PYTHON_EXEC_PREFIX}")
message(STATUS "Python Home:          ${PYTHON_HOME}")
message(STATUS "Python Executable:    ${Python_EXECUTABLE}")
message(STATUS "Python Libraries:     ${Python_LIBRARIES}")
message(STATUS "Python Library Dirs:  ${Python_LIBRARY_DIRS}")
message(STATUS "Python Include Dirs:  ${Python_INCLUDE_DIRS}")
message(STATUS "Numpy Include Dirs:   ${Python_NumPy_INCLUDE_DIRS}")
message(STATUS "NumPy Version:        ${Python_NumPy_VERSION}")
message(STATUS "Python Interpreter Id:${Python_INTERPRETER_ID}")
message(STATUS "Python Sitelib Dirs:  ${Python_SITELIB}")
message(STATUS "Python Sitearch Dirs: ${Python_SITEARCH}")
message(STATUS "Python Stdlib Dirs:   ${Python_STDLIB}")
message(STATUS "Python Stdarch Dirs:  ${Python_STDARCH}")
message(STATUS "Python Link options:  ${Python_LINK_OPTIONS}")



# pybind11
message(STATUS "[pybind11]")
set(pybind11_DIR ${3RDPARTY_DIR}/pybind11 CACHE FILEPATH "Path to the root of the pybind11 distribution")
add_subdirectory(${pybind11_DIR}  ${3RDPARTY_DIR}) # 如果不是主目录的子目录，需指定绝对路径
if(${pybind11_FOUND})
    message(STATUS "Found pybind11: ${pybind11_DIR}")
else()
    message(SEND_ERROR "Can't find pybind11")
endif()
##第三方库配置
INCLUDE_DIRECTORIES (${Python_INCLUDE_DIRS} )
INCLUDE_DIRECTORIES (${pybind11_INCLUDE_DIR})
message(STATUS "[公共第三方库配置]成功!\n")

############################# 编译子库 ########################################################

message(STATUS "[${PROJECT_NAME} 子库][配置子库]开始:")
#add_subdirectory(CppCallPy)
#add_subdirectory(PyCallCpp)
#add_subdirectory(Cpp2Pytorch)
add_subdirectory(MeshFix)
message(STATUS "[${PROJECT_NAME} 子库][配置子库]成功!")
message(STATUS "")
