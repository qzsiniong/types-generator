import * as fs from 'fs/promises';

import { warningHeader as defaultWarningHeader } from './warningHeader';

export const writeToFile = async (filePath: string, text: string, warningHeader = defaultWarningHeader) => {
  if (await fileExists(filePath)) {
    await fs.appendFile(filePath, text);
  } else {
    await fs.writeFile(filePath, warningHeader + text);
  }
};

function fileExists(filePath: string): Promise<boolean> {
  // For some reason there's no fsPromises.exists :(
  return fs
    .stat(filePath)
    .then(() => true)
    .catch(() => false);
}
