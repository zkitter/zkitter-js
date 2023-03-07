import { GenericService } from '../utils/svc';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Connection } from '../utils/message';
import { ConstructorOptions } from 'eventemitter2';
import { Proof } from '../models/proof';

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
