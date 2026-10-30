// Taiga Launcher: textos da página do jogo nos 5 idiomas do Taiga Launcher. Têm prioridade sobre as tabelas originais do
// NativeGameLink e cobrem todas as chaves usadas pelo código (o teste ngl-i18n confere isso a cada build).
import { TAIGA_PT } from './taiga-translations-pt';
import { TAIGA_FR } from './taiga-translations-fr';
import { TAIGA_DE } from './taiga-translations-de';

// Inglês: chaves cujo texto padrão no código está vazio ou em espanhol, e os nomes trocados pelo Taiga Launcher.
const english: Record<string, string> = {
	post_placeholder: 'Say something about this game to your friends...',
	activity: 'Activity',
	latest_news: 'View latest news',
	publish: 'Post',
	fetch_more: 'Load more activity',
	controller_ps4: 'DUALSHOCK support',
	controller_ps5: 'DualSense support',
	community_content: 'Community content',
	no_recent_activity: 'No recent activity from the developers of this game or from your friends.',
	cancel: 'Cancel',
	feed_game_launch: 'Release',
	feed_release_title_taiga: '{name} was released',
	feed_dlc: 'DLC',
	feed_event: 'Event',
	feed_beta: 'Beta',
	feed_content: 'New content',
	feed_season: 'Season',
	feed_community: 'Community',
	game_artwork_picker_api_key: 'Add your SteamGridDB API key in Taiga Launcher settings first.',
	taiga_ach_xbox_login: "Sign in with your Microsoft account in Taiga Launcher (Accounts) to see this game's Xbox achievements.",
	taiga_ach_login: "Connect the store account in Taiga Launcher (Accounts) to see this game's achievements.",
	taiga_ach_unmapped: "This game's achievements haven't shown up in your account yet. Open the game once and try again.",
	taiga_ach_offline: "Couldn't load the achievements right now. Try again in a moment.",
};

const spanish: Record<string, string> = {
	feed_game_launch: 'Lanzamiento',
	feed_release_title_taiga: '{name} salió a la venta',
	feed_content: 'Nuevo contenido',
	game_artwork_picker_api_key: 'Primero añade tu clave de API de SteamGridDB en los ajustes de Taiga Launcher.',
	game_artwork_picker_reset_success: 'Artwork predeterminado restaurado.',
	taiga_ach_xbox_login: 'Inicia sesión con tu cuenta de Microsoft en Taiga Launcher (Cuentas) para ver los logros de Xbox de este juego.',
	taiga_ach_login: 'Conecta la cuenta de la tienda en Taiga Launcher (Cuentas) para ver los logros de este juego.',
	taiga_ach_unmapped: 'Los logros de este juego aún no aparecen en tu cuenta. Abre el juego una vez e inténtalo de nuevo.',
	taiga_ach_offline: 'No se pudieron cargar los logros ahora. Inténtalo de nuevo en un momento.',
};

// Unidades de tempo do Big Picture (antes iam sempre em inglês).
const UNITS: Record<string, Record<string, string>> = {
	english: { unit_hour: 'hour', unit_hours: 'hours', unit_minute: 'minute', unit_minutes: 'minutes' },
	brazilian: { unit_hour: 'hora', unit_hours: 'horas', unit_minute: 'minuto', unit_minutes: 'minutos' },
	french: { unit_hour: 'heure', unit_hours: 'heures', unit_minute: 'minute', unit_minutes: 'minutes' },
	german: { unit_hour: 'Stunde', unit_hours: 'Stunden', unit_minute: 'Minute', unit_minutes: 'Minuten' },
	spanish: { unit_hour: 'hora', unit_hours: 'horas', unit_minute: 'minuto', unit_minutes: 'minutos' },
};

export const TAIGA_GDL_TEXT: Record<string, Record<string, string>> = {
	english: { ...english, ...UNITS.english },
	brazilian: { ...TAIGA_PT, ...UNITS.brazilian },
	french: { ...TAIGA_FR, ...UNITS.french },
	german: { ...TAIGA_DE, ...UNITS.german },
	spanish: { ...spanish, ...UNITS.spanish },
	latam: { ...spanish, ...UNITS.spanish },
};
