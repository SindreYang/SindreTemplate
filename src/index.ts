import { lazy_module } from "./general/lazy.js";

/** Select a module without loading unrelated engines or platform bindings. */
const modules = {
  general: lazy_module(() => import("./general/index.js")),
  utils2d: lazy_module(() => import("./utils2d/index.js")),
  utils3d: lazy_module(() => import("./utils3d/index.js")),
  utils3d_react: lazy_module(() => import("./utils3d/react.js")),
  utilsui_react: lazy_module(() => import("./utilsui/react.js")),
  utilsui_toast: lazy_module(() => import("./utilsui/toast/index.js")),
  utilsui_progress: lazy_module(() => import("./utilsui/progress/index.js")),
  utilsui_video: lazy_module(() => import("./utilsui/video/index.js")),
  utilsui_widgets: lazy_module(() => import("./utilsui/widgets/index.js")),
  utilsui_dialog: lazy_module(() => import("./utilsui/dialog/index.js")),
  utilsui_canvas: lazy_module(() => import("./utilsui/canvas/index.js")),
  utilsui_panel: lazy_module(() => import("./utilsui/panel/index.js")),
  utilsui_list: lazy_module(() => import("./utilsui/list/index.js")),
  utilsui_markdown: lazy_module(() => import("./utilsui/markdown.js")),
  utilsui_dnd: lazy_module(() => import("./utilsui/dnd/index.js")),
  utilsui_swiper: lazy_module(() => import("./utilsui/swiper/index.js")),
  utilsagent: lazy_module(() => import("./utilsagent/index.js")),
  ai: lazy_module(() => import("./ai/index.js")),
} as const;

export function load_module<K extends keyof typeof modules>(name: K): ReturnType<(typeof modules)[K]> {
  return modules[name]() as ReturnType<(typeof modules)[K]>;
}

export { lazy_module, lazy_keyed } from "./general/lazy.js";
