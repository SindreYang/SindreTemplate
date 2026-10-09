# `src/utils2d`

使用原生 Canvas 2D：图像坐标与 CSS/Canvas 像素坐标换算、矩形/旋转框/多边形/折线/关键点的纯数据类型与绘制。参考 SindreStudio 的 `LabelImageCanvas`，把几何与绘制从组件状态中分离。

实现位于 `algorithms.ts`，`index.ts` 统一导出。公开命名为 `get_canvas_point`、`get_image_point`、`get_annotation_hit`、`show_annotation`。

## 首版

坐标映射、范围检查、命中检测、标注绘制。Canvas/上下文由调用者传入；不创建页面元素，也不规定 React 状态。标注类型采用带 `kind` 字段的联合类型。

## 注意

- 明确图像像素、CSS 像素和设备像素比；坐标变换往返应保持精度。
- 旋转框角度统一使用弧度，不能直接混用模型输出的角度约定。
- 绘制前后用 `ctx.save()/ctx.restore()`，避免污染调用者的 Canvas 状态。
- OCR 四边形、mask、画笔、撤销重做与导出格式等作为后续专题逐项验证。
