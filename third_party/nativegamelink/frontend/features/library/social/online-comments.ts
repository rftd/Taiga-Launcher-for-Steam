// Taiga Launcher: comentários online nos jogos sem página na Steam (emuladores, ports). Quem tem o mesmo jogo vê os
// comentários de todos, com o nome e a foto da Steam (clicando, abre o perfil).
// Segurança: tudo o que vem do servidor é escrito como texto (textContent), nunca como HTML; fotos só de endereços da
// Steam e perfil só pelo SteamID numérico. A sessão da conta fica no Taiga Launcher, esta página nunca a vê.
import { callable } from '@steambrew/client';
import { displayLanguage } from '../../../steam/localization';
import { openSteamNavigationUrl } from '../../../steam/navigation';
import { backendLog } from '../../../api/backend';

const stateCall = callable<[{ shortcut_app_id: string; sort?: string; offset?: number; all?: boolean }], string>('taiga_comments_state');
const translateCall = callable<[{ id: string }], string>('taiga_comments_translate');
const postCall = callable<[{ shortcut_app_id: string; text: string }], string>('taiga_comments_post');
const deleteCall = callable<[{ id: string }], string>('taiga_comments_delete');
const reportCall = callable<[{ id: string }], string>('taiga_comments_report');
const likeCall = callable<[{ id: string; like: boolean }], string>('taiga_comments_like');
const loginCall = callable<[], string>('taiga_comments_login');
const loginStateCall = callable<[], string>('taiga_comments_login_state');
const logoutCall = callable<[], string>('taiga_comments_logout');

interface CommentItem { id: string; steamid: string; at: number; body: string; name: string; avatar: string; likes?: number; liked?: boolean; lang?: string | null }
interface Me { steamid: string; name: string; avatar: string; level: number | null; public: boolean }
interface CommentsState { enabled: boolean; available?: boolean; loggedIn?: boolean; me?: Me | null; pending?: boolean; items?: CommentItem[]; more?: boolean; total?: number | null; minLevel?: number | null; error?: string; game?: string; others?: number | null; lang?: string }

