import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';
import { BINARY_ENCODING, IExecuteFunctions } from 'n8n-core';
import { default as TelegramBot } from 'node-telegram-bot-api';

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
						name: 'Message',
						value: 'message',
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
						resource: ['message'],
					},
				},
				options: [
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
						name: 'Send Document',
						value: 'sendDocument',
						description: 'Send a document',
						action: 'Send a document',
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
				],
				default: 'sendMessage',
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
							'sendVideo',
							'sendSticker',
							'deleteMessage',
							'sendChatAction',
							'editMessageText',
						],
						resource: ['chat', 'message'],
					},
				},
				required: true,
				description: 'Unique identifier for the target chat',
			},

			{
				displayName: 'Binary Data',
				name: 'binaryData',
				type: 'boolean',
				default: false,
				required: true,
				displayOptions: {
					show: {
						operation: ['sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo'],
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
						operation: ['sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo', 'sendSticker'],
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
						operation: ['sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo'],
						resource: ['message'],
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
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				displayOptions: {
					show: {
						operation: [
							'sendAudio',
							'sendDocument',
							'sendPhoto',
							'sendVideo',
						],
					},
				},
				default: '',
				description: 'Caption text to set, 0-1024 characters',
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
							'sendVideo',
							'editMessageText',
						],
						resource: ['message'],
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
							'sendVideo',
							'sendSticker',
						],
						resource: ['chat', 'message'],
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
						operation: ['deleteMessage', 'editMessageText'],
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
					{
						name: 'Find Location',
						value: 'find_location',
						action: 'Find location',
					},
					{
						name: 'Record Audio',
						value: 'record_audio',
						action: 'Record audio',
					},
					{
						name: 'Record Video',
						value: 'record_video',
						action: 'Record video',
					},
					{
						name: 'Record Video Note',
						value: 'record_video_note',
						action: 'Record video note',
					},
					{
						name: 'Typing',
						value: 'typing',
						action: 'Typing a message',
					},
					{
						name: 'Upload Audio',
						value: 'upload_audio',
						action: 'Upload audio',
					},
					{
						name: 'Upload Document',
						value: 'upload_document',
						action: 'Upload document',
					},
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
					{
						name: 'Upload Video Note',
						value: 'upload_video_note',
						action: 'Upload video note',
					},
				],
				default: 'typing',
				description:
					'Type of action to broadcast. Choose one, depending on what the user is about to receive. The status is set for 5 seconds or less (when a message arrives from your bot).',
			},
			// amir nezami changes ends here \\
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0);
		const credentials = await this.getCredentials('baleMessengerApi');
		const binaryData = this.getNodeParameter('binaryData', 0, false);

		const bot = new TelegramBot(credentials.token as string, {
			baseApiUrl: 'https://tapi.bale.ai',
		});

		let body: IDataObject;

		for (let i = 0; i < items.length; i++) {
			body = {};

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
						pairedItem: { item: i },
					});

				}catch(err){

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

				bot.editMessageText(body.text, {
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
					pairedItem: { item: i },
				});

				// Add additional fields and replyMarkup
				// addAdditionalFields.call(this, body, i);
			}

			if (operation === 'sendSticker') {
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
					pairedItem: { item: i },
				});
			}

			if (operation === 'deleteMessage') {
				const messageId = this.getNodeParameter('messageId', i) as number;

				await bot.deleteMessage(chatId, messageId);

				returnData.push({
					json: {
						messageDeleted: true,
					},
					binary: {},
					pairedItem: { item: i },
				});
			}

			if (['sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo'].includes(operation)) {
				let fileOptions = undefined;
				let uploadData = undefined;
				const options = { reply_markup: getMarkup.call(this, i) };
				if (binaryData) {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
					fileOptions = { filename: itemBinaryData.fileName };
				} else {
					// file_id passed
					uploadData = this.getNodeParameter('fileId', 0) as string;
				}

				if (operation === 'sendDocument')
					await bot.sendDocument(chatId, uploadData, options, fileOptions);
				else if (operation === 'sendPhoto')
					await bot.sendPhoto(chatId, uploadData, options, fileOptions);
				else if (operation === 'sendAudio')
					await bot.sendAudio(chatId, uploadData, options, fileOptions);
				else if (operation === 'sendVideo')
					await bot.sendVideo(chatId, uploadData, options, fileOptions);
			}
		}

		return this.prepareOutputData(returnData);
	}
}
