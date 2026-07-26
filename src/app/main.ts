import { appContainer } from "./container.js";
import { createAdminApi } from "../admin/api.js";
import { createTelegramBot } from "../bot/telegramBot.js";

await appContainer.settingsService.ensureDefaults();

const api = createAdminApi(appContainer);

api.listen(appContainer.config.port, () => {
  console.log(`Админ API запущен: http://localhost:${appContainer.config.port}`);
});

if (appContainer.config.hasTelegramToken()) {
  const bot = createTelegramBot(appContainer);
  await bot.launch();
  console.log("Telegram-бот запущен.");
} else {
  console.log("Telegram-бот не запущен: TELEGRAM_BOT_TOKEN пустой.");
}

setInterval(() => {
  appContainer.reminderService.processDue().catch((error) => {
    console.error("Ошибка напоминаний", error);
  });
}, 60_000);

process.once("SIGINT", () => appContainer.prisma.$disconnect());
process.once("SIGTERM", () => appContainer.prisma.$disconnect());