const TEXT: Record<string, Record<string, string>> = {
	pt: { countOne: '1 comentário', countMany: '{n} comentários', modalTitle: 'Conecte sua Steam para comentar', modalText: 'Os comentários são públicos: aparecem com o seu nome e a sua foto da Steam para todos que têm este jogo no Taiga Launcher. Conecte sua conta para publicar, o que você escreveu continua na caixa.', modalPending: 'Confirme na página da Steam que abriu. Esta janela fecha sozinha quando terminar.', notNow: 'Agora não', close: 'Fechar', otherLangs: 'Ver {n} comentários em outros idiomas', otherLangsOne: 'Ver 1 comentário em outro idioma', onlyMine: 'Mostrar só os do seu idioma', translate: 'Traduzir', original: 'Ver original', translating: 'Traduzindo...', err_server: 'O servidor dos comentários teve um problema. Tente de novo em alguns minutos.', err_translate: 'Não foi possível traduzir agora. Tente mais tarde.', public: 'Públicos', publicTip: 'Tudo o que você escreve aqui pode ser visto por quem tem este jogo no Taiga Launcher.', lead: 'Converse com quem também tem {game} no Taiga Launcher. O que você escrever aqui aparece para todos eles.', leadNoGame: 'Converse com quem também tem este jogo no Taiga Launcher. O que você escrever aqui aparece para todos eles.', last: 'último comentário {when}', p1: 'Deixe uma dica para quem está começando {game}...', p2: 'O que você achou de {game}?', p3: 'Qual a sua lembrança favorita com {game}?', p4: 'Tem alguma dúvida sobre {game}? Pergunte aqui...', publicNote: 'Público: todos que têm este jogo no Taiga Launcher podem ver', asUser: 'comentando como {name}', needSteam: 'para publicar, você conecta sua Steam', chipTip: 'Dica', chipOpinion: 'Opinião', chipQuestion: 'Pergunta', chipMemory: 'Lembrança', emptyTitle: 'Comece a conversa sobre {game}', emptyTitleNoGame: 'Comece a conversa sobre este jogo', emptyText: 'Faça um comentário e todos que têm este jogo vão ver.', err_quota: 'O servidor dos comentários atingiu o limite gratuito de hoje. Volta a funcionar sozinho à meia-noite UTC (21h em Brasília).', publicLine: 'Seu comentário fica visível para todos que têm este jogo no Taiga Launcher.', emptyCta: 'Escrever o primeiro comentário', title: 'Comentários', placeholder: 'Escreva um comentário para quem também joga este jogo...', loginTitle: 'Participe da conversa', loginText: 'Para comentar, conecte com a sua conta Steam. Os comentários são públicos: todos que tiverem este jogo vão poder ver e comentar.', gateTitle: 'Conecte sua conta Steam para publicar', gateText: 'Os comentários são públicos: todos que têm este jogo no Taiga Launcher vão ver o que você escrever. Seu texto continua na caixa.', login: 'Entrar com a Steam', loginPending: 'Confirme na página da Steam que abriu. Esta parte atualiza sozinha.', logout: 'Sair', signedAs: 'Conectado como', empty: 'Ninguém comentou ainda. Seja o primeiro!', recent: 'Recentes', popular: 'Populares', showMore: 'Ver mais {n} comentários', showMoreOne: 'Ver mais 1 comentário', showLess: 'Mostrar menos', loadMore: 'Carregar mais comentários', delete: 'Apagar', deleteConfirm: 'Apagar mesmo?', report: 'Denunciar', reportConfirm: 'Confirmar denúncia', reported: 'Denúncia enviada. Obrigado!', like: 'Curtir', liked: 'Curtido', ownLike: 'Curtidas do seu comentário', posting: 'Publicando...', err_login: 'Conecte a sua conta Steam para comentar.', err_low_level: 'Sua conta Steam precisa ser nível {n} ou mais para comentar.', err_private_profile: 'Deixe seu perfil da Steam público para comentar (a Steam só mostra o nível de perfis públicos).', err_slow_down: 'Espere {n} s para comentar de novo.', err_daily_limit: 'Você chegou ao limite de comentários de hoje.', err_no_links: 'Links não são permitidos nos comentários.', err_too_long: 'Comentário longo demais (máximo de 500 caracteres).', err_duplicate: 'Você já publicou esse comentário.', err_banned: 'Esta conta não pode comentar.', err_offline: 'Comentários indisponíveis no momento. Tente de novo mais tarde.' },
	en: { countOne: '1 comment', countMany: '{n} comments', modalTitle: 'Connect your Steam account to comment', modalText: 'Comments are public: they show your Steam name and picture to everyone who has this game in Taiga Launcher. Connect your account to post, what you wrote stays in the box.', modalPending: 'Confirm on the Steam page that opened. This window closes by itself when you are done.', notNow: 'Not now', close: 'Close', otherLangs: 'See {n} comments in other languages', otherLangsOne: 'See 1 comment in another language', onlyMine: 'Show only comments in your language', translate: 'Translate', original: 'See original', translating: 'Translating...', err_server: 'The comments server had a problem. Try again in a few minutes.', err_translate: 'Could not translate right now. Try again later.', public: 'Public', publicTip: 'Everything you write here can be seen by anyone who has this game in Taiga Launcher.', lead: 'Chat with others who have {game} in Taiga Launcher. What you write here is shown to all of them.', leadNoGame: 'Chat with others who have this game in Taiga Launcher. What you write here is shown to all of them.', last: 'last comment {when}', p1: 'Leave a tip for someone starting {game}...', p2: 'What did you think of {game}?', p3: 'What is your favorite memory of {game}?', p4: 'Got a question about {game}? Ask here...', publicNote: 'Public: everyone who has this game in Taiga Launcher can see it', asUser: 'commenting as {name}', needSteam: 'to post, you connect your Steam account', chipTip: 'Tip', chipOpinion: 'Opinion', chipQuestion: 'Question', chipMemory: 'Memory', emptyTitle: 'Start the conversation about {game}', emptyTitleNoGame: 'Start the conversation about this game', emptyText: 'Leave a comment and everyone who has this game will see it.', err_quota: 'The comments server reached today’s free limit. It works again by itself at midnight UTC.', publicLine: 'Your comment will be visible to everyone who has this game in Taiga Launcher.', emptyCta: 'Write the first comment', title: 'Comments', placeholder: 'Write a comment for other players of this game...', loginTitle: 'Join the conversation', loginText: 'To comment, connect your Steam account. Comments are public: everyone who has this game can see them and comment too.', gateTitle: 'Connect your Steam account to post', gateText: 'Comments are public: everyone who has this game in Taiga Launcher will see what you write. Your text stays in the box.', login: 'Sign in through Steam', loginPending: 'Confirm on the Steam page that opened. This section updates by itself.', logout: 'Sign out', signedAs: 'Signed in as', empty: 'No comments yet. Be the first!', recent: 'Recent', popular: 'Popular', showMore: 'Show {n} more comments', showMoreOne: 'Show 1 more comment', showLess: 'Show less', loadMore: 'Load more comments', delete: 'Delete', deleteConfirm: 'Delete for real?', report: 'Report', reportConfirm: 'Confirm report', reported: 'Report sent. Thank you!', like: 'Like', liked: 'Liked', ownLike: 'Likes on your comment', posting: 'Posting...', err_login: 'Connect your Steam account to comment.', err_low_level: 'Your Steam account must be level {n} or higher to comment.', err_private_profile: 'Make your Steam profile public to comment (Steam only shows the level of public profiles).', err_slow_down: 'Wait {n} s before commenting again.', err_daily_limit: 'You reached today’s comment limit.', err_no_links: 'Links are not allowed in comments.', err_too_long: 'Comment too long (500 characters max).', err_duplicate: 'You already posted this comment.', err_banned: 'This account cannot comment.', err_offline: 'Comments are unavailable right now. Try again later.' },
	es: { countOne: '1 comentario', countMany: '{n} comentarios', modalTitle: 'Conecta tu cuenta de Steam para comentar', modalText: 'Los comentarios son públicos: aparecen con tu nombre y tu foto de Steam para todos los que tienen este juego en Taiga Launcher. Conecta tu cuenta para publicar, lo que escribiste se queda en el cuadro.', modalPending: 'Confirma en la página de Steam que se abrió. Esta ventana se cierra sola cuando termines.', notNow: 'Ahora no', close: 'Cerrar', otherLangs: 'Ver {n} comentarios en otros idiomas', otherLangsOne: 'Ver 1 comentario en otro idioma', onlyMine: 'Mostrar solo los de tu idioma', translate: 'Traducir', original: 'Ver original', translating: 'Traduciendo...', err_server: 'El servidor de comentarios tuvo un problema. Inténtalo de nuevo en unos minutos.', err_translate: 'No se pudo traducir ahora. Inténtalo más tarde.', public: 'Públicos', publicTip: 'Todo lo que escribas aquí lo puede ver quien tenga este juego en Taiga Launcher.', lead: 'Conversa con quienes también tienen {game} en Taiga Launcher. Lo que escribas aquí aparece para todos ellos.', leadNoGame: 'Conversa con quienes también tienen este juego en Taiga Launcher. Lo que escribas aquí aparece para todos ellos.', last: 'último comentario {when}', p1: 'Deja un consejo para quien empieza {game}...', p2: '¿Qué te pareció {game}?', p3: '¿Cuál es tu recuerdo favorito de {game}?', p4: '¿Tienes alguna duda sobre {game}? Pregunta aquí...', publicNote: 'Público: todos los que tienen este juego en Taiga Launcher pueden verlo', asUser: 'comentando como {name}', needSteam: 'para publicar, conectas tu cuenta de Steam', chipTip: 'Consejo', chipOpinion: 'Opinión', chipQuestion: 'Pregunta', chipMemory: 'Recuerdo', emptyTitle: 'Empieza la conversación sobre {game}', emptyTitleNoGame: 'Empieza la conversación sobre este juego', emptyText: 'Deja un comentario y todos los que tienen este juego lo verán.', err_quota: 'El servidor de comentarios alcanzó el límite gratuito de hoy. Vuelve a funcionar solo a medianoche UTC.', publicLine: 'Tu comentario será visible para todos los que tienen este juego en Taiga Launcher.', emptyCta: 'Escribir el primer comentario', title: 'Comentarios', placeholder: 'Escribe un comentario para quienes también juegan este juego...', loginTitle: 'Únete a la conversación', loginText: 'Para comentar, conéctate con tu cuenta de Steam. Los comentarios son públicos: todos los que tengan este juego podrán verlos y comentar.', gateTitle: 'Conecta tu cuenta de Steam para publicar', gateText: 'Los comentarios son públicos: todos los que tengan este juego en Taiga Launcher verán lo que escribas. Tu texto se queda en el cuadro.', login: 'Iniciar sesión con Steam', loginPending: 'Confirma en la página de Steam que se abrió. Esta sección se actualiza sola.', logout: 'Cerrar sesión', signedAs: 'Conectado como', empty: 'Nadie ha comentado todavía. ¡Sé el primero!', recent: 'Recientes', popular: 'Populares', showMore: 'Ver {n} comentarios más', showMoreOne: 'Ver 1 comentario más', showLess: 'Mostrar menos', loadMore: 'Cargar más comentarios', delete: 'Eliminar', deleteConfirm: '¿Eliminar de verdad?', report: 'Denunciar', reportConfirm: 'Confirmar denuncia', reported: 'Denuncia enviada. ¡Gracias!', like: 'Me gusta', liked: 'Te gusta', ownLike: 'Me gusta en tu comentario', posting: 'Publicando...', err_login: 'Conecta tu cuenta de Steam para comentar.', err_low_level: 'Tu cuenta de Steam debe ser nivel {n} o superior para comentar.', err_private_profile: 'Haz público tu perfil de Steam para comentar (Steam solo muestra el nivel de perfiles públicos).', err_slow_down: 'Espera {n} s para comentar de nuevo.', err_daily_limit: 'Llegaste al límite de comentarios de hoy.', err_no_links: 'No se permiten enlaces en los comentarios.', err_too_long: 'Comentario demasiado largo (máximo 500 caracteres).', err_duplicate: 'Ya publicaste este comentario.', err_banned: 'Esta cuenta no puede comentar.', err_offline: 'Los comentarios no están disponibles ahora. Inténtalo más tarde.' },
	fr: { countOne: '1 commentaire', countMany: '{n} commentaires', modalTitle: 'Connectez votre compte Steam pour commenter', modalText: 'Les commentaires sont publics : ils affichent votre nom et votre photo Steam à tous ceux qui ont ce jeu dans Taiga Launcher. Connectez votre compte pour publier, ce que vous avez écrit reste dans la zone de saisie.', modalPending: 'Confirmez sur la page Steam qui s’est ouverte. Cette fenêtre se ferme toute seule à la fin.', notNow: 'Pas maintenant', close: 'Fermer', otherLangs: 'Voir {n} commentaires dans d’autres langues', otherLangsOne: 'Voir 1 commentaire dans une autre langue', onlyMine: 'Afficher seulement ceux de votre langue', translate: 'Traduire', original: 'Voir l’original', translating: 'Traduction...', err_server: 'Le serveur des commentaires a rencontré un problème. Réessayez dans quelques minutes.', err_translate: 'Impossible de traduire pour le moment. Réessayez plus tard.', public: 'Publics', publicTip: 'Tout ce que vous écrivez ici est visible par ceux qui ont ce jeu dans Taiga Launcher.', lead: 'Discutez avec ceux qui ont aussi {game} dans Taiga Launcher. Ce que vous écrivez ici s’affiche pour eux tous.', leadNoGame: 'Discutez avec ceux qui ont aussi ce jeu dans Taiga Launcher. Ce que vous écrivez ici s’affiche pour eux tous.', last: 'dernier commentaire {when}', p1: 'Laissez une astuce à qui commence {game}...', p2: 'Qu’avez-vous pensé de {game} ?', p3: 'Quel est votre meilleur souvenir de {game} ?', p4: 'Une question sur {game} ? Posez-la ici...', publicNote: 'Public : tous ceux qui ont ce jeu dans Taiga Launcher peuvent le voir', asUser: 'vous commentez en tant que {name}', needSteam: 'pour publier, vous connectez votre compte Steam', chipTip: 'Astuce', chipOpinion: 'Avis', chipQuestion: 'Question', chipMemory: 'Souvenir', emptyTitle: 'Lancez la discussion sur {game}', emptyTitleNoGame: 'Lancez la discussion sur ce jeu', emptyText: 'Laissez un commentaire et tous ceux qui ont ce jeu le verront.', err_quota: 'Le serveur des commentaires a atteint la limite gratuite du jour. Il refonctionne tout seul à minuit UTC.', publicLine: 'Votre commentaire sera visible par tous ceux qui ont ce jeu dans Taiga Launcher.', emptyCta: 'Écrire le premier commentaire', title: 'Commentaires', placeholder: 'Écrivez un commentaire pour les autres joueurs de ce jeu...', loginTitle: 'Rejoignez la conversation', loginText: 'Pour commenter, connectez-vous avec votre compte Steam. Les commentaires sont publics : tous ceux qui ont ce jeu peuvent les voir et commenter.', gateTitle: 'Connectez votre compte Steam pour publier', gateText: 'Les commentaires sont publics : tous ceux qui ont ce jeu dans Taiga Launcher verront ce que vous écrivez. Votre texte reste dans la zone de saisie.', login: 'Se connecter via Steam', loginPending: 'Confirmez sur la page Steam qui s’est ouverte. Cette section se met à jour toute seule.', logout: 'Se déconnecter', signedAs: 'Connecté en tant que', empty: 'Aucun commentaire pour l’instant. Soyez le premier !', recent: 'Récents', popular: 'Populaires', showMore: 'Afficher {n} commentaires de plus', showMoreOne: 'Afficher 1 commentaire de plus', showLess: 'Afficher moins', loadMore: 'Charger plus de commentaires', delete: 'Supprimer', deleteConfirm: 'Vraiment supprimer ?', report: 'Signaler', reportConfirm: 'Confirmer le signalement', reported: 'Signalement envoyé. Merci !', like: 'J’aime', liked: 'Aimé', ownLike: 'J’aime sur votre commentaire', posting: 'Publication...', err_login: 'Connectez votre compte Steam pour commenter.', err_low_level: 'Votre compte Steam doit être de niveau {n} ou plus pour commenter.', err_private_profile: 'Rendez votre profil Steam public pour commenter (Steam n’affiche le niveau que des profils publics).', err_slow_down: 'Attendez {n} s avant de commenter à nouveau.', err_daily_limit: 'Vous avez atteint la limite de commentaires du jour.', err_no_links: 'Les liens ne sont pas autorisés dans les commentaires.', err_too_long: 'Commentaire trop long (500 caractères max.).', err_duplicate: 'Vous avez déjà publié ce commentaire.', err_banned: 'Ce compte ne peut pas commenter.', err_offline: 'Commentaires indisponibles pour le moment. Réessayez plus tard.' },
	de: { countOne: '1 Kommentar', countMany: '{n} Kommentare', modalTitle: 'Verbinde dein Steam-Konto zum Kommentieren', modalText: 'Kommentare sind öffentlich: Sie zeigen deinen Steam-Namen und dein Bild allen, die dieses Spiel im Taiga Launcher haben. Verbinde dein Konto zum Posten, dein Text bleibt im Feld.', modalPending: 'Bestätige auf der geöffneten Steam-Seite. Dieses Fenster schließt sich danach von selbst.', notNow: 'Jetzt nicht', close: 'Schließen', otherLangs: '{n} Kommentare in anderen Sprachen ansehen', otherLangsOne: '1 Kommentar in einer anderen Sprache ansehen', onlyMine: 'Nur Kommentare in deiner Sprache zeigen', translate: 'Übersetzen', original: 'Original ansehen', translating: 'Wird übersetzt...', err_server: 'Der Kommentar-Server hatte ein Problem. Versuch es in ein paar Minuten erneut.', err_translate: 'Übersetzen ist gerade nicht möglich. Versuch es später erneut.', public: 'Öffentlich', publicTip: 'Alles, was du hier schreibst, sehen alle, die dieses Spiel im Taiga Launcher haben.', lead: 'Unterhalte dich mit anderen, die {game} im Taiga Launcher haben. Was du hier schreibst, sehen sie alle.', leadNoGame: 'Unterhalte dich mit anderen, die dieses Spiel im Taiga Launcher haben. Was du hier schreibst, sehen sie alle.', last: 'letzter Kommentar {when}', p1: 'Gib einen Tipp für alle, die mit {game} anfangen...', p2: 'Wie fandest du {game}?', p3: 'Was ist deine schönste Erinnerung an {game}?', p4: 'Eine Frage zu {game}? Stell sie hier...', publicNote: 'Öffentlich: alle, die dieses Spiel im Taiga Launcher haben, können es sehen', asUser: 'du kommentierst als {name}', needSteam: 'zum Posten verbindest du dein Steam-Konto', chipTip: 'Tipp', chipOpinion: 'Meinung', chipQuestion: 'Frage', chipMemory: 'Erinnerung', emptyTitle: 'Starte das Gespräch über {game}', emptyTitleNoGame: 'Starte das Gespräch über dieses Spiel', emptyText: 'Schreib einen Kommentar, und alle, die dieses Spiel haben, sehen ihn.', err_quota: 'Der Kommentar-Server hat das heutige Gratis-Limit erreicht. Um Mitternacht UTC geht es von selbst wieder.', publicLine: 'Dein Kommentar ist für alle sichtbar, die dieses Spiel im Taiga Launcher haben.', emptyCta: 'Den ersten Kommentar schreiben', title: 'Kommentare', placeholder: 'Schreib einen Kommentar für andere Spieler dieses Spiels...', loginTitle: 'Mach mit', loginText: 'Zum Kommentieren melde dich mit deinem Steam-Konto an. Kommentare sind öffentlich: Alle, die dieses Spiel haben, können sie sehen und mitkommentieren.', gateTitle: 'Verbinde dein Steam-Konto zum Posten', gateText: 'Kommentare sind öffentlich: Alle, die dieses Spiel im Taiga Launcher haben, sehen, was du schreibst. Dein Text bleibt im Feld.', login: 'Über Steam anmelden', loginPending: 'Bestätige auf der geöffneten Steam-Seite. Dieser Bereich aktualisiert sich von selbst.', logout: 'Abmelden', signedAs: 'Angemeldet als', empty: 'Noch keine Kommentare. Sei der Erste!', recent: 'Neueste', popular: 'Beliebt', showMore: '{n} weitere Kommentare anzeigen', showMoreOne: '1 weiteren Kommentar anzeigen', showLess: 'Weniger anzeigen', loadMore: 'Weitere Kommentare laden', delete: 'Löschen', deleteConfirm: 'Wirklich löschen?', report: 'Melden', reportConfirm: 'Meldung bestätigen', reported: 'Meldung gesendet. Danke!', like: 'Gefällt mir', liked: 'Gefällt dir', ownLike: 'Likes für deinen Kommentar', posting: 'Wird veröffentlicht...', err_login: 'Verbinde dein Steam-Konto, um zu kommentieren.', err_low_level: 'Dein Steam-Konto muss mindestens Level {n} sein, um zu kommentieren.', err_private_profile: 'Stelle dein Steam-Profil auf öffentlich, um zu kommentieren (Steam zeigt das Level nur bei öffentlichen Profilen).', err_slow_down: 'Warte {n} s, bevor du erneut kommentierst.', err_daily_limit: 'Du hast das heutige Kommentarlimit erreicht.', err_no_links: 'Links sind in Kommentaren nicht erlaubt.', err_too_long: 'Kommentar zu lang (max. 500 Zeichen).', err_duplicate: 'Diesen Kommentar hast du schon veröffentlicht.', err_banned: 'Dieses Konto kann nicht kommentieren.', err_offline: 'Kommentare sind gerade nicht verfügbar. Versuch es später erneut.' },
};
function lang(): { key: string; locale: string } {
	const l = displayLanguage();
	if (/^(brazilian|portuguese)/.test(l)) return { key: 'pt', locale: 'pt-BR' };
	if (/^(spanish|latam)/.test(l)) return { key: 'es', locale: 'es-ES' };
	if (/^french/.test(l)) return { key: 'fr', locale: 'fr-FR' };
	if (/^german/.test(l)) return { key: 'de', locale: 'de-DE' };
	return { key: 'en', locale: 'en-US' };
}
function t(key: string, values: Record<string, string | number> = {}): string {
	let s = (TEXT[lang().key] || TEXT.en)[key] || TEXT.en[key] || key;
	for (const [k, v] of Object.entries(values)) s = s.split('{' + k + '}').join(String(v));
	return s;
}
function errorText(code: string, extra: { minLevel?: number | null; wait?: number | null; detail?: string } = {}): string {
	const key = 'err_' + code;
	if (code === 'server' && extra.detail) return t('err_server') + ' (' + extra.detail + ')';
	if (!TEXT.en[key]) return t('err_offline') + (code && code !== 'offline' && /^[a-z_]{2,32}$/.test(code) ? ` (${code})` : '');
	return t(key, { n: code === 'slow_down' ? Number(extra.wait || 30) : Number(extra.minLevel || 5) });
}
function relTime(at: number): string {
	const { locale } = lang();
	// Relógio do PC atrasado em relação ao servidor: nunca mostra "em 40 segundos".
	const diff = Math.min(0, (at - Date.now()) / 1000), abs = Math.abs(diff);
	try {
		const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
		if (abs < 45) return rtf.format(0, 'second');
		if (abs < 60) return rtf.format(Math.round(diff), 'second');
		if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
		if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
		if (abs < 30 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
	} catch {}
	try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(at)); } catch { return new Date(at).toLocaleDateString(); }
}
const STEAMID_RE = /^7656\d{13}$/;
const AVATAR_RE = /^https:\/\/avatars\.(?:akamai\.|cloudflare\.|fastly\.)?steamstatic\.com\/[a-f0-9]{40}(?:_full|_medium)?\.jpg$/;
const DEFAULT_AVATAR = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
const profileUrl = (steamid: string): string => STEAMID_RE.test(steamid) ? 'steam://url/SteamIDPage/' + steamid : '';

