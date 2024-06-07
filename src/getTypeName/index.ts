import { camelCase, pascalCase, snakeCase } from 'change-case';

type Fn = (table: string) => string;

const all = {
  pascal: pascalCase,
  camel: camelCase,
  snake: snakeCase,
  default: undefined,
} as const;

export type GetTypeName = keyof typeof all | Fn;

export function getTypeName(table: string, type?: GetTypeName) {
  if (typeof type === 'function') {
    return type(table);
  } else {
    return all[type ?? 'default']?.(table) ?? table;
  }
}
