import {
  chatTopic,
  threadTopic,
  globalMessageTopic,
  userMessageTopic,
  groupMessageTopic,
} from '../utils/pubsub';

export type FilterOptions = {
  address?: string[];
  group?: string[];
  ecdh?: string[];
  thread?: string[];
  all?: boolean;
  prefix?: string;
}

export class Filter {
  private address: Set<string>;
  private group: Set<string>;
  private ecdh: Set<string>;
  private thread: Set<string>;
  private all: boolean;
  private prefix: string;
  constructor(options?: FilterOptions) {
    const {
      address = [],
      group = [],
      ecdh = [],
      thread = [],
      all = false,
      prefix = '',
    } = options || {};

    this.address = new Set(address);
    this.group = new Set(group);
    this.ecdh = new Set(ecdh);
    this.thread = new Set(thread);
    this.all = all;
    this.prefix = prefix;

    console.log(this);
  }

  get isEmpty() {
    return !this.address.size
      && !this.group.size
      && !this.ecdh.size
      && !this.thread.size
      && !this.all;
  }

  get topics(): string[] {
    if (this.isEmpty) return [];

    if (this.all) {
      return [globalMessageTopic(this.prefix)];
    }

    return [
      ...[...this.group].map(g => groupMessageTopic(g, this.prefix)),
      ...[...this.address].map(u => userMessageTopic(u, this.prefix)),
      ...[...this.ecdh].map(t => chatTopic(t, this.prefix)),
      ...[...this.thread].map(t => threadTopic(t, this.prefix)),
    ];
  }

  has(identifier: string): boolean {
    if (this.all) return true;

    return this.address.has(identifier)
      || this.group.has(identifier)
      || this.thread.has(identifier)
      || this.ecdh.has(identifier);
  }

  update = (options: Exclude<FilterOptions, { prefix?: string }>) => {
    const {
      address = [],
      group = [],
      ecdh = [],
      thread = [],
      all = false,
    } = options || {};

    address.forEach(a => this.address.add(a));
    group.forEach(a => this.group.add(a));
    ecdh.forEach(a => this.ecdh.add(a));
    thread.forEach(a => this.thread.add(a));
    this.all = all;
  }
}