async function parse<T>(raw: Promise<string>): Promise<T> { return JSON.parse(await raw) as T; }

const STYLE = `
.taiga-comments{margin:4px 0 26px;font-family:"Motiva Sans",Arial,Helvetica,sans-serif}
.taiga-comments[hidden],.taiga-comments [hidden],.taiga-cc-park{display:none!important}
.taiga-cc-head{display:flex;align-items:center;gap:12px;margin:0 0 12px;font-size:13.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8f98a0}
.taiga-cc-title{display:flex;align-items:center;gap:6px;white-space:nowrap}
.taiga-cc-count{font-weight:400;letter-spacing:.5px}
.taiga-cc-rule{flex:1;height:1px;background:rgba(255,255,255,.1)}
.taiga-cc-public{display:inline-flex;align-items:center;gap:5px;padding:2px 8px 2px 6px;border-radius:10px;background:rgba(103,193,245,.12);color:#67c1f5;font-size:11px;font-weight:700;letter-spacing:.6px;white-space:nowrap;cursor:help}
.taiga-cc-public svg{width:12px;height:12px}
.taiga-cc-lead{margin:-4px 0 14px;color:#8f98a0;font-size:13px;line-height:1.45}
.taiga-cc-last{color:#626d7b;white-space:nowrap}
.taiga-cc-write{margin:0 0 14px}
.taiga-cc-write .taiga-cc-compose{margin:0}
.taiga-cc-under{display:flex;flex-direction:column;gap:7px;margin:8px 0 0 46px}
.taiga-cc-chips{display:flex;flex-wrap:wrap;gap:6px}
.taiga-cc-chip{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#8f98a0;font:inherit;font-size:12px;padding:3px 10px;border-radius:12px;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
.taiga-cc-chip:hover,.taiga-cc-chip:focus-visible{color:#fff;border-color:rgba(103,193,245,.45);background:rgba(103,193,245,.1)}
.taiga-cc-note{display:flex;align-items:center;gap:8px;color:#8f98a0;font-size:12px}
.taiga-cc-note svg{flex:none;width:13px;height:13px;color:#67c1f5}
.taiga-cc-note-text{flex:1;min-width:0}
.taiga-cc-chars{flex:none;color:#626d7b;font-variant-numeric:tabular-nums}
.taiga-cc-chars.is-over{color:#ff8a8a}
.taiga-cc-chars{visibility:hidden}
.taiga-cc-write:focus-within .taiga-cc-chars,.taiga-cc-write.has-text .taiga-cc-chars{visibility:visible}
.taiga-cc-me-avatar.is-guest{opacity:.55}
.taiga-cc-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:26px 18px 24px;border:1px dashed rgba(255,255,255,.1);background:rgba(0,0,0,.12)}
.taiga-cc-empty-copy{display:contents}
.taiga-cc-empty-icon{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(103,193,245,.12);color:#67c1f5;margin-bottom:4px}
.taiga-cc-empty-icon svg{width:22px;height:22px}
.taiga-cc-empty-title{color:#e5e5e5;font-size:15px}
.taiga-cc-empty-text{color:#8f98a0;font-size:13px;max-width:420px;line-height:1.45}
.taiga-cc-empty-cta{margin-top:8px;border:0;border-radius:2px;padding:7px 16px;background:linear-gradient(to right,#47bfff 5%,#1a44c2 60%);background-size:330% 100%;background-position:25% 0;color:#fff;font:inherit;font-size:13px;cursor:pointer;transition:background-position .25s}
.taiga-cc-empty-cta:hover{background-position:0 0}
.taiga-cc-bar{display:flex;align-items:center;gap:10px;margin:0 0 8px;color:#8f98a0;font-size:12px}
.taiga-cc-bar .taiga-cc-count{color:#c6d4df}
.taiga-cc-bar .taiga-cc-sort{margin-left:auto}
.taiga-cc-langs{background:none;border:0;padding:2px 0;margin-top:4px;color:#67c1f5;font:inherit;font-size:12.5px;cursor:pointer}
.taiga-cc-langs:hover{color:#fff;text-decoration:underline}
.taiga-c-translate{background:none;border:0;padding:0;margin:6px 0 0;color:#67c1f5;font:inherit;font-size:12px;cursor:pointer}
.taiga-c-translate:hover{color:#fff;text-decoration:underline}
.taiga-c-translate:disabled{color:#626d7b;cursor:default;text-decoration:none}
.taiga-c-lang{margin-left:2px;padding:0 5px;border-radius:2px;background:rgba(255,255,255,.07);color:#8f98a0;font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.taiga-cc-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);font-family:"Motiva Sans",Arial,Helvetica,sans-serif;animation:taiga-c-in .15s ease-out}
.taiga-cc-dialog{position:relative;width:min(460px,calc(100vw - 32px));box-sizing:border-box;padding:24px 24px 20px;border-radius:4px;background:linear-gradient(180deg,#232c3a 0%,#1a212c 100%);box-shadow:0 14px 48px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06);color:#c6d4df}
.taiga-cc-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;border-radius:2px;background:none;color:#8f98a0;font-size:20px;line-height:1;cursor:pointer}
.taiga-cc-x:hover{color:#fff;background:rgba(255,255,255,.08)}
.taiga-cc-dialog-icon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(103,193,245,.14);color:#67c1f5;margin:0 0 14px}
.taiga-cc-dialog-icon svg{width:26px;height:26px}
.taiga-cc-dialog h3{margin:0 30px 8px 0;font-size:19px;font-weight:400;color:#fff}
.taiga-cc-dialog p{margin:0;font-size:13.5px;line-height:1.5;color:#acb2b8}
.taiga-cc-dialog-err{margin-top:12px;padding:8px 10px;border-radius:2px;background:rgba(255,138,138,.08);color:#ffb3b3;font-size:12.5px}
.taiga-cc-dialog-actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:20px}
.taiga-cc-ghost{border:0;border-radius:2px;padding:7px 14px;background:rgba(255,255,255,.08);color:#c6d4df;font:inherit;font-size:13px;cursor:pointer}
.taiga-cc-ghost:hover{background:rgba(255,255,255,.14);color:#fff}
.taiga-cc-sort{display:flex;gap:14px}
.taiga-cc-sort button{border:0;background:none;color:#8f98a0;font:inherit;font-size:12px;font-weight:400;letter-spacing:.3px;text-transform:none;padding:2px 0;border-bottom:1px solid transparent;cursor:pointer}
.taiga-cc-sort button:hover{color:#fff}
.taiga-cc-sort button.is-active{color:#fff;border-bottom-color:#67c1f5}
.taiga-cc-compose{display:flex;gap:12px;align-items:flex-start;margin:0 0 14px}
.taiga-cc-compose>img{flex:none;width:34px;height:34px;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.taiga-cc-compose .gdl-status-box-container{flex:1;min-width:0;margin:0!important}
.taiga-cc-gate{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid rgba(103,193,245,.22);background:rgba(103,193,245,.06);box-shadow:0 2px 5px rgba(0,0,0,.22);animation:taiga-c-in .18s ease-out}
.taiga-cc-gate-icon{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:#67c1f5}
.taiga-cc-gate-icon svg{width:26px;height:26px}
.taiga-cc-gate-copy{flex:1;min-width:0;line-height:1.4}
.taiga-cc-gate-title{color:#e5e5e5;font-size:14px;margin-bottom:2px}
.taiga-cc-gate-text{color:#9da4ab;font-size:13px}
.taiga-c-login{flex:none;display:flex;align-items:center;gap:8px;padding:7px 14px;border:0;border-radius:2px;background:linear-gradient(to right,#47bfff 5%,#1a44c2 60%);background-size:330% 100%;background-position:25% 0;color:#fff;font:inherit;font-size:13px;cursor:pointer;transition:background-position .25s;white-space:nowrap}
.taiga-c-login:hover{background-position:0 0}
.taiga-c-login svg{width:17px;height:17px}
.taiga-c-login:disabled{opacity:.6;cursor:default}
.taiga-comments-msg{margin:0 0 12px;padding:8px 12px;border-radius:2px;background:rgba(255,138,138,.08);color:#ffb3b3;font-size:13px}
.taiga-comments-msg.is-ok{background:rgba(164,208,7,.08);color:#c4e36b}
.taiga-comments-list{display:flex;flex-direction:column}
.taiga-comment{display:flex;gap:12px;margin:0 0 10px;padding:12px 14px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.045);box-shadow:0 2px 5px rgba(0,0,0,.22);transition:border-color .14s ease;animation:taiga-c-in .18s ease-out}
.taiga-comment:hover{border-color:rgba(255,255,255,.09)}
@keyframes taiga-c-in{from{opacity:0}to{opacity:1}}
.taiga-c-avatar{flex:none;width:40px;height:40px;display:block;border-radius:2px;overflow:hidden;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.taiga-c-avatar img{width:40px;height:40px;display:block;object-fit:cover}
.taiga-c-main{flex:1;min-width:0}
.taiga-c-top{display:flex;align-items:flex-start;gap:10px}
.taiga-c-author{flex:1;min-width:0;display:flex;align-items:baseline;gap:10px;line-height:1.3}
.taiga-c-name{font-size:14px;color:#d6d7d8;cursor:pointer;text-decoration:none;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.taiga-c-name:hover{color:#fff;text-decoration:underline}
.taiga-c-time{color:#8f98a0;font-size:12px;white-space:nowrap}
.taiga-c-tools{display:flex;align-items:center;gap:6px}
.taiga-c-text{margin:6px 0 0;font-size:14px;color:#c6d4df;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.taiga-c-like{display:inline-flex;align-items:center;gap:5px;border:0;background:none;color:#8f98a0;font:inherit;font-size:12px;padding:3px 6px;border-radius:2px;cursor:pointer;transition:background .15s,color .15s}
.taiga-c-like svg{width:13px;height:13px}
.taiga-c-like:hover:not(:disabled){background:rgba(255,255,255,.06);color:#fff}
.taiga-c-like.is-liked{color:#67c1f5}
.taiga-c-like:disabled{cursor:default}
.taiga-c-act{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:3px;color:#8f98a0;font:inherit;font-size:12px;cursor:pointer;opacity:0;border-radius:2px;transition:opacity .15s,color .15s,background .15s}
.taiga-c-act svg{width:16px;height:16px}
.taiga-comment:hover .taiga-c-act,.taiga-c-act:focus-visible,.taiga-c-act.is-confirm{opacity:1}
.taiga-c-act:hover{color:#fff;background:rgba(255,255,255,.06)}
.taiga-c-act.is-confirm{color:#ff8a8a;padding:3px 6px}
.taiga-comments-empty{color:#8f98a0;font-size:13px;padding:14px;border:1px solid rgba(255,255,255,.045);background:rgba(0,0,0,.12)}
.taiga-cc-foot{display:flex;align-items:center;gap:10px;padding:2px 0 0}
.taiga-cc-foot:empty{display:none}
.taiga-cc-expand{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:#67c1f5;font:inherit;font-size:13px;padding:2px 0;cursor:pointer}
.taiga-cc-expand:hover{color:#fff}
.taiga-cc-expand svg{width:12px;height:12px;transition:transform .2s}
.taiga-cc-expand.is-open svg{transform:rotate(180deg)}
.taiga-cc-me{margin-left:auto;display:flex;align-items:center;gap:6px;color:#626d7b;font-size:12px}
.taiga-cc-me img{width:16px;height:16px;border-radius:2px}
.taiga-c-link{background:none;border:0;padding:0;color:#67c1f5;cursor:pointer;font:inherit}
.taiga-c-link:hover{color:#fff;text-decoration:underline}
`;
const STEAM_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.98 0C5.67 0 .5 4.86 0 11.04l6.44 2.66a3.4 3.4 0 0 1 1.92-.59h.19l2.86-4.15v-.06a4.52 4.52 0 1 1 4.52 4.52h-.1l-4.08 2.91v.16a3.39 3.39 0 0 1-6.73.6L.4 15.11A12 12 0 1 0 11.98 0Zm-4.45 18.2-1.47-.61a2.55 2.55 0 1 0 1.32-3.5l1.52.63a1.88 1.88 0 1 1-1.37 3.48Zm11.4-9.26a3.01 3.01 0 1 0-3.01 3.01 3.01 3.01 0 0 0 3.01-3.01Zm-5.27-.01a2.26 2.26 0 1 1 2.26 2.26 2.26 2.26 0 0 1-2.26-2.26Z"/></svg>';
const LIKE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 21h4V9H2v12Zm20-11a2 2 0 0 0-2-2h-6.3l.95-4.57.03-.32a1.5 1.5 0 0 0-.44-1.06L13.17 1 6.59 7.59A1.98 1.98 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z"/></svg>';
const CHEVRON = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
const FLAG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h2v18H5V3Zm3 1h10l-2 4 2 4H8V4Z"/></svg>';
const GLOBE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5Z"/></svg>';
const CHAT_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3.5V14H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm16 5h1a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-1v3l-3.5-3H11a2 2 0 0 1-2-2v-.5h7a4 4 0 0 0 4-4V8Z"/></svg>';
const PROMPTS = ['p1', 'p2', 'p3', 'p4'];
const MAX_CHARS = 500;
const COLLAPSED = 2;

