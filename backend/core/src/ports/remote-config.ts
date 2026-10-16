// The port through which the backend core loads remote configuration (BACKEND.md section 7.6).
import type { RemoteConfigDocument } from '../remote-config/types.ts';

export interface RemoteConfigSource {
  getConfig(audience: string): Promise<RemoteConfigDocument>;
}
