// Where the app's own files live (samples, static data). The app runs from
// the project folder in dev and from /app in Docker; APP_ROOT overrides.
import path from 'node:path';

export const APP_ROOT = path.resolve(process.env.APP_ROOT || process.cwd());