interface Mounted { doc: Document; wrapper: HTMLElement; shortcutAppId: string; root: HTMLElement; state: CommentsState; items: CommentItem[]; sort: 'recent' | 'popular'; expanded: boolean; timer: number; loginTimer: number; busy: boolean; composer: HTMLElement | null; gate: boolean; prompt: string; all: boolean; translated: Map<string, string>; showTranslated: Set<string> }
const mounted = new WeakMap<Document, Mounted>();
const lastState = new Map<string, { state: CommentsState; items: CommentItem[]; sort: 'recent' | 'popular' }>();

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const e = doc.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e;
}
function ensureStyle(doc: Document): void {
	let style = doc.getElementById('taiga-comments-style');
	if (!style) { style = doc.createElement('style'); style.id = 'taiga-comments-style'; doc.head?.appendChild(style); }
	if (style.textContent !== STYLE) style.textContent = STYLE;
}
function openProfile(doc: Document, steamid: string): void { const url = profileUrl(steamid); if (url) openSteamNavigationUrl(doc, url); }
function avatarImg(doc: Document, src: string): HTMLImageElement {
	const img = el(doc, 'img'); img.src = AVATAR_RE.test(src) ? src : DEFAULT_AVATAR; img.alt = ''; img.loading = 'lazy';
	img.addEventListener('error', () => { if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR; }, { once: true });
	return img;
}
function showMessage(m: Mounted, text: string, ok = false): void {
	const box = m.root.querySelector<HTMLElement>('.taiga-comments-msg'); if (!box) return;
	box.textContent = text; box.hidden = !text; box.classList.toggle('is-ok', ok);
}
function count(n: number): string { try { return new Intl.NumberFormat(lang().locale, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n); } catch { return String(n); } }

