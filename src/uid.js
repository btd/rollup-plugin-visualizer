let count = 0;

class Id {
  constructor(id) {
    this._id = id;
    this._href = createUrl({ hash: id }).href;
  }

  get id() {
    return this._id;
  }

  get href() {
    return this._href;
  }

  toString() {
    return `url(${this.href})`;
  }
}

export default function (name) {
  count += 1;
  const id = ["O", name, count].filter(Boolean).join("-");
  return new Id(id);
}

function createUrl(options = {}) {
  const url = new URL(window.location);
  return Object.assign(url, options);
}
