import { gdlText } from '../../steam/localization';

/** Taiga Launcher: frase para uma lista de conquistas vazia, conforme o motivo informado pelo programa. */
export function taigaAchievementEmptyText(data: { taiga_status?: string; taiga_provider?: string } | null | undefined): string {
	const status = String(data?.taiga_status || ''), provider = String(data?.taiga_provider || '');
	if (status === 'unconfigured' && provider === 'xbox') return gdlText('taiga_ach_xbox_login', 'Sign in with your Microsoft account in Taiga Launcher (Accounts) to see this game\'s Xbox achievements.');
	if (status === 'unconfigured') return gdlText('taiga_ach_login', 'Connect the store account in Taiga Launcher (Accounts) to see this game\'s achievements.');
	if (status === 'unmapped' && provider) return gdlText('taiga_ach_unmapped', 'This game\'s achievements were not found in your account yet. Open the game once and try again.');
	if (status === 'offline') return gdlText('taiga_ach_offline', 'Could not load the achievements right now. Try again in a moment.');
	return '';
}