// Caixa de comentário da página (a mesma do "Diga algo") passa para dentro do cartão dos comentários.
function adoptComposer(m: Mounted): void {
	const slot = m.root.querySelector<HTMLElement>('.taiga-cc-compose'); if (!slot) return;
	const composer = (m.composer && m.composer.isConnected ? m.composer : (m.wrapper.querySelector('.gdl-status-box-container') || m.doc.querySelector('.gdl-status-box-container'))) as HTMLElement | null;
	if (!composer) return;
	// A caixa fica livre mesmo sem conta conectada: o pedido para entrar só aparece ao tentar publicar.
	if (composer.parentElement !== slot) slot.appendChild(composer);
	m.composer = composer;
	const area = composer.querySelector<HTMLTextAreaElement>('#gdl-status-text');
	if (area) {
		area.placeholder = m.state.game ? t(m.prompt, { game: m.state.game }) : t('placeholder');
		// Contador de caracteres e "tem texto" (deixa o aviso de público à vista enquanto há rascunho).
		if (!area.dataset.taigaCounter) {
			area.dataset.taigaCounter = '1';
			area.addEventListener('input', () => { const mm = mounted.get(m.doc); if (mm && mm.root.contains(area)) updateCounter(mm, area); });
		}
		updateCounter(m, area);
	}
}
function updateCounter(m: Mounted, area: HTMLTextAreaElement): void {
	const n = area.value.length;
	const chars = m.root.querySelector<HTMLElement>('.taiga-cc-chars');
	if (chars) { chars.textContent = n + '/' + MAX_CHARS; chars.classList.toggle('is-over', n > MAX_CHARS); }
	m.root.querySelector('.taiga-cc-write')?.classList.toggle('has-text', area.value.trim().length > 0);
}
function composerArea(m: Mounted): HTMLTextAreaElement | null {
	return (m.composer?.querySelector('#gdl-status-text') || m.root.querySelector('#gdl-status-text')) as HTMLTextAreaElement | null;
}
function focusComposer(m: Mounted): void {
	const area = composerArea(m); if (!area) return;
	area.focus(); try { const end = area.value.length; area.setSelectionRange(end, end); } catch {}
	area.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}
