import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import PocketBase from 'pocketbase';
import {
	OPENAI_API_KEY,
	CARTESIA_API_KEY,
	POCKETBASE_URL,
	POCKETBASE_EMAIL,
	POCKETBASE_PASS
} from '$env/static/private';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

const pb = new PocketBase(POCKETBASE_URL);

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

export async function POST({ request }) {
	//console.log(pb);

	const authData = await pb.admins.authWithPassword(POCKETBASE_EMAIL, POCKETBASE_PASS);

	// after the above you can also access the auth data from the authStore
	console.log(pb.authStore.isValid);
	console.log(pb.authStore.token);
	console.log(pb.authStore.model.id);

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
		const previousConversations = await pb.collection('conversations').getList(1, 20, {
			filter: `user_id = "${user_id}"`,
			sort: '-created'
		});

		// Prepare conversation history for OpenAI
		const conversationHistory = previousConversations.items.reverse().flatMap((conv) => [
			{ role: 'user', content: conv.user_input },
			{ role: 'assistant', content: conv.ai_response }
		]);

		// Call OpenAI API
		const completion = await openai.chat.completions.create({
			model: 'gpt-4',
			messages: [
				...conversationHistory,
				{
					role: 'system',
					content: `
                    You are a san francisco skateboarder, older, middle aged. You are into punk rock, hip hop and read lots of books about south american literature.                     
                    `
				},
				{ role: 'user', content: message }
			]
		});

		const aiResponse = completion.choices[0].message.content;

		// Store the conversation in PocketBase
		await pb.collection('conversations').create({
			user_id: user_id,
			user_input: message,
			ai_response: aiResponse
		});

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
					id: 'd46abd1d-2d02-43e8-819f-51fb652c1c61' // newsman
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
