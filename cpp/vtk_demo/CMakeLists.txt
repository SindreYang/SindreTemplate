find_package(VTK CONFIG REQUIRED)

add_executable(vtk_demo src/demo.cpp)
target_link_libraries(vtk_demo PRIVATE ${VTK_LIBRARIES})
target_compile_features(vtk_demo PRIVATE cxx_std_20)

if(COMMAND vtk_module_autoinit)
  vtk_module_autoinit(TARGETS vtk_demo MODULES ${VTK_LIBRARIES})
endif()
