import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';

export default {
	async email(message: ForwardableEmailMessage, env: Record<string, any>, ctx: ExecutionContext): Promise<void> {
		const subject = message.headers.get('subject') || '';
		const messageId = message.headers.get('Message-ID');

		const reply = createMimeMessage();
		if (messageId) {
			reply.setHeader('In-Reply-To', messageId);
			reply.setHeader('References', messageId);
		}
		reply.setSender(message.to);
		reply.setRecipient(message.from);
		reply.setSubject(`Re: ${subject}`);
		reply.addMessage({
			contentType: 'text/plain',
			data: 'Thank you for your message. We have received your email and will respond shortly.',
		});
		reply.addMessage({
			contentType: 'text/html',
			data: '<h1>Thank you for your message</h1><p>We have received your email and will respond shortly.</p>',
		});

		await message.reply(new EmailMessage(message.to, message.from, reply.asRaw()));
	},
};
