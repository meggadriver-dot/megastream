import type { PlayerAudioOption, StreamKind } from './types.ts';

export interface FailoverCandidateResult {
  kind: 'backup' | 'audio';
  targetOptionId: string;
  streamUrl: string;
  streamKind: StreamKind;
  languageLabel: string;
  switchedLanguage: boolean;
}

export function pickNextPlayableCandidate(params: {
  activeOptionId: string;
  activeStreamUrl: string;
  audioOptions: readonly PlayerAudioOption[];
  failedAudioIds: ReadonlySet<string>;
  failedStreamUrls: ReadonlySet<string>;
}): FailoverCandidateResult | null {
  const {
    activeOptionId,
    activeStreamUrl,
    audioOptions,
    failedAudioIds,
    failedStreamUrls,
  } = params;

  const isFailedUrl = (url?: string | null): boolean =>
    !url || url === activeStreamUrl || failedStreamUrls.has(url);

  const activeOption = audioOptions.find((opt) => opt.id === activeOptionId);
  if (activeOption) {
    const sameLangBackups = Array.isArray(activeOption.backupStreams)
      ? activeOption.backupStreams
      : [];
    const nextBackup = sameLangBackups.find((b) => !isFailedUrl(b.streamUrl));
    if (nextBackup) {
      return {
        kind: 'backup',
        targetOptionId: activeOption.id,
        streamUrl: nextBackup.streamUrl,
        streamKind: nextBackup.streamKind,
        languageLabel: activeOption.languageLabel || activeOption.label,
        switchedLanguage: false,
      };
    }
  }

  for (const opt of audioOptions) {
    if (opt.id === activeOptionId || failedAudioIds.has(opt.id)) continue;

    if (!isFailedUrl(opt.streamUrl)) {
      return {
        kind: 'audio',
        targetOptionId: opt.id,
        streamUrl: opt.streamUrl,
        streamKind: opt.streamKind,
        languageLabel: opt.languageLabel || opt.label,
        switchedLanguage: true,
      };
    }

    const optBackup = (opt.backupStreams || []).find((b) => !isFailedUrl(b.streamUrl));
    if (optBackup) {
      return {
        kind: 'audio',
        targetOptionId: opt.id,
        streamUrl: optBackup.streamUrl,
        streamKind: optBackup.streamKind,
        languageLabel: opt.languageLabel || opt.label,
        switchedLanguage: true,
      };
    }
  }

  return null;
}

export function hasNextPlayableCandidate(params: {
  activeOptionId: string;
  activeStreamUrl: string;
  audioOptions: readonly PlayerAudioOption[];
  failedAudioIds: ReadonlySet<string>;
  failedStreamUrls: ReadonlySet<string>;
}): boolean {
  return pickNextPlayableCandidate(params) !== null;
}

export function shouldAutoRetryMutedOnPlayError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err && typeof err.name === 'string' ? err.name : '';
  const message =
    'message' in err && typeof err.message === 'string' ? err.message.toLowerCase() : '';

  if (name === 'NotAllowedError') return true;
  if (
    message.includes("user didn't interact") ||
    message.includes('autoplay') ||
    message.includes('not allowed')
  ) {
    return true;
  }
  return false;
}
