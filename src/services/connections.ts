import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import { GenericService } from '../utils/svc';

export class ConnectionService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & { db: GenericDBAdapterInterface }) {
    super(props);
    this.db = props.db;
  }
}
