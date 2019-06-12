let count = 0;

export default function(name) {
  return new Id("O-" + (name == null ? "" : name + "-") + ++count);
}

function Id(id) {
  this.id = id;
  this.href = window.location.href + "#" + id;
}

Id.prototype.toString = function() {
  return "url(" + this.href + ")";
};
