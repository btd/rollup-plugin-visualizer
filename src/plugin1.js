import { select } from 'd3-selection';
import { partition as d3partition, hierarchy as d3hierarchy } from 'd3-hierarchy';
import { arc as d3arc } from 'd3-shape';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import bytes from 'bytes';

var data = window.nodesData;

var width = 700,
    height = 700,
    radius = (Math.min(width, height) / 2) - 10;

function color(node) {
  if (node.children && node.children.length) {
    var parents = getAncestors(node);
    var hasNodeModules = !!parents.filter(n => n.data.name === 'node_modules').length;
    return hasNodeModules ? '#599e59' : '#487ea4';
  } else {
    return '#db7100';
  }
}

var x = scaleLinear()
    .range([0, 2 * Math.PI]);
var y = scaleSqrt()
    .range([0, radius]);


var g = select('#chart')
    .append('svg')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', 'translate(' + width/2 + ',' + height/2 + ')');

var partition = d3partition();
var arc = d3arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x0))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x1))); })
    .innerRadius(function(d) { return y(d.y0); })
    .outerRadius(function(d) { return y(d.y1); });

var root = d3hierarchy(data)
  .sum(function(d) {
    if (d.children) {
      return 0;
    } else {
      return d.size;
    }
  })
  .sort(null);

partition(root);

g.selectAll("path")
    .data(partition(root).descendants())
  .enter().append("path")
    .attr("display", function(d) { return d.depth ? null : "none"; })
    .attr("d", arc)
    .attr("fill-rule", "evenodd")
    .style('stroke', '#fff')
    .style("fill", function(d) { return color(d); })
    .on("mouseover", mouseover);

var totalSize = root.value;

select("#chart").on("mouseleave", mouseleave);

function mouseover(d) {
  var percentage = (100 * d.value / totalSize).toPrecision(2);
  var percentageString = percentage + '%';
  if (percentage < 0.1) {
      percentageString = '< 0.1%';
  }

  select('.details-name')
    .text(d.data.name);

  select('.details-percentage')
    .text(percentageString);

  select(".details-size")
    .text(bytes(d.value));

  select(".details")
      .style("display", "block");

  var sequenceArray = getAncestors(d);
  //updateBreadcrumbs(sequenceArray, percentageString);

  // Fade all the segments.
  g.selectAll("path")
      .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  g.selectAll("path")
      .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
              })
      .style("opacity", 1);
}

function getAncestors(node) {
  var path = [];
  var current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

function mouseleave() {
  g.selectAll("path")
    .style("opacity", 1);

  select(".details")
    .style("display", "none");
}
