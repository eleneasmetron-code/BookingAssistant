import { appContainer } from "./container.js";
import { createAdminApi } from "../admin/api.js";

await appContainer.settingsService.ensureDefaults();

const api = createAdminApi(appContainer);

api.listen(appContainer.config.port, () => {
  console.log(`Админ API запущен: http://localhost:${appContainer.config.port}`);
});
