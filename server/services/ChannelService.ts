import { isValidStreamUrl, sanitizePlainText } from '../../shared/catalogUtils';
import type { ChannelCategory, LiveChannel } from '../../shared/types';
import { repositoryStore } from '../repositories/interfaces';

const VALID_CATEGORIES: ChannelCategory[] = [
  'Notícias',
  'Esportes',
  'Entretenimento',
  'Filmes',
  'Variedades',
  'Infantil',
];

class ChannelServiceImpl {
  listPublic(category?: string): LiveChannel[] {
    const channels = repositoryStore.getChannels().filter((c) => c.active);
    if (!category || category === 'Todos') return channels;
    return channels.filter((c) => c.category === category);
  }

  listAllAdmin(): LiveChannel[] {
    return repositoryStore.getChannels();
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
    repositoryStore.addLog({
      level: 'info',
      service: 'ChannelService',
      message: `Canal autorizado salvo pelo admin: ${channel.name} (${channel.category}).`,
    });
    return channel;
  }

  remove(id: string): boolean {
    const ok = repositoryStore.deleteChannel(id);
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
