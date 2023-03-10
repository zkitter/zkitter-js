import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Proof } from '../models/proof';
import { Connection } from '../utils/message';
import { GenericService } from '../utils/svc';

export class ConnectionService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & { db: GenericDBAdapterInterface }) {
    super(props);
    this.db = props.db;
  }

  async insert(connection: Connection, proof: Proof) {
    return this.db.insertConnection(connection, proof);
  }

  async getConnections(
    address: string,
    limit?: number,
    offset?: number | string
  ): Promise<Connection[]> {
    return this.db.getConnections(address, limit, offset);
  }
}
