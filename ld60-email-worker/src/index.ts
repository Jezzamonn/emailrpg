import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';
import { Game } from '../../game/game.ts';
import { handleIncomingEmail } from '../../game/email/email.ts';

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// In-memory hub world for dev; will be persisted with Cloudflare Durable Objects
const game = new Game();

export default {
	async email(message: ForwardableEmailMessage, env: Record<string, any>, ctx: ExecutionContext): Promise<void> {
		const subject = message.headers.get('subject') || '';
		const messageId = message.headers.get('Message-ID');

		const emailContent = handleIncomingEmail(game, {
			from: message.from,
			subject,
			body: subject,
			imageSrc: 'cid:game_view',
		});

		const reply = createMimeMessage();
		if (messageId) {
			reply.setHeader('In-Reply-To', messageId);
			reply.setHeader('References', messageId);
		}
		reply.setSender(message.to);
		reply.setRecipient(message.from);
		reply.setSubject(emailContent.subject);

		if (emailContent.gifBytes) {
			reply.addAttachment({
				filename: 'game.gif',
				contentType: 'image/gif',
				data: bytesToBase64(emailContent.gifBytes),
				inline: true,
				headers: { 'Content-ID': '<game_view>' },
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
	},
};