function releaseComposer(m: Mounted): void {
	const c = m.composer; if (!c || !m.root.contains(c)) return;
	m.root.parentElement?.insertBefore(c, m.root);
	const area = c.querySelector<HTMLTextAreaElement>('#gdl-status-text'); if (area) area.placeholder = area.dataset.taigaOriginalPlaceholder || area.placeholder;
}

function commentNode(m: Mounted, c: CommentItem): HTMLElement {
	const { doc } = m;
	const mine = !!m.state.me && m.state.me.steamid === c.steamid;
	const row = el(doc, 'div', 'taiga-comment' + (mine ? ' is-mine' : '')); row.dataset.id = c.id;
	const avatarLink = el(doc, 'a', 'taiga-c-avatar'); avatarLink.title = c.name; avatarLink.appendChild(avatarImg(doc, c.avatar));
	avatarLink.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openProfile(doc, c.steamid); });
	const main = el(doc, 'div', 'taiga-c-main');
	const meta = el(doc, 'div', 'taiga-c-meta');
	const name = el(doc, 'a', 'taiga-c-name', c.name); name.title = c.name;
	name.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openProfile(doc, c.steamid); });
	const time = el(doc, 'span', 'taiga-c-time', relTime(c.at)); try { time.title = new Date(c.at).toLocaleString(lang().locale); } catch {}
	meta.className = 'taiga-c-top';
	const author = el(doc, 'div', 'taiga-c-author'); author.append(name, time);
	meta.appendChild(author);
	const foreign = !!c.lang && !!m.state.lang && c.lang !== m.state.lang;
	const shown = foreign && m.showTranslated.has(c.id) ? m.translated.get(c.id) : undefined;
	const text = el(doc, 'div', 'taiga-c-text', shown ?? c.body);
	if (foreign) author.appendChild(el(doc, 'span', 'taiga-c-lang', c.lang || ''));
	const bar = el(doc, 'div', 'taiga-c-tools');
	const likes = Math.max(0, Number(c.likes) || 0);
	const like = el(doc, 'button', 'taiga-c-like' + (c.liked ? ' is-liked' : '')); like.type = 'button';
	like.innerHTML = LIKE_ICON; like.appendChild(el(doc, 'span', '', likes > 0 ? count(likes) : (mine ? '0' : t('like'))));
	like.title = mine ? t('ownLike') : c.liked ? t('liked') : t('like');
	like.setAttribute('aria-pressed', c.liked ? 'true' : 'false');
	if (mine) like.disabled = true;
	else like.addEventListener('click', e => {
		e.preventDefault(); e.stopPropagation();
		if (!m.state.loggedIn) { openLoginModal(m); return; }
		const on = !c.liked; like.disabled = true;
		// Mostra na hora; se o servidor recusar, volta como estava.
		c.liked = on; c.likes = Math.max(0, likes + (on ? 1 : -1)); renderList(m);
		void parse<{ ok?: boolean; likes?: number; liked?: boolean; error?: string }>(likeCall({ id: c.id, like: on })).then(r => {
			if (r.ok === false) { c.liked = !on; c.likes = likes; showMessage(m, errorText(r.error || 'offline')); }
			else { c.likes = Number(r.likes) || 0; c.liked = !!r.liked; }
			renderList(m);
		}).catch(() => { c.liked = !on; c.likes = likes; renderList(m); });
	});
	bar.appendChild(like);
	if (m.state.loggedIn) {
		const button = el(doc, 'button', 'taiga-c-act'); button.type = 'button';
		const idle = (): void => { button.innerHTML = mine ? TRASH_ICON : FLAG_ICON; button.title = mine ? t('delete') : t('report'); button.classList.remove('is-confirm'); };
		idle();
		let armed = false;
		button.addEventListener('click', e => {
			e.preventDefault(); e.stopPropagation();
			if (!armed) { armed = true; button.textContent = mine ? t('deleteConfirm') : t('reportConfirm'); button.classList.add('is-confirm'); setTimeout(() => { if (armed && button.isConnected) { armed = false; idle(); } }, 4000); return; }
			armed = false; button.disabled = true;
			void parse<{ ok?: boolean; error?: string; hidden?: boolean }>((mine ? deleteCall : reportCall)({ id: c.id })).then(r => {
				if (r.ok === false) { showMessage(m, errorText(r.error || 'offline')); button.disabled = false; return; }
				if (mine || r.hidden) { m.items = m.items.filter(x => x.id !== c.id); if (typeof m.state.total === 'number') m.state.total = Math.max(0, m.state.total - 1); renderList(m); }
				if (!mine) { showMessage(m, t('reported'), true); idle(); button.disabled = false; }
			}).catch(() => { showMessage(m, errorText('offline')); button.disabled = false; });
		});
		bar.appendChild(button);
	}
	meta.appendChild(bar);
	main.append(meta, text);
	// Comentário em outro idioma: traduz para o idioma do programa (e volta ao original).
	if (foreign) {
		const tr = el(doc, 'button', 'taiga-c-translate', shown !== undefined ? t('original') : t('translate')); tr.type = 'button';
		tr.addEventListener('click', e => {
			e.preventDefault(); e.stopPropagation();
			if (m.showTranslated.has(c.id)) { m.showTranslated.delete(c.id); renderList(m); return; }
			if (m.translated.has(c.id)) { m.showTranslated.add(c.id); renderList(m); return; }
			tr.disabled = true; tr.textContent = t('translating');
			void parse<{ ok?: boolean; text?: string; error?: string }>(translateCall({ id: c.id })).then(r => {
				if (!r.ok || !r.text) { tr.disabled = false; tr.textContent = t('translate'); showMessage(m, t('err_translate')); return; }
				m.translated.set(c.id, r.text); m.showTranslated.add(c.id); renderList(m);
			}).catch(() => { tr.disabled = false; tr.textContent = t('translate'); showMessage(m, t('err_translate')); });
		});
		main.appendChild(tr);
	}
	row.append(avatarLink, main);
	return row;
}

