project(cu LANGUAGES CXX CUDA ) #新版只需要添加cuda则自动设置cuda
message(STATUS "[${PROJECT_NAME} 系列子库] 开始! 用于CUDA编程")
message(STATUS "[${PROJECT_NAME} 子库] cuda 编译工具路径：${CMAKE_CUDA_COMPILER}")
message(STATUS "[${PROJECT_NAME} 子库] 切记windows下cu文件不能有中文，注释也不行，最好别注释! 除非文件编码使用GBK")

######################## 编译子库 ###########################
message( STATUS "[${PROJECT_NAME} 子库] 开始!")
add_subdirectory(Add)
message( STATUS "[${PROJECT_NAME} 子库] 完成!")
message( STATUS "")