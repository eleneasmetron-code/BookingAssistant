export class AppError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export class SlotUnavailableError extends AppError {
  constructor(details?: unknown) {
    super(
      "Slot is unavailable",
      "Это время уже заняли. Сейчас покажу другие варианты.",
      "SLOT_UNAVAILABLE",
      details
    );
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(
      `${entity} not found`,
      "Не получилось найти нужные данные. Попробуйте ещё раз или позовите администратора.",
      "NOT_FOUND",
      { entity }
    );
  }
}

export class LateCancelNeedsAdminError extends AppError {
  constructor() {
    super(
      "Late cancellation needs administrator",
      "До визита осталось мало времени. Я передам отмену администратору.",
      "LATE_CANCEL_NEEDS_ADMIN"
    );
  }
}

export const getUserMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  return "Что-то пошло не так. Я сохранил обращение и передам администратору.";
};
