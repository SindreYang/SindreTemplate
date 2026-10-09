# 使用 CMake 包查找 Python 和 pybind11，不写死开发机路径。
add_executable(sindre_python_embed_example
  src/test.cpp
  src/pywarp.cpp
)

target_link_libraries(sindre_python_embed_example PRIVATE
  sindre_project_options
  Python::Python
  pybind11::embed
)
target_include_directories(sindre_python_embed_example PRIVATE include)
target_compile_features(sindre_python_embed_example PRIVATE cxx_std_20)

if(WIN32 AND Python_RUNTIME_LIBRARY_DIRS)
  # Windows 下把 Python DLL 复制到可执行文件旁，便于从构建目录直接运行。
  add_custom_command(TARGET sindre_python_embed_example POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "${Python_RUNTIME_LIBRARY_DIRS}/python${Python_VERSION_MAJOR}${Python_VERSION_MINOR}.dll"
      "$<TARGET_FILE_DIR:sindre_python_embed_example>"
    VERBATIM
  )
endif()
