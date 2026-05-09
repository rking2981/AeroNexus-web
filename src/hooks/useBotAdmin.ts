'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import botApi from '@/lib/bot-api';

export type BotAdminStatus = 'loading' | 'authorized' | 'not_admin' | 'not_linked' | 'no_discord_role';

export function useBotAdmin(): BotAdminStatus {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<BotAdminStatus>('loading');

  useEffect(() => {
    if (!user) { setStatus('not_admin'); return; }
    if (user.role !== 'PLATFORM_ADMIN') { setStatus('not_admin'); return; }

    (async () => {
      try {
        // Check if Discord account is linked
        const { data: linked } = await api.get('/v1/bot/linked-status');
        console.log('[BotAdmin] linked-status:', linked);
        if (!linked.discord_id) { setStatus('not_linked'); return; }

        // Check Discord Admin role via bot API
        const { data } = await botApi.get(`/check-role?discord_id=${linked.discord_id}`);
        console.log('[BotAdmin] check-role:', data);
        setStatus(data.has_role ? 'authorized' : 'no_discord_role');
      } catch (err) {
        console.error('[BotAdmin] error:', err);
        setStatus('not_admin');
      }
    })();
  }, [user]);

  return status;
}