function renderList(m: Mounted): void {
	const { doc, root, state } = m;
	root.classList.toggle('is-logged-out', !state.loggedIn);
	adoptComposer(m);
	const total = typeof state.total === 'number' ? state.total : m.items.length;
	const countEl = root.querySelector<HTMLElement>('.taiga-cc-count');
	if (countEl) countEl.textContent = total === 1 ? t('countOne') : t('countMany', { n: count(total) });
	const bar = root.querySelector<HTMLElement>('.taiga-cc-bar'); if (bar) bar.hidden = !(total > 0 && m.items.length > 0);
	const lastEl = root.querySelector<HTMLElement>('.taiga-cc-last');
	if (lastEl) { const latest = m.items.reduce((max, c) => Math.max(max, Number(c.at) || 0), 0); lastEl.textContent = latest > 0 ? '· ' + t('last', { when: relTime(latest) }) : ''; }
	for (const b of Array.from(root.querySelectorAll<HTMLElement>('.taiga-cc-sort button'))) b.classList.toggle('is-active', b.dataset.sort === m.sort);
	const sortBox = root.querySelector<HTMLElement>('.taiga-cc-sort'); if (sortBox) sortBox.hidden = total < 2;
	// Topo: sua foto ao lado da caixa (conectado). Sem conta, a caixa fica livre e o aviso só aparece ao tentar publicar.
	const compose = root.querySelector<HTMLElement>('.taiga-cc-compose');
	if (compose) {
		compose.querySelector('.taiga-cc-me-avatar')?.remove();
		const img = avatarImg(doc, state.loggedIn && state.me ? state.me.avatar : DEFAULT_AVATAR);
		img.className = 'taiga-cc-me-avatar' + (state.loggedIn && state.me ? '' : ' is-guest');
		compose.insertBefore(img, compose.firstChild);
	}
	const note = root.querySelector<HTMLElement>('.taiga-cc-note-text');
	if (note) note.textContent = t('publicLine') + (state.loggedIn && state.me ? ' · ' + t('asUser', { name: state.me.name }) : '');
	syncLoginModal(m);
	const list = root.querySelector<HTMLElement>('.taiga-comments-list'); if (!list) return;
	list.textContent = '';
	if (state.error === 'offline' && !m.items.length) list.appendChild(el(doc, 'div', 'taiga-comments-empty', errorText('offline')));
	else if (!m.items.length) {
		const box = el(doc, 'div', 'taiga-cc-empty');
		const icon = el(doc, 'div', 'taiga-cc-empty-icon'); icon.innerHTML = CHAT_ICON;
		const cta = el(doc, 'button', 'taiga-cc-empty-cta', t('emptyCta')); cta.type = 'button';
		cta.addEventListener('click', e => { e.preventDefault(); focusComposer(m); });
		const copy = el(doc, 'div', 'taiga-cc-empty-copy'); // Em destaque o convite ("Faça um comentário..."); embaixo, menor, o nome do jogo.
		copy.append(el(doc, 'div', 'taiga-cc-empty-title', t('emptyText')), el(doc, 'div', 'taiga-cc-empty-text', state.game ? t('emptyTitle', { game: state.game }) : t('emptyTitleNoGame')));
		box.append(icon, copy, cta);
		list.appendChild(box);
	}
	const visible = m.expanded ? m.items : m.items.slice(0, COLLAPSED);
	for (const c of visible) list.appendChild(commentNode(m, c));
	// Rodapé: expandir/recolher (seta), carregar mais e quem está conectado.
	const expand = root.querySelector<HTMLButtonElement>('.taiga-cc-expand');
	if (expand) {
		const hiddenCount = Math.max(0, total - COLLAPSED);
		const canMore = m.expanded && !!state.more;
		expand.hidden = !(hiddenCount > 0 || canMore);
		expand.classList.toggle('is-open', m.expanded && !canMore);
		const label = expand.querySelector('span');
		if (label) label.textContent = canMore ? t('loadMore') : m.expanded ? t('showLess') : hiddenCount === 1 ? t('showMoreOne') : t('showMore', { n: count(hiddenCount) });
		expand.dataset.mode = canMore ? 'more' : m.expanded ? 'less' : 'expand';
	}
	const less = root.querySelector<HTMLButtonElement>('.taiga-cc-less'); if (less) less.hidden = !(m.expanded && state.more);
	// Outros idiomas: por padrão só aparecem os comentários no idioma do programa.
	const langs = root.querySelector<HTMLButtonElement>('.taiga-cc-langs');
	if (langs) {
		const others = Number(state.others) || 0;
		langs.hidden = !(m.all || others > 0);
		langs.textContent = m.all ? t('onlyMine') : others === 1 ? t('otherLangsOne') : t('otherLangs', { n: count(others) });
	}
	const me = root.querySelector<HTMLElement>('.taiga-cc-me');
	if (me) {
		me.textContent = '';
		if (state.loggedIn && state.me) {
			const out = el(doc, 'button', 'taiga-c-link', t('logout')); out.type = 'button';
			out.addEventListener('click', e => { e.preventDefault(); void parse(logoutCall()).finally(() => refresh(m, true)); });
			me.append(el(doc, 'span', '', t('signedAs')), avatarImg(doc, state.me.avatar), el(doc, 'span', '', state.me.name), el(doc, 'span', '', '·'), out);
		}
	}
}

async function refresh(m: Mounted, resetItems = true): Promise<void> {
	if (m.busy) return; m.busy = true;
	try {
		const next = await parse<CommentsState>(stateCall({ shortcut_app_id: m.shortcutAppId, sort: m.sort, all: m.all }));
		if (m.all && next.others === undefined) next.others = m.state.others;
		if (!m.root.isConnected) return;
		if (!next.enabled) { releaseComposer(m); m.root.remove(); return; }
		m.state = next;
		if (resetItems || !m.items.length) m.items = Array.isArray(next.items) ? next.items : [];
		lastState.set(m.shortcutAppId, { state: next, items: m.items, sort: m.sort });
		m.root.hidden = false; adoptComposer(m); renderList(m);
	} catch (e) { backendLog('Taiga comentários: ' + String(e)); }
	finally { m.busy = false; }
}

function startLogin(m: Mounted): void {
	void parse<{ ok?: boolean; url?: string; error?: string; detail?: string }>(loginCall()).then(r => {
		if (!r.ok || !r.url || !/^https:\/\//.test(r.url)) { loginError(m, errorText(r.error || 'offline', r)); return; }
		openSteamNavigationUrl(m.doc, r.url);
		// A janela fecha ao abrir o login (não fica por cima da Steam); o andamento aparece na própria seção.
		m.state.pending = true; closeLoginModal(m); renderList(m); showMessage(m, t('loginPending'), true);
		const view = m.doc.defaultView; if (!view) return;
		if (m.loginTimer) view.clearInterval(m.loginTimer);
		const started = Date.now();
		m.loginTimer = view.setInterval(() => {
			if (!m.root.isConnected || Date.now() - started > 10 * 60000) { view.clearInterval(m.loginTimer); m.loginTimer = 0; return; }
			void parse<{ loggedIn?: boolean; pending?: boolean }>(loginStateCall()).then(s => {
				if (s.loggedIn) { view.clearInterval(m.loginTimer); m.loginTimer = 0; showMessage(m, ''); void refresh(m).then(() => focusComposer(m)); }
				else if (!s.pending) { view.clearInterval(m.loginTimer); m.loginTimer = 0; m.state.pending = false; showMessage(m, ''); renderList(m); }
			}).catch(() => {});
		}, 2000);
	}).catch(() => loginError(m, errorText('offline')));
}
// Janela "conecte sua Steam": aparece ao publicar (ou curtir) sem conta; fecha no X, em "Agora não", no Esc ou
// clicando fora, e sozinha quando o login termina.
const modals = new WeakMap<Document, HTMLElement>();
function closeLoginModal(m: Mounted, focus = false): void {
	const box = modals.get(m.doc); if (box) { box.remove(); modals.delete(m.doc); }
	m.gate = false;
	if (focus) focusComposer(m);
}
function loginError(m: Mounted, text: string): void {
	const box = modals.get(m.doc);
	const err = box?.querySelector<HTMLElement>('.taiga-cc-dialog-err');
	if (err) { err.textContent = text; err.hidden = !text; } else if (text) showMessage(m, text);
}
function syncLoginModal(m: Mounted): void {
	const box = modals.get(m.doc); if (!box) return;
	if (m.state.loggedIn) { closeLoginModal(m, true); return; }
	const p = box.querySelector<HTMLElement>('.taiga-cc-dialog-text'); if (p) p.textContent = m.state.pending ? t('modalPending') : t('modalText');
	const b = box.querySelector<HTMLButtonElement>('.taiga-c-login'); if (b) b.disabled = !!m.state.pending;
}
function openLoginModal(m: Mounted): void {
	const { doc } = m;
	m.gate = true;
	if (modals.get(doc)?.isConnected) { syncLoginModal(m); return; }
	const overlay = el(doc, 'div', 'taiga-cc-modal'); overlay.setAttribute('role', 'presentation');
	const dialog = el(doc, 'div', 'taiga-cc-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
	const x = el(doc, 'button', 'taiga-cc-x', '×'); x.type = 'button'; x.title = t('close'); x.setAttribute('aria-label', t('close'));
	const icon = el(doc, 'div', 'taiga-cc-dialog-icon'); icon.innerHTML = STEAM_ICON;
	const title = el(doc, 'h3', '', t('modalTitle')); const id = 'taiga-cc-dialog-title'; title.id = id; dialog.setAttribute('aria-labelledby', id);
	const text = el(doc, 'p', 'taiga-cc-dialog-text', m.state.pending ? t('modalPending') : t('modalText'));
	const err = el(doc, 'div', 'taiga-cc-dialog-err'); err.hidden = true;
	const actions = el(doc, 'div', 'taiga-cc-dialog-actions');
	const later = el(doc, 'button', 'taiga-cc-ghost', t('notNow')); later.type = 'button';
	const login = el(doc, 'button', 'taiga-c-login'); login.type = 'button'; login.innerHTML = STEAM_ICON; login.appendChild(el(doc, 'span', '', t('login'))); login.disabled = !!m.state.pending;
	actions.append(later, login);
	dialog.append(x, icon, title, text, err, actions);
	overlay.appendChild(dialog);
	const close = (e?: Event): void => { e?.preventDefault(); doc.removeEventListener('keydown', onKey, true); closeLoginModal(m, true); };
	const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && modals.get(doc) === overlay) { e.stopPropagation(); close(e); } };
	x.addEventListener('click', close); later.addEventListener('click', close);
	overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(e); });
	login.addEventListener('click', e => { e.preventDefault(); startLogin(m); });
	doc.addEventListener('keydown', onKey, true);
	(doc.body || doc.documentElement).appendChild(overlay);
	modals.set(doc, overlay);
	login.focus();
}

