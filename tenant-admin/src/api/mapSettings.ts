import { apiFetch as request } from './http';

export type MapSettings = {
  yandexMapsApiKey: string | null;
};

export const mapSettingsApi = {
  get: (): Promise<MapSettings> => request('/map-settings'),
  update: (yandexMapsApiKey: string | null): Promise<MapSettings> =>
    request('/map-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yandexMapsApiKey }),
    }),
};
