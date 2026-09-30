// Implements: plan://M18 — GAP-7 specs/09 §4.6 (TC-CONT-06): runtime-проверка
// envelope контент-файлов. Валидатор (specs/05 §9) держит данные в git чистыми;
// здесь защитный throw на случай рассинхрона чанков при деплое — экраны
// показывают свою error-фазу вместо белого экрана.
export interface Envelope {
  schema_version: number
  kind: string
}

/** Выбрасывает понятную ошибку, если файл не той схемы/версии. */
export function assertEnvelope(
  file: Envelope | undefined,
  expectedKind: string,
  source: string,
): void {
  if (!file || file.kind !== expectedKind || file.schema_version !== 1) {
    throw new Error(
      `контент "${source}": ожидался ${expectedKind} schema_version 1, ` +
        `получен ${file?.kind ?? 'пустой файл'} v${file?.schema_version ?? '?'}`,
    )
  }
}