/** Monta o cartão de comentários (só nos jogos do Taiga sem página na Steam; o Taiga Launcher decide). */
// Taiga Launcher: comentários online desligados por enquanto (o login com a Steam falhava). A caixa de texto volta a
// ser a normal, sem servidor; para religar, troque para true.
export const ONLINE_COMMENTS = false;

export function mountOnlineComments(doc: Document, wrapper: HTMLElement, shortcutAppId: string | null | undefined): void {
	const old = mounted.get(doc);
	if (old) {
		const view = doc.defaultView; if (view) { if (old.timer) view.clearInterval(old.timer); if (old.loginTimer) view.clearInterval(old.loginTimer); }
		closeLoginModal(old); releaseComposer(old); old.root.remove(); mounted.delete(doc);
	}
	const area = (wrapper.querySelector('#gdl-status-text') || doc.getElementById('gdl-status-text')) as HTMLTextAreaElement | null;
	if (area && !area.dataset.taigaOriginalPlaceholder) area.dataset.taigaOriginalPlaceholder = area.placeholder;
	if (!ONLINE_COMMENTS) return;
	if (!shortcutAppId || !/^\d+$/.test(String(shortcutAppId))) return;
	const feed = wrapper.querySelector('#gdl-activity-feed'); if (!feed) return;
	ensureStyle(doc);
	const root = el(doc, 'div', 'taiga-comments is-logged-out'); root.id = 'taiga-comments'; root.hidden = true;
	// Sem título próprio: a seção já fica sob "Atividade". Contagem e ordem só aparecem quando há comentários.
	const bar = el(doc, 'div', 'taiga-cc-bar'); bar.hidden = true;
	const sort = el(doc, 'div', 'taiga-cc-sort'); sort.setAttribute('role', 'tablist');
	for (const key of ['recent', 'popular'] as const) { const b = el(doc, 'button', '', t(key)); b.type = 'button'; b.dataset.sort = key; b.setAttribute('role', 'tab'); sort.appendChild(b); }
	bar.append(el(doc, 'span', 'taiga-cc-count'), el(doc, 'span', 'taiga-cc-last'), sort);
	const compose = el(doc, 'div', 'taiga-cc-compose');
	const write = el(doc, 'div', 'taiga-cc-write');
	write.append(compose);
	const msg = el(doc, 'div', 'taiga-comments-msg'); msg.hidden = true; msg.setAttribute('role', 'status');
	const list = el(doc, 'div', 'taiga-comments-list');
	const foot = el(doc, 'div', 'taiga-cc-foot');
	const expand = el(doc, 'button', 'taiga-cc-expand'); expand.type = 'button'; expand.hidden = true; expand.innerHTML = CHEVRON; expand.insertBefore(el(doc, 'span'), expand.firstChild);
	const less = el(doc, 'button', 'taiga-cc-expand taiga-cc-less is-open'); less.type = 'button'; less.hidden = true; less.innerHTML = CHEVRON; less.insertBefore(el(doc, 'span', '', t('showLess')), less.firstChild);
	const langs = el(doc, 'button', 'taiga-cc-langs'); langs.type = 'button'; langs.hidden = true;
	foot.append(expand, less, langs, el(doc, 'div', 'taiga-cc-me'));
	const park = el(doc, 'div', 'taiga-cc-park');
	root.append(write, msg, bar, list, foot, park);
	wrapper.insertBefore(root, feed);
	const cached = lastState.get(String(shortcutAppId));
	const m: Mounted = { doc, wrapper, shortcutAppId: String(shortcutAppId), root, state: cached?.state || { enabled: false }, items: cached?.items || [], sort: cached?.sort || 'recent', expanded: false, timer: 0, loginTimer: 0, busy: false, composer: null, gate: false, prompt: PROMPTS[Math.floor(Math.random() * PROMPTS.length)], all: false, translated: new Map(), showTranslated: new Set() };
	mounted.set(doc, m);
	sort.addEventListener('click', e => {
		const b = (e.target as Element | null)?.closest<HTMLElement>('button[data-sort]'); if (!b) return;
		e.preventDefault(); const next = b.dataset.sort === 'popular' ? 'popular' : 'recent'; if (next === m.sort) return;
		m.sort = next; renderList(m); void refresh(m, true);
	});
	const loadMore = (): void => {
		expand.disabled = true;
		void parse<CommentsState>(stateCall({ shortcut_app_id: m.shortcutAppId, sort: m.sort, offset: m.items.length, all: m.all })).then(r => {
			const seen = new Set(m.items.map(x => x.id));
			m.items = [...m.items, ...(r.items || []).filter(x => !seen.has(x.id))]; m.state.more = !!r.more; renderList(m);
		}).catch(() => {}).finally(() => { expand.disabled = false; });
	};
	expand.addEventListener('click', e => {
		e.preventDefault();
		const mode = expand.dataset.mode;
		if (mode === 'more') { loadMore(); return; }
		m.expanded = mode === 'expand'; renderList(m);
		if (!m.expanded) root.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
	});
	langs.addEventListener('click', e => { e.preventDefault(); m.all = !m.all; m.expanded = false; void refresh(m, true); });
	less.addEventListener('click', e => { e.preventDefault(); m.expanded = false; renderList(m); root.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); });
	if (cached?.state.enabled) { root.hidden = false; adoptComposer(m); renderList(m); }
	void refresh(m);
	const view = doc.defaultView;
	if (view) m.timer = view.setInterval(() => {
		if (!root.isConnected) { view.clearInterval(m.timer); if (m.loginTimer) view.clearInterval(m.loginTimer); if (mounted.get(doc) === m) mounted.delete(doc); return; }
		if (doc.hidden) return;
		void refresh(m, m.items.length <= 20);
	}, 60000);
}

/** Caixa de comentário: nos jogos com comentários online, publica o comentário (true = tratado aqui). */
export function submitOnlineComment(doc: Document, shortcutAppId: string | null | undefined, text: string, done: (ok: boolean) => void): boolean {
	const m = mounted.get(doc);
	if (!ONLINE_COMMENTS || !m || !m.root.isConnected || m.shortcutAppId !== String(shortcutAppId || '') || !m.state.enabled) return false;
	if (!m.state.loggedIn) { showMessage(m, ''); openLoginModal(m); done(false); return true; }
	showMessage(m, t('posting'), true);
	void parse<{ ok?: boolean; item?: CommentItem; error?: string; minLevel?: number; wait?: number; detail?: string }>(postCall({ shortcut_app_id: m.shortcutAppId, text })).then(r => {
		if (!r.ok || !r.item) { showMessage(m, errorText(r.error || 'offline', r)); done(false); return; }
		showMessage(m, '');
		if (m.sort !== 'recent') { m.sort = 'recent'; }
		m.items = [r.item, ...m.items.filter(x => x.id !== r.item!.id)];
		m.state.total = (typeof m.state.total === 'number' ? m.state.total : 0) + 1;
		renderList(m); done(true);
	}).catch(() => { showMessage(m, errorText('offline')); done(false); });
	return true;
}
