find_package(VTK CONFIG REQUIRED)

add_executable(vtk_demo src/demo.cpp)
target_link_libraries(vtk_demo PRIVATE sindre_project_options)
target_link_libraries(vtk_demo PRIVATE ${VTK_LIBRARIES})

if(COMMAND vtk_module_autoinit)
  vtk_module_autoinit(TARGETS vtk_demo MODULES ${VTK_LIBRARIES})
endif()
