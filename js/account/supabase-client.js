(() => {
  if (!window.supabase?.createClient) {
    console.error("Supabase SDK не загрузился.");
    return;
  }

  const config = window.HARVESTHUB_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const supabaseAnonKey = String(config.supabaseAnonKey || "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) || !supabaseAnonKey) {
    console.error("Публичная конфигурация Supabase не заполнена.");
    return;
  }

  // A link must not silently replace the account used for cloud saves.
  const callbackHash = new URLSearchParams(window.location.hash.slice(1));
  const callbackQuery = new URLSearchParams(window.location.search);
  const hasUrlSession = callbackHash.has('access_token') || callbackQuery.has('access_token');
  let acceptUrlSession = true;
  if (hasUrlSession) {
    acceptUrlSession = window.confirm(
      'Эта ссылка предлагает войти в аккаунт или восстановить пароль. Продолжайте только если вы сами запросили это письмо: после входа данные будут сохраняться в аккаунте из ссылки. Продолжить?'
    );
    if (!acceptUrlSession) {
      const cleanUrl = new URL(window.location.href);
      for (const key of ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'provider_token', 'provider_refresh_token']) {
        callbackHash.delete(key);
        cleanUrl.searchParams.delete(key);
      }
      cleanUrl.hash = callbackHash.toString();
      window.history.replaceState(window.history.state, '', cleanUrl.href);
    }
  }

  window.harvestHubSupabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: acceptUrlSession,
      storageKey: "harvesthub_supabase_auth"
    }
  });
})();
