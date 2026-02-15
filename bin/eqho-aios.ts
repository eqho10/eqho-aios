#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from '../src/cli/commands/init.js';
import { registerRunCommand } from '../src/cli/commands/run.js';
import { registerStoryCommand } from '../src/cli/commands/story.js';
import { registerStatusCommand } from '../src/cli/commands/status.js';
import { registerAgentCommand } from '../src/cli/commands/agent.js';
import { registerConfigCommand } from '../src/cli/commands/config.js';
import { registerNotifyCommand } from '../src/cli/commands/notify.js';

const program = new Command();

program
  .name('eqho-aios')
  .description('AI-Orchestrated Full-Stack Development Framework')
  .version('0.1.0');

// Register all commands
registerInitCommand(program);
registerRunCommand(program);
registerStoryCommand(program);
registerStatusCommand(program);
registerAgentCommand(program);
registerConfigCommand(program);
registerNotifyCommand(program);

program.parse(process.argv);
