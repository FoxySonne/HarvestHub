(() => {
  const SUPABASE_URL = "https://dfbenhembawizjhachwz.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_df26yuskbnUu6V6kVwe4iw_Ordrp8HV";

  if (!window.supabase?.createClient) {
    console.error("Supabase SDK не загрузился");
    window.harvestHubNotifications?.error(
      "Supabase SDK не загрузился",
      "Не удалось подключиться к серверу. Обновите страницу и попробуйте ещё раз."
    );
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

  if (!window.harvestHubSupabase) {
    window.harvestHubSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: acceptUrlSession
        }
      }
    );
  }
})();
