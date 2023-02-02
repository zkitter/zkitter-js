import {Command} from "commander";
import {initZkitter} from "../utils/cli";
import {UserServiceEvents} from "../services/users";
import {success} from "../utils/logger";

export function sync(program: Command) {
  program
    .command('sync')
    .description('sync with arbitrum and group')
    .option('-a, --arbitrum', 'sync with arbitrum')
    .option('--groups', 'sync with all group')
    .option('-g, --group <groupName>', 'sync with group')
    .action(async (options) => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      zkitter.on(UserServiceEvents.ArbitrumSynced, data => {
        const {latest, fromBlock, toBlock} = data;
        const completion = ((fromBlock / latest) * 100).toFixed(2);
        success(`Synced with Arbitrum Mainnet from block #${fromBlock} to #${toBlock}(${completion}%)`);
      });

      zkitter.on(UserServiceEvents.NewUserCreated, data => {
        success(`New user added - @${data.address}`);
      });

      if (options.arbitrum) {
        await zkitter.syncUsers();
      } else if (options.group) {
        await zkitter.syncGroup(options.group);
      } else if (options.groups) {
        await zkitter.syncGroup();
      }

      process.exit(0);
    });
}