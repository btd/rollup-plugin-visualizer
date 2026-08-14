let count = 0;

export class Id {
  private readonly idValue: string;
  private readonly hrefValue: string;

  constructor(id: string) {
    this.idValue = id;
    const url = new URL(window.location.href);
    url.hash = id;
    this.hrefValue = url.toString();
  }

  get id(): string {
    return this.idValue;
  }

  get href(): string {
    return this.hrefValue;
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
