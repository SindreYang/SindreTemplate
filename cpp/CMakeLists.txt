add_executable(sindre_template_example main.cpp)
target_link_libraries(sindre_template_example PRIVATE sindre_project_options)

if(SINDRE_ENABLE_OPENMP)
  target_link_libraries(sindre_template_example PRIVATE OpenMP::OpenMP_CXX)
endif()

if(BUILD_TESTING)
  add_test(NAME sindre_template_example_runs COMMAND sindre_template_example)
  set_tests_properties(sindre_template_example_runs PROPERTIES
    WORKING_DIRECTORY "$<TARGET_FILE_DIR:sindre_template_example>"
  )
endif()

if(SINDRE_BUILD_VTK_DEMO)
  add_subdirectory(vtk_demo)
endif()
