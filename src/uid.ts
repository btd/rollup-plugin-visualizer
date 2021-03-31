let count = 0;

export class Id {
  private _id: string;
  private _href: string;

  constructor(id: string) {
    this._id = id;
    const url = new URL(window.location.href);
    url.hash = id;
    this._href = url.toString();
  }

  get id(): Id["_id"] {
    return this._id;
  }

  get href(): Id["_href"] {
    return this._href;
  }

  toString(): string {
    return `url(${this.href})`;
  }
}

export function generateUniqueId(name: string): Id {
  count += 1;
  const id = ["O", name, count].filter(Boolean).join("-");
  return new Id(id);
}
