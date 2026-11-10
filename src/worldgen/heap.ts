/** Binary min-heap of integer items by key; ties go to the lower item, so pops are deterministic. */
export class Heap {
  private readonly keys: number[] = [];
  private readonly items: number[] = [];

  get size() {
    return this.items.length;
  }

  push(item: number, key: number) {
    const { keys, items } = this;
    let i = items.length;
    keys.push(key);
    items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const { keys, items } = this;
    const top = items[0];
    const last_key = keys.pop() ?? 0;
    const last_item = items.pop() ?? 0;
    if (items.length) {
      keys[0] = last_key;
      items[0] = last_item;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(l, m)) m = l;
        if (r < items.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private less(a: number, b: number) {
    return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.items[a] < this.items[b]);
  }

  private swap(a: number, b: number) {
    const { keys, items } = this;
    [keys[a], keys[b]] = [keys[b], keys[a]];
    [items[a], items[b]] = [items[b], items[a]];
  }
}
