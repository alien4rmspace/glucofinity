import { createReadStream } from 'node:fs';
import readline from 'node:readline';

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

export async function readCsv(
  filePath: string,
  visit: (record: Readonly<Record<string, string>>) => void,
): Promise<void> {
  const lines = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  let headers: string[] | undefined;
  for await (const line of lines) {
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = fields[index] ?? '';
    });
    visit(record);
  }
}
