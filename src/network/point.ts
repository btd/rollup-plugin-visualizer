export const svgPoint = (event: MouseEvent) => {
  const node = event.currentTarget as SVGSVGElement;
  const point = node.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const finalPoint = point.matrixTransform(node.getScreenCTM()?.inverse());
  return [finalPoint.x, finalPoint.y];
};
