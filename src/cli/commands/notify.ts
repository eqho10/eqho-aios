import { Command } from 'commander';
import chalk from 'chalk';
import { log } from '../../utils/logger.js';
import { loadConfig } from '../../core/config-loader.js';
import type { EqhoConfig } from '../../types/index.js';

async function sendTelegram(config: EqhoConfig, message: string): Promise<boolean> {
  const { telegram } = config.integrations;

  if (!telegram.enabled) {
    log.warn('Telegram entegrasyonu devre disi. config set ile aktif edin.');
    return false;
  }

  const botToken = process.env[telegram.bot_token_env];
  if (!botToken) {
    log.error(`Telegram bot token bulunamadi: ${telegram.bot_token_env} ortam degiskeni tanimli degil.`);
    return false;
  }

  if (!telegram.chat_id) {
    log.error('Telegram chat_id yapilandirilmamis.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: telegram.chat_id,
      text: message,
      parse_mode: 'HTML',
    };

    if (telegram.thread_id) {
      body.message_thread_id = telegram.thread_id;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Telegram API hatasi: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    log.error(`Telegram gonderim hatasi: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function sendN8n(config: EqhoConfig, message: string): Promise<boolean> {
  const { n8n } = config.integrations;

  if (!n8n.enabled) {
    log.warn('n8n entegrasyonu devre disi. config set ile aktif edin.');
    return false;
  }

  if (!n8n.webhook_url) {
    log.error('n8n webhook URL yapilandirilmamis.');
    return false;
  }

  try {
    const response = await fetch(n8n.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'eqho-aios',
        message,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`n8n webhook hatasi: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    log.error(`n8n gonderim hatasi: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export function registerNotifyCommand(program: Command): void {
  program
    .command('notify')
    .argument('<message>', 'Notification message')
    .option('--telegram', 'Send via Telegram', false)
    .option('--n8n', 'Send via n8n webhook', false)
    .description('Send notification via configured channels')
    .action(async (message: string, options: { telegram: boolean; n8n: boolean }) => {
      try {
        log.title('EqhoAIOS - Bildirim Gonder');

        let config: EqhoConfig;
        try {
          config = await loadConfig();
        } catch {
          log.error("Konfigurasyon yuklenemedi. Once 'eqho-aios init' calistirin ve API key ayarlayin.");
          process.exit(1);
          return; // TypeScript flow analysis
        }

        // If no channel specified, try all enabled channels
        const sendTelegramFlag = options.telegram;
        const sendN8nFlag = options.n8n;
        const noChannelSpecified = !sendTelegramFlag && !sendN8nFlag;

        let anySuccess = false;
        let anySent = false;

        // Telegram
        if (sendTelegramFlag || (noChannelSpecified && config.integrations.telegram.enabled)) {
          anySent = true;
          log.info('Telegram gonderiliyor...');
          const ok = await sendTelegram(config, message);
          if (ok) {
            log.success('Telegram bildirimi gonderildi.');
            anySuccess = true;
          }
        }

        // n8n
        if (sendN8nFlag || (noChannelSpecified && config.integrations.n8n.enabled)) {
          anySent = true;
          log.info('n8n webhook gonderiliyor...');
          const ok = await sendN8n(config, message);
          if (ok) {
            log.success('n8n webhook bildirimi gonderildi.');
            anySuccess = true;
          }
        }

        if (!anySent) {
          log.warn('Hicbir bildirim kanali aktif degil veya secilmedi.');
          log.info('Kanal aktif etmek icin:');
          console.log('  eqho-aios config set integrations.telegram.enabled true');
          console.log('  eqho-aios config set integrations.n8n.enabled true');
          console.log('');
          log.info('Veya kanal belirtin:');
          console.log('  eqho-aios notify "mesaj" --telegram');
          console.log('  eqho-aios notify "mesaj" --n8n');
        } else if (!anySuccess) {
          log.error('Hicbir bildirim gonderilemedi.');
        }
      } catch (err) {
        log.error(`Bildirim hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
