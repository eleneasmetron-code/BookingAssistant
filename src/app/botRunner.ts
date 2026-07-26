import { appContainer } from "./container.js";
import { createTelegramBot } from "../bot/telegramBot.js";

await appContainer.settingsService.ensureDefaults();

if (!appContainer.config.hasTelegramToken()) {
  console.log("TELEGRAM_BOT_TOKEN пустой. Бот не запущен.");
  process.exit(0);
}

const bot = createTelegramBot(appContainer);
await bot.launch();
console.log("Telegram-бот запущен.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
