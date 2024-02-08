import { INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
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
						name: 'Send Video',
						value: 'sendVideo',
						description: 'Send a video',
						action: 'Send a video',
					},
					{
						name: 'Send Audio',
						value: 'sendAudio',
						description: 'Send an audio file',
						action: 'Send an audio file',
					},
				],
				default: 'sendMessage',
			},

			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendDocument', 'sendMessage', 'sendPhoto', 'sendAudio', 'sendVideo'],
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
						operation: [
							'sendDocument',
							'sendPhoto',
							'sendAudio',
							'sendVideo',
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
							'sendVideo',
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
							'sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo'
						],
						resource: ['message'],
						binaryData: [false],
					},
				},
				description:
					'Pass a file_id to send a file that exists on the Bale servers',
			},

			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
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
							'sendVideo',
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
			{
				displayName: 'Reply To Message ID',
				name: 'reply_to_message_id',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['sendDocument', 'sendMessage', 'sendPhoto', 'sendAudio', 'sendVideo'],
						resource: ['chat', 'message'],
					},
				},
				default: 0,
				description: 'If the message is a reply, ID of the original message',
			},
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

		for (let i = 0; i < items.length; i++) {
			const chatId = this.getNodeParameter('chatId', i) as string;

			if (operation === 'sendMessage') {
				const text = this.getNodeParameter('text', i) as string;

				const res = await bot.sendMessage(chatId, text, {
					reply_markup: getMarkup.call(this, i)
				});
				returnData.push({
					json: {
						...res,
					},
					binary: {},
					pairedItem: { item: i },
				});
			}

			if (['sendDocument', 'sendPhoto', 'sendAudio', 'sendVideo'].includes(operation)) {
				let fileOptions = undefined;
				let uploadData = undefined;
				const options = { reply_markup: getMarkup.call(this, i) }
				if (binaryData) {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					const itemBinaryData = items[i].binary![binaryPropertyName];
					uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
					fileOptions = { filename: itemBinaryData.fileName }
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
