add_executable(sindre_template_example main.cpp)
target_compile_features(sindre_template_example PRIVATE cxx_std_20)

if(BUILD_TESTING)
  add_test(NAME sindre_template_example_runs COMMAND sindre_template_example)
endif()

if(SINDRE_BUILD_VTK_DEMO)
  add_subdirectory(vtk_demo)
endif()
