// Screen coordinates are CSS pixels; the inverse CTM also accounts for the
// SVG viewBox, desktop resizing, and browser zoom before graph zoom is applied.
export const svgPoint = (
  svg: SVGSVGElement,
  event: { clientX: number; clientY: number },
): [number, number] => {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM()!.inverse());
  return [transformed.x, transformed.y];
};
