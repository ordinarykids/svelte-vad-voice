import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { OPENAI_API_KEY, CARTESIA_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

const schema = zfd.formData({
	input: z.union([zfd.text(), zfd.file()]),
	message: zfd.repeatableOfType(
		zfd.json(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string()
			})
		)
	)
});

// Initialize SQLite database
let db;
(async () => {
	db = await open({
		filename: 'chat_history.db',
		driver: sqlite3.Database
	});

	await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_input TEXT,
      ai_response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

export async function POST({ request }) {
	// console.time('transcribe ' + request.headers.get('x-vercel-id') || 'local');

	const formData = await request.formData();
	const { data, success } = schema.safeParse(formData);
	if (!success) return json({ error: 'Invalid request' }, { status: 400 });

	const transcript = await getTranscript(data.input);
	const message = transcript;
	if (!message) return json({ error: 'Invalid audio' }, { status: 400 });

	let user_id = '123';

	try {
		console.time('API Call Duration');
		// Retrieve previous conversations for this user
		const previousConversations = await db.all(
			'SELECT user_input, ai_response FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20',
			[user_id]
		);

		// Prepare conversation history for OpenAI
		const conversationHistory = previousConversations.reverse().flatMap((conv) => [
			{ role: 'user', content: conv.user_input },
			{ role: 'assistant', content: conv.ai_response }
		]);

		// Call OpenAI API
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				...conversationHistory,
				{
					role: 'system',
					content: `- You are a monkey who really loves bananas. And like to tell jokes about Tarzan and swinging in vines. `
				},
				{ role: 'user', content: message }
			]
		});

		const aiResponse = completion.choices[0].message.content;

		// Store the conversation in the database
		await db.run('INSERT INTO conversations (user_id, user_input, ai_response) VALUES (?, ?, ?)', [
			user_id,
			message,
			aiResponse
		]);

		const response = aiResponse;

		console.log('transcript', transcript);
		console.log('aiResponse', aiResponse);
		if (!response) {
			return json({ error: 'No response from GPT-4' }, { status: 500 });
		}

		const voice = await fetch('https://api.cartesia.ai/tts/bytes', {
			method: 'POST',
			headers: {
				'Cartesia-Version': '2024-06-30',
				'Content-Type': 'application/json',
				'X-API-Key': CARTESIA_API_KEY
			},
			body: JSON.stringify({
				model_id: 'sonic-english',
				transcript: response,
				voice: {
					mode: 'id',
					id: '79a125e8-cd45-4c13-8a67-188112f4dd22'
				},
				output_format: {
					container: 'raw',
					encoding: 'pcm_f32le',
					sample_rate: 24000
				}
			})
		});

		if (!voice.ok) {
			console.error(await voice.text());
			return json({ error: 'Voice synthesis failed' }, { status: 500 });
		}

		return new Response(voice.body, {
			headers: {
				'X-Transcript': encodeURIComponent(transcript),
				'X-Response': encodeURIComponent(response)
			}
		});
	} catch (error) {
		console.error('Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	} finally {
		console.timeEnd('API Call Duration');
	}
}

async function getTranscript(input) {
	if (typeof input === 'string') return input;

	try {
		const response = await openai.audio.transcriptions.create({
			file: input,
			model: 'whisper-1'
		});

		return response.text.trim() || null;
	} catch {
		return null; // Empty audio file
	}
}
