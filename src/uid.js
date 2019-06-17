let count = 0;

class Id {
  constructor(id) {
    this._id = id;
  }

  get id() {
    return this._id;
  }

  get href() {
    const url = new URL(window.location);
    url.hash = this.id;
    return url.href;
  }

  toString() {
    return `url(${this.href})`;
  }
}

export default function(name) {
  count += 1;
  const id = ["O", name, count].filter(Boolean).join("-");
  return new Id(id);
}
