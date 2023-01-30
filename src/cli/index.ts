#!/usr/bin/env node
import {program} from "commander";
import {version} from "../../package.json";
import {init} from "./init";
import {status} from "./status";
import {timeline} from "./timeline";
import {sync} from "./sync";
import {fetch as fetchProgram} from "./fetch";
import {whois} from "./whois";
import {up} from "./up";
import {write} from "./write";
import {list} from "./list";

program
  .name('zkitter')
  .description('CLI for ZkitterJS local node')
  .version(version);

init(program);
status(program);
timeline(program);
sync(program);
fetchProgram(program);
whois(program);
up(program);
write(program);
list(program);

program.parse();
