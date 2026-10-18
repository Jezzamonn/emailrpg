import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';
import { Game } from '../../game/game.ts';
import { renderLevelToGif } from '../../game/lib/gif.ts';

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export default {
	async email(message: ForwardableEmailMessage, env: Record<string, any>, ctx: ExecutionContext): Promise<void> {
		const subject = message.headers.get('subject') || '';
		const messageId = message.headers.get('Message-ID');

		const game = new Game();
		// State will be loaded/persisted with Durable Objects

		const gifBytes = renderLevelToGif(game.currentLevel, 16);
		const gifBase64 = bytesToBase64(gifBytes);

		const reply = createMimeMessage();
		if (messageId) {
			reply.setHeader('In-Reply-To', messageId);
			reply.setHeader('References', messageId);
		}
		reply.setSender(message.to);
		reply.setRecipient(message.from);
		reply.setSubject(`Re: ${subject}`);

		reply.addAttachment({
			filename: 'game.gif',
			contentType: 'image/gif',
			data: gifBase64,
			inline: true,
			headers: { 'Content-ID': '<game_view>' },
		});

		reply.addMessage({
			contentType: 'text/plain',
			data: `Current Game State:\n\n${game.currentLevel.renderText()}\nReply with your move (e.g. 'k u').`,
		});
		reply.addMessage({
			contentType: 'text/html',
			data: `<h2>LD60 Game Turn</h2>
<p><img src="cid:game_view" alt="Game Board" style="image-rendering: pixelated; width: 288px; height: 288px;" /></p>
<pre>${game.currentLevel.renderText()}</pre>
<p>Reply to this email with your command to make a move (e.g. <code>k u</code>).</p>`,
		});

		await message.reply(new EmailMessage(message.to, message.from, reply.asRaw()));
	},
};
