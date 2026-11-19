import { isValidStreamUrl, sanitizePlainText } from '../../shared/catalogUtils.ts';
import { toIsoTimestamp } from '../../shared/siteConfigUtils.ts';
import type { ChannelCategory, LiveChannel } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';

const VALID_CATEGORIES: ChannelCategory[] = [
  'Notícias',
  'Esportes',
  'Entretenimento',
  'Filmes',
  'Variedades',
  'Infantil',
];

class ChannelServiceImpl {
  private lastHydratedAt = 0;
  private readonly hydrationTtlMs = 2_500;
  private hydrationPromise: Promise<void> | null = null;

  async ensureHydrated(force = false): Promise<void> {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }

    const run = (async () => {
      const remoteRes =
        await FirestoreRestService.queryActiveCollectionChecked<Partial<LiveChannel>>('channels');

      if (remoteRes.ok) {
        const remoteIds = new Set<string>();
        for (const raw of remoteRes.items) {
          if (
            !raw.id ||
            !raw.name ||
            !raw.category ||
            !VALID_CATEGORIES.includes(raw.category) ||
            !raw.streamUrl ||
            !isValidStreamUrl(raw.streamUrl)
          ) {
            continue;
          }
          const normalized: LiveChannel = {
            id: String(raw.id),
            name: sanitizePlainText(raw.name, 100),
            category: raw.category,
            streamUrl: String(raw.streamUrl).trim().slice(0, 500),
            logoUrl: raw.logoUrl ? String(raw.logoUrl).trim().slice(0, 500) : undefined,
            description: raw.description ? sanitizePlainText(raw.description, 300) : undefined,
            active: raw.active !== false,
            createdAt: toIsoTimestamp(raw.createdAt, new Date().toISOString()),
          };
          remoteIds.add(normalized.id);
          repositoryStore.upsertChannel(normalized);
        }

        for (const localCh of repositoryStore.getChannels()) {
          if (!remoteIds.has(localCh.id)) {
            repositoryStore.deleteChannel(localCh.id);
          }
        }
      }

      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });

    this.hydrationPromise = run;
    return run;
  }

  listPublic(category?: string): LiveChannel[] {
    const channels = repositoryStore.getChannels().filter((c) => c.active);
    if (!category || category === 'Todos') return channels;
    return channels.filter((c) => c.category === category);
  }

  async listPublicAsync(category?: string, force = false): Promise<LiveChannel[]> {
    await this.ensureHydrated(force);
    return this.listPublic(category);
  }

  listAllAdmin(): LiveChannel[] {
    return repositoryStore.getChannels();
  }

  async listAllAdminAsync(force = false): Promise<LiveChannel[]> {
    await this.ensureHydrated(force);
    return this.listAllAdmin();
  }

  createOrUpdate(payload: {
    id?: string;
    name: string;
    category: ChannelCategory;
    streamUrl: string;
    logoUrl?: string;
    description?: string;
    active?: boolean;
  }): LiveChannel {
    const name = sanitizePlainText(payload.name, 100);
    if (!name) {
      throw new Error('Nome do canal é obrigatório.');
    }
    if (!VALID_CATEGORIES.includes(payload.category)) {
      throw new Error('Categoria de canal inválida.');
    }
    if (!isValidStreamUrl(payload.streamUrl)) {
      throw new Error('URL de transmissão autorizada inválida (use http:// ou https://).');
    }

    const id = payload.id?.trim() || `ch_${Date.now()}`;
    const existing = repositoryStore.getChannels().find((c) => c.id === id);

    const channel: LiveChannel = {
      id,
      name,
      category: payload.category,
      streamUrl: payload.streamUrl.trim().slice(0, 500),
      logoUrl: payload.logoUrl ? payload.logoUrl.trim().slice(0, 500) : undefined,
      description: payload.description ? sanitizePlainText(payload.description, 300) : undefined,
      active: typeof payload.active === 'boolean' ? payload.active : true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    repositoryStore.upsertChannel(channel);
    this.lastHydratedAt = Date.now();
    repositoryStore.addLog({
      level: 'info',
      service: 'ChannelService',
      message: `Canal autorizado salvo pelo admin: ${channel.name} (${channel.category}).`,
    });
    return channel;
  }

  remove(id: string): boolean {
    const ok = repositoryStore.deleteChannel(id);
    this.lastHydratedAt = Date.now();
    if (ok) {
      repositoryStore.addLog({
        level: 'warn',
        service: 'ChannelService',
        message: `Canal removido pelo admin: ${id}.`,
      });
    }
    return ok;
  }
}

export const ChannelService = new ChannelServiceImpl();
