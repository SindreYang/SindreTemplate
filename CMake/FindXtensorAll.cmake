
#if (CMAKE_SYSTEM_NAME MATCHES "Linux")
#    find_package(BLAS REQUIRED)
#    message(STATUS "[BLAS]:\n\tVersion:${BLAS_VERSION}")
#    message(STATUS "[BLAS LIBRARIES]:\n\tLIBRARY:${BLAS_LIBRARIES}\n")
#else()
#    message(STATUS "[BLAS]:启动OpenBLAS替代BLAS!\n")
#    find_package(OpenBLAS  REQUIRED)
#    set(BLAS_LIBRARIES ${OpenBLAS_LIBRARIES})
#    message(STATUS "[BLAS]:\n\tVersion:${BLAS_VERSION}")
#    message(STATUS "[BLAS LIBRARIES]:\n\tLIBRARY:${BLAS_LIBRARIES}\n")
#
#endif()
find_package(BLAS REQUIRED)
find_package(LAPACK REQUIRED)
find_package(xtl REQUIRED)
find_package(xsimd REQUIRED)
find_package(xtensor REQUIRED)
find_package(xtensor-blas REQUIRED CONFIG)


message(STATUS "[XtensorAll]")
message(STATUS "blas       libraries:   ${BLAS_LIBRARIES}")
message(STATUS "lapack     libraries:   ${LAPACK_LIBRARIES}")
message(STATUS "xtl          version:   ${xtl_VERSION}")
message(STATUS "xsimd        version:   ${xsimd_VERSION}")
message(STATUS "xtensor-blas version:   ${xtensor-blas_VERSION}")
message(STATUS "xtensor      version:   ${xtensor_VERSION}")
message(STATUS "xtensor      include:   ${xtensor_INCLUDE_DIRS}/xtensor")
message(STATUS "xtensor-blas include:   ${xtensor-blas_INCLUDE_DIRS}/xtensor-blas")
message(STATUS "XtensorAll   export:    [{XtensorAll_LIBRARIES}] (include xtensor-blas) ")
message(STATUS "XtensorAll   export:    [{Xtensor_LIBRARIES}] (Not included xtensor-blas ")
message(STATUS "XtensorAll      tip:    注意：linux需要gcc>=8.3，否则提示段错误")
message(STATUS "")
# 导出变量
set(XtensorAll_LIBRARIES  xtensor xtensor::optimize  xtensor::use_xsimd xtensor-blas ${LAPACK_LIBRARIES})
set(Xtensor_LIBRARIES  xtensor xtensor::optimize  xtensor::use_xsimd )

include_directories(SYSTEM ${xtensor_INCLUDE_DIRS})  #最低优先级，防止跟open3d依赖冲突

