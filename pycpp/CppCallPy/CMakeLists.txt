project(cppCallPy)
message(STATUS "[${PROJECT_NAME} 子库] 开始!")


include_directories(include/)
file(GLOB_RECURSE _cpp "src/*.cpp")
add_executable(${PROJECT_NAME} ${_cpp})
target_link_libraries(${PROJECT_NAME}  PUBLIC
        Python::Python
        #Python::Interpreter
        #Python::Compiler
        Python::Module
        Python::NumPy
        pybind11::embed)

#######################复制运行库#########################
set(DLLS ${Python_RUNTIME_LIBRARY_DIRS}/python${Python_VERSION_MAJOR}${Python_VERSION_MINOR}.dll )
message(STATUS "复制 ${DLLS} \n到 ${EXECUTABLE_OUTPUT_PATH}目录下")
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        ${DLLS} ${EXECUTABLE_OUTPUT_PATH})

message(STATUS "[${PROJECT_NAME} 子库] 完成!")
message(STATUS "")