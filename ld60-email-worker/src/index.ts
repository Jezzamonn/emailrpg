import { EmailMessage } from 'cloudflare:email';
import { DurableObject } from 'cloudflare:workers';
import { createMimeMessage } from 'mimetext';
import PostalMime from 'postal-mime';
import { createGame, type GameState, type PlayerState } from '../../game/game.ts';
import type { LevelState } from '../../game/level.ts';
import { handleIncomingEmail } from '../../game/email/email.ts';
import { htmlToPlainText } from '../../game/email/template.ts';

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export class GameDurableObject extends DurableObject<Env> {
	async getGame(): Promise<GameState> {
		const hubLevel = await this.ctx.storage.get<LevelState>('hubLevel');
		if (!hubLevel) {
			return createGame();
		}
		const playerEntries = await this.ctx.storage.list<PlayerState>({ prefix: 'player:' });
		const players: Record<string, PlayerState> = {};
		for (const [key, player] of playerEntries) {
			players[key.slice('player:'.length)] = player;
		}
		return { hubLevel, players };
	}

	async saveGame(game: GameState): Promise<void> {
		await this.ctx.storage.put('hubLevel', game.hubLevel);
		const playerEntries = Object.entries(game.players);
		for (let i = 0; i < playerEntries.length; i += 128) {
			const batch: Record<string, PlayerState> = {};
			for (const [email, player] of playerEntries.slice(i, i + 128)) {
				batch[`player:${email}`] = player;
			}
			await this.ctx.storage.put(batch);
		}
	}
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const subject = message.headers.get('subject') || '';
		const messageId = message.headers.get('Message-ID');
		const parsedEmail = await PostalMime.parse(message.raw);
		const body =
			parsedEmail.text ?? (parsedEmail.html ? htmlToPlainText(parsedEmail.html) : '');

		const stub = env.GAME_DO.get(env.GAME_DO.idFromName('global'));
		const game = await stub.getGame();

		const result = handleIncomingEmail(game, {
			from: message.from,
			subject,
			body,
		});
		const emailContent = result.response;

		const reply = createMimeMessage();
		if (messageId) {
			reply.setHeader('In-Reply-To', messageId);
		}
		reply.setSender(message.to);
		reply.setRecipient(message.from);
		reply.setSubject(emailContent.subject);

		const attachmentNames = Object.keys(emailContent.images);
		attachmentNames.sort();

		for (const name of attachmentNames) {
			reply.addAttachment({
				filename: `${name}.gif`,
				contentType: 'image/gif',
				data: bytesToBase64(emailContent.images[name]),
				inline: true,
				headers: { 'Content-ID': `<${name}>` },
			});
		}

		reply.addMessage({
			contentType: 'text/plain',
			data: emailContent.text,
		});
		reply.addMessage({
			contentType: 'text/html',
			data: emailContent.html,
		});

		await message.reply(new EmailMessage(message.to, message.from, reply.asRaw()));
		await stub.saveGame(result.game);
	},
};

