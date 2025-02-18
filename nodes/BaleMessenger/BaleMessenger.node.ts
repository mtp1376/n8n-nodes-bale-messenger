import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject, NodeOperationError,
	// NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';
import FormData from 'form-data';
import {BINARY_ENCODING, IExecuteFunctions} from 'n8n-core';
import {ChatAction, default as TelegramBot, InlineQueryResult} from 'node-telegram-bot-api';
import {Stream} from "stream";

const BALE_API_URL = `https://tapi.bale.ai/bot`;
const axiosInstance = axios.create({
	maxContentLength: 2 * 1024 * 1024 * 1024, // 2GB
	headers: {
		'Content-Type': 'application/json',
	},
});

interface LabeledPrice {
	label: string;
	amount: number;
}

function getMarkup(this: IExecuteFunctions, i: number) {
	const replyMarkupOption = this.getNodeParameter('replyMarkup', i) as string;
	let reply_markup: any = {};

	if (replyMarkupOption === 'none') {
		return undefined;
	} else if (replyMarkupOption === 'forceReply') {
		return this.getNodeParameter('forceReply', i);
	} else if (replyMarkupOption === 'replyKeyboardRemove') {
		return this.getNodeParameter('replyKeyboardRemove', i);
	}

	let setParameterName = 'inline_keyboard';
	if (replyMarkupOption === 'replyKeyboard') {
		setParameterName = 'keyboard';
	}

	reply_markup[setParameterName] = [];

	const keyboardData = this.getNodeParameter(replyMarkupOption, i) as any;
	for (const row of keyboardData.rows) {
		const sendRows: any[] = [];
		if (row.row?.buttons === undefined) {
			continue;
		}
		for (const button of row.row.buttons) {
			let sendButtonData: any = {};
			sendButtonData.text = button.text;
			if (button.additionalFields) {
				Object.assign(sendButtonData, button.additionalFields);
			}
			sendRows.push(sendButtonData);
		}
		reply_markup[setParameterName].push(sendRows);
	}

	return reply_markup;
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<any> {
	const data: Record<string, any> = {callback_query_id: callbackQueryId};
	if (text) {
		data.text = text;
	}

	// Log the URL to ensure it's correct
	const url = `${BALE_API_URL}${token}/answerCallbackQuery`;
	console.log('Request URL:', url);
	console.log('Request Data:', data);

	try {
		const response = await axiosInstance.post(url, data);
		console.log('Response from Bale:', response.data);
		return response.data;
	} catch (error) {
		console.error('Failed to answer callback query:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function sendContact(token: string, chat_id: string, phone_number: string, first_name: string,
													 last_name?: string, replyToMessageId?: number) {
	const data: Record<string, any> = {
		chat_id: chat_id,
		phone_number: phone_number,
		first_name: first_name,
		last_name: last_name,
		reply_to_message_id: replyToMessageId,
		reply_markup: true
	};
	const url = `${BALE_API_URL}${token}/sendContact`;
	try {
		const response = await axiosInstance.post(url, data);
		console.log('Response from Bale:', response.data);
		return response.data;
	} catch (error) {
		console.error('Failed to send contact:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function sendInvoice(token: string, chatId: string, title: string, description: string, payload: string, providerToken: string,
													 prices: LabeledPrice[], photoUrl?: string, replyToMessageId?: number, replyMarkup?: any) {
	const data: Record<string, any> = {
		chat_id: chatId,
		title: title,
		description: description,
		payload: payload,
		provider_token: providerToken,
		prices: prices,
		photo_url: photoUrl,
		reply_to_message_id: replyToMessageId,
		reply_markup: replyMarkup
	};
	const url = `${BALE_API_URL}${token}/sendInvoice`;
	try {
		const response = await axiosInstance.post(url, data);
		console.log('Response from Bale:', response.data);
		return response.data;
	} catch (error) {
		console.error('Failed to send contact:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function getChatMembersCount(token: string, chatId: string) {
	const url = `${BALE_API_URL}${token}/getChatMembersCount`;
	try {
		const response = await axiosInstance.get(url, {
			params: {
				chat_id: chatId
			}
		});
		return response.data;
	} catch (error) {
		console.error('Failed to get chat members count:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function createNewStickerSet(token: string, userId: number, name: string, title: string, sticker: string | Stream | Buffer) {
	const data: Record<string, any> = {
		user_id: userId,
		name: name,
		title: title,
		sticker: sticker,
	};
	const url = `${BALE_API_URL}${token}/createNewStickerSet`;
	try {
		const response = await axiosInstance.post(url, data);
		return response.data;
	} catch (error) {
		console.error('Failed to create new sticker set:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function addStickerToSet(token: string, userId: number, name: string, sticker: string | Stream | Buffer) {
	const data: Record<string, any> = {
		user_id: userId,
		name: name,
		sticker: sticker,
	};
	const url = `${BALE_API_URL}${token}/createNewStickerSet`;
	try {
		const response = await axiosInstance.post(url, data);
		return response.data;
	} catch (error) {
		console.error('Failed to add new sticker to set:', error.response ? error.response.data : error.message);
		throw error;
	}
}

async function setChatPhoto(token: string, chatId: string, photo: Buffer) {
    const url = `${BALE_API_URL}${token}/setChatPhoto`;

    try {
        // Create FormData for the request
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', photo, {
            filename: 'chat_photo.jpg', // Ensure you provide a filename
            contentType: 'image/jpeg', // Set appropriate MIME type
        });

        // Send request using axios
        const response = await axios.post(url, formData, {
            headers: {
                ...formData.getHeaders(), // Get headers for multipart/form-data
            },
        });

        console.log('Chat photo set successfully:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('Failed to set chat photo:', error.response ? error.response.data : error.message);
        throw error;
    }
}


export class BaleMessenger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BaleMessenger',
		name: 'baleMessenger',
		icon: 'file:bale.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Bale Messenger API',
		defaults: {
			name: 'BaleMessenger',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'baleMessengerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Bot',
						value: 'bot'
					},
					{
						name: 'Callback',
						value: 'callback',
					},
					{
						name: 'Chat',
						value: 'chat',
					},
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'Message',
						value: 'message',
					},
					{
						name: 'Payment',
						value: 'payment',
					},
					{
						name: 'Sticker',
						value: 'sticker',
					},
				],
				default: 'message',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['chat'],
					},
				},
				options: [

					{
						name: 'Ban Chat Member',
						value: 'banChatMember',
						description: 'Ban a member from the chat',
						action: 'Ban a member from the chat',
					},

					{
						name: 'Get Chat',
						value: 'getChat',
						description: 'Get up to date information about a chat',
						action: 'Get a chat',
					},

					{
						name: 'Get Chat Members Count',
						value: 'getChatMembersCount',
						description: 'Get a chat members count',
						action: 'Get a chat members count',
					},

					{
						name: 'Leave Chat',
						value: 'leaveChat',
						description: 'Leave a group, supergroup or channel',
						action: 'Leave a chat',
					},

					{
						name: 'Set Chat Photo',
						value: 'setChatPhoto',
						description: 'Set a new profile photo for the group, supergroup, or channel',
						action: 'Set a chat photo',
					},

					{
						name: 'Unban Chat Member',
						value: 'unbanChatMember',
						description: 'Unban a member from the chat',
						action: 'Unban a member from the chat',
					},

				],
				default: 'getChat',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bot'],
					},
				},
				options: [
					{
						name: 'Get Me',
						value: 'getMe',
						description: 'A simple method for testing your bots auth token',
						action: 'Test bot auth token',
					},
					{
						name: 'Log Out',
						value: 'logOut',
						description: 'Log out from the cloud Bot API server before launching the bot locally',
						action: 'Log out from the cloud bot api',
					},
					{
						name: 'Close',
						value: 'close',
						description: 'Close the bot instance before moving it from one local server to another',
						action: 'Close the bot instance',
					},
				],
				default: 'getMe'
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Copy Message',
						value: 'copyMessage',
						description: 'Copy a message',
						action: 'Copy a message',
					},
					{
						name: 'Delete Chat Message',
						value: 'deleteMessage',
						description: 'Delete a chat message',
						action: 'Delete a chat message',
					},
					{
						name: 'Edit Message Text',
						value: 'editMessageText',
						description: 'Edit a text message',
						action: 'Edit a test message',
					},
					{
						name: 'Forward Message',
						value: 'forwardMessage',
						description: 'Forward a message',
						action: 'Forward a message'
					},
					{
						name: 'Send Animation',
						value: 'sendAnimation',
						description: 'Send an animated file',
						action: 'Send an animated file',
					},
					{
						name: 'Send Audio',
						value: 'sendAudio',
						description: 'Send an audio file',
						action: 'Send an audio file',
					},
					{
						name: 'Send Chat Action',
						value: 'sendChatAction',
						description: 'Send a chat action',
						action: 'Send a chat action',
					},
					{
						name: 'Send Contact',
						value: 'sendContact',
						description: 'Send a contact',
						action: 'Send a contact',
					},
					{
						name: 'Send Document',
						value: 'sendDocument',
						description: 'Send a document',
						action: 'Send a document',
					},
					{
						name: 'Send Location',
						value: 'sendLocation',
						description: 'Send a location',
						action: 'Send a location',
					},
					{
						name: 'Send Media Group',
						value: 'sendMediaGroup',
						description: 'Send group of photos or videos to album',
						action: 'Send a media group message',
					},
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a text message',
						action: 'Send a text message',
					},
					{
						name: 'Send Photo',
						value: 'sendPhoto',
						description: 'Send a photo',
						action: 'Send a photo message',
					},
					{
						name: 'Send Sticker',
						value: 'sendSticker',
						description: 'Send a sticker',
						action: 'Send a sticker',
					},
					{
						name: 'Send Video',
						value: 'sendVideo',
						description: 'Send a video',
						action: 'Send a video',
					},
					{
						name: 'Send Voice',
						value: 'sendVoice',
						description: 'Send a voice',
						action: 'Send a voice',
					},
				],

				default: 'sendMessage',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['callback'],
					},
				},
				options: [
					{
						name: 'Answer Query',
						value: 'answerQuery',
						description: 'Send answer to callback query sent from inline keyboard',
						action: 'Answer a query callback',
					},
					{
						name: 'Answer Inline Query',
						value: 'answerInlineQuery',
						description: 'Send answer to callback query sent from inline bot',
						action: 'Answer an inline query callback',
					},
				],
				default: 'answerQuery',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['payment'],
					},
				},
				options: [
					{
						name: 'Send Invoice',
						value: 'sendInvoice',
						description: 'Send a request for payment',
						action: 'Send a request for payment',
					},
				],
				default: 'sendInvoice',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['sticker'],
					},
				},
				options: [
					{
						name: 'Upload Sticker',
						value: 'uploadSticker',
						description: 'Upload a sticker file',
						action: 'Upload a sticker file',
					},

					{
						name: 'Create New Sticker Set',
						value: 'createNewStickerSet',
						description: 'Create a new sticker set',
						action: 'Create a new sticker set',
					},

					{
						name: 'Add Sticker To Set',
						value: 'addStickerToSet',
						description: 'Add a sticker to an existing sticker set',
						action: 'Add a sticker to an existing sticker set',
					},
				],
				default: 'uploadSticker',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['file'],
					},
				},
				options: [
					{
						name: 'Get File',
						value: 'getFile',
						description: 'Retrieve file information by file ID',
						action: 'Get a file',
					},

				],
				default: 'getFile',
			},


			// edit message
			{
				displayName: 'Message Type',
				name: 'messageType',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['editMessageText'],
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Inline Message',
						value: 'inlineMessage',
					},
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
				description: 'The type of the message to edit',
			},
			{
				displayName: 'Inline Message ID',
				name: 'inlineMessageId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						messageType: ['inlineMessage'],
						operation: ['editMessageText'],
						resource: ['message'],
					},
				},
				required: true,
				description: 'Unique identifier of the inline message to edit',
			},
			{
				displayName: 'Disable Notification',
				name: 'disable_notification',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['editMessageText'],
					},
				},
				description:
					'Whether to send the message silently. Users will receive a notification with no sound.',
			},
			// edit message

			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendMessage',
							'sendPhoto',
							'sendAudio',
							'sendVoice',
							'sendVideo',
							'sendAnimation',
							'sendMediaGroup',
							'sendSticker',
							'deleteMessage',
							'sendChatAction',
							'editMessageText',
							'sendLocation',
							'sendContact',
							'copyMessage',
							'forwardMessage',
							'getChat',
							'leaveChat',
							'getChatMembersCount',
							'sendInvoice',
							'banChatMember',
							'unbanChatMember',
							'setChatPhoto',
						],
						resource: ['chat', 'message', 'payment'],
					},
				},
				required: true,
				description: 'Unique identifier for the target chat',
			},

			{
				displayName: 'From Chat ID',
				name: 'fromChatId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'copyMessage',
							'forwardMessage',
						],
						resource: ['chat', 'message'],
					},
				},
				required: true,
				description: 'Unique identifier for the chat where the original message was sent',
			},

			{
				displayName: 'Binary Data',
				name: 'binaryData',
				type: 'boolean',
				default: false,
				required: true,
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendPhoto',
							'sendAudio',
							'sendVideo',
							'sendAnimation',
							'sendVoice',
						],
						resource: ['message'],
					},
				},
				description: 'Whether the data to upload should be taken from binary field',
			},

			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendPhoto',
							'sendAudio',
							'sendVoice',
							'sendVideo',
							'sendAnimation',
							'sendSticker',
						],
						resource: ['message'],
						binaryData: [true],
					},
				},
				placeholder: '',
				description: 'Name of the binary property that contains the data to upload',
			},

			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendPhoto',
							'sendAudio',
							'sendVoice',
							'sendVideo',
							'sendAnimation',
						],
						resource: ['message', 'file'],
						binaryData: [false],
					},
				},
				description: 'Pass a file_id to send a file that exists on the Bale servers',
			},

			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['sendMessage', 'editMessageText'],
						resource: ['message'],
					},
				},
				description: 'Text of the message to be sent',
			},

			{
				displayName: 'Reply Markup',
				name: 'replyMarkup',
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendMessage',
							'sendPhoto',
							'sendAudio',
							'sendVoice',
							'sendVideo',
							'sendAnimation',
							'editMessageText',
							'sendLocation',
							'sendContact',
							'sendInvoice',
						],
						resource: ['message', 'payment'],
					},
				},
				type: 'options',
				options: [
					{
						name: 'Inline Keyboard',
						value: 'inlineKeyboard',
					},
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Reply Keyboard',
						value: 'replyKeyboard',
					},
					{
						name: 'Reply Keyboard Remove',
						value: 'replyKeyboardRemove',
					},
				],
				default: 'none',
				description: 'Additional interface options',
			},

			{
				displayName: 'Inline Keyboard',
				name: 'inlineKeyboard',
				placeholder: 'Add Keyboard Row',
				description: 'Adds an inline keyboard that appears right next to the message it belongs to',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						replyMarkup: ['inlineKeyboard'],
						resource: ['message'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Rows',
						name: 'rows',
						values: [
							{
								displayName: 'Row',
								name: 'row',
								type: 'fixedCollection',
								description: 'The value to set',
								placeholder: 'Add Button',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								options: [
									{
										displayName: 'Buttons',
										name: 'buttons',
										values: [
											{
												displayName: 'Text',
												name: 'text',
												type: 'string',
												default: '',
												description: 'Label text on the button',
											},
											{
												displayName: 'Additional Fields',
												name: 'additionalFields',
												type: 'collection',
												placeholder: 'Add Field',
												default: {},
												options: [
													{
														displayName: 'Callback Data',
														name: 'callback_data',
														type: 'string',
														default: '',
														description:
															'Data to be sent in a callback query to the bot when button is pressed, 1-64 bytes',
													},
													{
														displayName: 'URL',
														name: 'url',
														type: 'string',
														default: '',
														description: 'HTTP or tg:// URL to be opened when button is pressed',
													},
												],
											},
										],
									},
								],
							},
						],
					},
				],
			},

			{
				displayName: 'Reply Keyboard',
				name: 'replyKeyboard',
				placeholder: 'Add Reply Keyboard Row',
				description: 'Adds a custom keyboard with reply options',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						replyMarkup: ['replyKeyboard'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Rows',
						name: 'rows',
						values: [
							{
								displayName: 'Row',
								name: 'row',
								type: 'fixedCollection',
								description: 'The value to set',
								placeholder: 'Add Button',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								options: [
									{
										displayName: 'Buttons',
										name: 'buttons',
										values: [
											{
												displayName: 'Text',
												name: 'text',
												type: 'string',
												default: '',
												description:
													'Text of the button. If none of the optional fields are used, it will be sent as a message when the button is pressed.',
											},
										],
									},
								],
							},
						],
					},
				],
			},

			{
				displayName: 'Reply Keyboard Remove',
				name: 'replyKeyboardRemove',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						replyMarkup: ['replyKeyboardRemove'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Remove Keyboard',
						name: 'remove_keyboard',
						type: 'boolean',
						default: false,
						description: 'Whether to request clients to remove the custom keyboard',
					},
					{
						displayName: 'Selective',
						name: 'selective',
						type: 'boolean',
						default: false,
						description: 'Whether to force reply from specific users only',
					},
				],
			},
			// amir nezami changes starts here \\
			{
				displayName: 'Reply To Message ID',
				name: 'replyToMessageId',
				type: 'number',
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendMessage',
							'sendPhoto',
							'sendAudio',
							'sendVoice',
							'sendVideo',
							'sendAnimation',
							'sendMediaGroup',
							'sendSticker',
							'sendContact',
							'sendInvoice'
						],
						resource: ['chat', 'message', 'payment'],
					},
				},
				default: 0,
				description: 'If the message is a reply, ID of the original message',
			},
			{
				displayName: 'Sticker ID',
				name: 'stickerId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendSticker'],
						resource: ['message'],
					},
				},
				description:
					'Sticker to send. Pass a file_id to send a file that exists on the Bale servers (recommended).',
			},
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['deleteMessage', 'editMessageText', 'copyMessage', 'forwardMessage'],
						resource: ['message'],
					},
				},
				required: true,
				description: 'Unique identifier of the message to delete',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['sendChatAction'],
						resource: ['message'],
					},
				},
				options: [
					// {
					// 	name: 'Find Location',
					// 	value: 'find_location',
					// 	action: 'Find location',
					// },//TODO should complete
					{
						name: 'Record Video',
						value: 'record_video',
						action: 'Record video',
					},
					// {
					// 	name: 'Record Video Note',
					// 	value: 'record_video_note',
					// 	action: 'Record video note',
					// },
					{
						name: 'Record Voice',
						value: 'record_voice',
						action: 'Record voice',
					},
					{
						name: 'Typing',
						value: 'typing',
						action: 'Typing a message',
					},
					// {
					// 	name: 'Upload Document',
					// 	value: 'upload_document',
					// 	action: 'Upload document',
					// },//TODO should complete
					{
						name: 'Upload Photo',
						value: 'upload_photo',
						action: 'Upload photo',
					},
					{
						name: 'Upload Video',
						value: 'upload_video',
						action: 'Upload video',
					},
					// {
					// 	name: 'Upload Video Note',
					// 	value: 'upload_video_note',
					// 	action: 'Upload video note',
					// },
					{
						name: 'Upload Voice',
						value: 'upload_voice',
						action: 'Upload voice',
					},
				],
				default: 'typing',
				description:
					'Type of action to broadcast. Choose one, depending on what the user is about to receive. The status is set for 5 seconds or less (when a message arrives from your bot).',
			},
			// amir nezami changes ends here \\

			// ----------------------------------
			//         message:sendContact
			// ----------------------------------
			{
				displayName: 'Phone Number',
				name: 'phone_number',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['sendContact'],
						resource: ['message'],
					},
				},
				placeholder: '+989123456789',
				description: 'Phone number of the contact to be sent',
			},

			{
				displayName: 'First Name',
				name: 'first_name',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['sendContact'],
						resource: ['message'],
					},
				},
				description: 'First name of the contact to be sent',
			},
			{
				displayName: 'Last Name',
				name: 'last_name',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendContact'],
						resource: ['message'],
					},
				},
				description: 'Last name of the contact to be sent',
			},

			// ----------------------------------
			//         message:sendLocation
			// ----------------------------------
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				default: 0.0,
				typeOptions: {
					numberPrecision: 10,
					minValue: -90,
					maxValue: 90,
				},
				displayOptions: {
					show: {
						operation: ['sendLocation'],
						resource: ['message'],
					},
				},
				description: 'Location latitude',
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				typeOptions: {
					numberPrecision: 10,
					minValue: -180,
					maxValue: 180,
				},
				default: 0.0,
				displayOptions: {
					show: {
						operation: ['sendLocation'],
						resource: ['message'],
					},
				},
				description: 'Location longitude',
			},
			{
				displayName: 'Horizontal Accuracy',
				name: 'horizontal_accuracy',
				type: 'number',
				typeOptions: {
					numberPrecision: 10,
					minValue: 0,
					maxValue: 1500,
				},
				default: 0.0,
				displayOptions: {
					show: {
						operation: ['sendLocation'],
						resource: ['message'],
					},
				},
				description: 'Location horizontal accuracy',
			},

			// ----------------------------------
			//         callback:answerQuery
			// ----------------------------------
			{
				displayName: 'Query ID',
				name: 'queryId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['answerQuery'],
						resource: ['callback'],
					},
				},
				required: true,
				description: 'Unique identifier for the query to be answered',
			},

			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: ['answerQuery'],
						resource: ['callback'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Cache Time',
						name: 'cache_time',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'The maximum amount of time in seconds that the result of the callback query may be cached client-side',
					},
					{
						displayName: 'Show Alert',
						name: 'show_alert',
						type: 'boolean',
						default: false,
						description:
							'Whether an alert will be shown by the client instead of a notification at the top of the chat screen',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
						description:
							'Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters.',
					},
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						default: '',
						description: "URL that will be opened by the user's client",
					},
				],
			},

			// -----------------------------------------------
			//         callback:answerInlineQuery
			// -----------------------------------------------
			{
				displayName: 'Query ID',
				name: 'queryId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['answerInlineQuery'],
						resource: ['callback'],
					},
				},
				required: true,
				description: 'Unique identifier for the answered query',
			},
			{
				displayName: 'Results',
				name: 'results',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['answerInlineQuery'],
						resource: ['callback'],
					},
				},
				required: true,
				description: 'A JSON-serialized array of results for the inline query',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: ['answerInlineQuery'],
						resource: ['callback'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Cache Time',
						name: 'cache_time',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'The maximum amount of time in seconds that the result of the callback query may be cached client-side',
					},
					{
						displayName: 'Show Alert',
						name: 'show_alert',
						type: 'boolean',
						default: false,
						description:
							'Whether an alert will be shown by the client instead of a notification at the top of the chat screen',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
						description:
							'Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters.',
					},
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						default: '',
						description: "URL that will be opened by the user's client",
					},
				],
			},


			// -----------------------------------------------
			//         message: sendMediaGroup
			// -----------------------------------------------
			{
				displayName: 'Media',
				name: 'media',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						operation: ['sendMediaGroup'],
						resource: ['message'],
					},
				},
				description: 'The media to add',
				placeholder: 'Add Media',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						displayName: 'Media',
						name: 'media',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'Photo',
										value: 'photo',
									},
									{
										name: 'Video',
										value: 'video',
									},
								],
								default: 'photo',
								description: 'The type of the media to add',
							},
							{
								displayName: 'Media File',
								name: 'media',
								type: 'string',
								default: '',
								description:
									'Media to send. Pass a file_id to send a file that exists on the Telegram servers (recommended) or pass an HTTP URL for Telegram to get a file from the Internet.',
							},
							{
								displayName: 'Additional Fields',
								name: 'additionalFields',
								type: 'collection',
								placeholder: 'Add Field',
								default: {},
								options: [
									{
										displayName: 'Caption',
										name: 'caption',
										type: 'string',
										default: '',
										description: 'Caption text to set, 0-1024 characters',
									},
									{
										displayName: 'Parse Mode',
										name: 'parse_mode',
										type: 'options',
										options: [
											{
												name: 'Markdown (Legacy)',
												value: 'Markdown',
											},
											{
												name: 'MarkdownV2',
												value: 'MarkdownV2',
											},
											{
												name: 'HTML',
												value: 'HTML',
											},
										],
										default: 'HTML',
										description: 'How to parse the text',
									},
								],
							},
						],
					},
				],
			},

			// -----------------------------------------------
			//         chat & sticker:  member
			// -----------------------------------------------
			{
				displayName: 'UserId',
				name: 'userId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						operation: [
							'banChatMember',
							'unbanChatMember',
							'uploadSticker',
							'createNewStickerSet',
							'addStickerToSet',
						],
						resource: ['chat', 'sticker'],
					},
				}
			},

			// -----------------------------------------------
			//         chat:  member
			// -----------------------------------------------
			{
				displayName: 'Only If Banned',
				name: 'onlyIfBanned',
				type: 'boolean',
				default: false,
				required: true,
				displayOptions: {
					show: {
						operation: ['unbanChatMember'],
						resource: ['chat'],
					},
				},
				description: 'Whether the user is blocked or not, perform the action if they are not blocked',
			},

			// -----------------------------------------------
			//         payment: sendInvoice
			// -----------------------------------------------
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'Set title for invoice',
			},

			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'Send an invoice for payment',
			},

			{
				displayName: 'Payload',
				name: 'payload',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'Invoice payload for internal processes, used to differentiate payment requests, not visible to the user (1 to 128 bytes)',
			},

			{
				displayName: 'Provider Token',
				name: 'providerToken',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'Card number for request',
			},

			{
				displayName: 'Prices',
				name: 'prices',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: '[{ "label": "Product A", "amount": 1000 }, { "label": "Product B", "amount": 2000 }]',
				options: [
					{
						name: 'priceItem',
						displayName: 'Price Item',
						values: [
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								description: 'The label for the item (e.g., product name)',
							},
							{
								displayName: 'Amount',
								name: 'amount',
								type: 'number',
								default: 0,
								description: 'The price for the item (in smallest currency unit)',
							},
						],
					},
				],
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'A JSON-serialized list of price objects, where each object contains "label" and "amount" keys',
			},


			{
				displayName: 'Photo Url',
				name: 'photoUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendInvoice'],
						resource: ['payment'],
					},
				},
				description: 'URL of the product image to include with the invoice for a visual reference of the purchased item',
			},

			// -----------------------------------------------
			//         sticker: createNewStickerSet & addStickerToSet
			// -----------------------------------------------

			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['createNewStickerSet', 'addStickerToSet'],
						resource: ['sticker'],
					},
				},
			},

			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['createNewStickerSet'],
						resource: ['sticker'],
					},
				},
				description: 'Set a title for new sticker set',
			},

			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'uploadSticker',
							'createNewStickerSet',
							'addStickerToSet',
						],
						resource: ['sticker'],
					},
				},
				placeholder: '',
				description: 'Name of the binary property that contains the data to upload',
			},

			// -----------------------------------------------
			//         file: getFile
			// -----------------------------------------------

			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'getFile',
						],
						resource: ['file'],
					},
				},
				description: 'Pass a file_id to get a file details that exists on the Bale servers',
			},


			// -----------------------------------------------
			//         chat: setChatPhoto
			// -----------------------------------------------
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'setChatPhoto',
						],
						resource: ['chat'],
					},
				},
				placeholder: '',
				description: 'Name of the binary property that contains photo for setting on chat',
			},


			// -----------------------------------------------
			//         message:sendAnimation/sendAudio/sendLocation/sendMessage/sendPhoto/sendSticker/sendVideo
			// -----------------------------------------------

			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'sendAnimation',
							'sendAudio',
							'sendDocument',
							'sendPhoto',
							'sendVideo',
							'sendVoice',
						],
						resource: ['message'],
					},
				},
				description: 'Caption text to set, 0-1024 characters',
			},

			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'sendAnimation',
							'sendAudio',
							'sendDocument',
							'sendPhoto',
							'sendVideo',
							'sendSticker',
						],
						resource: ['message'],
						binaryData: [true],
					},
				},
				placeholder: 'image.jpeg',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0);
		const resource = this.getNodeParameter('resource', 0);
		const credentials = await this.getCredentials('baleMessengerApi');
		const binaryData = this.getNodeParameter('binaryData', 0, false);

		const bot = new TelegramBot(credentials.token as string, {
			baseApiUrl: 'https://tapi.bale.ai',
		});

		let body: IDataObject;

		for (let i = 0; i < items.length; i++) {
			body = {};

			if (resource === 'bot') {

				if (operation === 'getMe') {
					const res = await bot.getMe();
					returnData.push({
						json: {
							...res
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'logOut') {
					const res = await bot.logOut();
					returnData.push({
						json: {
							logged_out: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'close') {
					const res = await bot.close();
					returnData.push({
						json: {
							closed: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}
			} else if (resource === 'callback') {
				if (operation === 'answerQuery') {
					// ----------------------------------
					//         callback:answerQuery
					// ----------------------------------

					const query_id = this.getNodeParameter('queryId', i) as string;

					// Add additional fields
					// const additionalFields = this.getNodeParameter('additionalFields', i);
					try {
						const res = await answerCallbackQuery(credentials.token as string, query_id, "amir");
						returnData.push({
							json: {
								successful: res,
							},
							binary: {},
							pairedItem: {item: i},
						});
					} catch (error) {
						// Log the error for debugging purposes
						console.error('Error answering callback query:', error);
						// Optionally, you can add more information to the returned data for further inspection
						returnData.push({
							json: {
								successful: false,
								errorMessage: error.message,
								errorDetails: error.response ? error.response.data : {},
							},
							binary: {},
							pairedItem: {item: i},
						});
					}
				} else if (operation === 'answerInlineQuery') {
					// -----------------------------------------------
					//         callback:answerInlineQuery
					// -----------------------------------------------

					const query_id = this.getNodeParameter('queryId', i) as string;
					const resultsParam = this.getNodeParameter('results', i) as string;
					let results: InlineQueryResult[] = [];

					try {
						results = JSON.parse(resultsParam) as InlineQueryResult[];
					} catch (error) {
						throw new NodeOperationError(this.getNode(), 'The results parameter is not a valid JSON string.', {
							itemIndex: i,
						});
					}

					// Log the parsed results for debugging
					console.log('Parsed results:', JSON.stringify(results, null, 2));

					// Add additional fields
					const additionalFields = this.getNodeParameter('additionalFields', i) || {};

					try {
						// Log the payload being sent to Telegram API
						console.log('Sending answerInlineQuery request with:', JSON.stringify({
							query_id,
							results,
							additionalFields
						}, null, 2));

						// Send request to Telegram API
						const res = await bot.answerInlineQuery(query_id, results, additionalFields);

						// Log the response from Telegram API
						console.log('Received response:', res);

						returnData.push({
							json: {
								successful: res,
							},
							binary: {},
							pairedItem: {item: i},
						});
					} catch (error) {
						// Log the error for debugging
						console.error('Failed to answer inline query:', error);

						throw new NodeOperationError(this.getNode(), `Failed to answer inline query: ${error.message}`, {
							itemIndex: i,
							...error,
						});
					}
				}

			} else if (resource === 'message') {
				const chatId = this.getNodeParameter('chatId', i) as string;

				if (operation === 'sendMessage') {
					try {
						const text = this.getNodeParameter('text', i) as string;

						const res = await bot.sendMessage(chatId, text, {
							reply_markup: getMarkup.call(this, i),
						});
						returnData.push({
							json: {
								...res,
							},
							binary: {},
							pairedItem: {item: i},
						});

					} catch (err) {

						//throw new NodeOperationError(this.getNode(), `bad request - chat not found`);
					}
				} else if (operation === 'editMessageText') {
					const messageType = this.getNodeParameter('messageType', i) as string;
					let chat_id;
					let message_id;
					let Text;
					if (messageType === 'inlineMessage') {
						body.inline_message_id = this.getNodeParameter('inlineMessageId', i) as string;
					} else {
						chat_id = this.getNodeParameter('chatId', i) as string;
						message_id = this.getNodeParameter('messageId', i) as number;
						// reply_markup = this.getNodeParameter('replyMarkup', i) as InlineKeyboardMarkup;
					}

					body.text = this.getNodeParameter('text', i) as string;
					Text = body.text;

					await bot.editMessageText(body.text, {
						chat_id: chat_id,
						message_id: message_id,
						reply_markup: getMarkup.call(this, i),
					});

					returnData.push({
						json: {
							Text,
							chat_id,
							message_id,
						},
						binary: {},
						pairedItem: {item: i},
					});

					// Add additional fields and replyMarkup
					// addAdditionalFields.call(this, body, i);
				} else if (operation === 'sendSticker') {
					const stickerId = this.getNodeParameter('stickerId', i) as string;
					const replyToMessageId = this.getNodeParameter('replyToMessageId', i) as number;

					const res = await bot.sendSticker(chatId, stickerId, {
						reply_to_message_id: replyToMessageId,
					});

					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'deleteMessage') {
					const messageId = this.getNodeParameter('messageId', i) as number;

					await bot.deleteMessage(chatId, messageId);

					returnData.push({
						json: {
							messageDeleted: true,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'copyMessage') {
					const fromChatId = this.getNodeParameter('fromChatId', i) as string;
					const messageId = this.getNodeParameter('messageId', i) as number;

					const res = bot.copyMessage(chatId, fromChatId, messageId);

					returnData.push({
						json: {
							messageId: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'forwardMessage') {
					const fromChatId = this.getNodeParameter('fromChatId', i) as string;
					const messageId = this.getNodeParameter('messageId', i) as number;

					const res = bot.forwardMessage(chatId, fromChatId, messageId);

					returnData.push({
						json: {
							res: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (['sendDocument', 'sendPhoto', 'sendAudio', 'sendVoice', 'sendVideo', 'sendAnimation'].includes(operation)) {
					let uploadData = undefined;
					const caption = this.getNodeParameter('caption', i) as string;

					const options = {caption: caption, reply_markup: getMarkup.call(this, i)};

					if (binaryData) {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
						const itemBinaryData = items[i].binary![binaryPropertyName];
						uploadData = itemBinaryData.fileName as string;
					} else {
						// file_id passed
						uploadData = this.getNodeParameter('fileId', 0) as string;
					}
					if (operation === 'sendDocument')
						await bot.sendDocument(chatId, uploadData, options);
					else if (operation === 'sendPhoto')
						await bot.sendPhoto(chatId, uploadData, options);
					else if (operation === 'sendAudio')
						await bot.sendAudio(chatId, uploadData, options);
					else if (operation === 'sendVoice')
						await bot.sendVoice(chatId, uploadData, options);
					else if (operation === 'sendVideo')
						await bot.sendVideo(chatId, uploadData, options);
					else if (operation === 'sendAnimation')
						await bot.sendAnimation(chatId, uploadData, options)

				} else if (operation === 'sendMediaGroup') {
					const mediaItems = this.getNodeParameter('media', i) as IDataObject;
					const replyToMessageId = this.getNodeParameter('replyToMessageId', i) as number;

					const body: any = {
						media: [],
					};
					for (const mediaItem of mediaItems.media as IDataObject[]) {
						if (mediaItem.additionalFields !== undefined) {
							Object.assign(mediaItem, mediaItem.additionalFields);
							delete mediaItem.additionalFields;
						}
						body.media.push(mediaItem);
					}

					await bot.sendMediaGroup(chatId, body.media, {
						reply_to_message_id: replyToMessageId,
					})
				} else if (operation === 'sendLocation') {
					const latitude = this.getNodeParameter('latitude', i) as number;
					const longitude = this.getNodeParameter('longitude', i) as number;
					const horizontal_accuracy = this.getNodeParameter('horizontal_accuracy', i) as number;
					const res = await bot.sendLocation(chatId, latitude, longitude, {
						horizontal_accuracy: horizontal_accuracy,
					})
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'sendContact') {
					const phone_number = this.getNodeParameter('phone_number', i) as string;
					const first_name = this.getNodeParameter('first_name', i) as string;
					const last_name = this.getNodeParameter('last_name', i) as string;
					const replyToMessageId = this.getNodeParameter('replyToMessageId', i) as number;

					const res = await sendContact(credentials.token as string, chatId, phone_number,
						first_name, last_name, replyToMessageId);
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});

				} else if (operation == "sendChatAction") {

					const action = this.getNodeParameter('action', i) as string;

					const res = await bot.sendChatAction(chatId, action as ChatAction);
					returnData.push({
						json: {
							successful: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}
			} else if (resource === 'chat') {
				const chatId = this.getNodeParameter('chatId', i) as string;
				if (operation === 'getChat') {
					const res = await bot.getChat(chatId);
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'leaveChat') {
					const res = await bot.leaveChat(chatId);
					returnData.push({
						json: {
							leaved: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'getChatMembersCount') {
					const res = await getChatMembersCount(credentials.token as string, chatId)
					returnData.push({
						json: {
							memberCount: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'banChatMember') {
					const userId = this.getNodeParameter('userId', i) as number;
					const res = await bot.banChatMember(chatId, userId);
					returnData.push({
						json: {
							banned: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'unbanChatMember') {
					const userId = this.getNodeParameter('userId', i) as number;
					const res = await bot.unbanChatMember(chatId, userId);
					returnData.push({
						json: {
							unbanned: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'setChatPhoto') {
					let uploadData = undefined;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
					// const res = await bot.setChatPhoto(chatId, uploadData, {
          //   filename: itemBinaryData.fileName || 'photo.jpg', // Explicitly set a filename
          //   contentType: 'image/jpeg', // Ensure MIME type is valid
        	// });
					const res = await setChatPhoto(credentials.token as string, chatId, uploadData)
					returnData.push({
						json: {
							set: res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}

			} else if (resource === 'payment') {
				if (operation === 'sendInvoice') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const title = this.getNodeParameter('title', i) as string;
					const description = this.getNodeParameter('description', i) as string;
					const payload = this.getNodeParameter('payload', i) as string;
					const providerToken = this.getNodeParameter('providerToken', i) as string;
					const photoUrl = this.getNodeParameter('photoUrl', i) as string;
					const replyToMessageId = this.getNodeParameter('replyToMessageId', i) as number;
					const replyMarkup = getMarkup.call(this, i);
					// Define the structure for the price item

					// Get the prices fixedCollection parameter
					const prices = this.getNodeParameter('prices', i) as IDataObject;

					// Extract priceItem array from the fixedCollection
					const priceItems = prices?.priceItem as LabeledPrice[] || [];

					// Iterate over priceItems with explicit type for 'item'
					priceItems.forEach((item: LabeledPrice) => {
						const label = item.label;
						const amount = item.amount;
						console.log(`Label: ${label}, Amount: ${amount}`);
					});

					const res = await sendInvoice(credentials.token as string, chatId, title, description, payload, providerToken, priceItems, photoUrl, replyToMessageId, replyMarkup)
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}
			} else if (resource === 'sticker') {
				if (operation === 'uploadSticker') {
					const userId = this.getNodeParameter('userId', i) as number;
					let uploadData = undefined;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
					const res = await bot.uploadStickerFile(userId, uploadData)
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				} else if (operation === 'createNewStickerSet') {
					const userId = this.getNodeParameter('userId', i) as number;
					const name = this.getNodeParameter('name', i) as string;
					const title = this.getNodeParameter('title', i) as string;

					let uploadData = undefined;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);

					const res = await createNewStickerSet(credentials.token as string, userId, name, title, uploadData)
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});

				} else if (operation === 'addStickerToSet') {
					const userId = this.getNodeParameter('userId', i) as number;
					const name = this.getNodeParameter('name', i) as string;

					let uploadData = undefined;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);

					const res = await addStickerToSet(credentials.token as string, userId, name, uploadData)
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}
			} else if (resource === 'file') {
				if (operation === 'getFile') {
					const fileId = this.getNodeParameter('fileId', 0) as string
					const res = await bot.getFile(fileId)
					returnData.push({
						json: {
							...res,
						},
						binary: {},
						pairedItem: {item: i},
					});
				}
			}
		}
		return this.prepareOutputData(returnData);
	}
}
