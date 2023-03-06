import { Command } from 'commander';
import { ZkitterEvents } from '../services';
import { initZkitter } from '../utils/cli';

export function fetch(program: Command) {
  program
    .command('fetch')
    .description('fetch historical data (30 days max) from waku')
    .option('-u, --user <address>', 'fetch recent history of this user address')
    .option('-g, --group <groupId>', 'fetch recent history of this group id')
    .option('-a, --all', 'fetch all messages')
    .action(async options => {
      const zkitter = await initZkitter();

      if (!zkitter) return;

      let count = 0;
      let oldCount = 0;

      zkitter.on(ZkitterEvents.AlreadyExist, () => {
        oldCount++;
      });

      zkitter.on(ZkitterEvents.NewMessageCreated, () => {
        count++;
      });

      if (options.user) {
        await zkitter.queryUser(options.user);
      } else if (options.group) {
        await zkitter.queryGroup(options.group);
      } else if (options.all) {
        await zkitter.queryAll();
      }

      console.log(`Found ${count} new message(s) and ${oldCount} old message(s).`);

      process.exit(0);
    });
}
