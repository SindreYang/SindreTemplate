project(Add) #新版只需要添加cuda则自动设置cuda
message(STATUS "[${PROJECT_NAME} 子库] 开始!")

######################## 第三方库 ###########################
######################## 编译配置 ###########################

include_directories(include)
file(GLOB_RECURSE _cpp "src/*.cpp")
file(GLOB_RECURSE _cu "src/*.cu")
add_executable(${PROJECT_NAME} ${_cpp} ${_cu})

message( STATUS "[${PROJECT_NAME} 子库] 完成!")