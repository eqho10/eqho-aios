import { Command } from 'commander';
import chalk from 'chalk';
import { log } from '../../utils/logger.js';
import { loadConfig } from '../../core/config-loader.js';
import {
  readFile,
  writeFile,
  fileExists,
  resolveProjectPath,
} from '../../utils/file-utils.js';
import { parseYaml, stringifyYaml } from '../../utils/yaml-utils.js';

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];

  // Try to parse the value as a proper type
  if (value === 'true') {
    current[lastKey] = true;
  } else if (value === 'false') {
    current[lastKey] = false;
  } else if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
    current[lastKey] = Number(value);
  } else {
    current[lastKey] = value;
  }
}

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function printConfig(obj: Record<string, unknown>, indent: number = 0): void {
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}:`);
      printConfig(value as Record<string, unknown>, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}: ${chalk.white(JSON.stringify(value))}`);
    } else if (typeof value === 'boolean') {
      console.log(`${prefix}${chalk.cyan(key)}: ${value ? chalk.green('true') : chalk.red('false')}`);
    } else if (typeof value === 'number') {
      console.log(`${prefix}${chalk.cyan(key)}: ${chalk.yellow(String(value))}`);
    } else {
      console.log(`${prefix}${chalk.cyan(key)}: ${chalk.white(String(value))}`);
    }
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('View and modify configuration');

  // config show
  config
    .command('show')
    .option('--key <key>', 'Show specific config key (e.g., llm.model)')
    .description('Show current configuration')
    .action(async (options: { key?: string }) => {
      try {
        log.title('EqhoAIOS - Konfigurasyon');

        const configPath = resolveProjectPath('.eqho-aios', 'config.yaml');
        if (!(await fileExists(configPath))) {
          log.error("Konfigurasyon bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        const raw = await readFile(configPath);
        const parsed = parseYaml<Record<string, unknown>>(raw);

        if (options.key) {
          const value = getNestedValue(parsed, options.key);
          if (value === undefined) {
            log.error(`Anahtar bulunamadi: ${options.key}`);
            process.exit(1);
          }

          if (typeof value === 'object' && value !== null) {
            console.log(chalk.cyan(options.key) + ':');
            printConfig(value as Record<string, unknown>, 1);
          } else {
            console.log(`${chalk.cyan(options.key)}: ${chalk.white(String(value))}`);
          }
        } else {
          printConfig(parsed);
        }
      } catch (err) {
        log.error(`Config gosterme hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // config set
  config
    .command('set')
    .argument('<key>', 'Config key in dot notation (e.g., llm.model)')
    .argument('<value>', 'New value')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      try {
        const configPath = resolveProjectPath('.eqho-aios', 'config.yaml');
        if (!(await fileExists(configPath))) {
          log.error("Konfigurasyon bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        const raw = await readFile(configPath);
        const parsed = parseYaml<Record<string, unknown>>(raw);

        // Get old value for display
        const oldValue = getNestedValue(parsed, key);

        // Set the new value
        setNestedValue(parsed, key, value);

        // Write back
        const newContent = stringifyYaml(parsed);
        await writeFile(configPath, newContent);

        log.success(`Konfigurasyon guncellendi: ${key}`);
        console.log(chalk.gray('  Eski deger: ') + chalk.red(String(oldValue ?? 'undefined')));
        console.log(chalk.gray('  Yeni deger: ') + chalk.green(String(getNestedValue(parsed, key))));

        // Validate the updated config still loads correctly
        try {
          await loadConfig();
          log.success('Konfigurasyon gecerli.');
        } catch (err) {
          log.warn(`Dikkat: Konfigurasyon dogrulama hatasi - ${err instanceof Error ? err.message : String(err)}`);
          log.info('Hatali degeri duzeltmek icin: eqho-aios config set ' + key + ' <deger>');
        }
      } catch (err) {
        log.error(`Config ayarlama hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
