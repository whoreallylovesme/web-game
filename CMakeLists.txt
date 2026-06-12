cmake_minimum_required(VERSION 3.20)

project(ai_containment_2027
  VERSION 0.1.0
  DESCRIPTION "AI Containment 2027 - a native C++ raylib top-down action prototype"
  LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(raylib 5.0 QUIET)

if(NOT raylib_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 5.5
  )
  set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(BUILD_GAMES OFF CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(raylib)
endif()

add_executable(ai-containment-2027
  src/main.cpp
)

target_compile_options(ai-containment-2027 PRIVATE
  $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-Wall -Wextra -Wpedantic>
)

target_link_libraries(ai-containment-2027 PRIVATE raylib)

if(APPLE)
  target_link_libraries(ai-containment-2027 PRIVATE
    "-framework IOKit"
    "-framework Cocoa"
    "-framework OpenGL"
  )
endif()
